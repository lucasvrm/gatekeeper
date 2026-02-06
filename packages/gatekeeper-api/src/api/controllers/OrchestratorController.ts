import type { Request, Response } from 'express'
import { OrchestratorEventService, type OrchestratorEventData } from '../../services/OrchestratorEventService.js'
import type { GeneratePlanInput, GenerateSpecInput, FixArtifactsInput, ExecuteInput, RunPipelineInput } from '../schemas/orchestrator.schema.js'
import { prisma } from '../../db/client.js'
import { nanoid } from 'nanoid'
import { createLogger } from '../../utils/logger.js'

const log = createLogger('OrchestratorController')

/**
 * Lazy-loaded orchestrator instance.
 * Defers the import of gatekeeper-orchestrator to first use,
 * so the API server can boot even if the package isn't installed yet.
 *
 * Typed as the duck-typed interface we actually use, avoiding a circular
 * ReturnType<typeof getOrchestrator> reference.
 */
interface OrchestratorInstance {
  generatePlan(input: GeneratePlanInput, callbacks: ReturnType<typeof makeCallbacks>): Promise<unknown>
  generateSpec(input: GenerateSpecInput, callbacks: ReturnType<typeof makeCallbacks>): Promise<unknown>
  fixArtifacts(input: FixArtifactsInput, callbacks: ReturnType<typeof makeCallbacks>): Promise<unknown>
  execute(input: ExecuteInput, callbacks: ReturnType<typeof makeCallbacks>): Promise<unknown>
}

let _orchestrator: OrchestratorInstance | null = null

async function getOrchestrator(): Promise<OrchestratorInstance> {
  if (_orchestrator) return _orchestrator

  try {
    const mod = await import('gatekeeper-orchestrator')
    _orchestrator = new mod.Orchestrator(mod.loadConfig()) as OrchestratorInstance
    return _orchestrator
  } catch {
    throw new Error(
      'gatekeeper-orchestrator package not found. Run "npm install" at the monorepo root.',
    )
  }
}

function makeCallbacks(outputId: string) {
  return {
    onEvent: (event: OrchestratorEventData) => {
      OrchestratorEventService.emitOrchestratorEvent(outputId, event)
    },
  }
}

export class OrchestratorController {
  /**
   * POST /run - Inicia uma pipeline completa de agent
   * Para testes E2E - versão simplificada
   */
  async run(req: Request, res: Response): Promise<void> {
    const data = req.body as RunPipelineInput
    log.debug({ body: req.body }, 'Run endpoint called')

    try {
      // Gera outputId único
      const outputId = nanoid()
      log.info({ outputId, projectId: data.projectId }, 'Generated outputId for pipeline')

      // Busca project no banco
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        include: { workspace: true },
      })

      if (!project) {
        res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' })
        return
      }

      // Cria AgentRun no banco
      const agentRun = await prisma.agentRun.create({
        data: {
          id: outputId,
          taskDescription: data.task,
          projectPath: project.workspace.rootPath,
          outputId,
          provider: data.provider || 'anthropic',
          model: data.model || 'claude-sonnet-4',
          status: 'running',
        },
      })

      // Cria PipelineState para o endpoint GET /status
      await prisma.pipelineState.create({
        data: {
          outputId,
          status: 'running',
          stage: 'planning',
          progress: 0,
          lastEventId: 0,
        },
      })

      // Retorna 202 Accepted imediatamente (async background pattern)
      res.status(202).json({
        outputId: agentRun.id,
        status: 'accepted',
        eventsUrl: `/api/orchestrator/events/${outputId}`,
      })

