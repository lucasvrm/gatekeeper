/**
 * Mistral Provider — Mistral Chat API Adapter
 *
 * Normalizes the Mistral AI API to the canonical LLMProvider interface.
 *
 * Key API traits:
 *  - Format is OpenAI-compatible with camelCase naming
 *  - System prompt: `{ role: 'system', content }` in messages array
 *  - Tool definitions: `{ type: 'function', function: { name, description, parameters } }`
 *  - Tool calls: `message.toolCalls[]` (camelCase, not snake_case like OpenAI)
 *  - Tool results: `{ role: 'tool', toolCallId, name, content }` — requires `name`
 *  - Stop reasons: `finishReason: 'tool_calls' | 'stop' | 'length'` (camelCase)
 *  - Usage: `usage.promptTokens`, `usage.completionTokens` (camelCase)
 *
 * Gotcha: Mistral requires the tool `name` in tool result messages.
 * Our canonical format doesn't include it, so we cache tool_call_id → name
 * as we process responses.
 */

import { Mistral } from '@mistralai/mistralai'
import type {
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  UserMessage,
} from '@mistralai/mistralai/models/components/index.js'
import type {
  LLMProvider,
  LLMResponse,
  LLMMessage,
  ToolDefinition,
  ContentBlock,
  StopReason,
  ChatParams,
  ToolUseBlock,
  TextBlock,
  ToolResultBlock,
} from '../../types/agent.types.js'

// Mistral SDK message union type
type MistralMessage =
  | (SystemMessage & { role: 'system' })
  | (AssistantMessage & { role: 'assistant' })
  | (ToolMessage & { role: 'tool' })
  | (UserMessage & { role: 'user' })

export class MistralProvider implements LLMProvider {
  readonly name = 'mistral' as const
  private client: Mistral

  /**
   * Cache: tool_call_id → tool_name.
   * Mistral requires `name` in tool result messages, but our canonical
   * ToolResultBlock only has `toolUseId`. We populate this cache when
   * processing each LLM response that contains tool calls.
   */
  private toolCallNames = new Map<string, string>()

  constructor(apiKey: string) {
    this.client = new Mistral({ apiKey })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const response = await this.client.chat.complete({
      model: params.model,
      maxTokens: params.maxTokens,
      messages: this.toMistralMessages(params.system, params.messages),
      tools: params.tools.length > 0 ? this.toMistralTools(params.tools) : undefined,
      toolChoice: params.tools.length > 0 ? 'auto' : undefined,
      ...(params.temperature !== undefined && { temperature: params.temperature }),
    })

    return this.normalizeResponse(response)
  }

  // ─── Request Normalizers ─────────────────────────────────────────────────

  private toMistralMessages(
    system: string,
    messages: LLMMessage[],
  ): MistralMessage[] {
    const result: MistralMessage[] = [
      { role: 'system', content: system } as MistralMessage,
    ]

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content } as MistralMessage)
        continue
      }

      // Assistant messages: extract text + toolCalls
      if (msg.role === 'assistant') {
        const textParts = msg.content
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')

        const toolCalls = msg.content
          .filter((b): b is ToolUseBlock => b.type === 'tool_use')
          .map((b) => ({
            id: b.id,
            type: 'function' as const,
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input),
            },
          }))

        const assistantMsg: Record<string, unknown> = {
          role: 'assistant',
          content: textParts || '',
        }

        if (toolCalls.length > 0) {
          assistantMsg.toolCalls = toolCalls
        }

        result.push(assistantMsg as MistralMessage)
        continue
      }

      // User messages: split tool_results (→ role: 'tool') from text
      const toolResults = msg.content.filter(
        (b): b is ToolResultBlock => b.type === 'tool_result',
      )
      const textBlocks = msg.content.filter(
        (b): b is TextBlock => b.type === 'text',
      )

      // Tool results → role: 'tool' with name (from cache)
      for (const tr of toolResults) {
        result.push({
          role: 'tool',
          toolCallId: tr.toolUseId,
          name: this.toolCallNames.get(tr.toolUseId) ?? 'unknown',
          content: tr.isError ? `Error: ${tr.content}` : tr.content,
        } as MistralMessage)
      }

      // Text blocks → role: 'user'
      if (textBlocks.length > 0) {
        result.push({
          role: 'user',
          content: textBlocks.map((b) => b.text).join('\n'),
        } as MistralMessage)
      }
    }

    return result
  }

  private toMistralTools(tools: ToolDefinition[]) {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || [],
        },
      },
    }))
  }

  // ─── Response Normalizer ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private normalizeResponse(response: any): LLMResponse {
    const choice = response?.choices?.[0]
    if (!choice) {
      return {
        content: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }

    const content: ContentBlock[] = []

    // Text content
    if (choice.message?.content) {
      content.push({ type: 'text', text: choice.message.content })
    }

    // Tool calls (camelCase in Mistral)
    if (choice.message?.toolCalls) {
      for (const tc of choice.message.toolCalls) {
        let input: Record<string, unknown> = {}
        try {
          input =
            typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments
        } catch {
          input = { _raw: tc.function.arguments }
        }

        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        })

        // Cache name so we can include it in tool result messages
        this.toolCallNames.set(tc.id, tc.function.name)
      }
    }

    // Normalize finishReason (camelCase) to canonical StopReason
    const stopReason: StopReason =
      choice.finishReason === 'tool_calls'
        ? 'tool_use'
        : choice.finishReason === 'length'
          ? 'max_tokens'
          : 'end_turn'

    return {
      content,
      stopReason,
      usage: {
        inputTokens: response.usage?.promptTokens ?? 0,
        outputTokens: response.usage?.completionTokens ?? 0,
      },
    }
  }
}
