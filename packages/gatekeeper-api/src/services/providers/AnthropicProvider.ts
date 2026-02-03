/**
 * Anthropic Provider — Claude Messages API Adapter
 *
 * Normalizes the Anthropic Messages API to the canonical LLMProvider interface.
 *
 * Key API traits:
 *  - System prompt: separate `system` parameter (not in messages)
 *  - Tool definitions: `{ name, description, input_schema }`
 *  - Tool calls: `content[].type === 'tool_use'` with `id`, `name`, `input` (object)
 *  - Tool results: `{ type: 'tool_result', tool_use_id, content, is_error }` in user message
 *  - Stop reasons: 'tool_use' | 'end_turn' | 'max_tokens'
 *  - Usage: `usage.input_tokens`, `usage.output_tokens`
 *
 * Prompt Caching:
 *  - Inserts `cache_control: { type: "ephemeral" }` breakpoints at:
 *    1. System prompt (last block)
 *    2. Last tool definition
 *    3. Second-to-last user message (captures full conversation prefix)
 *  - Cache hits are charged at 0.1x, cache writes at 1.25x
 *  - Usage reports `cache_creation_input_tokens` and `cache_read_input_tokens`
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  LLMProvider,
  LLMResponse,
  LLMMessage,
  ToolDefinition,
  ContentBlock,
  StopReason,
  ChatParams,
} from '../../types/agent.types.js'

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    const useCache = params.enableCache !== false // default ON

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: useCache
        ? this.toSystemWithCache(params.system)
        : params.system,
      messages: useCache
        ? this.toAnthropicMessagesWithCache(params.messages)
        : this.toAnthropicMessages(params.messages),
      tools: useCache
        ? this.toAnthropicToolsWithCache(params.tools)
        : this.toAnthropicTools(params.tools),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
    })

    return this.normalizeResponse(response)
  }

  // ─── System Prompt with Cache ───────────────────────────────────────────

  /**
   * Wrap the system prompt as a cacheable text block.
   * The system prompt never changes across iterations, so it's a perfect
   * cache candidate (100% hit rate after first call).
   */
  private toSystemWithCache(
    system: string,
  ): Anthropic.TextBlockParam[] {
    return [
      {
        type: 'text' as const,
        text: system,
        cache_control: { type: 'ephemeral' as const },
      },
    ]
  }

  // ─── Request Normalizers ─────────────────────────────────────────────────

  private toAnthropicMessages(
    messages: LLMMessage[],
  ): Anthropic.MessageParam[] {
    return messages.map((msg) => this.convertMessage(msg))
  }

  /**
   * Convert messages with a cache_control breakpoint on the second-to-last
   * user message. This captures the full conversation prefix:
   *
   *   [user_0] ← original prompt
   *   [asst_1] ← first response
   *   [user_1] ← tool results
   *   ...
   *   [user_n-1] ← CACHE BREAKPOINT HERE (everything above is cached)
   *   [asst_n]   ← latest assistant response (new)
   *   [user_n]   ← latest tool results (new)
   */
  private toAnthropicMessagesWithCache(
    messages: LLMMessage[],
  ): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = []

    // Find the index of the second-to-last user message
    // In the agent loop, messages alternate: [user, asst, user, asst, user]
    // The last 2 messages are [asst(new), user(new tool results)]
    // We want to cache everything before those.
    let cacheIndex = -1
    if (messages.length >= 4) {
      // Walk backward to find the second-to-last user message
      let userCount = 0
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userCount++
          if (userCount === 2) {
            cacheIndex = i
            break
          }
        }
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const converted = this.convertMessage(msg)

      if (i === cacheIndex) {
        // Add cache_control to the last block of this message
        converted.content = this.addCacheToLastBlock(
          converted.content as Anthropic.ContentBlockParam[],
        )
      }

      result.push(converted)
    }

    return result
  }

  /**
   * Add cache_control to the last content block of a message.
   */
  private addCacheToLastBlock(
    blocks: Anthropic.ContentBlockParam[],
  ): Anthropic.ContentBlockParam[] {
    if (blocks.length === 0) return blocks

    const result = [...blocks]
    const last = { ...result[result.length - 1] } as Record<string, unknown>
    last.cache_control = { type: 'ephemeral' }
    result[result.length - 1] = last as Anthropic.ContentBlockParam
    return result
  }

  private convertMessage(msg: LLMMessage): Anthropic.MessageParam {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content }],
      }
    }

    const blocks: Anthropic.ContentBlockParam[] = msg.content.map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'text' as const, text: block.text }

        case 'tool_use':
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          }

        case 'tool_result':
          return {
            type: 'tool_result' as const,
            tool_use_id: block.toolUseId,
            content: block.content,
            is_error: block.isError,
          }
      }
    })

    return { role: msg.role, content: blocks } as Anthropic.MessageParam
  }

  // ─── Tools ──────────────────────────────────────────────────────────────

  private toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required || [],
      },
    }))
  }

  /**
   * Same as toAnthropicTools but adds cache_control to the LAST tool.
   * Tools never change between iterations, so 100% cache hit after first call.
   */
  private toAnthropicToolsWithCache(tools: ToolDefinition[]): Anthropic.Tool[] {
    const result = this.toAnthropicTools(tools)

    if (result.length > 0) {
      const last = result[result.length - 1] as Record<string, unknown>
      last.cache_control = { type: 'ephemeral' }
    }

    return result
  }

  // ─── Response Normalizer ─────────────────────────────────────────────────

  private normalizeResponse(response: Anthropic.Message): LLMResponse {
    const content: ContentBlock[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        content.push({ type: 'text', text: block.text })
      } else if (block.type === 'tool_use') {
        content.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        })
      }
    }

    const stopReason: StopReason =
      response.stop_reason === 'tool_use'
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end_turn'

    // Extract cache metrics from usage
    const usage = response.usage as Record<string, number>

    return {
      content,
      stopReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
      },
    }
  }
}
