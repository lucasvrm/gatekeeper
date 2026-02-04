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
import { AgentRunPersistenceService } from '../../services/AgentRunPersistenceService.js'
import { GatekeeperValidationBridge } from '../../services/GatekeeperValidationBridge.js'
import type { AgentEvent } from '../../types/agent.types.js'

const persistence = new AgentRunPersistenceService(prisma)

// ─── Lazy singleton ────────────────────────────────────────────────────────

let _bridge: AgentOrchestratorBridge | null = null

function getBridge(): AgentOrchestratorBridge {
  if (!_bridge) {
    const apiUrl = process.env.GATEKEEPER_API_URL || `http://localhost:${process.env.PORT || 3000}/api`
    _bridge = new AgentOrchestratorBridge(prisma, apiUrl)
  }
  return _bridge
}

let _validationBridge: GatekeeperValidationBridge | null = null

function getValidationBridge(): GatekeeperValidationBridge {
  if (!_validationBridge) {
    _validationBridge = new GatekeeperValidationBridge()
  }
  return _validationBridge
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
    const dbRunId = await persistence.createRun({
      taskDescription,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })
    const stepId = await persistence.startStep({
      runId: dbRunId,
      step: 1,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })

    try {
      const result = await bridge.generatePlan(
        { taskDescription, projectPath, taskType, profileId, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      await persistence.completeStep({
        stepId,
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        model: result.agentResult.model,
      })
      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_plan_done',
        dbRunId,
        outputId: result.outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Plan ${runId} failed:`, err)
      await persistence.failStep(stepId, (err as Error).message)
      await persistence.failRun(dbRunId, (err as Error).message)
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
    const dbRunId = await persistence.createRun({
      taskDescription: `spec for ${outputId}`,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })
    const stepId = await persistence.startStep({
      runId: dbRunId,
      step: 2,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })

    try {
      const result = await bridge.generateSpec(
        { outputId, projectPath, profileId, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      await persistence.completeStep({
        stepId,
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        model: result.agentResult.model,
      })
      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_spec_done',
        dbRunId,
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Spec ${runId} failed:`, err)
      await persistence.failStep(stepId, (err as Error).message)
      await persistence.failRun(dbRunId, (err as Error).message)
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
    const dbRunId = await persistence.createRun({
      taskDescription: `fix ${target} for ${outputId}`,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })
    const stepId = await persistence.startStep({
      runId: dbRunId,
      step: 3,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })

    try {
      const result = await bridge.fixArtifacts(
        {
          outputId, projectPath, target, failedValidators,
          runId: gkRunId, rejectionReport, profileId, provider, model,
        },
        { onEvent: makeEmitter(runId) },
      )

      await persistence.completeStep({
        stepId,
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        model: result.agentResult.model,
      })
      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_fix_done',
        dbRunId,
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
      })
    } catch (err) {
      console.error(`[Bridge] Fix ${runId} failed:`, err)
      await persistence.failStep(stepId, (err as Error).message)
      await persistence.failRun(dbRunId, (err as Error).message)
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
    const dbRunId = await persistence.createRun({
      taskDescription: `execute ${outputId}`,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })
    const stepId = await persistence.startStep({
      runId: dbRunId,
      step: 4,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })

    try {
      const result = await bridge.execute(
        { outputId, projectPath, provider, model },
        { onEvent: makeEmitter(runId) },
      )

      await persistence.completeStep({
        stepId,
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        model: result.agentResult.model,
      })
      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_execute_done',
        dbRunId,
        outputId,
        artifacts: result.artifacts.map((a) => a.filename),
        tokensUsed: result.tokensUsed,
        iterations: result.agentResult.iterations,
        provider: result.agentResult.provider,
        model: result.agentResult.model,
      })
    } catch (err) {
      console.error(`[Bridge] Execute ${runId} failed:`, err)
      await persistence.failStep(stepId, (err as Error).message)
      await persistence.failRun(dbRunId, (err as Error).message)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    }
  }

  /**
   * POST /agent/bridge/pipeline
   *
   * Full automated pipeline: plan → spec → execute → [validate → fix → re-execute] loop.
   * Body: { taskDescription, projectPath, taskType?, profileId?, projectId?, provider?, model?, maxFixRetries? }
   */
  async runFullPipeline(req: Request, res: Response): Promise<void> {
    const {
      taskDescription, projectPath, taskType, profileId,
      projectId, provider, model, maxFixRetries = 3,
    } = req.body
    const runId = nanoid(12)

    if (!taskDescription || !projectPath) {
      res.status(400).json({ error: 'taskDescription and projectPath are required' })
      return
    }

    res.status(202).json({
      runId,
      status: 'started',
      pipeline: 'full',
      maxFixRetries,
      eventsUrl: `/api/agent/events/${runId}`,
    })

    // Background execution of full pipeline
    this.executeFullPipeline(runId, {
      taskDescription, projectPath, taskType, profileId,
      projectId, provider, model, maxFixRetries,
    }).catch((err) => {
      console.error(`[Bridge] Full pipeline ${runId} failed:`, err)
      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:error',
        error: (err as Error).message,
      })
    })
  }

  // ─── Full Pipeline Background Execution ──────────────────────────────

  private async executeFullPipeline(
    runId: string,
    params: {
      taskDescription: string
      projectPath: string
      taskType?: string
      profileId?: string
      projectId?: string
      provider?: string
      model?: string
      maxFixRetries: number
    },
  ): Promise<void> {
    const bridge = getBridge()
    const validationBridge = getValidationBridge()
    const emit = makeEmitter(runId)
    const { taskDescription, projectPath, taskType, profileId, projectId, provider, model, maxFixRetries } = params

    const dbRunId = await persistence.createRun({
      taskDescription,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
    })

    try {
      // ── Step 1: Plan ──────────────────────────────────────────────────
      emit({ type: 'agent:bridge_start', step: 1 } as AgentEvent)
      const step1Id = await persistence.startStep({ runId: dbRunId, step: 1, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

      const planResult = await bridge.generatePlan(
        { taskDescription, projectPath, taskType, profileId, provider, model },
        { onEvent: emit },
      )

      await persistence.completeStep({ stepId: step1Id, tokensUsed: planResult.tokensUsed, iterations: planResult.agentResult.iterations, model: planResult.agentResult.model })

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_plan_done',
        outputId: planResult.outputId,
        artifacts: planResult.artifacts.map((a) => a.filename),
      })

      const outputId = planResult.outputId

      // ── Step 2: Spec ──────────────────────────────────────────────────
      emit({ type: 'agent:bridge_start', step: 2 } as AgentEvent)
      const step2Id = await persistence.startStep({ runId: dbRunId, step: 2, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

      const specResult = await bridge.generateSpec(
        { outputId, projectPath, profileId, provider, model },
        { onEvent: emit },
      )

      await persistence.completeStep({ stepId: step2Id, tokensUsed: specResult.tokensUsed, iterations: specResult.agentResult.iterations, model: specResult.agentResult.model })

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:bridge_spec_done',
        outputId,
        artifacts: specResult.artifacts.map((a) => a.filename),
      })

      // ── Step 4 + Gatekeeper Validation Fix Loop ───────────────────────
      //
      // NEW: Instead of heuristic text analysis ("tests passed"), we run
      // the real Gatekeeper validation (gates 2-3) after each execution
      // attempt. This gives the fixer structured feedback about exactly
      // which validators failed, replacing guesswork with precision.
      //
      let attempt = 0
      let lastExecuteResult
      let lastValidation

      while (attempt <= maxFixRetries) {
        // ── Execute ─────────────────────────────────────────────────────
        emit({ type: 'agent:bridge_start', step: 4 } as AgentEvent)
        const step4Id = await persistence.startStep({ runId: dbRunId, step: 4, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

        const executeResult = await bridge.execute(
          { outputId, projectPath, provider, model },
          { onEvent: emit },
        )

        await persistence.completeStep({ stepId: step4Id, tokensUsed: executeResult.tokensUsed, iterations: executeResult.agentResult.iterations, model: executeResult.agentResult.model })

        lastExecuteResult = executeResult

        // ── Gatekeeper Validation (real gates 2-3) ──────────────────────
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:validation_start',
          outputId,
          attempt: attempt + 1,
          runType: 'EXECUTION',
        })

        const validation = await validationBridge.validate({
          outputId,
          projectPath,
          taskDescription,
          projectId,
          runType: 'EXECUTION',
        })

        lastValidation = validation

        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:validation_complete',
          outputId,
          attempt: attempt + 1,
          validationRunId: validation.validationRunId,
          passed: validation.passed,
          status: validation.status,
          failedGate: validation.failedGate,
          failedGateName: validation.failedGateName,
          failedValidatorCodes: validation.failedValidatorCodes,
          gateResults: validation.gateResults,
        })

        // ── Check validation result ─────────────────────────────────────

        if (validation.status === 'SKIPPED') {
          // Validation couldn't run (missing manifest, etc.)
          // Fall back to heuristic text analysis as before
          console.warn(`[Bridge] Validation skipped for attempt ${attempt + 1}, falling back to heuristic`)
          const agentText = executeResult.agentResult.text.toLowerCase()
          const testsPass = agentText.includes('all tests pass') ||
            agentText.includes('tests passed') ||
            agentText.includes('test suite passed') ||
            !agentText.includes('fail')

          if (testsPass || attempt >= maxFixRetries) {
            OrchestratorEventService.emitOrchestratorEvent(runId, {
              type: 'agent:bridge_execute_done',
              outputId,
              attempt: attempt + 1,
              testsPass,
              validationMode: 'heuristic',
              artifacts: executeResult.artifacts.map((a) => a.filename),
            })
            break
          }
        } else if (validation.passed) {
          // All gates passed — pipeline complete!
          OrchestratorEventService.emitOrchestratorEvent(runId, {
            type: 'agent:bridge_execute_done',
            outputId,
            attempt: attempt + 1,
            testsPass: true,
            validationMode: 'gatekeeper',
            validationRunId: validation.validationRunId,
            artifacts: executeResult.artifacts.map((a) => a.filename),
          })
          break
        }

        // ── Validation failed — check if we can retry ───────────────────

        if (attempt >= maxFixRetries) {
          OrchestratorEventService.emitOrchestratorEvent(runId, {
            type: 'agent:bridge_execute_done',
            outputId,
            attempt: attempt + 1,
            testsPass: false,
            validationMode: 'gatekeeper',
            validationRunId: validation.validationRunId,
            failedValidators: validation.failedValidatorCodes,
            artifacts: executeResult.artifacts.map((a) => a.filename),
          })
          break
        }

        // ── Fix loop: run fixer with real Gatekeeper feedback ───────────

        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:pipeline_retry',
          attempt: attempt + 1,
          maxRetries: maxFixRetries,
          reason: `Gatekeeper validation failed: ${validation.failedValidatorCodes.join(', ')}`,
          failedGate: validation.failedGate,
          failedGateName: validation.failedGateName,
          failedValidators: validation.failedValidatorCodes,
        })

        emit({ type: 'agent:bridge_start', step: 3 } as AgentEvent)
        const step3Id = await persistence.startStep({ runId: dbRunId, step: 3, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

        const fixResult = await bridge.fixArtifacts(
          {
            outputId,
            projectPath,
            target: 'spec' as const,
            failedValidators: validation.failedValidatorCodes,
            rejectionReport: validation.rejectionReport,
            profileId,
            provider,
            model,
          },
          { onEvent: emit },
        )

        await persistence.completeStep({ stepId: step3Id, tokensUsed: fixResult.tokensUsed, iterations: fixResult.agentResult.iterations, model: fixResult.agentResult.model })

        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:bridge_fix_done',
          outputId,
          attempt: attempt + 1,
          corrections: fixResult.corrections,
          failedValidators: validation.failedValidatorCodes,
        })

        attempt++
      }

      await persistence.completeRun(dbRunId)

      OrchestratorEventService.emitOrchestratorEvent(runId, {
        type: 'agent:pipeline_complete',
        dbRunId,
        outputId,
        totalAttempts: attempt + 1,
        validationPassed: lastValidation?.passed ?? false,
        validationRunId: lastValidation?.validationRunId,
        artifacts: lastExecuteResult?.artifacts.map((a) => a.filename) ?? [],
      })
    } catch (err) {
      await persistence.failRun(dbRunId, (err as Error).message)
      throw err
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
