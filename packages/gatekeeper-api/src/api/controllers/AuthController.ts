import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { AuthService } from '../../services/AuthService.js'
import { loginSchema, registerSchema } from '../schemas/auth.schema.js'
import { ZodError } from 'zod'

const authService = new AuthService()

export class AuthController {
  /**
   * POST /api/auth/register
   * Creates a new user with email and password
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const input = registerSchema.parse(req.body)

      // Normalize email to lowercase for case-insensitive comparison
      const normalizedEmail = input.email.toLowerCase()

      // Check if email already exists (normalized to lowercase)
      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail
        }
      })

      if (existingUser) {
        res.status(409).json({
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Email already registered',
          path: req.path,
        })
        return
      }

      // Hash password and create user
      const passwordHash = await authService.hashPassword(input.password)
      const user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      })

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
          path: req.path,
        })
        return
      }
      console.error('Register error:', error)
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during registration',
        path: req.path,
      })
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates a user and returns a JWT token
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const input = loginSchema.parse(req.body)

      // Normalize email for case-insensitive lookup
      const normalizedEmail = input.email.toLowerCase()

      // Find user by email (case-insensitive)
      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        }
      })

      if (!user) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          path: req.path,
        })
        return
      }

      // Verify password
      const isValidPassword = await authService.verifyPassword(input.password, user.passwordHash)
      if (!isValidPassword) {
        res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          path: req.path,
        })
        return
      }

      // Generate token
      const token = authService.generateToken(user.id)

      res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
          path: req.path,
        })
        return
      }
      console.error('Login error:', error)
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
        path: req.path,
      })
    }
  }

  /**
   * GET /api/auth/me
   * Returns the current authenticated user
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      // Get userId from request (set by authMiddleware)
      const userId = (req as Request & { user?: { userId: string } }).user?.userId

      if (!userId) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
          path: req.path,
        })
        return
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
        },
      })

      if (!user) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'User not found',
          path: req.path,
        })
        return
      }

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
        },
      })
    } catch (error) {
      console.error('Me error:', error)
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An error occurred',
        path: req.path,
      })
    }
  }
}
