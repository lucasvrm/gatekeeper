/**
 * Configuration module for Gatekeeper MCP Server
 * Loads environment variables with sensible defaults
 */

export interface Config {
  GATEKEEPER_API_URL: string
  DOCS_DIR: string
  ARTIFACTS_DIR: string
  NOTIFICATIONS_DESKTOP: boolean
  NOTIFICATIONS_SOUND: boolean
}

const POSSIBLE_PORTS = [3001, 3000, 3002] // Try most common ports

/**
 * Auto-discover Gatekeeper API by trying multiple ports
 */
async function discoverApiUrl(): Promise<string> {
  for (const port of POSSIBLE_PORTS) {
    try {
      const url = `http://localhost:${port}/health`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)
      
      const response = await fetch(url, { 
        signal: controller.signal,
        method: 'GET',
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const apiUrl = `http://localhost:${port}/api`
        console.error(`✓ Found Gatekeeper API at ${apiUrl}`)
        return apiUrl
      }
    } catch {
      // Port not available, try next
      continue
    }
  }
  
  // Fallback to default if no port responds
  console.error(`⚠ Could not auto-discover Gatekeeper API, using default: http://localhost:3000/api`)
  return 'http://localhost:3000/api'
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    GATEKEEPER_API_URL: env.GATEKEEPER_API_URL || 'http://localhost:3000/api',
    DOCS_DIR: env.DOCS_DIR || './docs',
    ARTIFACTS_DIR: env.ARTIFACTS_DIR || './artifacts',
    NOTIFICATIONS_DESKTOP: env.NOTIFICATIONS_DESKTOP !== 'false',
    NOTIFICATIONS_SOUND: env.NOTIFICATIONS_SOUND !== 'false',
  }
}

export async function loadConfigWithDiscovery(
  env: Record<string, string | undefined> = process.env
): Promise<Config> {
  const apiUrl = env.GATEKEEPER_API_URL || await discoverApiUrl()
  
  return {
    GATEKEEPER_API_URL: apiUrl,
    DOCS_DIR: env.DOCS_DIR || './docs',
    ARTIFACTS_DIR: env.ARTIFACTS_DIR || './artifacts',
    NOTIFICATIONS_DESKTOP: env.NOTIFICATIONS_DESKTOP !== 'false',
    NOTIFICATIONS_SOUND: env.NOTIFICATIONS_SOUND !== 'false',
  }
}

export const config = loadConfig()