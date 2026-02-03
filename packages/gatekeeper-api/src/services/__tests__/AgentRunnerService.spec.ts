import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { LLMProvider, LLMResponse, AgentEvent, PhaseConfig } from '../../types/agent.types.js'
import { AgentToolExecutor, READ_TOOLS, SAVE_ARTIFACT_TOOL } from '../AgentToolExecutor.js'

// Mock SDKs so LLMProviderRegistry can be imported
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: vi.fn() }; constructor() {} },
}))
vi.mock('openai', () => ({
  default: class { chat = { completions: { create: vi.fn() } }; constructor() {} },
}))
vi.mock('@mistralai/mistralai', () => ({
  Mistral: class { chat = { complete: vi.fn() }; constructor() {} },
}))

const { AgentRunnerService } = await import('../AgentRunnerService.js')
const { LLMProviderRegistry } = await import('../providers/LLMProviderRegistry.js')

// ─── Mock Provider ─────────────────────────────────────────────────────────

function createMockProvider(responses: LLMResponse[]): LLMProvider {
  let callIndex = 0
  return {
    name: 'anthropic' as const,
    chat: vi.fn(async () => {
      const response = responses[callIndex]
      if (!response) throw new Error(`No mock response for call ${callIndex}`)
      callIndex++
      return response
    }),
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AgentRunnerService', () => {
  let projectRoot: string
  let toolExecutor: AgentToolExecutor

  const defaultPhase: PhaseConfig = {
    step: 1,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    maxIterations: 10,
  }

  beforeEach(async () => {
    toolExecutor = new AgentToolExecutor()
    projectRoot = await mkdtemp(join(tmpdir(), 'agent-runner-test-'))
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(join(projectRoot, 'src', 'index.ts'), 'export const x = 1\n')
    await writeFile(join(projectRoot, 'package.json'), '{"name":"test"}\n')
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  describe('simple text response (no tools)', () => {
    it('should return text when LLM responds with end_turn', async () => {
      const mockProvider = createMockProvider([
        {
          content: [{ type: 'text', text: 'Here is my plan.' }],
          stopReason: 'end_turn',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ])

      const registry = new LLMProviderRegistry({})
      // Inject mock provider
      ;(registry as any).providers.set('anthropic', mockProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)
      const events: AgentEvent[] = []

      const result = await runner.run({
        phase: defaultPhase,
        systemPrompt: 'You are a planner.',
        userMessage: 'Plan something.',
        tools: READ_TOOLS,
        projectRoot,
        onEvent: (e) => events.push(e),
      })

      expect(result.text).toBe('Here is my plan.')
      expect(result.iterations).toBe(1)
      expect(result.provider).toBe('anthropic')
      expect(result.tokensUsed).toEqual({ inputTokens: 100, outputTokens: 50 })

      // Check events
      expect(events[0]).toEqual({
        type: 'agent:start',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        step: 1,
      })
      expect(events.some((e) => e.type === 'agent:complete')).toBe(true)
    })
  })

  describe('tool use loop', () => {
    it('should execute tools and loop back to LLM', async () => {
      const mockProvider = createMockProvider([
        // Iteration 1: LLM requests read_file
        {
          content: [
            { type: 'text', text: 'Let me read the index.' },
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'read_file',
              input: { path: 'src/index.ts' },
            },
          ],
          stopReason: 'tool_use',
          usage: { inputTokens: 50, outputTokens: 30 },
        },
        // Iteration 2: LLM responds with final text
        {
          content: [{ type: 'text', text: 'I found x = 1. Here is the plan.' }],
          stopReason: 'end_turn',
          usage: { inputTokens: 80, outputTokens: 40 },
        },
      ])

      const registry = new LLMProviderRegistry({})
      ;(registry as any).providers.set('anthropic', mockProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)
      const events: AgentEvent[] = []

      const result = await runner.run({
        phase: defaultPhase,
        systemPrompt: 'You are a planner.',
        userMessage: 'Analyze the project.',
        tools: READ_TOOLS,
        projectRoot,
        onEvent: (e) => events.push(e),
      })

      expect(result.text).toContain('x = 1')
      expect(result.iterations).toBe(2)
      expect(result.tokensUsed.inputTokens).toBe(130) // 50 + 80
      expect(result.tokensUsed.outputTokens).toBe(70) // 30 + 40

      // Should have tool events
      expect(events.some((e) => e.type === 'agent:tool_call')).toBe(true)
      expect(events.some((e) => e.type === 'agent:tool_result')).toBe(true)
    })
  })

  describe('save_artifact', () => {
    it('should capture artifacts via save_artifact tool', async () => {
      const mockProvider = createMockProvider([
        {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_art',
              name: 'save_artifact',
              input: { filename: 'plan.json', content: '{"task":"test"}' },
            },
          ],
          stopReason: 'tool_use',
          usage: { inputTokens: 30, outputTokens: 20 },
        },
        {
          content: [{ type: 'text', text: 'Plan saved.' }],
          stopReason: 'end_turn',
          usage: { inputTokens: 50, outputTokens: 10 },
        },
      ])

      const registry = new LLMProviderRegistry({})
      ;(registry as any).providers.set('anthropic', mockProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)

      await runner.run({
        phase: defaultPhase,
        systemPrompt: 'Save a plan.',
        userMessage: 'Create plan.',
        tools: [...READ_TOOLS, SAVE_ARTIFACT_TOOL],
        projectRoot,
      })

      const artifacts = toolExecutor.getArtifacts()
      expect(artifacts.get('plan.json')).toBe('{"task":"test"}')
    })
  })

  describe('max iterations', () => {
    it('should throw when max iterations exceeded', async () => {
      // Provider always requests tools (infinite loop)
      const infiniteResponses = Array.from({ length: 15 }, (_, i) => ({
        content: [
          {
            type: 'tool_use' as const,
            id: `toolu_${i}`,
            name: 'read_file',
            input: { path: 'src/index.ts' },
          },
        ],
        stopReason: 'tool_use' as const,
        usage: { inputTokens: 10, outputTokens: 10 },
      }))

      const mockProvider = createMockProvider(infiniteResponses)
      const registry = new LLMProviderRegistry({})
      ;(registry as any).providers.set('anthropic', mockProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)

      await expect(
        runner.run({
          phase: { ...defaultPhase, maxIterations: 3 },
          systemPrompt: 'Loop forever.',
          userMessage: 'Go.',
          tools: READ_TOOLS,
          projectRoot,
        }),
      ).rejects.toThrow(/max iterations/)
    })
  })

  describe('fallback', () => {
    it('should fallback to secondary provider on error', async () => {
      // Primary provider always fails
      const failingProvider: LLMProvider = {
        name: 'anthropic',
        chat: vi.fn(async () => { throw new Error('Rate limited') }),
      }

      // Fallback provider succeeds
      const fallbackProvider: LLMProvider = {
        ...createMockProvider([
          {
            content: [{ type: 'text', text: 'Fallback succeeded.' }],
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 5 },
          },
        ]),
        name: 'openai' as const,
      }

      const registry = new LLMProviderRegistry({})
      ;(registry as any).providers.set('anthropic', failingProvider)
      ;(registry as any).providers.set('openai', fallbackProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)
      const events: AgentEvent[] = []

      const result = await runner.run({
        phase: {
          ...defaultPhase,
          fallbackProvider: 'openai',
          fallbackModel: 'gpt-4.1',
        },
        systemPrompt: 'Test fallback.',
        userMessage: 'Hello.',
        tools: [],
        projectRoot,
        onEvent: (e) => events.push(e),
      })

      expect(result.text).toBe('Fallback succeeded.')
      expect(result.provider).toBe('openai')

      // Should have fallback event
      const fallbackEvent = events.find((e) => e.type === 'agent:fallback')
      expect(fallbackEvent).toBeDefined()
    })

    it('should throw if no fallback configured and primary fails', async () => {
      const failingProvider: LLMProvider = {
        name: 'anthropic',
        chat: vi.fn(async () => { throw new Error('API down') }),
      }

      const registry = new LLMProviderRegistry({})
      ;(registry as any).providers.set('anthropic', failingProvider)

      const runner = new AgentRunnerService(registry, toolExecutor)

      await expect(
        runner.run({
          phase: defaultPhase, // no fallback
          systemPrompt: 'Test.',
          userMessage: 'Hello.',
          tools: [],
          projectRoot,
        }),
      ).rejects.toThrow('API down')
    })
  })
})
