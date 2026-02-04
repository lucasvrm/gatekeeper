import type { Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { prisma } from '../../db/client.js'
import { LLMProviderRegistry } from '../../services/providers/LLMProviderRegistry.js'
import { AgentToolExecutor, READ_TOOLS, WRITE_TOOLS, SAVE_ARTIFACT_TOOL } from '../../services/AgentToolExecutor.js'
import { AgentRunnerService } from '../../services/AgentRunnerService.js'
import { AgentPromptAssembler } from '../../services/AgentPromptAssembler.js'
import { OrchestratorEventService } from '../../services/OrchestratorEventService.js'
import { AgentRunPersistenceService } from '../../services/AgentRunPersistenceService.js'
import type { PhaseConfig, AgentEvent, ProviderName } from '../../types/agent.types.js'
import type { RunAgentInput, RunSinglePhaseInput } from '../schemas/agent.schema.js'

const persistence = new AgentRunPersistenceService(prisma)

/**
 * Lazy-initialized registry + runner.
 * Defers SDK initialization until first use.
 */
let _registry: LLMProviderRegistry | null = null

function getRegistry(): LLMProviderRegistry {
  if (!_registry) {
    _registry = LLMProviderRegistry.fromEnv()
  }
  return _registry
}

export class AgentRunnerController {
  /**
   * POST /agent/run — Run the full 3-phase pipeline
   *
   * Runs Planner → Spec Writer → Coder asynchronously.
   * Returns immediately with a runId; progress streams via SSE.
   */
  async runPipeline(req: Request, res: Response): Promise<void> {
    const data = req.body as RunAgentInput
    const runId = nanoid(12)

    // Load phase configs from DB
    const dbConfigs = await prisma.agentPhaseConfig.findMany({
      where: {},
      orderBy: { step: 'asc' },
    })

    if (dbConfigs.length === 0) {
      res.status(500).json({
        error: 'Nenhum AgentPhaseConfig ativo encontrado. Execute db:seed.',
      })
      return
    }

    // Build phase configs with optional overrides
    const phases: PhaseConfig[] = dbConfigs.map((db) => {
      const override = data.overrides?.[String(db.step)]
      return {
        step: db.step,
        provider: (override?.provider ?? db.provider) as ProviderName,
        model: override?.model ?? db.model,
        maxTokens: db.maxTokens,
        maxIterations: db.maxIterations,
        maxInputTokensBudget: db.maxInputTokensBudget,
        temperature: db.temperature ?? undefined,
        fallbackProvider: db.fallbackProvider as ProviderName | undefined,
        fallbackModel: db.fallbackModel ?? undefined,
      }
    })

    // Return immediately with runId
    res.status(202).json({
      runId,
      status: 'started',
      phases: phases.map((p) => ({
        step: p.step,
        provider: p.provider,
        model: p.model,
        fallback: p.fallbackProvider
          ? `${p.fallbackProvider}/${p.fallbackModel}`
          : null,
      })),
      eventsUrl: `/api/agent/events/${runId}`,
    })

    // Run pipeline in background
    this.executePipeline(runId, data, phases).catch((err) => {
      console.error(`[AgentRunner] Pipeline ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    })
  }

  /**
   * POST /agent/run/phase — Run a single phase
   *
   * Useful for testing individual phases or re-running a failed step.
   */
  async runSinglePhase(req: Request, res: Response): Promise<void> {
    const data = req.body as RunSinglePhaseInput
    const runId = nanoid(12)

    // Load config from DB or use defaults
    const dbConfig = await prisma.agentPhaseConfig.findUnique({
      where: { step: data.step },
    })

    const phase: PhaseConfig = {
      step: data.step,
      provider: (data.provider ?? dbConfig?.provider ?? 'anthropic') as ProviderName,
      model: data.model ?? dbConfig?.model ?? 'claude-sonnet-4-5-20250929',
      maxTokens: dbConfig?.maxTokens ?? 8192,
      maxIterations: dbConfig?.maxIterations ?? 30,
      maxInputTokensBudget: dbConfig?.maxInputTokensBudget ?? 0,
      temperature: dbConfig?.temperature ?? undefined,
      fallbackProvider: dbConfig?.fallbackProvider as ProviderName | undefined,
      fallbackModel: dbConfig?.fallbackModel ?? undefined,
    }

    res.status(202).json({
      runId,
      status: 'started',
      phase: {
        step: phase.step,
        provider: phase.provider,
        model: phase.model,
      },
      eventsUrl: `/api/agent/events/${runId}`,
    })

    // Run in background
    this.executeSinglePhase(runId, data, phase).catch((err) => {
      console.error(`[AgentRunner] Phase ${data.step} run ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    })
  }

  /**
   * GET /agent/status — Check agent system status
   */
  async status(_req: Request, res: Response): Promise<void> {
    const registry = getRegistry()

    const phases = await prisma.agentPhaseConfig.findMany({
      where: {},
      orderBy: { step: 'asc' },
    })

    res.json({
      ready: registry.available().length > 0,
      providers: {
        available: registry.available(),
        anthropic: registry.has('anthropic'),
        openai: registry.has('openai'),
        mistral: registry.has('mistral'),
      },
      phases: phases.map((p) => ({
        step: p.step,
        provider: p.provider,
        model: p.model,
        providerAvailable: registry.has(p.provider as ProviderName),
        fallback: p.fallbackProvider
          ? {
              provider: p.fallbackProvider,
              model: p.fallbackModel,
              available: registry.has(p.fallbackProvider as ProviderName),
            }
          : null,
      })),
    })
  }

  // ─── Private: Background Execution ────────────────────────────────────

  private async executePipeline(
    runId: string,
    data: RunAgentInput,
    phases: PhaseConfig[],
  ): Promise<void> {
    const registry = getRegistry()
    const toolExecutor = new AgentToolExecutor()
    const runner = new AgentRunnerService(registry, toolExecutor)
    const assembler = new AgentPromptAssembler(prisma)

    const systemPrompts = await assembler.assembleAll()

    // Persistence: create run record
    const primaryPhase = phases[0]
    const dbRunId = await persistence.createRun({
      taskDescription: data.taskDescription,
      projectPath: data.projectPath,
      provider: primaryPhase.provider,
      model: primaryPhase.model,
    })

    const onEvent = (event: AgentEvent) => {
      OrchestratorEventService.emitOrchestratorEvent(runId, event)
    }

    try {
      const result = await runner.runPipeline({
        phases,
        systemPrompts,
        taskDescription: data.taskDescription,
        projectRoot: data.projectPath,
        readTools: READ_TOOLS,
        writeTools: WRITE_TOOLS,
        saveArtifactTool: SAVE_ARTIFACT_TOOL,
        onEvent,
        onStepStart: async (step, phase) => {
          return persistence.startStep({
            runId: dbRunId,
            step,
            provider: phase.provider,
            model: phase.model,
          })
        },
        onStepComplete: async (stepId, result) => {
          await persistence.completeStep({
            stepId,
            tokensUsed: result.tokensUsed,
            iterations: result.iterations,
            model: result.model,
          })
        },
        onStepFail: async (stepId, error) => {
          await persistence.failStep(stepId, error)
        },
      })

      await persistence.completeRun(dbRunId)

      // Emit final result
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:pipeline_complete',
        dbRunId,
        artifactCount: result.artifacts.size,
        artifactNames: [...result.artifacts.keys()],
        totalTokens: result.totalTokens,
        phases: result.phaseResults.map((r) => ({
          provider: r.provider,
          model: r.model,
          iterations: r.iterations,
          tokens: r.tokensUsed,
        })),
      })
    } catch (err) {
      await persistence.failRun(dbRunId, (err as Error).message)
      throw err
    }
  }

  private async executeSinglePhase(
    runId: string,
    data: RunSinglePhaseInput,
    phase: PhaseConfig,
  ): Promise<void> {
    const registry = getRegistry()
    const toolExecutor = new AgentToolExecutor()
    const runner = new AgentRunnerService(registry, toolExecutor)
    const assembler = new AgentPromptAssembler(prisma)

    const systemPrompt = await assembler.assembleForStep(data.step)

    const tools = [...READ_TOOLS, SAVE_ARTIFACT_TOOL]
    if (data.step === 4) {
      tools.push(...WRITE_TOOLS)
    }

    // Persistence: create run + step
    const dbRunId = await persistence.createRun({
      taskDescription: data.taskDescription,
      projectPath: data.projectPath,
      provider: phase.provider,
      model: phase.model,
    })
    const stepId = await persistence.startStep({
      runId: dbRunId,
      step: data.step,
      provider: phase.provider,
      model: phase.model,
    })

    const onEvent = (event: AgentEvent) => {
      OrchestratorEventService.emitOrchestratorEvent(runId, event)
    }

    try {
      const result = await runner.run({
        phase,
        systemPrompt,
        userMessage: data.taskDescription,
        tools,
        projectRoot: data.projectPath,
        onEvent,
      })

      await persistence.completeStep({
        stepId,
        tokensUsed: result.tokensUsed,
        iterations: result.iterations,
        model: result.model,
      })
      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:phase_complete',
        dbRunId,
        step: data.step,
        ...result,
        artifactNames: [...toolExecutor.getArtifacts().keys()],
      })
    } catch (err) {
      await persistence.failStep(stepId, (err as Error).message)
      await persistence.failRun(dbRunId, (err as Error).message)
      throw err
    }
  }
}
