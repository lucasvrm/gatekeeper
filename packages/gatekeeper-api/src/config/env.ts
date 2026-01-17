export interface EnvConfig {
  port: number
  nodeEnv: string
  logLevel: string
  databaseUrl: string
  isDevelopment: boolean
  isProduction: boolean
}

export const validateEnv = (env: NodeJS.ProcessEnv = process.env): EnvConfig => {
  const port = parseInt(env.PORT ?? '3000', 10)
  const nodeEnv = env.NODE_ENV ?? 'development'
  const logLevel = env.LOG_LEVEL ?? 'info'
  const databaseUrl = env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  return {
    port,
    nodeEnv,
    logLevel,
    databaseUrl,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
  }
}

export const env = validateEnv()
