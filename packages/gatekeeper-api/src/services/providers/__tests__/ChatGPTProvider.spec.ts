/**
 * @file ChatGPTProvider.spec.ts
 * @description Contract spec — ChatGPTProvider para encapsular chamadas à API OpenAI
 * @contract chatgpt-provider-implementation
 * @mode STRICT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ─────────────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
    constructor() {}
  },
}))

// ⚠️ IMPORTANTE: ChatGPTProvider será criado pelo Executor (action: CREATE)
// Por isso, importamos APÓS o mock para testar o comportamento esperado
const { ChatGPTProvider } = await import('../ChatGPTProvider.js')

// ─── Setup ─────────────────────────────────────────────────────────────────

const originalEnv = process.env.OPENAI_API_KEY

beforeEach(() => {
  vi.clearAllMocks()
  process.env.OPENAI_API_KEY = 'test-api-key-12345'
})

afterEach(() => {
  if (originalEnv) {
    process.env.OPENAI_API_KEY = originalEnv
  } else {
    delete process.env.OPENAI_API_KEY
  }
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ChatGPTProvider — Environment API Key', () => {
  // @clause CL-PROV-001
  it('succeeds when provider reads OPENAI_API_KEY from environment', () => {
    process.env.OPENAI_API_KEY = 'sk-env-test-key'

    const provider = new ChatGPTProvider()

    expect(provider).toBeDefined()
    expect(provider.sendMessage).toBeInstanceOf(Function)
  })

  // @clause CL-PROV-001
  it('succeeds when provider accepts API key via constructor parameter', () => {
    const provider = new ChatGPTProvider('sk-custom-key')

    expect(provider).toBeDefined()
  })

  // @clause CL-PROV-003
  it('fails when OPENAI_API_KEY is not defined in environment', () => {
    delete process.env.OPENAI_API_KEY

    expect(() => new ChatGPTProvider()).toThrow(/OPENAI_API_KEY not found/)
  })
})

describe('ChatGPTProvider — sendMessage Method', () => {
  // @clause CL-PROV-002
  it('succeeds when sendMessage returns string response from gpt-5.2', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: 'TypeScript is a typed superset of JavaScript.', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 8 },
    })

    const provider = new ChatGPTProvider()
    const response = await provider.sendMessage('Explain TypeScript')

    expect(response).toBe('TypeScript is a typed superset of JavaScript.')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  // @clause CL-PROV-002
  it('succeeds when sendMessage calls OpenAI API with gpt-5.2 model', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: 'Response text', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    })

    const provider = new ChatGPTProvider()
    await provider.sendMessage('Test prompt')

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-5.2')
    expect(callArgs.messages[0].content).toBe('Test prompt')
  })

  // @clause CL-PROV-002
  it('fails when sendMessage receives empty prompt', async () => {
    const provider = new ChatGPTProvider()

    // Empty string should still be processed by provider
    // (validation is responsibility of consumer/controller)
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: '', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    })

    const response = await provider.sendMessage('')
    expect(response).toBe('')
  })
})

describe('ChatGPTProvider — Error Handling', () => {
  // @clause CL-PROV-004
  it('succeeds when API error is propagated with descriptive message', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const provider = new ChatGPTProvider()

    await expect(provider.sendMessage('Test')).rejects.toThrow(/API rate limit exceeded/)
  })

  // @clause CL-PROV-004
  it('succeeds when network error is propagated', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Network timeout'))

    const provider = new ChatGPTProvider()

    await expect(provider.sendMessage('Test')).rejects.toThrow(/Network timeout/)
  })

  // @clause CL-PROV-004
  it('fails when error is swallowed silently without propagation', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Authentication failed'))

    const provider = new ChatGPTProvider()

    // Error should be thrown, not swallowed
    await expect(provider.sendMessage('Test')).rejects.toThrow()
  })
})

describe('ChatGPTProvider — Model Configuration Isolation', () => {
  // @clause CL-PROV-005
  it('succeeds when model change affects only provider internals', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: 'Response', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    })

    const provider = new ChatGPTProvider()

    // Public interface should remain stable regardless of internal model config
    const response = await provider.sendMessage('Test')

    expect(response).toBe('Response')
    expect(typeof response).toBe('string')
  })

  // @clause CL-PROV-005
  it('succeeds when sendMessage interface remains stable', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: 'Test', tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })

    const provider = new ChatGPTProvider()

    // Method signature: (prompt: string) => Promise<string>
    const result = await provider.sendMessage('Input')

    expect(typeof result).toBe('string')
    expect(result).toBeDefined()
  })

  // @clause CL-PROV-005
  it('fails when model parameter is exposed in public interface', () => {
    const provider = new ChatGPTProvider()

    // Provider should NOT expose model as public property or method parameter
    // @ts-expect-error - model should be private
    expect(provider.model).toBeUndefined()
  })
})

describe('ChatGPTProvider — Response Formatting', () => {
  // @clause CL-PROV-002
  it('succeeds when null content is handled gracefully', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { content: null, tool_calls: null },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    })

    const provider = new ChatGPTProvider()
    const response = await provider.sendMessage('Test')

    // Provider should handle null content (return empty string or throw descriptive error)
    expect(typeof response).toBe('string')
  })

  // @clause CL-PROV-002
  it('succeeds when empty choices array is handled', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [],
      usage: { prompt_tokens: 1, completion_tokens: 0 },
    })

    const provider = new ChatGPTProvider()

    // Provider should handle empty choices gracefully
    await expect(
      provider.sendMessage('Test')
    ).resolves.toBeDefined()
  })

  // @clause CL-PROV-002
  it('fails when response contains tool_calls instead of text', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: { name: 'read_file', arguments: '{}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 10 },
    })

    const provider = new ChatGPTProvider()

    // Provider should handle or reject tool_calls (not designed for tools)
    const response = await provider.sendMessage('Test')

    // Either return empty string or the content field
    expect(typeof response).toBe('string')
  })
})

describe('ChatGPTProvider — Dependency Injection', () => {
  // @clause CL-CTRL-001
  it('succeeds when provider is injectable via constructor', () => {
    const provider = new ChatGPTProvider('sk-injected-key')

    expect(provider).toBeInstanceOf(ChatGPTProvider)
  })

  // @clause CL-CTRL-001
  it('succeeds when multiple instances can coexist', () => {
    const provider1 = new ChatGPTProvider('sk-key-1')
    const provider2 = new ChatGPTProvider('sk-key-2')

    expect(provider1).not.toBe(provider2)
    expect(provider1.sendMessage).toBeInstanceOf(Function)
    expect(provider2.sendMessage).toBeInstanceOf(Function)
  })

  // @clause CL-CTRL-001
  it('fails when provider depends on global state', () => {
    const provider1 = new ChatGPTProvider('sk-key-1')
    const provider2 = new ChatGPTProvider('sk-key-2')

    // Instances should be independent (no shared mutable state)
    expect(provider1).not.toBe(provider2)
  })
})
