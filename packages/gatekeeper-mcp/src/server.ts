/**
 * MCP Server v2 for Gatekeeper
 * 5 tools, 2 prompts, zero resources/notifications
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js'
import { GatekeeperClient } from './client/GatekeeperClient.js'
import { Config } from './config.js'
import { tools, handleToolCall } from './tools.js'
import { getAllPrompts, handlePromptRequest } from './prompts/index.js'

export interface ServerContext {
  server: Server
  client: GatekeeperClient
  config: Config
}

export function createServer(config: Config): ServerContext {
  const server = new Server(
    {
      name: 'gatekeeper-mcp',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  )

  const client = new GatekeeperClient({ baseUrl: config.GATEKEEPER_API_URL })

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools }
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
    const result = await handlePromptRequest(name, args ?? {}, {
      client,
      docsDir: config.DOCS_DIR,
    })
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
