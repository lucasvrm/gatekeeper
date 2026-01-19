import { Router } from 'express'
import { ConfigController } from '../controllers/ConfigController.js'

const router = Router()
const controller = new ConfigController()

router.get('/config/sensitive-file-rules', (req, res, next) => {
  controller.listSensitiveFileRules(req, res).catch(next)
})

router.post('/config/sensitive-file-rules', (req, res, next) => {
  controller.createSensitiveFileRule(req, res).catch(next)
})

router.put('/config/sensitive-file-rules/:id', (req, res, next) => {
  controller.updateSensitiveFileRule(req, res).catch(next)
})

router.delete('/config/sensitive-file-rules/:id', (req, res, next) => {
  controller.deleteSensitiveFileRule(req, res).catch(next)
})

router.get('/config/ambiguous-terms', (req, res, next) => {
  controller.listAmbiguousTerms(req, res).catch(next)
})

router.post('/config/ambiguous-terms', (req, res, next) => {
  controller.createAmbiguousTerm(req, res).catch(next)
})

router.put('/config/ambiguous-terms/:id', (req, res, next) => {
  controller.updateAmbiguousTerm(req, res).catch(next)
})

router.delete('/config/ambiguous-terms/:id', (req, res, next) => {
  controller.deleteAmbiguousTerm(req, res).catch(next)
})

router.get('/config/validation-configs', (req, res, next) => {
  controller.listValidationConfigs(req, res).catch(next)
})

router.post('/config/validation-configs', (req, res, next) => {
  controller.createValidationConfig(req, res).catch(next)
})

router.put('/config/validation-configs/:id', (req, res, next) => {
  controller.updateValidationConfig(req, res).catch(next)
})

router.delete('/config/validation-configs/:id', (req, res, next) => {
  controller.deleteValidationConfig(req, res).catch(next)
})

router.get('/config/customization', (req, res, next) => {
  controller.getCustomization(req, res).catch(next)
})

router.put('/config/customization', (req, res, next) => {
  controller.updateCustomization(req, res).catch(next)
})

export { router as configRoutes }
