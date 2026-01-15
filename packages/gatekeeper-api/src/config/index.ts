import 'dotenv/config'

const port = parseInt(process.env.PORT ?? '3000')
const nodeEnv = process.env.NODE_ENV ?? 'development'
const logLevel = process.env.LOG_LEVEL ?? 'info'
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const config = {
  port,
  nodeEnv,
  logLevel,
  databaseUrl,
  isDevelopment: nodeEnv === 'development',
  isProduction: nodeEnv === 'production',
}
