import { Router } from 'express'
import { OrchestratorContentController } from '../controllers/OrchestratorContentController.js'

const router = Router()
const contentCtrl = new OrchestratorContentController()

// ── Instructions CRUD ───────────────────────────────────────────────────────
// GET /api/orchestrator/instructions?step=1
router.get('/orchestrator/instructions', (req, res, next) => {
  req.query.kind = 'instruction'
  contentCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/instructions', (req, res, next) => {
  req.body.kind = 'instruction'
  contentCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/instructions/:id', (req, res, next) => {
  contentCtrl.getById(req, res).catch(next)
})
router.put('/orchestrator/instructions/:id', (req, res, next) => {
  contentCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/instructions/:id', (req, res, next) => {
  contentCtrl.delete(req, res).catch(next)
})

// ── Docs CRUD ───────────────────────────────────────────────────────────────
router.get('/orchestrator/docs', (req, res, next) => {
  req.query.kind = 'doc'
  contentCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/docs', (req, res, next) => {
  req.body.kind = 'doc'
  contentCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/docs/:id', (req, res, next) => {
  contentCtrl.getById(req, res).catch(next)
})
router.put('/orchestrator/docs/:id', (req, res, next) => {
  contentCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/docs/:id', (req, res, next) => {
  contentCtrl.delete(req, res).catch(next)
})

// ── Prompts CRUD ────────────────────────────────────────────────────────────
router.get('/orchestrator/prompts', (req, res, next) => {
  req.query.kind = 'prompt'
  contentCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/prompts', (req, res, next) => {
  req.body.kind = 'prompt'
  contentCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/prompts/:id', (req, res, next) => {
  contentCtrl.getById(req, res).catch(next)
})
router.put('/orchestrator/prompts/:id', (req, res, next) => {
  contentCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/prompts/:id', (req, res, next) => {
  contentCtrl.delete(req, res).catch(next)
})

export { router as orchestratorContentRoutes }
