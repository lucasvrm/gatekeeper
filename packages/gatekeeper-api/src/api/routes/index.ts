import { Router } from 'express'
import { validationRoutes } from './validation.routes.js'
import { runsRoutes } from './runs.routes.js'

const router = Router()

router.use('/', validationRoutes)
router.use('/', runsRoutes)

export default router
