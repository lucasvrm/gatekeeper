import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatParams, ToolDefinition } from '../../../types/agent.types.js'

// ─── Mock the Mistral SDK ──────────────────────────────────────────────────

const mockComplete = vi.fn()

vi.mock('@mistralai/mistralai', () => ({
  Mistral: class MockMistral {
    chat = { complete: mockComplete }
    constructor() {}
  },
}))

const { MistralProvider } = await import('../MistralProvider.js')

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
  model: 'mistral-large-latest',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: sampleTools,
  maxTokens: 4096,
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('MistralProvider', () => {
  let provider: InstanceType<typeof MistralProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new MistralProvider('test-api-key')
  })

  it('should have name "mistral"', () => {
    expect(provider.name).toBe('mistral')
  })

  describe('response normalization (camelCase)', () => {
    it('should normalize camelCase response fields', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Bonjour!', toolCalls: null },
          finishReason: 'stop',
        }],
        usage: { promptTokens: 10, completionTokens: 3 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toEqual([{ type: 'text', text: 'Bonjour!' }])
      expect(result.stopReason).toBe('end_turn')
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 3 })
    })

    it('should normalize camelCase toolCalls', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Reading file...',
            toolCalls: [
              {
                id: 'tc_001',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"src/main.ts"}',
                },
              },
            ],
          },
          finishReason: 'tool_calls',
        }],
        usage: { promptTokens: 20, completionTokens: 10 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.stopReason).toBe('tool_use')
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'tc_001',
        name: 'read_file',
        input: { path: 'src/main.ts' },
      })
    })
  })

  describe('tool name cache', () => {
    it('should cache tool names from responses for use in tool results', async () => {
      // First call: LLM returns a tool_use
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            toolCalls: [
              {
                id: 'tc_xyz',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"test.ts"}',
                },
              },
            ],
          },
          finishReason: 'tool_calls',
        }],
        usage: { promptTokens: 10, completionTokens: 5 },
      })

      await provider.chat(baseChatParams)

      // Second call: we send tool_result back — should include cached name
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Done!', toolCalls: null },
          finishReason: 'stop',
        }],
        usage: { promptTokens: 20, completionTokens: 3 },
      })

      await provider.chat({
        ...baseChatParams,
        messages: [
          ...baseChatParams.messages,
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'tc_xyz', name: 'read_file', input: { path: 'test.ts' } },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId: 'tc_xyz',
                content: 'file content here',
                isError: false,
              },
            ],
          },
        ],
      })

      const callArgs = mockComplete.mock.calls[1][0]
      // Find the tool result message
      const toolMsg = callArgs.messages.find(
        (m: Record<string, unknown>) => m.role === 'tool',
      )

      // Mistral requires 'name' in tool result — should come from cache
      expect(toolMsg).toBeDefined()
      expect(toolMsg.name).toBe('read_file')
      expect(toolMsg.toolCallId).toBe('tc_xyz')
    })
  })

  describe('request formatting', () => {
    it('should inject system prompt as first message', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: { content: 'ok', toolCalls: null },
          finishReason: 'stop',
        }],
        usage: { promptTokens: 1, completionTokens: 1 },
      })

      await provider.chat(baseChatParams)

      const callArgs = mockComplete.mock.calls[0][0]
      expect(callArgs.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      })
    })

    it('should pass camelCase parameters to SDK', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: { content: 'ok', toolCalls: null },
          finishReason: 'stop',
        }],
        usage: { promptTokens: 1, completionTokens: 1 },
      })

      await provider.chat(baseChatParams)

      const callArgs = mockComplete.mock.calls[0][0]
      expect(callArgs.maxTokens).toBe(4096)
      expect(callArgs.model).toBe('mistral-large-latest')
    })
  })

  describe('edge cases', () => {
    it('should handle arguments as object (not string)', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            toolCalls: [
              {
                id: 'tc_obj',
                type: 'function',
                function: {
                  name: 'read_file',
                  arguments: { path: 'direct-object.ts' }, // already parsed
                },
              },
            ],
          },
          finishReason: 'tool_calls',
        }],
        usage: { promptTokens: 5, completionTokens: 5 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'tc_obj',
        name: 'read_file',
        input: { path: 'direct-object.ts' },
      })
    })

    it('should handle empty choices', async () => {
      mockComplete.mockResolvedValueOnce({
        choices: [],
        usage: null,
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toEqual([])
      expect(result.stopReason).toBe('end_turn')
    })
  })
})
