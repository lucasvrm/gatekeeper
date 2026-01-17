import { ChatMessage, LLMAgentConfig, LLMResponse } from '../types/elicitor.types.js'

export interface ILLMAdapter {
  readonly provider: string
  initialize(config: LLMAgentConfig): Promise<void>
  chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse>
  isReady(): boolean
  validateApiKey(): Promise<boolean>
  getModelInfo(): ModelInfo
}

export interface ModelInfo {
  provider: string
  model: string
  maxTokens: number
  contextWindow: number
  supportsStreaming: boolean
  supportsTools: boolean
}

export interface ILLMAdapterFactory {
  create(config: LLMAgentConfig): ILLMAdapter
  supports(provider: string): boolean
}
