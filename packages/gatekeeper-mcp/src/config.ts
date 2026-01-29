/**
 * Configuration module for Gatekeeper MCP Server
 * Loads environment variables with sensible defaults
 */

export interface Config {
  GATEKEEPER_API_URL: string
  DOCS_DIR: string
  ARTIFACTS_DIR: string
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    GATEKEEPER_API_URL: env.GATEKEEPER_API_URL || 'http://localhost:3000',
    DOCS_DIR: env.DOCS_DIR || './docs',
    ARTIFACTS_DIR: env.ARTIFACTS_DIR || './artifacts',
  }
}

export const config = loadConfig()
