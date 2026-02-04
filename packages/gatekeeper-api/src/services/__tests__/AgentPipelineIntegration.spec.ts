import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { LLMProvider, LLMResponse, AgentResult, PhaseConfig } from '../../types/agent.types.js'
import { AgentToolExecutor, READ_TOOLS, WRITE_TOOLS, SAVE_ARTIFACT_TOOL } from '../AgentToolExecutor.js'

// Mock SDKs
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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function endTurnResponse(text: string, tokens = { inputTokens: 1000, outputTokens: 500 }): LLMResponse {
  return {
    content: [{ type: 'text', text }],
    stopReason: 'end_turn',
    usage: tokens,
  }
}

function toolCallResponse(toolName: string, input: Record<string, unknown>): LLMResponse {
  return {
    content: [{ type: 'tool_use', id: 'tool-1', name: toolName, input }],
    stopReason: 'tool_use',
    usage: { inputTokens: 800, outputTokens: 200 },
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Pipeline Integration', () => {
  let projectRoot: string
  let toolExecutor: AgentToolExecutor

  const makePhase = (step: number, overrides?: Partial<PhaseConfig>): PhaseConfig => ({
    step,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    maxIterations: 10,
    maxInputTokensBudget: 0,
    ...overrides,
  })

  beforeEach(async () => {
    toolExecutor = new AgentToolExecutor()
    projectRoot = await mkdtemp(join(tmpdir(), 'pipeline-int-'))
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(join(projectRoot, 'src', 'index.ts'), 'export const x = 1\n')
    await writeFile(join(projectRoot, 'package.json'), '{"name":"test"}\n')
  })

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })

  // ── Step 3 user message ─────────────────────────────────────────────────

  describe('Step 3 in pipeline', () => {
    it('runs step 3 with correct user message containing artifacts', async () => {
      const provider = createMockProvider([
        // Step 1 (planner): save artifact then end
        toolCallResponse('save_artifact', { name: 'plan.json', content: '{"task":"test"}' }),
        endTurnResponse('Plan complete'),
        // Step 3 (fixer): end with fix
        endTurnResponse('Fixed the plan artifacts'),
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const systemPrompts = new Map([
        [1, 'You are a planner'],
        [3, 'You are a fixer'],
      ])

      const result = await runner.runPipeline({
        phases: [makePhase(1), makePhase(3)],
        systemPrompts,
        taskDescription: 'Build feature X',
        projectRoot,
        readTools: READ_TOOLS,
        writeTools: WRITE_TOOLS,
        saveArtifactTool: SAVE_ARTIFACT_TOOL,
      })

      expect(result.phaseResults).toHaveLength(2)

      // Verify step 3 received artifacts in user message
      const step3Call = provider.chat.mock.calls[2] // 3rd call = step 3
      const step3Messages = step3Call[0].messages
      const userMsg = step3Messages[0].content as string
      expect(userMsg).toContain('plan.json')
      expect(userMsg).toContain('fix any issues')
    })

    it('includes step 3 in 4-phase pipeline: 1 → 2 → 3 → 4', async () => {
      const provider = createMockProvider([
        endTurnResponse('Plan ready'),     // Step 1
        endTurnResponse('Spec written'),   // Step 2
        endTurnResponse('Artifacts fixed'), // Step 3
        endTurnResponse('Code complete'),  // Step 4
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const systemPrompts = new Map([
        [1, 'Planner'],
        [2, 'Spec Writer'],
        [3, 'Fixer'],
        [4, 'Coder'],
      ])

      const result = await runner.runPipeline({
        phases: [makePhase(1), makePhase(2), makePhase(3), makePhase(4)],
        systemPrompts,
        taskDescription: 'Build login',
        projectRoot,
        readTools: READ_TOOLS,
        writeTools: WRITE_TOOLS,
        saveArtifactTool: SAVE_ARTIFACT_TOOL,
      })

      expect(result.phaseResults).toHaveLength(4)
      expect(result.totalTokens.inputTokens).toBe(4000) // 1000 * 4
      expect(result.totalTokens.outputTokens).toBe(2000) // 500 * 4
    })
  })

  // ── Persistence callbacks ───────────────────────────────────────────────

  describe('Persistence callbacks', () => {
    it('calls onStepStart and onStepComplete for each phase', async () => {
      const provider = createMockProvider([
        endTurnResponse('Phase 1 done'),
        endTurnResponse('Phase 2 done'),
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const systemPrompts = new Map([
        [1, 'Planner'],
        [2, 'Spec Writer'],
      ])

      const onStepStart = vi.fn().mockResolvedValueOnce('step-id-1').mockResolvedValueOnce('step-id-2')
      const onStepComplete = vi.fn().mockResolvedValue(undefined)
      const onStepFail = vi.fn().mockResolvedValue(undefined)

      await runner.runPipeline({
        phases: [makePhase(1), makePhase(2)],
        systemPrompts,
        taskDescription: 'Build feature',
        projectRoot,
        readTools: READ_TOOLS,
        writeTools: WRITE_TOOLS,
        saveArtifactTool: SAVE_ARTIFACT_TOOL,
        onStepStart,
        onStepComplete,
        onStepFail,
      })

      expect(onStepStart).toHaveBeenCalledTimes(2)
      expect(onStepStart).toHaveBeenCalledWith(1, expect.objectContaining({ step: 1 }))
      expect(onStepStart).toHaveBeenCalledWith(2, expect.objectContaining({ step: 2 }))

      expect(onStepComplete).toHaveBeenCalledTimes(2)
      expect(onStepComplete).toHaveBeenCalledWith('step-id-1', expect.objectContaining({ text: 'Phase 1 done' }))
      expect(onStepComplete).toHaveBeenCalledWith('step-id-2', expect.objectContaining({ text: 'Phase 2 done' }))

      expect(onStepFail).not.toHaveBeenCalled()
    })

    it('calls onStepFail when a phase errors', async () => {
      const provider = createMockProvider([])
      // Override chat to always fail
      provider.chat = vi.fn().mockRejectedValue(new Error('API timeout'))

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const systemPrompts = new Map([[1, 'Planner']])

      const onStepStart = vi.fn().mockResolvedValue('step-fail-1')
      const onStepComplete = vi.fn()
      const onStepFail = vi.fn().mockResolvedValue(undefined)

      await expect(
        runner.runPipeline({
          phases: [makePhase(1)],
          systemPrompts,
          taskDescription: 'Build feature',
          projectRoot,
          readTools: READ_TOOLS,
          writeTools: WRITE_TOOLS,
          saveArtifactTool: SAVE_ARTIFACT_TOOL,
          onStepStart,
          onStepComplete,
          onStepFail,
        }),
      ).rejects.toThrow('API timeout')

      expect(onStepFail).toHaveBeenCalledWith('step-fail-1', 'API timeout')
      expect(onStepComplete).not.toHaveBeenCalled()
    })
  })

  // ── Token Budget ────────────────────────────────────────────────────────

  describe('Token budget guardrail', () => {
    it('emits budget_warning at 80%', async () => {
      const provider = createMockProvider([
        // First call uses 85% of budget
        {
          content: [{ type: 'tool_use', id: 't1', name: 'list_directory', input: { path: '.' } }],
          stopReason: 'tool_use' as const,
          usage: { inputTokens: 8500, outputTokens: 500 }, // 8500/10000 = 85%
        },
        endTurnResponse('Done', { inputTokens: 500, outputTokens: 200 }),
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const events: any[] = []
      const onEvent = (e: any) => events.push(e)

      await runner.run({
        phase: makePhase(1, { maxInputTokensBudget: 10_000 }),
        systemPrompt: 'Planner',
        userMessage: 'Plan task',
        tools: READ_TOOLS,
        projectRoot,
        onEvent,
      })

      const warnings = events.filter((e) => e.type === 'agent:budget_warning')
      expect(warnings.length).toBeGreaterThanOrEqual(1)
      expect(warnings[0].percentUsed).toBe(85)
    })

    it('throws on budget exceeded', async () => {
      const provider = createMockProvider([
        {
          content: [{ type: 'tool_use', id: 't1', name: 'list_directory', input: { path: '.' } }],
          stopReason: 'tool_use' as const,
          usage: { inputTokens: 11_000, outputTokens: 500 }, // Over 10k budget
        },
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      await expect(
        runner.run({
          phase: makePhase(1, { maxInputTokensBudget: 10_000 }),
          systemPrompt: 'Planner',
          userMessage: 'Plan task',
          tools: READ_TOOLS,
          projectRoot,
        }),
      ).rejects.toThrow('Token budget exceeded')
    })

    it('no budget check when maxInputTokensBudget is 0', async () => {
      const provider = createMockProvider([
        endTurnResponse('Done', { inputTokens: 999_999, outputTokens: 500 }),
      ])

      const registry = new LLMProviderRegistry()
      registry.register(provider)
      const runner = new AgentRunnerService(registry, toolExecutor)

      const events: any[] = []

      // Should complete without issues — budget=0 means unlimited
      const result = await runner.run({
        phase: makePhase(1, { maxInputTokensBudget: 0 }),
        systemPrompt: 'Planner',
        userMessage: 'Plan task',
        tools: READ_TOOLS,
        projectRoot,
        onEvent: (e) => events.push(e),
      })

      expect(result.text).toBe('Done')
      const budgetEvents = events.filter((e) => e.type?.includes('budget'))
      expect(budgetEvents).toHaveLength(0)
    })
  })
})
