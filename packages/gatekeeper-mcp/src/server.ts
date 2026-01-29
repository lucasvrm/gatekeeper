/**
 * MCP Server setup for Gatekeeper
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js'
import { GatekeeperClient } from './client/GatekeeperClient.js'
import { Config } from './config.js'
import { registerResources, handleReadResource } from './resources/index.js'

export interface ServerContext {
  server: Server
  client: GatekeeperClient
  config: Config
}

export function createServer(config: Config): ServerContext {
  const server = new Server(
    {
      name: 'gatekeeper-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  )

  const client = new GatekeeperClient({ baseUrl: config.GATEKEEPER_API_URL })

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: registerResources(config),
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
    return handleReadResource(request.params.uri, client, config)
  })

  // Placeholder for tools (Phase 2)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [] }
  })

  server.setRequestHandler(CallToolRequestSchema, async () => {
    throw new Error('No tools available')
  })

  return { server, client, config }
}

export async function startServer(config: Config): Promise<ServerContext> {
  const ctx = createServer(config)
  const transport = new StdioServerTransport()
  await ctx.server.connect(transport)
  return ctx
}
