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
import { AgentOrchestratorBridge } from '../../services/AgentOrchestratorBridge.js'
import { OrchestratorEventService } from '../../services/OrchestratorEventService.js'
import { AgentRunPersistenceService } from '../../services/AgentRunPersistenceService.js'
import { GatekeeperValidationBridge } from '../../services/GatekeeperValidationBridge.js'
import type { AgentEvent, ProviderName } from '../../types/agent.types.js'

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

/** Validate and narrow a string from req.body to ProviderName. Returns undefined for invalid/missing values. */
function asProvider(value: unknown): ProviderName | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return undefined
}

function makeEmitter(runId: string) {
  return (event: AgentEvent) => {
    OrchestratorEventService.emitOrchestratorEvent(runId, event)
  }
}

/** Generate an outputId (same logic as AgentOrchestratorBridge.generateOutputId) */
function generateOutputId(taskDescription: string): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const nnn = String(Math.floor(Math.random() * 900) + 100)
  const slug = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '')
  return `${yyyy}_${mm}_${dd}_${nnn}_${slug}`
}

// ─── Controller ────────────────────────────────────────────────────────────

export class BridgeController {
  /**
   * POST /agent/bridge/plan
   *
   * Body: { taskDescription, projectPath, taskType?, profileId?, provider?, model? }
   * Returns: 202 + { runId, outputId, eventsUrl }
   * Background: runs agent → saves artifacts to disk
   * SSE events: agent:bridge_start, agent:iteration, agent:tool_call, agent:complete, agent:bridge_complete
   */
  async generatePlan(req: Request, res: Response): Promise<void> {
    const { taskDescription, projectPath, taskType, profileId, model, attachments } = req.body
    const provider = asProvider(req.body.provider)

    if (!taskDescription || !projectPath) {
      res.status(400).json({ error: 'taskDescription and projectPath are required' })
      return
    }

    const bridge = getBridge()

    // Generate outputId early so the client can connect SSE before work starts
    const outputId = generateOutputId(taskDescription)

    const emit = makeEmitter(outputId)

    // Return immediately so the client can connect SSE
    res.status(202).json({
      outputId,
      eventsUrl: `/api/orchestrator/events/${outputId}`,
    })

    // Run in background
    setImmediate(async () => {
      try {
        const result = await bridge.generatePlan(
          { taskDescription, projectPath, taskType, profileId, provider, model, outputId, attachments },
          { onEvent: emit },
        )

        // Emit completion with full result
        OrchestratorEventService.emitOrchestratorEvent(outputId, {
          type: 'agent:bridge_plan_done',
          outputId: result.outputId,
          artifacts: result.artifacts.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
          tokensUsed: result.tokensUsed,
        })
      } catch (err) {
        console.error('[Bridge] Plan failed:', err)
        // Only emit if AgentRunnerService didn't already emit via SSE
        if (!(err as any)?._sseEmitted) {
          OrchestratorEventService.emitOrchestratorEvent(outputId, {
            type: 'agent:error',
            error: (err as Error).message,
          })
        }
      }
    })
  }

  /**
   * POST /agent/bridge/spec
   *
   * Body: { outputId, projectPath, profileId?, provider?, model? }
   */
  async generateSpec(req: Request, res: Response): Promise<void> {
    const { outputId, projectPath, profileId, model } = req.body
    const provider = asProvider(req.body.provider)

    if (!outputId || !projectPath) {
      res.status(400).json({ error: 'outputId and projectPath are required' })
      return
    }

    const bridge = getBridge()

    try {
      const result = await bridge.generateSpec(
        { outputId, projectPath, profileId, provider, model },
      )

      res.status(201).json({
        outputId,
        artifacts: result.artifacts.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
        tokensUsed: result.tokensUsed,
      })
    } catch (err) {
      console.error('[Bridge] Spec failed:', err)
      const errObj = err as Error
      const status = (err as any)?.code === 'MISSING_ARTIFACTS' ? 400 : 500
      res.status(status).json({ error: errObj.message })
    }
  }

