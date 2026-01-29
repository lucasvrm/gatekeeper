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
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceResult,
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js'
import { GatekeeperClient } from './client/GatekeeperClient.js'
import { Config } from './config.js'
import { registerResources, handleReadResource } from './resources/index.js'
import { getAllTools, handleToolCall } from './tools/index.js'
import { getAllPrompts, handlePromptRequest } from './prompts/index.js'
import { initNotificationConfig } from './tools/notifications.tools.js'

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
        prompts: {},
      },
    }
  )

  const client = new GatekeeperClient({ baseUrl: config.GATEKEEPER_API_URL })

  // Initialize notification config from environment
  initNotificationConfig({
    desktop: config.NOTIFICATIONS_DESKTOP,
    sound: config.NOTIFICATIONS_SOUND,
  })

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: registerResources(config),
    }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
    return handleReadResource(request.params.uri, client, config)
  })

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: getAllTools() }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params
    const result = await handleToolCall(name, args ?? {}, { client, config })
    return result as CallToolResult
  })

  // Register prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: getAllPrompts() }
  })

  server.setRequestHandler(GetPromptRequestSchema, async (request): Promise<GetPromptResult> => {
    const { name, arguments: args } = request.params
    const result = handlePromptRequest(name, args ?? {}, config.DOCS_DIR)
    return result as GetPromptResult
  })

  return { server, client, config }
}

export async function startServer(config: Config): Promise<ServerContext> {
  const ctx = createServer(config)
  const transport = new StdioServerTransport()
  await ctx.server.connect(transport)
  return ctx
}
