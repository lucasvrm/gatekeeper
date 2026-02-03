/**
 * Agent ↔ Orchestrator Bridge Controller
 *
 * HTTP API for the AgentOrchestratorBridge.
 * Provides the same pipeline operations (plan, spec, fix, execute)
 * as the existing OrchestratorController, but powered by AgentRunner
 * (multi-provider, tool-based agent loop).
 *
 * Routes (mounted under /api/agent/bridge/):
 *   POST /plan        → Generate plan artifacts (step 1)
 *   POST /spec        → Generate test spec (step 2)
 *   POST /fix         → Fix artifacts after rejection (step 3)
 *   POST /execute     → Execute implementation (step 4)
 *   GET  /artifacts/:outputId → List artifacts on disk
 *   GET  /artifacts/:outputId/:filename → Read single artifact
 */

import type { Request, Response } from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { nanoid } from 'nanoid'
import { prisma } from '../../db/client.js'
import { AgentOrchestratorBridge, BridgeError } from '../../services/AgentOrchestratorBridge.js'
import { OrchestratorEventService } from '../../services/OrchestratorEventService.js'
import type { AgentEvent } from '../../types/agent.types.js'

// ─── Lazy singleton ────────────────────────────────────────────────────────

let _bridge: AgentOrchestratorBridge | null = null

function getBridge(): AgentOrchestratorBridge {
  if (!_bridge) {
    const apiUrl = process.env.GATEKEEPER_API_URL || `http://localhost:${process.env.PORT || 3000}/api`
    _bridge = new AgentOrchestratorBridge(prisma, apiUrl)
  }
  return _bridge
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function handleBridgeError(error: unknown, res: Response): void {
  if (error instanceof BridgeError) {
    const status = error.code === 'MISSING_ARTIFACTS' ? 422 : 500
    res.status(status).json({
      error: error.message,
      code: error.code,
      details: error.details,
    })
    return
  }
  throw error
}

function makeEmitter(runId: string) {
  return (event: AgentEvent) => {
    OrchestratorEventService.emitOrchestratorEvent(runId, event as Record<string, unknown>)
  }
}

// ─── Controller ────────────────────────────────────────────────────────────

export class BridgeController {
  /**
   * POST /agent/bridge/plan
   *
   * Body: { taskDescription, projectPath, taskType?, profileId?, provider?, model? }
   * Returns: 202 + { runId, outputId, eventsUrl }
   * Background: runs agent → saves artifacts to disk
   * Final SSE event: { type: 'agent:bridge_plan_done', outputId, artifacts }
   */
  async generatePlan(req: Request, res: Response): Promise<void> {
    const { taskDescription, projectPath, taskType, profileId, provider, model } = req.body
    const runId = nanoid(12)

    if (!taskDescription || !projectPath) {
      res.status(400).json({ error: 'taskDescription and projectPath are required' })
      return
    }

    // Return immediately — work happens in background
    res.status(202).json({
      runId,
      status: 'started',
      step: 1,
      eventsUrl: `/api/agent/events/${runId}`,
    })

    // Background execution
    const bridge = getBridge()
    try {
      const result = await bridge.generatePlan(
        { taskDescription, projectPath, taskType, profileId, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_plan_done',
        outputId: result.outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Plan ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    }
  }

  /**
   * POST /agent/bridge/spec
   *
   * Body: { outputId, projectPath, profileId?, provider?, model? }
   */
  async generateSpec(req: Request, res: Response): Promise<void> {
    const { outputId, projectPath, profileId, provider, model } = req.body
    const runId = nanoid(12)

    if (!outputId || !projectPath) {
      res.status(400).json({ error: 'outputId and projectPath are required' })
      return
    }

    res.status(202).json({
      runId,
      status: 'started',
      step: 2,
      outputId,
      eventsUrl: `/api/agent/events/${runId}`,
    })

    const bridge = getBridge()
    try {
      const result = await bridge.generateSpec(
        { outputId, projectPath, profileId, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_spec_done',
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Spec ${runId} failed:`, err)
      const errObj = err as Error
      if (err instanceof BridgeError) {
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:error',
          error: errObj.message,
          code: (err as BridgeError).code,
        })
      } else {
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:error',
          error: errObj.message,
        })
      }
    }
  }

  /**
   * POST /agent/bridge/fix
   *
   * Body: { outputId, projectPath, target, failedValidators, runId?, rejectionReport?, profileId?, provider?, model? }
   */
  async fixArtifacts(req: Request, res: Response): Promise<void> {
    const {
      outputId, projectPath, target, failedValidators,
      runId: gkRunId, rejectionReport, profileId, provider, model,
    } = req.body
    const runId = nanoid(12)

    if (!outputId || !projectPath || !target || !failedValidators) {
      res.status(400).json({
        error: 'outputId, projectPath, target, and failedValidators are required',
      })
      return
    }

    res.status(202).json({
      runId,
      status: 'started',
      step: 3,
      outputId,
      eventsUrl: `/api/agent/events/${runId}`,
    })

    const bridge = getBridge()
    try {
      const result = await bridge.fixArtifacts(
        {
          outputId, projectPath, target, failedValidators,
          runId: gkRunId, rejectionReport, profileId, provider, model,
        },
        { onEvent: makeEmitter(runId) },
      )

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_fix_done',
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
      })
    } catch (err) {
      console.error(`[Bridge] Fix ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    }
  }

  /**
   * POST /agent/bridge/execute
   *
   * Body: { outputId, projectPath, provider?, model? }
   */
  async execute(req: Request, res: Response): Promise<void> {
    const { outputId, projectPath, provider, model } = req.body
    const runId = nanoid(12)

    if (!outputId || !projectPath) {
      res.status(400).json({ error: 'outputId and projectPath are required' })
      return
    }

    res.status(202).json({
      runId,
      status: 'started',
      step: 4,
      outputId,
      eventsUrl: `/api/agent/events/${runId}`,
    })

    const bridge = getBridge()
    try {
      const result = await bridge.execute(
        { outputId, projectPath, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_execute_done',
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Execute ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    }
  }

  /**
   * GET /agent/bridge/artifacts/:outputId
   *
   * List all artifact files for a given outputId.
   */
  async listArtifacts(req: Request, res: Response): Promise<void> {
    const { outputId } = req.params
    const projectPath = (req.query.projectPath as string) || process.cwd()

    const bridge = getBridge()
    const artifactsDir = await bridge.getArtifactsPath(outputId, projectPath)

    try {
      const files = fs.readdirSync(artifactsDir)
      const artifacts = files.map((filename) => {
        const filePath = path.join(artifactsDir, filename)
        const stats = fs.statSync(filePath)
        return {
          filename,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        }
      })

      res.json({
        outputId,
        path: artifactsDir,
        artifacts,
      })
    } catch {
      res.status(404).json({
        error: `No artifacts found for outputId: ${outputId}`,
        path: artifactsDir,
      })
    }
  }

  /**
   * GET /agent/bridge/artifacts/:outputId/:filename
   *
   * Read a single artifact file.
   */
  async readArtifact(req: Request, res: Response): Promise<void> {
    const { outputId, filename } = req.params
    const projectPath = (req.query.projectPath as string) || process.cwd()

    const bridge = getBridge()
    const artifactsDir = await bridge.getArtifactsPath(outputId, projectPath)
    const filePath = path.join(artifactsDir, filename)

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      res.json({
        outputId,
        filename,
        content,
        size: content.length,
      })
    } catch {
      res.status(404).json({
        error: `Artifact not found: ${outputId}/${filename}`,
      })
    }
  }
}
