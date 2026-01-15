import { Router } from 'express'
import { ValidationController } from '../controllers/ValidationController.js'
import { CreateRunSchema } from '../schemas/validation.schema.js'

const router = Router()
const controller = new ValidationController()

router.post('/runs', async (req, res, next) => {
  try {
    const validatedData = CreateRunSchema.parse(req.body)
    req.body = validatedData
    await controller.createRun(req, res)
  } catch (error) {
    next(error)
  }
})

router.get('/gates', (req, res, next) => {
  controller.listGates(req, res).catch(next)
})

router.get('/gates/:number/validators', (req, res, next) => {
  controller.getGateValidators(req, res).catch(next)
})

router.get('/config', (req, res, next) => {
  controller.getConfig(req, res).catch(next)
})

router.put('/config/:key', (req, res, next) => {
  controller.updateConfig(req, res).catch(next)
})

export { router as validationRoutes }
