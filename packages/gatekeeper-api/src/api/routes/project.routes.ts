import { Router } from 'express'
import { ProjectController } from '../controllers/ProjectController.js'

const router = Router()
const controller = new ProjectController()

router.get('/projects', (req, res, next) => {
  controller.listProjects(req, res).catch(next)
})

router.get('/projects/:id', (req, res, next) => {
  controller.getProject(req, res).catch(next)
})

router.post('/projects', (req, res, next) => {
  controller.createProject(req, res).catch(next)
})

router.put('/projects/:id', (req, res, next) => {
  controller.updateProject(req, res).catch(next)
})

router.delete('/projects/:id', (req, res, next) => {
  controller.deleteProject(req, res).catch(next)
})

export { router as projectRoutes }
