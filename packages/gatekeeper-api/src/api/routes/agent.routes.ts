import { Router } from 'express'
import { AgentPhaseConfigController } from '../controllers/AgentPhaseConfigController.js'
import { OrchestratorContentController } from '../controllers/OrchestratorContentController.js'
import { AgentRunnerController } from '../controllers/AgentRunnerController.js'
import { AgentRunsController } from '../controllers/AgentRunsController.js'
import { BridgeController } from '../controllers/BridgeController.js'
import { ProviderModelController } from '../controllers/ProviderModelController.js'
import { ProviderController } from '../controllers/ProviderController.js'
import { OrchestratorEventService, type OrchestratorStreamEvent } from '../../services/OrchestratorEventService.js'
import {
  CreatePhaseConfigSchema,
  UpdatePhaseConfigSchema,
  CreateContentSchema,
  UpdateContentSchema,
  RunAgentSchema,
  RunSinglePhaseSchema,
  CreateProviderModelSchema,
  UpdateProviderModelSchema,
  DiscoverModelsSchema,
  CreateProviderSchema,
  UpdateProviderSchema,
} from '../schemas/agent.schema.js'

const router = Router()
const phaseConfigCtrl = new AgentPhaseConfigController()
const contentCtrl = new OrchestratorContentController()
const runnerCtrl = new AgentRunnerController()
const runsCtrl = new AgentRunsController()
const bridgeCtrl = new BridgeController()
const providerModelCtrl = new ProviderModelController()
const providerCtrl = new ProviderController()

// ─── System Status ─────────────────────────────────────────────────────────