      // Executa pipeline em background (assíncrono)
      setImmediate(() => {
        this.runPipelineAsync(outputId, data, project.workspace.rootPath).catch(error => {
          // Log de erro apenas se não foi emitido via SSE
          if (!(error as any)?._sseEmitted) {
            log.error({ outputId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Background pipeline error')
          }
        })
      })
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : 'Internal server error' }, 'Run endpoint error')
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      })
    }
  }

  /**
   * Executa pipeline em background com orchestrator REAL (não simulação).
   * Substitui setTimeout por chamadas reais aos métodos do orchestrator.
   * Pattern: getOrchestrator() + makeCallbacks() + async/await
   */
  private async runPipelineAsync(outputId: string, data: RunPipelineInput, projectPath: string): Promise<void> {
    log.info({ outputId, phases: data.phases }, 'Starting real pipeline execution')

    try {
      const orch = await getOrchestrator()
      const callbacks = makeCallbacks(outputId)

      // Emite evento inicial
      OrchestratorEventService.emitOrchestratorEvent(outputId, {
        type: 'agent:bridge_init',
        outputId,
        projectPath,
      })

      // Executa fases sequencialmente conforme especificado
      for (const phase of data.phases) {
        switch (phase) {
          case 'PLANNING':
            log.debug({ outputId, phase }, 'Executing planning phase')
            await orch.generatePlan(
              {
                taskDescription: data.task,
                taskType: 'feature',
                model: data.model,
              },
              callbacks
            )
            break

          case 'WRITING':
            log.debug({ outputId, phase }, 'Executing writing phase')
            // Gera spec
            await orch.generateSpec({ outputId, model: data.model }, callbacks)
            // Executa implementação
            await orch.execute({ outputId, projectPath, model: data.model }, callbacks)
            break

          case 'VALIDATION':
            log.debug({ outputId, phase }, 'Validation phase (manual)')
            OrchestratorEventService.emitOrchestratorEvent(outputId, {
              type: 'agent:validation_pending',
              outputId,
            })
            break
        }
      }

      // Atualiza status no banco para completado
      await prisma.agentRun.update({
        where: { id: outputId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })

      await prisma.pipelineState.update({
        where: { outputId },
        data: {
          status: 'completed',
          stage: 'complete',
          progress: 100,
        },
      })

      // Evento final de sucesso
      OrchestratorEventService.emitOrchestratorEvent(outputId, {
        type: 'agent:complete',
        outputId,
        success: true,
      })
    } catch (error) {
      log.error({ outputId, error: error instanceof Error ? error.message : 'Unknown' }, 'Pipeline failed')

      // Atualiza status para falha
      await prisma.agentRun.update({
        where: { id: outputId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      })

      await prisma.pipelineState.update({
        where: { outputId },
        data: {
          status: 'failed',
        },
      })

      // Emite evento de erro apenas se não foi emitido via SSE antes
      if (!(error as any)?._sseEmitted) {
        OrchestratorEventService.emitOrchestratorEvent(outputId, {
          type: 'agent:error',
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: 'unknown',
          canRetry: false,
        })
      }

      throw error
    }
  }

  async generatePlan(req: Request, res: Response): Promise<void> {
    const data = req.body as GeneratePlanInput

    try {
      const orch = await getOrchestrator()
      const result = await orch.generatePlan(data, makeCallbacks(data.taskDescription))

      res.status(201).json(result)
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const orchError = error as Error & { code: string; details?: unknown }
        res.status(orchError.code === 'MISSING_ARTIFACTS' ? 422 : 500).json({
          error: orchError.message,
          code: orchError.code,
          details: orchError.details,
        })
        return
      }
      throw error
    }
  }

  async generateSpec(req: Request, res: Response): Promise<void> {
    const data = req.body as GenerateSpecInput

    try {
      const orch = await getOrchestrator()
      const result = await orch.generateSpec(data, makeCallbacks(data.outputId))

      res.status(201).json(result)
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const orchError = error as Error & { code: string; details?: unknown }
        const status = orchError.code === 'MISSING_ARTIFACTS' ? 400 : 500
        res.status(status).json({
          error: orchError.message,
          code: orchError.code,
          details: orchError.details,
        })
        return
      }
      throw error
    }
  }

  async fixArtifacts(req: Request, res: Response): Promise<void> {
    const data = req.body as FixArtifactsInput

    try {
      const orch = await getOrchestrator()
      const result = await orch.fixArtifacts(data, makeCallbacks(data.outputId))

      res.json(result)
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const orchError = error as Error & { code: string; details?: unknown }
        res.status(orchError.code === 'FIX_FAILED' ? 422 : 500).json({
          error: orchError.message,
          code: orchError.code,
          details: orchError.details,
        })
        return
      }
      throw error
    }
  }

  async getStatus(req: Request, res: Response): Promise<void> {
    const { outputId } = req.params
    const state = await OrchestratorEventService.getStatus(outputId)
    if (!state) {
      res.status(404).json({ error: 'Pipeline não encontrada', code: 'NOT_FOUND' })
      return
    }
    res.json(state)
  }

  async getEvents(req: Request, res: Response): Promise<void> {
    const { outputId } = req.params
    const { sinceId, limit } = (req as any).validatedQuery as { sinceId?: number; limit: number }
    const result = await OrchestratorEventService.getEventsPaginated(outputId, sinceId, limit)
    res.json(result)
  }

  async execute(req: Request, res: Response): Promise<void> {
    const data = req.body as ExecuteInput

    try {
      const orch = await getOrchestrator()
      const result = await orch.execute(data, makeCallbacks(data.outputId))

      res.json(result)
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const orchError = error as Error & { code: string; details?: unknown }
        res.status(500).json({
          error: orchError.message,
          code: orchError.code,
          details: orchError.details,
        })
        return
      }
      throw error
    }
  }

  /**
   * POST /cleanup-logs - Trigger manual log rotation
   * Query params: olderThanDays (optional, default: 30)
   */
  async cleanupLogs(req: Request, res: Response): Promise<void> {
    try {
      const olderThanDays = req.query.olderThanDays
        ? parseInt(req.query.olderThanDays as string, 10)
        : undefined

      const deletedCount = await OrchestratorEventService.cleanupOldEvents(olderThanDays)

      res.json({
        success: true,
        deletedCount,
        retentionDays: olderThanDays ?? parseInt(process.env.LOG_RETENTION_DAYS || '30', 10),
      })
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Log cleanup failed')
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Log cleanup failed',
        code: 'CLEANUP_FAILED',
      })
    }
  }
}
