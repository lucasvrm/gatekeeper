import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../services/AuthService.js'

const authService = new AuthService()
const GRACE_PERIOD_SECONDS = 900 // 15 minutes

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
]

// Routes that start with these prefixes are public
// SSE endpoints are public because EventSource API cannot send Authorization headers
const PUBLIC_PREFIXES = [
  '/health',
  '/api/orchestrator/events/',
  '/api/agent/events/',
  '/api/orchestrator/run', // E2E testing endpoint
  '/api/orchestrator/cleanup-logs', // Admin endpoint (should be protected in production)
]

// SSE endpoints and E2E test endpoints that need pattern matching
const SSE_PATTERNS = [
  /^\/api\/runs\/[^/]+\/events$/,
  /^\/api\/orchestrator\/[^/]+\/(status|events)$/,  // E2E testing endpoints
]

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(path: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(path)) {
    return true
  }

  // Check prefixes
  for (const prefix of PUBLIC_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true
    }
  }

  // Check SSE patterns
  for (const pattern of SSE_PATTERNS) {
    if (pattern.test(path)) {
      return true
    }
  }

  return false
}

/**
 * Authentication middleware
 * - Checks for Bearer token in Authorization header
 * - Validates the JWT token
 * - Attaches user info to request
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path
  const isPublic = isPublicRoute(path)
  console.log(`[authMiddleware] ${req.method} ${path} - isPublic: ${isPublic}`)

  // Skip authentication for public routes
  if (isPublic) {
    next()
    return
  }

  // Get Authorization header
  const authHeader = req.headers.authorization

  // Check if Authorization header is present
  if (!authHeader || authHeader === '') {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
      path: req.path,
    })
    return
  }

  // Check if it's a Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid authorization header format',
      path: req.path,
    })
    return
  }

  // Extract token
  const token = authHeader.substring(7)

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token not provided',
      path: req.path,
    })
    return
  }

  // Check token status
  const tokenStatus = authService.checkTokenStatus(token)

  if (tokenStatus === 'expired') {
    // Grace period: accept tokens expired within the last 15 minutes
    try {
      const jwtSecret = process.env.JWT_SECRET || 'test-secret-key'
      const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true }) as { userId?: string; exp?: number }
      const expiredAt = (decoded.exp || 0) * 1000
      const graceDeadline = expiredAt + GRACE_PERIOD_SECONDS * 1000

      if (decoded.userId && Date.now() < graceDeadline) {
        // Within grace period — renew token and continue
        const newToken = authService.generateToken(decoded.userId)
        res.setHeader('X-Renewed-Token', newToken)
        ;(req as Request & { user: { userId: string } }).user = {
          userId: decoded.userId,
        }
        next()
        return
      }
    } catch {
      // Fall through to expired response
    }

    res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Token has expired',
      path: req.path,
    })
    return
  }

  if (tokenStatus === 'invalid') {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid token',
      path: req.path,
    })
    return
  }

  // Token is valid, decode it
  const decoded = authService.verifyToken(token)

  if (!decoded || !decoded.userId) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid token payload',
      path: req.path,
    })
    return
  }

  // Attach user info to request
  ;(req as Request & { user: { userId: string } }).user = {
    userId: decoded.userId,
  }

  next()
}
