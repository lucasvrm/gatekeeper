import { Router } from 'express'
import { UIContractController } from '../controllers/UIContractController.js'

const router = Router()
const controller = new UIContractController()

router.get('/projects/:projectId/ui-contract', (req, res, next) => {
  controller.getContract(req, res).catch(next)
})

router.post('/projects/:projectId/ui-contract', (req, res, next) => {
  controller.createOrUpdate(req, res).catch(next)
})

router.delete('/projects/:projectId/ui-contract', (req, res, next) => {
  controller.deleteContract(req, res).catch(next)
})

export { router as uiContractRoutes }
