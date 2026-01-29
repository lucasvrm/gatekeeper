/**
 * Session Tools
 * Tools for reading session configuration (READ-ONLY)
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'

export const sessionTools: Tool[] = [
  {
    name: 'get_session_config',
    description: 'Get current MCP session configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_active_context_files',
    description: 'List files available in DOCS_DIR',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_active_snippets',
    description: 'Get available code snippets (placeholder for Plano 3)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_variables',
    description: 'Get resolved environment variables',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

export async function handleSessionTool(
  name: string,
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_session_config': {
        const config = {
          GATEKEEPER_API_URL: ctx.config.GATEKEEPER_API_URL,
          DOCS_DIR: ctx.config.DOCS_DIR,
          ARTIFACTS_DIR: ctx.config.ARTIFACTS_DIR,
          notifications: {
            desktop: ctx.config.NOTIFICATIONS_DESKTOP,
            sound: ctx.config.NOTIFICATIONS_SOUND,
          },
        }
        return { content: [{ type: 'text', text: JSON.stringify(config) }] }
      }

      case 'get_active_context_files': {
        if (!fs.existsSync(ctx.config.DOCS_DIR)) {
          return { content: [{ type: 'text', text: JSON.stringify([]) }] }
        }

        const files = fs.readdirSync(ctx.config.DOCS_DIR)
          .filter(f => f.endsWith('.md'))

        return { content: [{ type: 'text', text: JSON.stringify(files) }] }
      }

      case 'get_active_snippets': {
        // Placeholder for Plano 3 - returns empty array
        return { content: [{ type: 'text', text: JSON.stringify([]) }] }
      }

      case 'get_variables': {
        const variables = {
          GATEKEEPER_API_URL: ctx.config.GATEKEEPER_API_URL,
          DOCS_DIR: ctx.config.DOCS_DIR,
          ARTIFACTS_DIR: ctx.config.ARTIFACTS_DIR,
        }
        return { content: [{ type: 'text', text: JSON.stringify(variables) }] }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown session tool: ${name}` }],
          isError: true,
        }
    }
  } catch (error) {
    const err = error as Error
    return {
      content: [{ type: 'text', text: `error: ${err.message}` }],
      isError: true,
    }
  }
}