  /**
   * POST /agent/bridge/fix
   *
   * Body: { outputId, projectPath, target, failedValidators, runId?, rejectionReport?, profileId?, provider?, model?, customInstructions? }
   */
  async fixArtifacts(req: Request, res: Response): Promise<void> {
    const {
      outputId, projectPath, target, failedValidators,
      runId: gkRunId, rejectionReport, profileId, model, taskPrompt, customInstructions,
    } = req.body
    const provider = asProvider(req.body.provider)

    console.log('[Controller:Fix] POST /agent/bridge/fix')
    console.log('[Controller:Fix] body:', JSON.stringify({ outputId, target, failedValidators, provider, model, projectPath, runId: gkRunId, taskPromptLen: taskPrompt?.length, hasCustomInstructions: !!customInstructions }, null, 2))

    if (!outputId || !projectPath || !target || !failedValidators) {
      console.error('[Controller:Fix] Missing required fields!')
      res.status(400).json({
        error: 'outputId, projectPath, target, and failedValidators are required',
      })
      return
    }

    const bridge = getBridge()

    try {
      const result = await bridge.fixArtifacts(
        {
          outputId, projectPath, target, failedValidators,
          runId: gkRunId, rejectionReport, profileId, provider, model, taskPrompt, customInstructions,
        },
      )

      console.log('[Controller:Fix] Success — artifacts:', result.artifacts.map(a => `${a.filename}(${a.content.length})`))
      console.log('[Controller:Fix] corrections:', result.corrections?.length ?? 0)
      res.json({
        outputId,
        artifacts: result.artifacts.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
        corrections: result.corrections,
        tokensUsed: result.tokensUsed,
        correctedTaskPrompt: result.correctedTaskPrompt,
      })
    } catch (err) {
      console.error('[Controller:Fix] FAILED:', err)
      const errObj = err as Error
      res.status(500).json({ error: errObj.message })
    }
  }

