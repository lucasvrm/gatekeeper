import { Router } from 'express'
import { RunsController } from '../controllers/RunsController.js'
import { RunEventService, type RunEvent } from '../../services/RunEventService.js'

const router = Router()
const controller = new RunsController()

router.get('/runs/:id/events', (req, res) => {
  const { id } = req.params
  console.log('[SSE] Client connected for run:', id)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial comment to confirm connection
  res.write(': connected\n\n')

  const onEvent = (event: RunEvent) => {
    if (event.runId === id) {
      console.log('[SSE] Sending event to client:', event.type)
      const data = `data: ${JSON.stringify(event)}\n\n`
      res.write(data)
      // Force flush - some environments buffer the response
      if (typeof (res as any).flush === 'function') {
        (res as any).flush()
      }
    }
  }

  RunEventService.on('run-event', onEvent)

  req.on('close', () => {
    console.log('[SSE] Client disconnected for run:', id)
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

export { router as runsRoutes }
