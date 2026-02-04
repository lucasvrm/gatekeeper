import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockAgentRun = {
  create: vi.fn(),
  update: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  findMany: vi.fn(),
}

const mockAgentRunStep = {
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  aggregate: vi.fn(),
}

const mockPrisma = {
  agentRun: mockAgentRun,
  agentRunStep: mockAgentRunStep,
} as any

// ─── Import after mocks ─────────────────────────────────────────────────────

import { AgentRunPersistenceService } from '../../AgentRunPersistenceService.js'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AgentRunPersistenceService', () => {
  let service: AgentRunPersistenceService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AgentRunPersistenceService(mockPrisma)
  })

  // ── createRun ───────────────────────────────────────────────────────────

  describe('createRun', () => {
    it('creates a run record with status running', async () => {
      mockAgentRun.create.mockResolvedValue({ id: 'run-1' })

      const id = await service.createRun({
        taskDescription: 'Build login page',
        projectPath: '/home/user/project',
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
      })

      expect(id).toBe('run-1')
      expect(mockAgentRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskDescription: 'Build login page',
          projectPath: '/home/user/project',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
          status: 'running',
        }),
      })
    })
  })

  // ── startStep ───────────────────────────────────────────────────────────

  describe('startStep', () => {
    it('creates a step record linked to run', async () => {
      mockAgentRunStep.create.mockResolvedValue({ id: 'step-1' })

      const id = await service.startStep({
        runId: 'run-1',
        step: 1,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
      })

      expect(id).toBe('step-1')
      expect(mockAgentRunStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: 'run-1',
          step: 1,
          status: 'running',
        }),
      })
    })
  })

  // ── completeStep ────────────────────────────────────────────────────────

  describe('completeStep', () => {
    it('updates step with tokens and cost, then aggregates to run', async () => {
      mockAgentRunStep.update.mockResolvedValue({})
      mockAgentRunStep.findUnique.mockResolvedValue({ runId: 'run-1' })
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: {
          inputTokens: 5000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          estimatedCostUsd: 0.03,
        },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.completeStep({
        stepId: 'step-1',
        tokensUsed: { inputTokens: 5000, outputTokens: 1000 },
        iterations: 5,
        model: 'claude-sonnet-4-5-20250929',
      })

      // Step updated
      expect(mockAgentRunStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'completed',
          inputTokens: 5000,
          outputTokens: 1000,
          iterations: 5,
        }),
      })

      // Run totals updated via aggregate
      expect(mockAgentRunStep.aggregate).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
        _sum: expect.any(Object),
      })

      expect(mockAgentRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          totalInputTokens: 5000,
          totalOutputTokens: 1000,
        }),
      })
    })

    it('computes cost correctly for claude sonnet', async () => {
      mockAgentRunStep.update.mockResolvedValue({})
      mockAgentRunStep.findUnique.mockResolvedValue({ runId: 'run-1' })
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.completeStep({
        stepId: 'step-1',
        tokensUsed: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        iterations: 10,
        model: 'claude-sonnet-4-5-20250929',
      })

      // Claude Sonnet 4.5: $3/M input + $15/M output = $18
      const stepData = mockAgentRunStep.update.mock.calls[0][0].data
      expect(stepData.estimatedCostUsd).toBe(18)
    })

    it('computes cost correctly for gpt-4.1', async () => {
      mockAgentRunStep.update.mockResolvedValue({})
      mockAgentRunStep.findUnique.mockResolvedValue({ runId: 'run-1' })
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.completeStep({
        stepId: 'step-1',
        tokensUsed: { inputTokens: 500_000, outputTokens: 200_000 },
        iterations: 5,
        model: 'gpt-4.1',
      })

      // GPT-4.1: ($2 * 0.5) + ($8 * 0.2) = $1 + $1.6 = $2.6
      const stepData = mockAgentRunStep.update.mock.calls[0][0].data
      expect(stepData.estimatedCostUsd).toBe(2.6)
    })

    it('includes cache tokens in cost for anthropic models', async () => {
      mockAgentRunStep.update.mockResolvedValue({})
      mockAgentRunStep.findUnique.mockResolvedValue({ runId: 'run-1' })
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.completeStep({
        stepId: 'step-1',
        tokensUsed: {
          inputTokens: 100_000,
          outputTokens: 50_000,
          cacheReadTokens: 200_000,
          cacheCreationTokens: 100_000,
        },
        iterations: 3,
        model: 'claude-sonnet-4-5-20250929',
      })

      // $3*0.1 + $15*0.05 + $0.30*0.2 + $3.75*0.1 = $0.3 + $0.75 + $0.06 + $0.375 = $1.485
      const stepData = mockAgentRunStep.update.mock.calls[0][0].data
      expect(stepData.estimatedCostUsd).toBe(1.485)
    })
  })

  // ── failStep ────────────────────────────────────────────────────────────

  describe('failStep', () => {
    it('marks step as failed with error message', async () => {
      mockAgentRunStep.update.mockResolvedValue({})

      await service.failStep('step-1', 'Token budget exceeded')

      expect(mockAgentRunStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'Token budget exceeded',
        }),
      })
    })
  })

  // ── completeRun / failRun ───────────────────────────────────────────────

  describe('completeRun', () => {
    it('aggregates totals and marks run completed', async () => {
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: { inputTokens: 10000, outputTokens: 3000, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0.075 },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.completeRun('run-1')

      // Should call update twice: once for totals, once for status
      expect(mockAgentRun.update).toHaveBeenCalledTimes(2)

      const statusCall = mockAgentRun.update.mock.calls[1][0]
      expect(statusCall.data.status).toBe('completed')
      expect(statusCall.data.completedAt).toBeInstanceOf(Date)
    })
  })

  describe('failRun', () => {
    it('aggregates totals and marks run failed', async () => {
      mockAgentRunStep.aggregate.mockResolvedValue({
        _sum: { inputTokens: 5000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0.03 },
      })
      mockAgentRun.update.mockResolvedValue({})

      await service.failRun('run-1', 'Pipeline crashed')

      const statusCall = mockAgentRun.update.mock.calls[1][0]
      expect(statusCall.data.status).toBe('failed')
      expect(statusCall.data.error).toBe('Pipeline crashed')
    })
  })

  // ── getCostStats ────────────────────────────────────────────────────────

  describe('getCostStats', () => {
    it('returns run + step stats with duration', async () => {
      const now = new Date()
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

      mockAgentRun.findUniqueOrThrow.mockResolvedValue({
        id: 'run-1',
        status: 'completed',
        totalInputTokens: 15000,
        totalOutputTokens: 4000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0.105,
        startedAt: fiveMinAgo,
        completedAt: now,
        steps: [
          {
            step: 1,
            status: 'completed',
            inputTokens: 5000,
            outputTokens: 1000,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            estimatedCostUsd: 0.03,
            iterations: 5,
            startedAt: fiveMinAgo,
            completedAt: new Date(fiveMinAgo.getTime() + 60_000),
          },
        ],
      })

      const stats = await service.getCostStats('run-1')

      expect(stats.run.durationMs).toBe(5 * 60 * 1000)
      expect(stats.steps).toHaveLength(1)
      expect(stats.steps[0].durationMs).toBe(60_000)
    })
  })

  // ── listRuns ────────────────────────────────────────────────────────────

  describe('listRuns', () => {
    it('returns recent runs with default limit', async () => {
      mockAgentRun.findMany.mockResolvedValue([
        { id: 'run-1', taskDescription: 'Test', status: 'completed' },
      ])

      const runs = await service.listRuns()

      expect(mockAgentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          orderBy: { startedAt: 'desc' },
        }),
      )
      expect(runs).toHaveLength(1)
    })

    it('filters by status when provided', async () => {
      mockAgentRun.findMany.mockResolvedValue([])

      await service.listRuns({ status: 'failed', limit: 5 })

      expect(mockAgentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'failed' },
          take: 5,
        }),
      )
    })
  })
})
