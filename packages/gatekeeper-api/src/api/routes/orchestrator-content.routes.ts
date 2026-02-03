import { Router } from 'express'
import { OrchestratorContentController } from '../controllers/OrchestratorContentController.js'

const router = Router()

// 3 instances, one per kind
const instructionsCtrl = new OrchestratorContentController('instruction')
const docsCtrl = new OrchestratorContentController('doc')
const promptsCtrl = new OrchestratorContentController('prompt')

// ── Instructions CRUD ───────────────────────────────────────────────────────
// GET /api/orchestrator/instructions?step=1&active=true
router.get('/orchestrator/instructions', (req, res, next) => {
  instructionsCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/instructions', (req, res, next) => {
  instructionsCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/instructions/:id', (req, res, next) => {
  instructionsCtrl.get(req, res).catch(next)
})
router.put('/orchestrator/instructions/:id', (req, res, next) => {
  instructionsCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/instructions/:id', (req, res, next) => {
  instructionsCtrl.delete(req, res).catch(next)
})
router.put('/orchestrator/instructions/reorder', (req, res, next) => {
  instructionsCtrl.reorder(req, res).catch(next)
})

// ── Docs CRUD ───────────────────────────────────────────────────────────────
router.get('/orchestrator/docs', (req, res, next) => {
  docsCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/docs', (req, res, next) => {
  docsCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/docs/:id', (req, res, next) => {
  docsCtrl.get(req, res).catch(next)
})
router.put('/orchestrator/docs/:id', (req, res, next) => {
  docsCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/docs/:id', (req, res, next) => {
  docsCtrl.delete(req, res).catch(next)
})
router.put('/orchestrator/docs/reorder', (req, res, next) => {
  docsCtrl.reorder(req, res).catch(next)
})

// ── Prompts CRUD ────────────────────────────────────────────────────────────
router.get('/orchestrator/prompts', (req, res, next) => {
  promptsCtrl.list(req, res).catch(next)
})
router.post('/orchestrator/prompts', (req, res, next) => {
  promptsCtrl.create(req, res).catch(next)
})
router.get('/orchestrator/prompts/:id', (req, res, next) => {
  promptsCtrl.get(req, res).catch(next)
})
router.put('/orchestrator/prompts/:id', (req, res, next) => {
  promptsCtrl.update(req, res).catch(next)
})
router.delete('/orchestrator/prompts/:id', (req, res, next) => {
  promptsCtrl.delete(req, res).catch(next)
})
router.put('/orchestrator/prompts/reorder', (req, res, next) => {
  promptsCtrl.reorder(req, res).catch(next)
})

export { router as orchestratorContentRoutes }
