import { Router } from 'express'
import { MCPSnippetController } from '../controllers/MCPSnippetController.js'
import { MCPContextPackController } from '../controllers/MCPContextPackController.js'
import { MCPSessionPresetController } from '../controllers/MCPSessionPresetController.js'
import { MCPSessionConfigController } from '../controllers/MCPSessionConfigController.js'
import { MCPSessionHistoryController } from '../controllers/MCPSessionHistoryController.js'
import { MCPStatusController } from '../controllers/MCPStatusController.js'
import { MCPPromptController } from '../controllers/MCPPromptController.js'

const router = Router()

const snippetController = new MCPSnippetController()
const contextPackController = new MCPContextPackController()
const presetController = new MCPSessionPresetController()
const sessionConfigController = new MCPSessionConfigController()
const historyController = new MCPSessionHistoryController()
const statusController = new MCPStatusController()
const promptController = new MCPPromptController()

// Snippets CRUD
router.get('/mcp/snippets', (req, res, next) => {
  snippetController.list(req, res).catch(next)
})

router.post('/mcp/snippets', (req, res, next) => {
  snippetController.create(req, res).catch(next)
})

router.get('/mcp/snippets/:id', (req, res, next) => {
  snippetController.get(req, res).catch(next)
})

router.put('/mcp/snippets/:id', (req, res, next) => {
  snippetController.update(req, res).catch(next)
})

router.delete('/mcp/snippets/:id', (req, res, next) => {
  snippetController.delete(req, res).catch(next)
})

// Context Packs CRUD
router.get('/mcp/context-packs', (req, res, next) => {
  contextPackController.list(req, res).catch(next)
})

router.post('/mcp/context-packs', (req, res, next) => {
  contextPackController.create(req, res).catch(next)
})

router.get('/mcp/context-packs/:id', (req, res, next) => {
  contextPackController.get(req, res).catch(next)
})

router.put('/mcp/context-packs/:id', (req, res, next) => {
  contextPackController.update(req, res).catch(next)
})

router.delete('/mcp/context-packs/:id', (req, res, next) => {
  contextPackController.delete(req, res).catch(next)
})

// Session Presets CRUD
router.get('/mcp/presets', (req, res, next) => {
  presetController.list(req, res).catch(next)
})

router.post('/mcp/presets', (req, res, next) => {
  presetController.create(req, res).catch(next)
})

router.get('/mcp/presets/:id', (req, res, next) => {
  presetController.get(req, res).catch(next)
})

router.put('/mcp/presets/:id', (req, res, next) => {
  presetController.update(req, res).catch(next)
})

router.delete('/mcp/presets/:id', (req, res, next) => {
  presetController.delete(req, res).catch(next)
})

// Session Config (singleton)
router.get('/mcp/session', (req, res, next) => {
  sessionConfigController.get(req, res).catch(next)
})

router.put('/mcp/session', (req, res, next) => {
  sessionConfigController.update(req, res).catch(next)
})

// Session History
router.get('/mcp/history', (req, res, next) => {
  historyController.list(req, res).catch(next)
})

router.delete('/mcp/history/:id', (req, res, next) => {
  historyController.delete(req, res).catch(next)
})

// Status
router.get('/mcp/status', (req, res, next) => {
  statusController.get(req, res).catch(next)
})

// Prompt Instructions CRUD
router.get('/mcp/prompts', (req, res, next) => {
  promptController.list(req, res).catch(next)
})

router.post('/mcp/prompts', (req, res, next) => {
  promptController.create(req, res).catch(next)
})

router.get('/mcp/prompts/:id', (req, res, next) => {
  promptController.get(req, res).catch(next)
})

router.put('/mcp/prompts/:id', (req, res, next) => {
  promptController.update(req, res).catch(next)
})

router.delete('/mcp/prompts/:id', (req, res, next) => {
  promptController.delete(req, res).catch(next)
})

export { router as mcpRoutes }
