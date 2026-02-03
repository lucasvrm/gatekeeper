import { Router } from 'express'
import { OrchestratorController } from '../controllers/OrchestratorController.js'
import { OrchestratorEventService, type OrchestratorStreamEvent } from '../../services/OrchestratorEventService.js'
import {
  GeneratePlanSchema,
  GenerateSpecSchema,
  FixArtifactsSchema,
  ExecuteSchema,
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

// SSE: Stream orchestrator events for a given outputId
router.get('/events/:outputId', (req, res) => {
  const { outputId } = req.params
  console.log('[SSE] Orchestrator client connected for:', outputId)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(': connected\n\n')

  const onEvent = (payload: OrchestratorStreamEvent) => {
    if (payload.outputId === outputId) {
      console.log('[SSE] Orchestrator event:', payload.event.type, 'for:', outputId)
      const data = `data: ${JSON.stringify(payload.event)}\n\n`
      res.write(data)
      const resWithFlush = res as unknown as { flush?: () => void }
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush()
      }
    }
  }

  OrchestratorEventService.on('orchestrator-event', onEvent)

  req.on('close', () => {
    console.log('[SSE] Orchestrator client disconnected for:', outputId)
    OrchestratorEventService.off('orchestrator-event', onEvent)
  })
})

export { router as orchestratorRoutes }
