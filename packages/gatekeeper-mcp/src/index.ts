/**
 * Gatekeeper MCP Server
 * Entry point for the Model Context Protocol server
 */

export { startServer, createServer } from './server.js'
export { loadConfig, config } from './config.js'
export type { Config } from './config.js'
export type { ServerContext } from './server.js'

// Client exports
export { GatekeeperClient } from './client/GatekeeperClient.js'
export type * from './client/types.js'

// Run server if executed directly
import { config } from './config.js'
import { startServer } from './server.js'

const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  startServer(config).catch((error) => {
    console.error('Failed to start server:', error)
    process.exit(1)
  })
}
