/**
 * MCP Server v3 for Gatekeeper
 * 8 tools (5 pipeline + 3 workflow), 3 prompts, zero resources/notifications
 *
 * The 3 workflow tools (create_plan, generate_spec, implement_code) are
 * wrappers over the MCP prompts. This dual-registration ensures:
 * - Claude Desktop → uses tools (reliable, always works)
 * - Claude Code    → uses prompts via /mcp__gatekeeper__create_plan (or tools)
 * - Other clients  → whichever primitive they support
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
      version: '3.0.0',
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  )

  const client = new GatekeeperClient({ baseUrl: config.GATEKEEPER_API_URL })

  // Register tool handlers (includes workflow tools that wrap prompts)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params
    const result = await handleToolCall(name, args ?? {}, { client, config })
    return result as CallToolResult
  })

  // Register prompt handlers (kept for Claude Code and other clients that support prompts)
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: getAllPrompts() }
  })

  server.setRequestHandler(GetPromptRequestSchema, async (request): Promise<GetPromptResult> => {
    const { name, arguments: args } = request.params
    const result = await handlePromptRequest(name, args ?? {}, {
      client,
      docsDir: config.DOCS_DIR,
      artifactsDir: config.ARTIFACTS_DIR,
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
