import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

interface AppError extends Error {
  statusCode?: number
  details?: unknown
}

export function errorHandler(
  err: AppError & { status?: number; type?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    console.error('Zod validation error:', {
      path: req.path,
      method: req.method,
      issues: err.issues,
    })
    res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: err.issues,
      path: req.path,
      code: 'VALIDATION_ERROR',
    })
    return
  }

  // Handle 413 Payload Too Large
  if (err.status === 413 || err.type === 'entity.too.large') {
    console.error('Payload too large:', {
      path: req.path,
      method: req.method,
      contentLength: req.headers['content-length'],
    })
    res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body exceeds maximum allowed size',
      maxSize: '10MB',
      code: 'PAYLOAD_TOO_LARGE',
    })
    return
  }

  const statusCode = err.statusCode || err.status || 500
  const message = err.message || 'Internal server error'

  console.error('Error:', {
    message,
    statusCode,
    details: err.details,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  res.status(statusCode).json({
    error: err.name || 'Error',
    message,
    details: err.details,
    path: req.path,
  })
}
