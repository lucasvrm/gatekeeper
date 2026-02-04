import { Router } from 'express'
import { configRoutes } from './config.routes.js'
import { runsRoutes } from './runs.routes.js'
import { validationRoutes } from './validation.routes.js'
import { validatorsRoutes } from './validators.routes.js'
import { workspaceRoutes } from './workspace.routes.js'
import { projectRoutes } from './project.routes.js'
import { gitRoutes } from './git.routes.js'
import { mcpRoutes } from './mcp.routes.js'
import { orchestratorRoutes } from './orchestrator.routes.js'
import { orchestratorContentRoutes } from './orchestrator-content.routes.js'
import { agentRoutes } from './agent.routes.js'
import { healthRoutes } from './health.routes.js'

const router = Router()

router.use('/', healthRoutes)
router.use('/', configRoutes)
router.use('/', runsRoutes)
router.use('/', validationRoutes)
router.use('/', validatorsRoutes)
router.use('/', workspaceRoutes)
router.use('/', projectRoutes)
router.use('/', gitRoutes)
router.use('/', mcpRoutes)
router.use('/orchestrator', orchestratorRoutes)
router.use('/', orchestratorContentRoutes)
router.use('/agent', agentRoutes)

export default router
