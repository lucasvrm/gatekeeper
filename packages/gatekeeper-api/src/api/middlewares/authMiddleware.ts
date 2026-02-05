import type { Request, Response, NextFunction } from 'express'
import { AuthService } from '../../services/AuthService.js'

const authService = new AuthService()

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
]

// Routes that start with these prefixes are public
const PUBLIC_PREFIXES = [
  '/health',
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

  // Skip authentication for public routes
  if (isPublicRoute(path)) {
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
