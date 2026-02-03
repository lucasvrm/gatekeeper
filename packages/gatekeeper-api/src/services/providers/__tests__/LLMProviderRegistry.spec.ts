import { describe, it, expect, vi } from 'vitest'

// Mock all provider SDKs
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: vi.fn() }; constructor() {} },
}))
vi.mock('openai', () => ({
  default: class { chat = { completions: { create: vi.fn() } }; constructor() {} },
}))
vi.mock('@mistralai/mistralai', () => ({
  Mistral: class { chat = { complete: vi.fn() }; constructor() {} },
}))

const { LLMProviderRegistry } = await import('../LLMProviderRegistry.js')

describe('LLMProviderRegistry', () => {
  it('should register providers with valid API keys', () => {
    const registry = new LLMProviderRegistry({
      anthropic: { apiKey: 'sk-ant-test' },
      openai: { apiKey: 'sk-openai-test' },
    })

    expect(registry.has('anthropic')).toBe(true)
    expect(registry.has('openai')).toBe(true)
    expect(registry.has('mistral')).toBe(false)
    expect(registry.available()).toEqual(['anthropic', 'openai'])
  })

  it('should not register providers without API keys', () => {
    const registry = new LLMProviderRegistry({})

    expect(registry.available()).toEqual([])
    expect(registry.has('anthropic')).toBe(false)
  })

  it('should return correct provider instance', () => {
    const registry = new LLMProviderRegistry({
      anthropic: { apiKey: 'sk-test' },
    })

    const provider = registry.get('anthropic')
    expect(provider.name).toBe('anthropic')
  })

  it('should throw on unconfigured provider', () => {
    const registry = new LLMProviderRegistry({
      anthropic: { apiKey: 'sk-test' },
    })

    expect(() => registry.get('openai')).toThrow(/not configured/)
    expect(() => registry.get('openai')).toThrow(/Available providers: anthropic/)
  })

  it('should throw with helpful message when no providers configured', () => {
    const registry = new LLMProviderRegistry({})

    expect(() => registry.get('anthropic')).toThrow(/No providers configured/)
  })

  it('should register all three providers', () => {
    const registry = new LLMProviderRegistry({
      anthropic: { apiKey: 'sk-1' },
      openai: { apiKey: 'sk-2' },
      mistral: { apiKey: 'sk-3' },
    })

    expect(registry.available()).toEqual(['anthropic', 'openai', 'mistral'])
    expect(registry.get('anthropic').name).toBe('anthropic')
    expect(registry.get('openai').name).toBe('openai')
    expect(registry.get('mistral').name).toBe('mistral')
  })

  describe('fromEnv', () => {
    it('should create registry from environment variables', () => {
      const registry = LLMProviderRegistry.fromEnv({
        ANTHROPIC_API_KEY: 'sk-ant',
        OPENAI_API_KEY: 'sk-oai',
      } as unknown as NodeJS.ProcessEnv)

      expect(registry.has('anthropic')).toBe(true)
      expect(registry.has('openai')).toBe(true)
      expect(registry.has('mistral')).toBe(false)
    })

    it('should skip providers with missing env vars', () => {
      const registry = LLMProviderRegistry.fromEnv({} as unknown as NodeJS.ProcessEnv)
      expect(registry.available()).toEqual([])
    })
  })
})
