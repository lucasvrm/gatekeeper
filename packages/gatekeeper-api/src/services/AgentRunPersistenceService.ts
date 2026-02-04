/**
 * Agent Run Persistence Service
 *
 * Tracks agent pipeline runs across their lifecycle:
 *   createRun → startStep → completeStep (per step) → completeRun | failRun
 *
 * Stores token usage, cost estimates, and timing data for observability.
 *
 * Cost model (approximate, per 1M tokens):
 *   Anthropic Claude Sonnet 4.5: $3 input, $15 output, $0.30 cache read, $3.75 cache write
 *   OpenAI GPT-4.1:              $2 input, $8 output
 *   Mistral Large:               $2 input, $6 output
 */

import type { PrismaClient } from '@prisma/client'
import type { TokenUsage } from '../types/agent.types.js'

// ─── Cost Tables (per 1M tokens) ─────────────────────────────────────────────

interface CostRate {
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
}

const COST_RATES: Record<string, CostRate> = {
  // Anthropic
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 },
  'claude-opus-4-5-20251101': { input: 15, output: 75, cacheRead: 1.50, cacheWrite: 18.75 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4, cacheRead: 0.08, cacheWrite: 1 },
  // OpenAI
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  // Mistral
  'mistral-large-latest': { input: 2, output: 6 },
}

// Default fallback rate
const DEFAULT_RATE: CostRate = { input: 3, output: 15 }

// ─── Service ──────────────────────────────────────────────────────────────────

