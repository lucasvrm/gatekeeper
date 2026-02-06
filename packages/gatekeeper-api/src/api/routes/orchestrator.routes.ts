import { Router } from 'express'
import { OrchestratorController } from '../controllers/OrchestratorController.js'
import { OrchestratorEventService, type OrchestratorStreamEvent } from '../../services/OrchestratorEventService.js'
import {
  GeneratePlanSchema,
  GenerateSpecSchema,
  FixArtifactsSchema,
  ExecuteSchema,
  StatusParamsSchema,
  EventsQuerySchema,
} from '../schemas/orchestrator.schema.js'

const router = Router()
const controller = new OrchestratorController()

// Step 1: Generate plan artifacts
router.post('/plan', async (req, res, next) => {
  try {
    const validatedData = GeneratePlanSchema.parse(req.body)
    req.body = validatedData
    await controller.generatePlan(req, res)
  } catch (error) {
    next(error)
  }
})

// Step 2: Generate spec test
router.post('/spec', async (req, res, next) => {
  try {
    const validatedData = GenerateSpecSchema.parse(req.body)
    req.body = validatedData
    await controller.generateSpec(req, res)
  } catch (error) {
    next(error)
  }
})

// Fix: Correct artifacts after Gatekeeper rejection
router.post('/fix', async (req, res, next) => {
  try {
    const validatedData = FixArtifactsSchema.parse(req.body)
    req.body = validatedData
    await controller.fixArtifacts(req, res)
  } catch (error) {
    next(error)
  }
})

// Step 4: Execute implementation in project
router.post('/execute', async (req, res, next) => {
  try {
    const validatedData = ExecuteSchema.parse(req.body)
    req.body = validatedData
    await controller.execute(req, res)
  } catch (error) {
    next(error)
  }
})

// REST: Pipeline status snapshot
router.get('/:outputId/status', async (req, res, next) => {
  try {
    const { outputId } = StatusParamsSchema.parse(req.params)
    req.params.outputId = outputId
    await controller.getStatus(req, res)
  } catch (error) {
    next(error)
  }
})

// REST: Paginated event backlog
router.get('/:outputId/events', async (req, res, next) => {
  try {
    StatusParamsSchema.parse(req.params)
    const query = EventsQuerySchema.parse(req.query)
    ;(req as any).validatedQuery = query
    await controller.getEvents(req, res)
  } catch (error) {
    next(error)
  }
})

// Helper: flush response if compression middleware buffers
function flush(res: import('express').Response) {
  const r = res as unknown as { flush?: () => void }
  if (typeof r.flush === 'function') r.flush()
}

// SSE: Stream orchestrator events for a given outputId
router.get('/events/:outputId', async (req, res) => {
  const { outputId } = req.params
  const lastEventIdHeader = req.headers['last-event-id']
  const lastSeq = lastEventIdHeader ? parseInt(String(lastEventIdHeader), 10) : NaN

  console.log('[SSE] Orchestrator client connected for:', outputId, lastEventIdHeader ? `(reconnect after seq=${lastEventIdHeader})` : '(fresh)')

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
    const buffered = OrchestratorEventService.getBufferedEventsAfter(outputId, lastSeq)
    if (buffered.length > 0) {
      console.log(`[SSE] Replaying ${buffered.length} buffered event(s) after seq=${lastSeq} for: ${outputId}`)
      for (const { event, seq } of buffered) {
        res.write(`id:${seq}\ndata:${JSON.stringify(event)}\n\n`)
      }
    } else {
      // Buffer expired or empty: fallback to DB (up to 200 events)
      console.log(`[SSE] Buffer miss for seq=${lastSeq}, falling back to DB for: ${outputId}`)
      const dbEvents = await OrchestratorEventService.replayFromDb(outputId)
      for (const dbEvent of dbEvents) {
        const payload = dbEvent.payload ? JSON.parse(dbEvent.payload) : { type: dbEvent.eventType }
        res.write(`id:db-${dbEvent.id}\ndata:${JSON.stringify(payload)}\n\n`)
      }
    }
  } else {
    // Fresh connection: replay full buffer
    const buffered = OrchestratorEventService.getBufferedEventsWithSeq(outputId)
    if (buffered.length > 0) {
      console.log(`[SSE] Replaying ${buffered.length} buffered event(s) for: ${outputId}`)
      for (const { event, seq } of buffered) {
        res.write(`id:${seq}\ndata:${JSON.stringify(event)}\n\n`)
      }
    }
  }
  flush(res)

  // ── Live events with id: ──
  const onEvent = (payload: OrchestratorStreamEvent) => {
    if (payload.outputId === outputId) {
      const seq = payload.seq ?? 0
      res.write(`id:${seq}\ndata:${JSON.stringify(payload.event)}\n\n`)
      flush(res)
    }
  }

  // ── Heartbeat 15s ──
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n')
    flush(res)
  }, 15_000)

  OrchestratorEventService.on('orchestrator-event', onEvent)

  // ── Cleanup ──
  req.on('close', () => {
    console.log('[SSE] Orchestrator client disconnected for:', outputId)
    clearInterval(heartbeatInterval)
    OrchestratorEventService.off('orchestrator-event', onEvent)
  })
})

export { router as orchestratorRoutes }
