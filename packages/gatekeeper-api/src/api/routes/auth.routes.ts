import { Router } from 'express'
import { AuthController } from '../controllers/AuthController.js'

const router = Router()
const authController = new AuthController()

// POST /api/auth/register - Create a new user
router.post('/auth/register', (req, res) => authController.register(req, res))

// POST /api/auth/login - Authenticate user and get token
router.post('/auth/login', (req, res) => authController.login(req, res))

// GET /api/auth/me - Get current user (requires auth - handled by middleware)
router.get('/auth/me', (req, res) => authController.me(req, res))

export const authRoutes = router
