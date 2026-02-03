import type { Request, Response } from 'express'
import { OrchestratorEventService, type OrchestratorEventData } from '../../services/OrchestratorEventService.js'
import type { GeneratePlanInput, GenerateSpecInput, FixArtifactsInput, ExecuteInput } from '../schemas/orchestrator.schema.js'

/**
 * Lazy-loaded orchestrator instance.
 * Defers the import of gatekeeper-orchestrator to first use,
 * so the API server can boot even if the package isn't installed yet.
 */
let _orchestrator: Awaited<ReturnType<typeof getOrchestrator>> | null = null

async function getOrchestrator() {
  if (_orchestrator) return _orchestrator

  try {
    const mod = await import('gatekeeper-orchestrator')
    _orchestrator = new mod.Orchestrator(mod.loadConfig())
    return _orchestrator
  } catch (error) {
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
}
