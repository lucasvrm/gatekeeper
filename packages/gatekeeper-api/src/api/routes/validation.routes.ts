import { Router } from 'express'
import { ZodError } from 'zod'
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
    if (error instanceof ZodError) {
      const fields = error.errors.map(e => ({
        path: e.path.join('.'),
        expected: 'expected' in e ? e.expected : undefined,
        received: 'received' in e ? e.received : undefined,
        message: e.message,
      }))
      console.warn('[Validation] Contract schema error:', JSON.stringify(fields, null, 2))
      res.status(400).json({
        error: 'CONTRACT_SCHEMA_INVALID',
        message: 'O contrato gerado pelo LLM tem erros de schema: ' + fields.map(f => f.path + ' (' + f.message + ')').join(', '),
        fields,
      })
      return
    }
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
