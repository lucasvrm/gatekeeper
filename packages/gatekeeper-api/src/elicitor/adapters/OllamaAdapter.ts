import { Ollama } from 'ollama'

import { BaseLLMAdapter } from './BaseLLMAdapter.js'
import { ModelInfo } from './ILLMAdapter.js'
import { ChatMessage, LLMProvider, LLMResponse } from '../types/elicitor.types.js'

export class OllamaAdapter extends BaseLLMAdapter {
  readonly provider = LLMProvider.OLLAMA
  private client: Ollama | null = null

  private static readonly MODEL_INFO: Record<string, { contextWindow: number }> = {
    'llama3.2': { contextWindow: 128000 },
  }

  protected async doInitialize(): Promise<void> {
    const host = this.config?.baseUrl || 'http://localhost:11434'
    this.client = new Ollama({ host })
    await this.client.list()
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse> {
    this.ensureInitialized()
    if (!this.client || !this.config) {
      throw new Error('Not initialized')
    }

    const startTime = Date.now()
    const ollamaMessages: Array<{ role: string; content: string }> = []

    if (systemPrompt) {
      ollamaMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const message of messages) {
      ollamaMessages.push({ role: message.role, content: message.content })
    }

    const response = await this.client.chat({
      model: this.config.model,
      messages: ollamaMessages,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    })

    const durationMs = Date.now() - startTime

    return {
      content: response.message.content,
      tokensIn: response.prompt_eval_count || 0,
      tokensOut: response.eval_count || 0,
      durationMs,
      finishReason: response.done ? 'stop' : 'unknown',
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      if (!this.config) {
        throw new Error('Not initialized')
      }

      const host = this.config.baseUrl || 'http://localhost:11434'
      const testClient = new Ollama({ host })
      const list = await testClient.list()
      const models = Array.isArray(list?.models) ? list.models : []
      const hasModel = models.some((model) => {
        if (typeof model === 'string') {
          return model === this.config?.model
        }
        const named = model as { name?: string; model?: string }
        return named.name === this.config?.model || named.model === this.config?.model
      })

      return hasModel
    } catch {
      return false
    }
  }

  getModelInfo(): ModelInfo {
    if (!this.config) {
      throw new Error('Not initialized')
    }

    const modelData = OllamaAdapter.MODEL_INFO[this.config.model] || { contextWindow: 8192 }

    return {
      provider: this.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      contextWindow: modelData.contextWindow,
      supportsStreaming: true,
      supportsTools: false,
    }
  }
}
