import { Router } from 'express'
import { configRoutes } from './config.routes.js'
import { runsRoutes } from './runs.routes.js'
import { validationRoutes } from './validation.routes.js'
import { validatorsRoutes } from './validators.routes.js'
import { workspaceRoutes } from './workspace.routes.js'
import { projectRoutes } from './project.routes.js'
import { gitRoutes } from './git.routes.js'
import { uiContractRoutes } from './ui-contract.routes.js'
import { themeRoutes } from './theme.routes.js'

const router = Router()

router.use('/', configRoutes)
router.use('/', runsRoutes)
router.use('/', validationRoutes)
router.use('/', validatorsRoutes)
router.use('/', workspaceRoutes)
router.use('/', projectRoutes)
router.use('/', gitRoutes)
router.use('/', uiContractRoutes)
router.use('/', themeRoutes)

export default router
