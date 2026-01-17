import { Router } from 'express'
import { validationRoutes } from './validation.routes.js'
import { runsRoutes } from './runs.routes.js'
import { configRoutes } from './config.routes.js'
import { validatorsRoutes } from './validators.routes.js'

const router = Router()

router.use('/', validationRoutes)
router.use('/', runsRoutes)
router.use('/', configRoutes)
router.use('/', validatorsRoutes)

export default router
