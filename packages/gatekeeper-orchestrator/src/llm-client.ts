/**
 * Gatekeeper Orchestrator — LLM Client
 *
 * Thin wrapper around the Anthropic Messages API for steps 1, 2, and fix.
 * These steps only need text generation (no filesystem, no tools).
 *
 * Uses @anthropic-ai/sdk (the standard SDK, NOT the Agent SDK).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TokenUsage } from './types.js'

export interface LLMResponse {
  text: string
  tokensUsed: TokenUsage
  stopReason: string | null
}

export interface LLMStreamCallbacks {
  onText?: (chunk: string) => void
  onComplete?: (response: LLMResponse) => void
}

export class LLMClient {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * Send a prompt and get a complete response.
   */
  async complete(
    prompt: string,
    options: {
      model?: string
      maxTokens?: number
      system?: string
    } = {}
  ): Promise<LLMResponse> {
    const model = options.model || 'claude-sonnet-4-5-20250929'
    const maxTokens = options.maxTokens || 8192

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: options.system || this.defaultSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n')

    return {
      text,
      tokensUsed: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason,
    }
  }

  /**
   * Send a prompt with streaming, calling back on each text chunk.
   */
  async stream(
    prompt: string,
    callbacks: LLMStreamCallbacks,
    options: {
      model?: string
      maxTokens?: number
      system?: string
    } = {}
  ): Promise<LLMResponse> {
    const model = options.model || 'claude-sonnet-4-5-20250929'
    const maxTokens = options.maxTokens || 8192

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: options.system || this.defaultSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    })

    let fullText = ''

    stream.on('text', (text) => {
      fullText += text
      callbacks.onText?.(text)
    })

    const finalMessage = await stream.finalMessage()

    const response: LLMResponse = {
      text: fullText,
      tokensUsed: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
      stopReason: finalMessage.stop_reason,
    }

    callbacks.onComplete?.(response)
    return response
  }

  private defaultSystemPrompt(): string {
    return `You are a senior software engineer specialized in TDD (Test-Driven Development).

You produce artifacts inside named code blocks. Each artifact MUST be wrapped in a code block
whose opening line is the EXACT filename:

\`\`\`plan.json
{ ... }
\`\`\`

\`\`\`contract.md
# Contract
...
\`\`\`

Rules:
- ALWAYS use the exact filename as the code block label
- NEVER use generic labels like \`\`\`json or \`\`\`markdown — use the filename
- Each artifact must be a complete, self-contained file
- Respond in the same language as the task description (Portuguese or English)`
  }
}