  /**
   * POST /agent/bridge/execute
   *
   * Body: { outputId, projectPath, provider?, model? }
   * Returns: 202 + { outputId, eventsUrl }
   * Background: runs agent → emits SSE events → completes with agent:bridge_execute_done
   */
  async execute(req: Request, res: Response): Promise<void> {
    const { outputId, projectPath, model } = req.body
    const provider = asProvider(req.body.provider)

    console.log('[Controller:Execute] POST /agent/bridge/execute')
    console.log('[Controller:Execute] body:', JSON.stringify({ outputId, projectPath, provider, model }))

    if (!outputId || !projectPath) {
      console.error('[Controller:Execute] Missing required fields!')
      res.status(400).json({ error: 'outputId and projectPath are required' })
      return
    }

    const bridge = getBridge()
    const emit = makeEmitter(outputId)

    // Return immediately so the client doesn't timeout
    res.status(202).json({
      outputId,
      mode: 'agent',
      eventsUrl: `/api/agent/events/${outputId}`,
    })

    // Run in background
    setImmediate(async () => {
      try {
        const result = await bridge.execute(
          { outputId, projectPath, provider, model },
          { onEvent: emit },
        )

        OrchestratorEventService.emitOrchestratorEvent(outputId, {
          type: 'agent:bridge_execute_done',
          outputId,
          mode: 'agent',
          artifacts: result.artifacts.map((a) => a.filename),
          tokensUsed: result.tokensUsed,
        })
      } catch (err) {
        console.error('[Bridge] Execute failed:', err)
        if (!(err as any)?._sseEmitted) {
          OrchestratorEventService.emitOrchestratorEvent(outputId, {
            type: 'agent:error',
            error: (err as Error).message,
          })
        }
      }
    })
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
      projectId, model, maxFixRetries = 3,
    } = req.body
    const provider = asProvider(req.body.provider)
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
      if (!(err as any)?._sseEmitted) {
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:error',
          error: (err as Error).message,
        })
      }
    })
  }


  /**
   * POST /agent/bridge/pipeline/resume
   *
   * Resume a previously failed pipeline run from its last checkpoint.
   * Body: { runId: string (DB run ID), provider?, model?, maxFixRetries? }
   *
   * Finds the last completed step and restarts from the next one,
   * reusing existing plan/spec artifacts.
   */
  async resumePipeline(req: Request, res: Response): Promise<void> {
    const {
      runId: dbRunId, projectId, model, maxFixRetries = 3,
    } = req.body
    const provider = asProvider(req.body.provider)

    if (!dbRunId) {
      res.status(400).json({ error: 'runId is required (DB AgentRun ID)' })
      return
    }

    // Direct DB lookup for the specific run
    const run = await prisma.agentRun.findUnique({
      where: { id: dbRunId },
      select: {
        id: true,
        outputId: true,
        lastCompletedStep: true,
        taskDescription: true,
        projectPath: true,
        status: true,
      },
    })

    if (!run) {
      res.status(404).json({ error: `Run not found: ${dbRunId}` })
      return
    }

    if (run.status !== 'failed') {
      res.status(400).json({
        error: `Run ${dbRunId} is not in a resumable state (status: ${run.status}). Only failed runs can be resumed.`,
      })
      return
    }

    if (run.lastCompletedStep < 1 || !run.outputId) {
      res.status(400).json({
        error: `Run ${dbRunId} has no checkpoint to resume from (lastCompletedStep: ${run.lastCompletedStep}). Start a new pipeline instead.`,
      })
      return
    }

    const sseRunId = nanoid(12)

    res.status(202).json({
      runId: sseRunId,
      dbRunId: run.id,
      status: 'resuming',
      resumeFromStep: run.lastCompletedStep,
      outputId: run.outputId,
      eventsUrl: `/api/agent/events/${sseRunId}`,
    })

    // Background execution with resume
    this.executeFullPipeline(sseRunId, {
      taskDescription: run.taskDescription,
      projectPath: run.projectPath,
      projectId,
      provider,
      model,
      maxFixRetries,
      resumeFromStep: run.lastCompletedStep,
      existingOutputId: run.outputId,
      existingDbRunId: run.id,
    }).catch((err) => {
      console.error(`[Bridge] Pipeline resume ${sseRunId} failed:`, err)
      if (!(err as any)?._sseEmitted) {
        OrchestratorEventService.emitOrchestratorEvent(sseRunId, {
          type: 'agent:error',
          error: (err as Error).message,
        })
      }
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
      provider?: ProviderName
      model?: string
      maxFixRetries: number
      /** For checkpoint/resume: skip steps up to this number */
      resumeFromStep?: number
      /** For checkpoint/resume: reuse existing outputId */
      existingOutputId?: string
      /** For checkpoint/resume: reuse existing DB run ID */
      existingDbRunId?: string
    },
  ): Promise<void> {
    const bridge = getBridge()
    const validationBridge = getValidationBridge()
    const emit = makeEmitter(runId)
    const {
      taskDescription, projectPath, taskType, profileId, projectId,
      provider, model, maxFixRetries,
      resumeFromStep = 0, existingOutputId, existingDbRunId,
    } = params

    const dbRunId = existingDbRunId || await persistence.createRun({
      taskDescription,
      projectPath,
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-5-20250929',
      outputId: existingOutputId,
    })

    // If resuming, update run status back to running
    if (existingDbRunId) {
      await persistence.resumeRun(dbRunId)
    }

    let outputId = existingOutputId || ''

    try {
      // ── Step 1: Plan ──────────────────────────────────────────────────
      if (resumeFromStep < 1) {
        emit({ type: 'agent:bridge_start', step: 1 } as AgentEvent)
        const step1Id = await persistence.startStep({ runId: dbRunId, step: 1, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

        const planResult = await bridge.generatePlan(
          { taskDescription, projectPath, taskType, profileId, provider, model },
          { onEvent: emit },
        )

        await persistence.completeStep({ stepId: step1Id, tokensUsed: planResult.tokensUsed, iterations: planResult.agentResult.iterations, model: planResult.agentResult.model })
        await persistence.updateCheckpoint(dbRunId, 1, planResult.outputId)

        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:bridge_plan_done',
          outputId: planResult.outputId,
          artifacts: planResult.artifacts.map((a) => a.filename),
        })

        outputId = planResult.outputId
      } else {
        console.log(`[Bridge] Resuming: skipping step 1 (plan) — already completed`)
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:step_skipped',
          step: 1,
          reason: 'checkpoint_resume',
        })
      }

      // ── Step 2: Spec ──────────────────────────────────────────────────
      if (resumeFromStep < 2) {
        emit({ type: 'agent:bridge_start', step: 2 } as AgentEvent)
        const step2Id = await persistence.startStep({ runId: dbRunId, step: 2, provider: provider || 'anthropic', model: model || 'claude-sonnet-4-5-20250929' })

        const specResult = await bridge.generateSpec(
          { outputId, projectPath, profileId, provider, model },
          { onEvent: emit },
        )

        await persistence.completeStep({ stepId: step2Id, tokensUsed: specResult.tokensUsed, iterations: specResult.agentResult.iterations, model: specResult.agentResult.model })
        await persistence.updateCheckpoint(dbRunId, 2)

        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:bridge_spec_done',
          outputId,
          artifacts: specResult.artifacts.map((a) => a.filename),
        })
      } else {
        console.log(`[Bridge] Resuming: skipping step 2 (spec) — already completed`)
        OrchestratorEventService.emitOrchestratorEvent(runId, {
          type: 'agent:step_skipped',
          step: 2,
          reason: 'checkpoint_resume',
        })
      }

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
        await persistence.updateCheckpoint(dbRunId, 4)

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
