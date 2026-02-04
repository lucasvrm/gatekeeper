import { Router } from 'express'
import { GitController } from '../controllers/GitController.js'

const router = Router()
const gitController = new GitController()

// Git operations routes
router.post('/git/status', (req, res) => gitController.getStatus(req, res))
router.post('/git/add', (req, res) => gitController.add(req, res))
router.post('/git/add-files', (req, res) => gitController.addFiles(req, res))
router.post('/git/changed-files', (req, res) => gitController.getChangedFiles(req, res))
router.post('/git/commit', (req, res) => gitController.commit(req, res))
router.get('/git/diff', (req, res) => gitController.getDiff(req, res))
router.post('/git/push', (req, res) => gitController.push(req, res))
router.post('/git/pull', (req, res) => gitController.pull(req, res))
router.post('/git/fetch-status', (req, res) => gitController.fetchStatus(req, res))
router.get('/git/branch', (req, res) => gitController.getBranch(req, res))

export { router as gitRoutes }
