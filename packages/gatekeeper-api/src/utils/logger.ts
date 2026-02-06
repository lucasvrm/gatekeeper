/**
 * Logger estruturado com suporte opcional a Pino.
 *
 * Features:
 * - Logs estruturados em JSON (fácil parsing)
 * - Níveis configuráveis via LOG_LEVEL env var
 * - Context binding para adicionar metadata
 * - Fallback para console.log se Pino não estiver disponível
 *
 * Usage:
 * ```ts
 * import { createLogger } from '@/utils/logger'
 *
 * const log = createLogger('OrchestratorController')
 * log.info({ outputId }, 'Pipeline started')
 * log.error({ error }, 'Pipeline failed')
 * ```
 *
 * Para usar Pino (recomendado para produção):
 * npm install --workspace=gatekeeper-api pino pino-pretty
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const NODE_ENV = process.env.NODE_ENV || 'development'

const LOG_LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

const currentLogLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info

interface LogContext {
  service?: string
  [key: string]: unknown
}

interface Logger {
  trace(context: LogContext | string, message?: string): void
  debug(context: LogContext | string, message?: string): void
  info(context: LogContext | string, message?: string): void
  warn(context: LogContext | string, message?: string): void
  error(context: LogContext | string, message?: string): void
  fatal(context: LogContext | string, message?: string): void
  child(context: LogContext): Logger
}

/**
 * Cria um logger usando Pino se disponível, senão fallback para console estruturado.
 */
function createBaseLogger(): Logger {
  // Try to use Pino if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pino = require('pino')

    return pino({
      level: LOG_LEVEL,
      transport:
        NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    }) as Logger
  } catch {
    // Pino not available, use console fallback
    return createConsoleLogger({})
  }
}

/**
 * Fallback logger usando console com formato estruturado.
 */
function createConsoleLogger(context: LogContext): Logger {
  function shouldLog(level: string): boolean {
    return LOG_LEVELS[level] >= currentLogLevel
  }

  function log(level: string, contextOrMsg: LogContext | string, message?: string) {
    if (!shouldLog(level)) return

    const timestamp = new Date().toISOString()
    const isContextObj = typeof contextOrMsg === 'object'
    const msg = isContextObj ? message : contextOrMsg
    const ctx = isContextObj ? { ...context, ...contextOrMsg } : context

    const logObj = {
      level,
      time: timestamp,
      ...ctx,
      msg,
    }

    const output = NODE_ENV === 'development' ? formatPretty(logObj) : JSON.stringify(logObj)

    if (level === 'error' || level === 'fatal') {
      console.error(output)
    } else if (level === 'warn') {
      console.warn(output)
    } else {
      console.log(output)
    }
  }

  function formatPretty(logObj: Record<string, unknown>): string {
    const { level, time, service, msg, ...rest } = logObj
    const timeStr = typeof time === 'string' ? time.substring(11, 19) : ''
    const serviceStr = service ? `[${service}]` : ''
    const levelStr = (level as string).toUpperCase().padEnd(5)
    const restStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
    return `${timeStr} ${levelStr} ${serviceStr} ${msg}${restStr}`
  }

  return {
    trace: (ctx, msg) => log('trace', ctx, msg),
    debug: (ctx, msg) => log('debug', ctx, msg),
    info: (ctx, msg) => log('info', ctx, msg),
    warn: (ctx, msg) => log('warn', ctx, msg),
    error: (ctx, msg) => log('error', ctx, msg),
    fatal: (ctx, msg) => log('fatal', ctx, msg),
    child: (childContext) => createConsoleLogger({ ...context, ...childContext }),
  }
}

const baseLogger = createBaseLogger()

/**
 * Create a child logger with a service name context.
 */
export function createLogger(service: string): Logger {
  return baseLogger.child({ service })
}

/**
 * Default logger for general use.
 */
export const logger = baseLogger