export class AgentRunPersistenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new pipeline run record.
   */
  async createRun(params: {
    taskDescription: string
    projectPath: string
    provider: string
    model: string
    outputId?: string
  }): Promise<string> {
    const run = await this.prisma.agentRun.create({
      data: {
        taskDescription: params.taskDescription,
        projectPath: params.projectPath,
        provider: params.provider,
        model: params.model,
        outputId: params.outputId || null,
        status: 'running',
      },
    })
    return run.id
  }


  /**
   * Resume a previously failed run (reset status to running).
   */
  async resumeRun(runId: string): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        error: null,
        completedAt: null,
      },
    })
  }

  /**
   * Record the start of a pipeline step.
   */
  async startStep(params: {
    runId: string
    step: number
    provider: string
    model: string
  }): Promise<string> {
    const stepRecord = await this.prisma.agentRunStep.create({
      data: {
        runId: params.runId,
        step: params.step,
        provider: params.provider,
        model: params.model,
        status: 'running',
      },
    })
    return stepRecord.id
  }

  /**
   * Record a completed step with token usage and iterations.
   * Computes estimated cost from token counts.
   */
  async completeStep(params: {
    stepId: string
    tokensUsed: TokenUsage
    iterations: number
    model: string
  }): Promise<void> {
    const cost = this.estimateCost(params.model, params.tokensUsed)

    await this.prisma.agentRunStep.update({
      where: { id: params.stepId },
      data: {
        status: 'completed',
        inputTokens: params.tokensUsed.inputTokens,
        outputTokens: params.tokensUsed.outputTokens,
        cacheReadTokens: params.tokensUsed.cacheReadTokens ?? 0,
        cacheWriteTokens: params.tokensUsed.cacheCreationTokens ?? 0,
        estimatedCostUsd: cost,
        iterations: params.iterations,
        completedAt: new Date(),
      },
    })

    // Update parent run totals
    const step = await this.prisma.agentRunStep.findUnique({
      where: { id: params.stepId },
      select: { runId: true },
    })

    if (step) {
      await this.updateRunTotals(step.runId)
    }
  }

  /**
   * Record a failed step.
   */
  async failStep(stepId: string, error: string): Promise<void> {
    await this.prisma.agentRunStep.update({
      where: { id: stepId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    })
  }

  /**
   * Mark the entire run as completed.
   */
  async completeRun(runId: string): Promise<void> {
    await this.updateRunTotals(runId)

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })
  }

  /**
   * Mark the entire run as failed.
   */
  async failRun(runId: string, error: string): Promise<void> {
    await this.updateRunTotals(runId)

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    })
  }

  /**
   * Get cost statistics for a run.
   */
  async getCostStats(runId: string): Promise<{
    run: {
      id: string
      status: string
      totalInputTokens: number
      totalOutputTokens: number
      cacheReadTokens: number
      cacheWriteTokens: number
      estimatedCostUsd: number
      durationMs: number | null
    }
    steps: {
      step: number
      status: string
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      cacheWriteTokens: number
      estimatedCostUsd: number
      iterations: number
      durationMs: number | null
    }[]
  }> {
    const run = await this.prisma.agentRun.findUniqueOrThrow({
      where: { id: runId },
      include: {
        steps: {
          orderBy: { step: 'asc' },
        },
      },
    })

    const runDuration = run.completedAt
      ? run.completedAt.getTime() - run.startedAt.getTime()
      : null

    return {
      run: {
        id: run.id,
        status: run.status,
        totalInputTokens: run.totalInputTokens,
        totalOutputTokens: run.totalOutputTokens,
        cacheReadTokens: run.cacheReadTokens,
        cacheWriteTokens: run.cacheWriteTokens,
        estimatedCostUsd: run.estimatedCostUsd,
        durationMs: runDuration,
      },
      steps: run.steps.map((s) => ({
        step: s.step,
        status: s.status,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        cacheReadTokens: s.cacheReadTokens,
        cacheWriteTokens: s.cacheWriteTokens,
        estimatedCostUsd: s.estimatedCostUsd,
        iterations: s.iterations,
        durationMs: s.completedAt
          ? s.completedAt.getTime() - s.startedAt.getTime()
          : null,
      })),
    }
  }

  /**
   * List recent runs with summary stats.
   */
  async listRuns(params?: {
    limit?: number
    status?: string
  }): Promise<{
    id: string
    taskDescription: string
    status: string
    provider: string
    model: string
    totalInputTokens: number
    totalOutputTokens: number
    estimatedCostUsd: number
    startedAt: Date
    completedAt: Date | null
  }[]> {
    const where: Record<string, unknown> = {}
    if (params?.status) where.status = params.status

    return this.prisma.agentRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: params?.limit ?? 20,
      select: {
        id: true,
        taskDescription: true,
        status: true,
        provider: true,
        model: true,
        totalInputTokens: true,
        totalOutputTokens: true,
        estimatedCostUsd: true,
        startedAt: true,
        completedAt: true,
      },
    })
  }


  /**
   * Update the last completed step (checkpoint for resume).
   */
  async updateCheckpoint(runId: string, step: number, outputId?: string): Promise<void> {
    const data: Record<string, unknown> = { lastCompletedStep: step }
    if (outputId) data.outputId = outputId
    await this.prisma.agentRun.update({
      where: { id: runId },
      data,
    })
  }

  /**
   * Find a resumable run for the given task+project.
   * Returns the most recent failed run that has completed at least step 1.
   */
  async findResumableRun(params: {
    taskDescription?: string
    projectPath: string
    outputId?: string
  }): Promise<{
    id: string
    outputId: string | null
    lastCompletedStep: number
    taskDescription: string
  } | null> {
    // If outputId provided, find run by outputId
    if (params.outputId) {
      const run = await this.prisma.agentRun.findFirst({
        where: {
          outputId: params.outputId,
          status: 'failed',
          lastCompletedStep: { gte: 1 },
        },
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          outputId: true,
          lastCompletedStep: true,
          taskDescription: true,
        },
      })
      return run
    }

    // Otherwise find by projectPath + task
    return this.prisma.agentRun.findFirst({
      where: {
        projectPath: params.projectPath,
        status: 'failed',
        lastCompletedStep: { gte: 1 },
        ...(params.taskDescription ? { taskDescription: params.taskDescription } : {}),
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        outputId: true,
        lastCompletedStep: true,
        taskDescription: true,
      },
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Recompute run totals from child steps.
   */
  private async updateRunTotals(runId: string): Promise<void> {
    const agg = await this.prisma.agentRunStep.aggregate({
      where: { runId },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
        estimatedCostUsd: true,
      },
    })

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        totalInputTokens: agg._sum.inputTokens ?? 0,
        totalOutputTokens: agg._sum.outputTokens ?? 0,
        cacheReadTokens: agg._sum.cacheReadTokens ?? 0,
        cacheWriteTokens: agg._sum.cacheWriteTokens ?? 0,
        estimatedCostUsd: agg._sum.estimatedCostUsd ?? 0,
      },
    })
  }

  /**
   * Estimate USD cost from token usage and model rates.
   */
  private estimateCost(model: string, tokens: TokenUsage): number {
    const rate = COST_RATES[model] ?? DEFAULT_RATE

    let cost = 0
    cost += (tokens.inputTokens / 1_000_000) * rate.input
    cost += (tokens.outputTokens / 1_000_000) * rate.output

    if (tokens.cacheReadTokens && rate.cacheRead) {
      cost += (tokens.cacheReadTokens / 1_000_000) * rate.cacheRead
    }
    if (tokens.cacheCreationTokens && rate.cacheWrite) {
      cost += (tokens.cacheCreationTokens / 1_000_000) * rate.cacheWrite
    }

    return Math.round(cost * 1_000_000) / 1_000_000 // 6 decimal places
  }
}
