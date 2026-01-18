import pino from 'pino'
import type { LogService as ILogService } from '../types/index.js'

export class LogService implements ILogService {
  private logger: pino.Logger
  private runId: string

  constructor(runId: string) {
    this.runId = runId
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    })
  }

  private enrichMetadata(metadata?: Record<string, unknown>) {
    return {
      runId: this.runId,
      ...metadata,
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(this.enrichMetadata(metadata), message)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logger.info(this.enrichMetadata(metadata), message)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(this.enrichMetadata(metadata), message)
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.logger.error(this.enrichMetadata(metadata), message)
  }
}
