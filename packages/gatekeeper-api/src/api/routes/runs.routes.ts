import { Router } from 'express'
import { RunsController } from '../controllers/RunsController.js'

const router = Router()
const controller = new RunsController()

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

export { router as runsRoutes }
