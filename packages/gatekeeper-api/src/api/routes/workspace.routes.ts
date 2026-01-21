import { Router } from 'express'
import { WorkspaceController } from '../controllers/WorkspaceController.js'

const router = Router()
const controller = new WorkspaceController()

// Workspace CRUD
router.get('/workspaces', (req, res, next) => {
  controller.listWorkspaces(req, res).catch(next)
})

router.get('/workspaces/:id', (req, res, next) => {
  controller.getWorkspace(req, res).catch(next)
})

router.post('/workspaces', (req, res, next) => {
  controller.createWorkspace(req, res).catch(next)
})

router.put('/workspaces/:id', (req, res, next) => {
  controller.updateWorkspace(req, res).catch(next)
})

router.delete('/workspaces/:id', (req, res, next) => {
  controller.deleteWorkspace(req, res).catch(next)
})

// Workspace configs
router.get('/workspaces/:id/configs', (req, res, next) => {
  controller.getWorkspaceConfigs(req, res).catch(next)
})

router.put('/workspaces/:id/configs/:key', (req, res, next) => {
  controller.updateWorkspaceConfig(req, res).catch(next)
})

router.delete('/workspaces/:id/configs/:key', (req, res, next) => {
  controller.deleteWorkspaceConfig(req, res).catch(next)
})

export { router as workspaceRoutes }
