import OpenAI from 'openai'

import { BaseLLMAdapter } from './BaseLLMAdapter.js'
import { ModelInfo } from './ILLMAdapter.js'
import { ChatMessage, LLMProvider, LLMResponse, MessageRole } from '../types/elicitor.types.js'

export class OpenAIAdapter extends BaseLLMAdapter {
  readonly provider = LLMProvider.OPENAI
  private client: OpenAI | null = null

  private static readonly MODEL_INFO: Record<string, { contextWindow: number }> = {
    'gpt-4-turbo': { contextWindow: 128000 },
    'gpt-4o': { contextWindow: 128000 },
    'gpt-4': { contextWindow: 8192 },
    'gpt-3.5-turbo': { contextWindow: 16385 },
  }

  protected async doInitialize(): Promise<void> {
    const apiKey = this.getApiKey()
    this.client = new OpenAI({ apiKey })
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse> {
    this.ensureInitialized()
    if (!this.client || !this.config) {
      throw new Error('Not initialized')
    }

    const startTime = Date.now()
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const message of messages) {
      if (message.role === MessageRole.SYSTEM && !systemPrompt) {
        openaiMessages.push({ role: 'system', content: message.content })
      } else if (message.role === MessageRole.USER) {
        openaiMessages.push({ role: 'user', content: message.content })
      } else if (message.role === MessageRole.ASSISTANT) {
        openaiMessages.push({ role: 'assistant', content: message.content })
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: openaiMessages,
    })

    const durationMs = Date.now() - startTime
    const choice = response.choices[0]

    return {
      content: choice.message.content || '',
      tokensIn: response.usage?.prompt_tokens || 0,
      tokensOut: response.usage?.completion_tokens || 0,
      durationMs,
      finishReason: choice.finish_reason || 'unknown',
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey()
      const testClient = new OpenAI({ apiKey })
      await testClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 5,
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

    const modelData = OpenAIAdapter.MODEL_INFO[this.config.model] || { contextWindow: 128000 }

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
