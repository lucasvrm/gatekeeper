import { Router } from 'express'
import { AgentsController } from '../controllers/AgentsController.js'

const router = Router()
const controller = new AgentsController()

router.get('/agents', (req, res, next) => {
  controller.list(req, res).catch(next)
})

router.get('/agents/:id', (req, res, next) => {
  controller.get(req, res).catch(next)
})

router.post('/agents', (req, res, next) => {
  controller.create(req, res).catch(next)
})

router.put('/agents/:id', (req, res, next) => {
  controller.update(req, res).catch(next)
})

router.delete('/agents/:id', (req, res, next) => {
  controller.delete(req, res).catch(next)
})

router.post('/agents/:id/default', (req, res, next) => {
  controller.setDefault(req, res).catch(next)
})

router.post('/agents/:id/test', (req, res, next) => {
  controller.test(req, res).catch(next)
})

export { router as agentsRoutes }
