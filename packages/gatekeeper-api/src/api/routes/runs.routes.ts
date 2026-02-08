import { Router } from 'express'
import multer from 'multer'
import { RunsController } from '../controllers/RunsController.js'
import { RunEventService, type RunEvent } from '../../services/RunEventService.js'

const router = Router()
const controller = new RunsController()

// SSE heartbeat interval (ms) - keeps connection alive and detects silent death
const SSE_HEARTBEAT_INTERVAL = parseInt(process.env.SSE_HEARTBEAT_INTERVAL || '15000', 10)

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
})

router.get('/artifacts', (req, res, next) => {
  controller.listArtifacts(req, res).catch(next)
})

router.get('/artifacts/:outputId', (req, res, next) => {
  controller.getArtifactContents(req, res).catch(next)
})

router.get('/runs/:id/events', (req, res) => {
  const { id } = req.params

  // Parse Last-Event-Id for reconnection support
  // Header takes precedence over query param
  const lastEventIdHeader = req.headers['last-event-id'] as string | undefined
  const lastEventIdQuery = req.query.lastEventId as string | undefined
  const lastEventIdRaw = lastEventIdHeader || lastEventIdQuery
  const lastSeq = lastEventIdRaw ? parseInt(lastEventIdRaw, 10) : NaN

  if (!Number.isNaN(lastSeq)) {
    console.log(`[SSE] Client reconnecting for run: ${id}, lastSeq: ${lastSeq}`)
  } else {
    console.log('[SSE] Client connected for run:', id)
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial comment to confirm connection
  res.write(': connected\n\n')

  // Helper to flush response
  const flush = () => {
    const resWithFlush = res as unknown as { flush?: () => void }
    if (typeof resWithFlush.flush === 'function') {
      resWithFlush.flush()
    }
  }

  // Replay buffered events on reconnection (before live events)
  if (!Number.isNaN(lastSeq)) {
    const bufferedEvents = RunEventService.getBufferedEventsAfter(id, lastSeq)
    if (bufferedEvents.length > 0) {
      console.log(`[SSE] Replaying ${bufferedEvents.length} buffered events for run: ${id}`)
      for (const event of bufferedEvents) {
        res.write(`id: ${event.seq}\n`)
        res.write(`data: ${JSON.stringify({ type: event.type, runId: event.runId, data: event.data })}\n\n`)
      }
      flush()
    }
  }

  // Start heartbeat interval to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n')
    flush()
  }, SSE_HEARTBEAT_INTERVAL)

  // Track local seq for live events (fallback if buffer doesn't provide seq)
  let localSeqCounter = 0

  const onEvent = (event: RunEvent & { seq?: number }) => {
    if (event.runId === id) {
      console.log('[SSE] Sending event to client:', event.type)
      const seq = event.seq ?? localSeqCounter++
      res.write(`id: ${seq}\n`)
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      flush()
    }
  }

  RunEventService.on('run-event', onEvent)

  req.on('close', () => {
    console.log('[SSE] Client disconnected for run:', id)
    clearInterval(heartbeatInterval)
    RunEventService.off('run-event', onEvent)
  })
})

router.get('/runs', (req, res, next) => {
  controller.listRuns(req, res).catch(next)
})

router.get('/runs/:id', (req, res, next) => {
  controller.getRun(req, res).catch(next)
})

router.get('/runs/:id/results', (req, res, next) => {
  controller.getRunResults(req, res).catch(next)
})

router.post('/runs/:id/abort', (req, res, next) => {
  controller.abortRun(req, res).catch(next)
})

router.delete('/runs/:id', (req, res, next) => {
  controller.deleteRun(req, res).catch(next)
})

router.post('/runs/:id/rerun/:gateNumber', (req, res, next) => {
  controller.rerunGate(req, res).catch(next)
})

router.post('/runs/:id/validators/:validatorCode/bypass', (req, res, next) => {
  controller.bypassValidator(req, res).catch(next)
})

router.put('/runs/:id/files', upload.fields([
  { name: 'planJson', maxCount: 1 },
  { name: 'specFile', maxCount: 1 }
]), (req, res, next) => {
  controller.uploadFiles(req, res).catch(next)
})

export { router as runsRoutes }
