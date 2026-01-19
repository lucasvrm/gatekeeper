import { Router } from 'express'
import { configRoutes } from './config.routes.js'
import { runsRoutes } from './runs.routes.js'
import { validationRoutes } from './validation.routes.js'
import { validatorsRoutes } from './validators.routes.js'

const router = Router()

router.use('/', configRoutes)
router.use('/', runsRoutes)
router.use('/', validationRoutes)
router.use('/', validatorsRoutes)

export default router
