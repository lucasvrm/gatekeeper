/**
 * OpenAI Provider — Chat Completions API Adapter
 *
 * Normalizes the OpenAI Chat Completions API to the canonical LLMProvider interface.
 *
 * Key API traits:
 *  - System prompt: `{ role: 'system', content }` in messages array
 *  - Tool definitions: `{ type: 'function', function: { name, description, parameters } }`
 *  - Tool calls: `message.tool_calls[]` with `{ id, function: { name, arguments } }` (JSON string)
 *  - Tool results: `{ role: 'tool', tool_call_id, content }` — dedicated role
 *  - Stop reasons: 'tool_calls' | 'stop' | 'length'
 *  - Usage: `usage.prompt_tokens`, `usage.completion_tokens`
 *
 * Major differences from Anthropic:
 *  1. System prompt goes IN the messages array, not as a separate parameter
 *  2. Tool call arguments are JSON STRINGS, not parsed objects
 *  3. Tool results use `role: 'tool'` instead of being embedded in `role: 'user'`
 *  4. Supports `strict: true` for structured output enforcement
 */

import OpenAI from 'openai'
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

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: this.toOpenAIMessages(params.system, params.messages),
      tools: params.tools.length > 0 ? this.toOpenAITools(params.tools) : undefined,
      tool_choice: params.tools.length > 0 ? 'auto' : undefined,
      ...(params.temperature !== undefined && { temperature: params.temperature }),
    })

    return this.normalizeResponse(response)
  }

  // ─── Request Normalizers ─────────────────────────────────────────────────

  private toOpenAIMessages(
    system: string,
    messages: LLMMessage[],
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
    ]

    for (const msg of messages) {
      // Simple string content
      if (typeof msg.content === 'string') {
        result.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
        continue
      }

      // Assistant messages: extract text + tool_calls
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

        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: textParts || null,
        }

        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls
        }

        result.push(assistantMsg)
        continue
      }

      // User messages: split tool_results (→ role: 'tool') from text
      const toolResults = msg.content.filter(
        (b): b is ToolResultBlock => b.type === 'tool_result',
      )
      const textBlocks = msg.content.filter(
        (b): b is TextBlock => b.type === 'text',
      )

      // Tool results become individual 'tool' role messages
      for (const tr of toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: tr.toolUseId,
          content: tr.isError ? `Error: ${tr.content}` : tr.content,
        })
      }

      // Text blocks stay as 'user' role
      if (textBlocks.length > 0) {
        result.push({
          role: 'user',
          content: textBlocks.map((b) => b.text).join('\n'),
        })
      }
    }

    return result
  }

  private toOpenAITools(
    tools: ToolDefinition[],
  ): OpenAI.ChatCompletionTool[] {
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

  private normalizeResponse(response: OpenAI.ChatCompletion): LLMResponse {
    const choice = response.choices[0]
    if (!choice) {
      return {
        content: [],
        stopReason: 'end_turn',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }

    const content: ContentBlock[] = []

    // Text content
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content })
    }

    // Tool calls (arguments come as JSON string → parse)
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        // SDK v6+ has a union: function tool calls have type 'function' with a function property;
        // custom tool calls don't. We only handle function tool calls.
        if (tc.type !== 'function' || !('function' in tc)) continue

        const fn = tc.function
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(fn.arguments)
        } catch (err) {
          input = { _raw: fn.arguments }
        }

        content.push({
          type: 'tool_use',
          id: tc.id,
          name: fn.name,
          input,
        })
      }
    }

    // Normalize finish_reason to canonical StopReason
    const stopReason: StopReason =
      choice.finish_reason === 'tool_calls'
        ? 'tool_use'
        : choice.finish_reason === 'length'
          ? 'max_tokens'
          : 'end_turn'

    return {
      content,
      stopReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    }
  }
}
