import { Router } from 'express'
import { HealthController } from '../controllers/HealthController.js'

const router = Router()
const controller = new HealthController()

router.get('/health', (req, res, next) => {
  controller.getHealth(req, res).catch(next)
})

export { router as healthRoutes }
