/**
 * Project Tools
 * Tools for listing and getting projects
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'
import type { GatekeeperError } from '../client/types.js'

export const projectTools: Tool[] = [
  {
    name: 'list_projects',
    description: 'List all Gatekeeper projects',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Filter by workspace ID' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Get a specific project by ID',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
      },
      required: ['projectId'],
    },
  },
]

export async function handleProjectTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'list_projects': {
        const limit = args.limit as number | undefined
        const result = await ctx.client.listProjects({ limit })
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'get_project': {
        const projectId = args.projectId as string
        if (!projectId) {
          return {
            content: [{ type: 'text', text: 'Missing required field: projectId' }],
            isError: true,
          }
        }
        const result = await ctx.client.getProject(projectId)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown project tool: ${name}` }],
          isError: true,
        }
    }
  } catch (error) {
    const err = error as GatekeeperError
    if (err.code === 'ECONNREFUSED') {
      return {
        content: [{ type: 'text', text: 'error: API unavailable (ECONNREFUSED)' }],
        isError: true,
      }
    }
    if (err.status === 404) {
      return {
        content: [{ type: 'text', text: 'error: not found (404)' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: `error: ${err.message}` }],
      isError: true,
    }
  }
}
