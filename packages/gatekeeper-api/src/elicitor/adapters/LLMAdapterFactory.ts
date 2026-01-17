import { ILLMAdapter, ILLMAdapterFactory } from './ILLMAdapter.js'
import { LLMAgentConfig, LLMProvider } from '../types/elicitor.types.js'
import { AnthropicAdapter } from './AnthropicAdapter.js'
import { OpenAIAdapter } from './OpenAIAdapter.js'
import { GoogleAdapter } from './GoogleAdapter.js'
import { OllamaAdapter } from './OllamaAdapter.js'

export class LLMAdapterFactory implements ILLMAdapterFactory {
  private static instance: LLMAdapterFactory

  static getInstance(): LLMAdapterFactory {
    if (!LLMAdapterFactory.instance) {
      LLMAdapterFactory.instance = new LLMAdapterFactory()
    }
    return LLMAdapterFactory.instance
  }

  create(config: LLMAgentConfig): ILLMAdapter {
    const provider = config.provider as LLMProvider

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        return new AnthropicAdapter()
      case LLMProvider.OPENAI:
        return new OpenAIAdapter()
      case LLMProvider.GOOGLE:
        return new GoogleAdapter()
      case LLMProvider.OLLAMA:
        return new OllamaAdapter()
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`)
    }
  }

  supports(provider: string): boolean {
    return Object.values(LLMProvider).includes(provider as LLMProvider)
  }

  getSupportedProviders(): string[] {
    return Object.values(LLMProvider)
  }
}
