import { Router } from 'express'
import { ThemeController } from '../controllers/ThemeController.js'

const router = Router()
const controller = new ThemeController()

router.post('/themes', (req, res) => controller.createTheme(req, res))
router.get('/themes', (req, res) => controller.listThemes(req, res))
router.get('/themes/active', (req, res) => controller.getActiveTheme(req, res))
router.put('/themes/:themeId/activate', (req, res) => controller.activateTheme(req, res))
router.delete('/themes/:themeId', (req, res) => controller.deleteTheme(req, res))
router.post('/themes/preview', (req, res) => controller.previewTheme(req, res))

export { router as themeRoutes }
