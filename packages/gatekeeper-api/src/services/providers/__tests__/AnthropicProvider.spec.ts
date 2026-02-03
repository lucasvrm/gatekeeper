import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatParams, ToolDefinition } from '../../../types/agent.types.js'

// ─── Mock the Anthropic SDK ────────────────────────────────────────────────

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
    constructor() {}
  },
}))

// Import AFTER mock is set up
const { AnthropicProvider } = await import('../AnthropicProvider.js')

// ─── Test Fixtures ─────────────────────────────────────────────────────────

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
  model: 'claude-sonnet-4-5-20250929',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: sampleTools,
  maxTokens: 4096,
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AnthropicProvider', () => {
  let provider: InstanceType<typeof AnthropicProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new AnthropicProvider('test-api-key')
  })

  it('should have name "anthropic"', () => {
    expect(provider.name).toBe('anthropic')
  })

  describe('text response normalization', () => {
    it('should normalize a simple text response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello back!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toEqual([
        { type: 'text', text: 'Hello back!' },
      ])
      expect(result.stopReason).toBe('end_turn')
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
    })

    it('should map max_tokens stop reason', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Truncated...' }],
        stop_reason: 'max_tokens',
        usage: { input_tokens: 100, output_tokens: 4096 },
      })

      const result = await provider.chat(baseChatParams)
      expect(result.stopReason).toBe('max_tokens')
    })
  })

  describe('tool use normalization', () => {
    it('should normalize tool_use response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Let me read that file.' },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'read_file',
            input: { path: 'src/index.ts' },
          },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 50, output_tokens: 30 },
      })

      const result = await provider.chat(baseChatParams)

      expect(result.content).toHaveLength(2)
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Let me read that file.',
      })
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'toolu_123',
        name: 'read_file',
        input: { path: 'src/index.ts' },
      })
      expect(result.stopReason).toBe('tool_use')
    })
  })

  describe('request formatting', () => {
    it('should pass system prompt as top-level parameter', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      })

      await provider.chat(baseChatParams)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant.',
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
        }),
      )
    })

    it('should format tools with input_schema', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      })

      await provider.chat(baseChatParams)

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.tools[0]).toEqual({
        name: 'read_file',
        description: 'Read a file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      })
    })

    it('should include temperature when provided', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      })

      await provider.chat({ ...baseChatParams, temperature: 0.5 })

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5 }),
      )
    })

    it('should format tool_result blocks in user messages', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Got it.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      })

      await provider.chat({
        ...baseChatParams,
        messages: [
          { role: 'user', content: 'Read this file' },
          {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 'toolu_1', name: 'read_file', input: { path: 'x.ts' } },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                toolUseId: 'toolu_1',
                content: 'file contents here',
                isError: false,
              },
            ],
          },
        ],
      })

      const callArgs = mockCreate.mock.calls[0][0]
      const lastMsg = callArgs.messages[2]

      // Anthropic format: tool_result in user message content array
      expect(lastMsg.role).toBe('user')
      expect(lastMsg.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: 'file contents here',
        is_error: false,
      })
    })
  })
})
