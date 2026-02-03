import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatParams, ToolDefinition } from '../../../types/agent.types.js'

// ─── Mock the OpenAI SDK ───────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
    constructor() {}
  },
}))

const { OpenAIProvider } = await import('../OpenAIProvider.js')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const sampleTools: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
]

const baseChatParams: ChatParams = {
  model: 'gpt-4.1',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: sampleTools,
  maxTokens: 4096,
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('OpenAIProvider', () => {
  let provider: InstanceType<typeof OpenAIProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenAIProvider('test-api-key')
  })

  it('should have name "openai"', () => {
    expect(provider.name).toBe('openai')
  })

  describe('request formatting', () => {
    it('should inject system prompt as first message', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hi!', tool_calls: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })

      await provider.chat(baseChatParams)

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      })
      expect(callArgs.messages[1]).toEqual({
        role: 'user',
        content: 'Hello',
      })
    })

    it('should format tools with function wrapper', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'ok', tool_calls: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })

      await provider.chat(baseChatParams)

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path' },
            },
            required: ['path'],
          },
        },
      })
    })

    it('should split tool_result blocks into separate role:tool messages', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Done', tool_calls: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })

      await provider.chat({
        ...baseChatParams,
        messages: [
          { role: 'user', content: 'Read file' },
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'call_1', name: 'read_file', input: { path: 'x.ts' } },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId: 'call_1',
                content: 'file contents',
                isError: false,
              },
            ],
          },
        ],
      })

      const callArgs = mockCreate.mock.calls[0][0]
      // system + user + assistant + tool = 4 messages
      const toolMsg = callArgs.messages[3]
      expect(toolMsg).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'file contents',
      })
    })
  })

  describe('response normalization', () => {
    it('should normalize text response with stop reason', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hello!', tool_calls: null },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 3 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }])
      expect(result.stopReason).toBe('end_turn') // 'stop' → 'end_turn'
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 3 })
    })

    it('should normalize tool_calls finish reason to tool_use', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Let me read that.',
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"src/index.ts"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.stopReason).toBe('tool_use')
      expect(result.content).toHaveLength(2)
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Let me read that.',
      })
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'call_abc',
        name: 'read_file',
        input: { path: 'src/index.ts' },
      })
    })

    it('should handle malformed JSON arguments gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_bad',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: '{ broken json',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_bad',
        name: 'read_file',
        input: { _raw: '{ broken json' },
      })
    })

    it('should map length finish reason to max_tokens', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Truncated...', tool_calls: null },
          finish_reason: 'length',
        }],
        usage: { prompt_tokens: 100, completion_tokens: 4096 },
      })

      const result = await provider.chat(baseChatParams)
      expect(result.stopReason).toBe('max_tokens')
    })

    it('should handle empty choices', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
        usage: null,
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toEqual([])
      expect(result.stopReason).toBe('end_turn')
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    })
  })
})
