import { describe, it, expect } from 'vitest'
import { LLMAdapterFactory } from '../src/elicitor/adapters/LLMAdapterFactory.js'
import { AnthropicAdapter } from '../src/elicitor/adapters/AnthropicAdapter.js'
import { OpenAIAdapter } from '../src/elicitor/adapters/OpenAIAdapter.js'
import { GoogleAdapter } from '../src/elicitor/adapters/GoogleAdapter.js'
import { OllamaAdapter } from '../src/elicitor/adapters/OllamaAdapter.js'
import { LLMProvider } from '../src/elicitor/types/elicitor.types.js'

describe('LLMAdapterFactory', () => {
  const factory = LLMAdapterFactory.getInstance()

  it('creates Anthropic adapter', () => {
    const adapter = factory.create({
      id: '1',
      name: 'Claude',
      slug: 'claude',
      provider: LLMProvider.ANTHROPIC,
      model: 'claude-3-5-sonnet',
      temperature: 0.7,
      maxTokens: 1024,
      apiKey: 'test',
    })

    expect(adapter).toBeInstanceOf(AnthropicAdapter)
  })

  it('creates OpenAI adapter', () => {
    const adapter = factory.create({
      id: '1',
      name: 'GPT',
      slug: 'gpt',
      provider: LLMProvider.OPENAI,
      model: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 1024,
      apiKey: 'test',
    })

    expect(adapter).toBeInstanceOf(OpenAIAdapter)
  })

  it('creates Google adapter', () => {
    const adapter = factory.create({
      id: '1',
      name: 'Gemini',
      slug: 'gemini',
      provider: LLMProvider.GOOGLE,
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 1024,
      apiKey: 'test',
    })

    expect(adapter).toBeInstanceOf(GoogleAdapter)
  })

  it('creates Ollama adapter', () => {
    const adapter = factory.create({
      id: '1',
      name: 'Ollama',
      slug: 'ollama',
      provider: LLMProvider.OLLAMA,
      model: 'llama3',
      temperature: 0.7,
      maxTokens: 1024,
    })

    expect(adapter).toBeInstanceOf(OllamaAdapter)
  })

  it('throws for unsupported provider', () => {
    expect(() => factory.create({
      id: '1',
      name: 'Bad',
      slug: 'bad',
      provider: 'unknown' as LLMProvider,
      model: 'x',
      temperature: 0.7,
      maxTokens: 1024,
    })).toThrow('Unsupported LLM provider')
  })

  it('supports all providers', () => {
    expect(factory.supports(LLMProvider.ANTHROPIC)).toBe(true)
    expect(factory.supports(LLMProvider.OPENAI)).toBe(true)
    expect(factory.supports(LLMProvider.GOOGLE)).toBe(true)
    expect(factory.supports(LLMProvider.OLLAMA)).toBe(true)
  })
})
