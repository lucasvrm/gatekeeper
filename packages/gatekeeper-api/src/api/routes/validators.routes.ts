import { Router } from 'express'
import { ValidatorController } from '../controllers/ValidatorController.js'

const router = Router()
const controller = new ValidatorController()

router.get('/validators', (req, res, next) => {
  controller.listValidators(req, res).catch(next)
})

router.get('/validators/:name', (req, res, next) => {
  controller.getValidator(req, res).catch(next)
})

router.put('/validators/:name', (req, res, next) => {
  controller.updateValidator(req, res).catch(next)
})

export { router as validatorsRoutes }
