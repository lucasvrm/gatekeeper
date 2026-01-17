import Anthropic from '@anthropic-ai/sdk'

import { BaseLLMAdapter } from './BaseLLMAdapter.js'
import { ModelInfo } from './ILLMAdapter.js'
import { ChatMessage, LLMProvider, LLMResponse, MessageRole } from '../types/elicitor.types.js'

export class AnthropicAdapter extends BaseLLMAdapter {
  readonly provider = LLMProvider.ANTHROPIC
  private client: Anthropic | null = null

  private static readonly MODEL_INFO: Record<string, { contextWindow: number }> = {
    'claude-opus-4-5-20250514': { contextWindow: 200000 },
    'claude-sonnet-4-20250514': { contextWindow: 200000 },
    'claude-haiku-4-5-20251001': { contextWindow: 200000 },
    'claude-3-5-sonnet-20241022': { contextWindow: 200000 },
    'claude-3-opus-20240229': { contextWindow: 200000 },
  }

  protected async doInitialize(): Promise<void> {
    const apiKey = this.getApiKey()
    this.client = new Anthropic({ apiKey })
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse> {
    this.ensureInitialized()
    if (!this.client || !this.config) {
      throw new Error('Not initialized')
    }

    const startTime = Date.now()

    const anthropicMessages = messages
      .filter((message) => message.role !== MessageRole.SYSTEM)
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      }))

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt || undefined,
      messages: anthropicMessages,
    })

    const durationMs = Date.now() - startTime
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n')

    return {
      content,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      durationMs,
      finishReason: response.stop_reason || 'unknown',
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey()
      const testClient = new Anthropic({ apiKey })
      await testClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      })
      return true
    } catch {
      return false
    }
  }

  getModelInfo(): ModelInfo {
    if (!this.config) {
      throw new Error('Not initialized')
    }

    const modelData = AnthropicAdapter.MODEL_INFO[this.config.model] || { contextWindow: 200000 }

    return {
      provider: this.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      contextWindow: modelData.contextWindow,
      supportsStreaming: true,
      supportsTools: true,
    }
  }
}
