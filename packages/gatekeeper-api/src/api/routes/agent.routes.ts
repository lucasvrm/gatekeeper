import { Router } from 'express'
import { AgentPhaseConfigController } from '../controllers/AgentPhaseConfigController.js'
import { OrchestratorContentController } from '../controllers/OrchestratorContentController.js'
import { AgentRunnerController } from '../controllers/AgentRunnerController.js'
import { BridgeController } from '../controllers/BridgeController.js'
import { OrchestratorEventService, type OrchestratorStreamEvent } from '../../services/OrchestratorEventService.js'
import {
  CreatePhaseConfigSchema,
  UpdatePhaseConfigSchema,
  CreateContentSchema,
  UpdateContentSchema,
  RunAgentSchema,
  RunSinglePhaseSchema,
} from '../schemas/agent.schema.js'

const router = Router()
const phaseConfigCtrl = new AgentPhaseConfigController()
const contentCtrl = new OrchestratorContentController()
const runnerCtrl = new AgentRunnerController()
const bridgeCtrl = new BridgeController()

// ─── System Status ─────────────────────────────────────────────────────────

router.get('/status', async (req, res, next) => {
  try {
    await runnerCtrl.status(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Providers ─────────────────────────────────────────────────────────────

router.get('/providers', async (req, res, next) => {
  try {
    await phaseConfigCtrl.listProviders(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Phase Configs CRUD ────────────────────────────────────────────────────

router.get('/phases', async (req, res, next) => {
  try {
    await phaseConfigCtrl.list(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/phases/:step', async (req, res, next) => {
  try {
    await phaseConfigCtrl.getByStep(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/phases', async (req, res, next) => {
  try {
    const validated = CreatePhaseConfigSchema.parse(req.body)
    req.body = validated
    await phaseConfigCtrl.create(req, res)
  } catch (error) {
    next(error)
  }
})

router.put('/phases/:step', async (req, res, next) => {
  try {
    const validated = UpdatePhaseConfigSchema.parse(req.body)
    req.body = validated
    await phaseConfigCtrl.update(req, res)
  } catch (error) {
    next(error)
  }
})

router.delete('/phases/:step', async (req, res, next) => {
  try {
    await phaseConfigCtrl.delete(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Orchestrator Content CRUD ─────────────────────────────────────────────

router.get('/content', async (req, res, next) => {
  try {
    await contentCtrl.list(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/content/preview/:step', async (req, res, next) => {
  try {
    await contentCtrl.previewPrompt(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/content/:id', async (req, res, next) => {
  try {
    await contentCtrl.getById(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/content', async (req, res, next) => {
  try {
    const validated = CreateContentSchema.parse(req.body)
    req.body = validated
    await contentCtrl.create(req, res)
  } catch (error) {
    next(error)
  }
})

router.put('/content/:id', async (req, res, next) => {
  try {
    const validated = UpdateContentSchema.parse(req.body)
    req.body = validated
    await contentCtrl.update(req, res)
  } catch (error) {
    next(error)
  }
})

router.delete('/content/:id', async (req, res, next) => {
  try {
    await contentCtrl.delete(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Agent Runner ──────────────────────────────────────────────────────────

router.post('/run', async (req, res, next) => {
  try {
    const validated = RunAgentSchema.parse(req.body)
    req.body = validated
    await runnerCtrl.runPipeline(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/run/phase', async (req, res, next) => {
  try {
    const validated = RunSinglePhaseSchema.parse(req.body)
    req.body = validated
    await runnerCtrl.runSinglePhase(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Bridge: Pipeline with Artifact Persistence ──────────────────────────

router.post('/bridge/plan', async (req, res, next) => {
  try {
    await bridgeCtrl.generatePlan(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/bridge/spec', async (req, res, next) => {
  try {
    await bridgeCtrl.generateSpec(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/bridge/fix', async (req, res, next) => {
  try {
    await bridgeCtrl.fixArtifacts(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/bridge/execute', async (req, res, next) => {
  try {
    await bridgeCtrl.execute(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/bridge/artifacts/:outputId', async (req, res, next) => {
  try {
    await bridgeCtrl.listArtifacts(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/bridge/artifacts/:outputId/:filename', async (req, res, next) => {
  try {
    await bridgeCtrl.readArtifact(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── SSE: Stream agent events ──────────────────────────────────────────────

router.get('/events/:runId', (req, res) => {
  const { runId } = req.params
  console.log('[SSE] Agent client connected for:', runId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(': connected\n\n')

  const onEvent = (payload: OrchestratorStreamEvent) => {
    if (payload.outputId === runId) {
      const data = `data: ${JSON.stringify(payload.event)}\n\n`
      res.write(data)
      const resWithFlush = res as unknown as { flush?: () => void }
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush()
      }

      // Auto-close on terminal events
      const eventType = (payload.event as Record<string, unknown>).type as string
      if (
        eventType === 'agent:pipeline_complete' ||
        eventType === 'agent:phase_complete' ||
        eventType === 'agent:error' ||
        eventType === 'agent:bridge_plan_done' ||
        eventType === 'agent:bridge_spec_done' ||
        eventType === 'agent:bridge_fix_done' ||
        eventType === 'agent:bridge_execute_done'
      ) {
        res.write(`data: ${JSON.stringify({ type: 'agent:stream_end' })}\n\n`)
        res.end()
      }
    }
  }

  OrchestratorEventService.on('orchestrator-event', onEvent)

  req.on('close', () => {
    console.log('[SSE] Agent client disconnected for:', runId)
    OrchestratorEventService.off('orchestrator-event', onEvent)
  })
})

export { router as agentRoutes }
