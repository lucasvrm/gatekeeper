import type { Request, Response, NextFunction } from 'express'

interface AppError extends Error {
  statusCode?: number
  details?: any
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500
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