router.get('/status', async (req, res, next) => {
  try {
    await runnerCtrl.status(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── Providers CRUD ───────────────────────────────────────────────────────

router.get('/providers', async (req, res, next) => {
  try {
    await providerCtrl.list(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/providers/all', async (req, res, next) => {
  try {
    await providerCtrl.listAll(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/providers', async (req, res, next) => {
  try {
    const validated = CreateProviderSchema.parse(req.body)
    req.body = validated
    await providerCtrl.create(req, res)
  } catch (error) {
    next(error)
  }
})

router.put('/providers/:id', async (req, res, next) => {
  try {
    const validated = UpdateProviderSchema.parse(req.body)
    req.body = validated
    await providerCtrl.update(req, res)
  } catch (error) {
    next(error)
  }
})

router.delete('/providers/:id', async (req, res, next) => {
  try {
    await providerCtrl.delete(req, res)
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

// ─── Provider Models CRUD ─────────────────────────────────────────────────

router.get('/models', async (req, res, next) => {
  try {
    await providerModelCtrl.list(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/models', async (req, res, next) => {
  try {
    const validated = CreateProviderModelSchema.parse(req.body)
    req.body = validated
    await providerModelCtrl.create(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/models/discover', async (req, res, next) => {
  try {
    const validated = DiscoverModelsSchema.parse(req.body)
    req.body = validated
    await providerModelCtrl.discover(req, res)
  } catch (error) {
    next(error)
  }
})

router.put('/models/:id', async (req, res, next) => {
  try {
    const validated = UpdateProviderModelSchema.parse(req.body)
    req.body = validated
    await providerModelCtrl.update(req, res)
  } catch (error) {
    next(error)
  }
})

router.delete('/models/:id', async (req, res, next) => {
  try {
    await providerModelCtrl.delete(req, res)
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

router.post('/bridge/discovery', async (req, res, next) => {
  try {
    await bridgeCtrl.generateDiscovery(req, res)
  } catch (error) {
    next(error)
  }
})

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

router.post('/bridge/pipeline', async (req, res, next) => {
  try {
    await bridgeCtrl.runFullPipeline(req, res)
  } catch (error) {
    next(error)
  }
})

router.post('/bridge/pipeline/resume', async (req, res, next) => {
  try {
    await bridgeCtrl.resumePipeline(req, res)
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

// ─── Runs: Observability ──────────────────────────────────────────────────

router.get('/runs', async (req, res, next) => {
  try {
    await runsCtrl.list(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/runs/:id', async (req, res, next) => {
  try {
    await runsCtrl.getById(req, res)
  } catch (error) {
    next(error)
  }
})

// ─── SSE: Stream agent events ──────────────────────────────────────────────

// Helper: flush response if compression middleware buffers
function flushAgent(res: import('express').Response) {
  const r = res as unknown as { flush?: () => void }
  if (typeof r.flush === 'function') r.flush()
}

router.get('/events/:runId', async (req, res) => {
  const { runId } = req.params
  const lastEventIdHeader = req.headers['last-event-id']
  const lastSeq = lastEventIdHeader ? parseInt(String(lastEventIdHeader), 10) : NaN

  console.log('[SSE] Agent client connected for:', runId, lastEventIdHeader ? `(reconnect after seq=${lastEventIdHeader})` : '(fresh)')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(': connected\n\n')

  // ── Replay ──
  if (!isNaN(lastSeq)) {
    // Reconnection: try buffer first, DB fallback
    const buffered = OrchestratorEventService.getBufferedEventsAfter(runId, lastSeq)
    if (buffered.length > 0) {
      console.log(`[SSE] Replaying ${buffered.length} buffered event(s) after seq=${lastSeq} for: ${runId}`)
      for (const { event, seq } of buffered) {
        res.write(`id:${seq}\ndata:${JSON.stringify(event)}\n\n`)
      }
    } else {
      // Buffer expired or empty: fallback to DB (up to 200 events)
      console.log(`[SSE] Buffer miss for seq=${lastSeq}, falling back to DB for: ${runId}`)
      const dbEvents = await OrchestratorEventService.replayFromDb(runId)
      for (const dbEvent of dbEvents) {
        const payload = dbEvent.payload ? JSON.parse(dbEvent.payload) : { type: dbEvent.eventType }
        res.write(`id:db-${dbEvent.id}\ndata:${JSON.stringify(payload)}\n\n`)
      }
    }
  } else {
    // Fresh connection: replay full buffer with seq
    const buffered = OrchestratorEventService.getBufferedEventsWithSeq(runId)
    if (buffered.length > 0) {
      console.log(`[SSE] Replaying ${buffered.length} buffered event(s) for: ${runId}`)
      for (const { event, seq } of buffered) {
        res.write(`id:${seq}\ndata:${JSON.stringify(event)}\n\n`)
      }
    }
  }
  flushAgent(res)

  // ── Live events with id: ──
  const onEvent = (payload: OrchestratorStreamEvent) => {
    if (payload.outputId === runId) {
      const seq = payload.seq ?? 0
      res.write(`id:${seq}\ndata:${JSON.stringify(payload.event)}\n\n`)
      flushAgent(res)

      // Auto-close on terminal events.
      // NOTE: We do NOT close on bridge_*_done events because those are emitted
      // as intermediate steps within a full pipeline run. Only true terminal
      // events (pipeline complete, single phase complete, or error) close the stream.
      const eventType = (payload.event as Record<string, unknown>).type as string
      if (
        eventType === 'agent:pipeline_complete' ||
        eventType === 'agent:phase_complete' ||
        eventType === 'agent:error'
      ) {
        res.write(`id:${seq}\ndata:${JSON.stringify({ type: 'agent:stream_end' })}\n\n`)
        clearInterval(heartbeatInterval)
        res.end()
      }
    }
  }

  // ── Heartbeat 15s ──
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n')
    flushAgent(res)
  }, 15_000)

  OrchestratorEventService.on('orchestrator-event', onEvent)

  // ── Cleanup ──
  req.on('close', () => {
    console.log('[SSE] Agent client disconnected for:', runId)
    clearInterval(heartbeatInterval)
    OrchestratorEventService.off('orchestrator-event', onEvent)
  })
})

export { router as agentRoutes }
