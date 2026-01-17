import { ILLMAdapter, ModelInfo } from './ILLMAdapter.js'
import { ChatMessage, LLMAgentConfig, LLMProvider, LLMResponse } from '../types/elicitor.types.js'

export abstract class BaseLLMAdapter implements ILLMAdapter {
  protected config: LLMAgentConfig | null = null
  protected initialized = false

  abstract readonly provider: LLMProvider

  async initialize(config: LLMAgentConfig): Promise<void> {
    this.config = config
    await this.doInitialize()
    this.initialized = true
  }

  protected abstract doInitialize(): Promise<void>

  abstract chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse>

  abstract validateApiKey(): Promise<boolean>

  abstract getModelInfo(): ModelInfo

  isReady(): boolean {
    return this.initialized && this.config !== null
  }

  protected getApiKey(): string {
    if (!this.config) {
      throw new Error('Adapter not initialized')
    }

    if (this.config.apiKey) {
      return this.config.apiKey
    }

    if (this.config.apiKeyEnvVar) {
      const envKey = process.env[this.config.apiKeyEnvVar]
      if (envKey) {
        return envKey
      }
    }

    throw new Error(`No API key configured for ${this.provider}`)
  }

  protected ensureInitialized(): void {
    if (!this.isReady()) {
      throw new Error(`${this.provider} adapter not initialized`)
    }
  }
}
