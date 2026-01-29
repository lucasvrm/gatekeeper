/**
 * Run Tools
 * Tools for managing validation runs
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'
import type { GatekeeperError, CreateRunInput } from '../client/types.js'

export const runTools: Tool[] = [
  {
    name: 'create_run',
    description: 'Create a new validation run',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        outputId: { type: 'string', description: 'Output ID for artifacts' },
        taskPrompt: { type: 'string', description: 'Task description' },
        manifest: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  action: { type: 'string', enum: ['CREATE', 'MODIFY', 'DELETE'] },
                  reason: { type: 'string' },
                },
                required: ['path', 'action'],
              },
            },
            testFile: { type: 'string' },
          },
          required: ['files', 'testFile'],
        },
        dangerMode: { type: 'boolean', description: 'Enable danger mode' },
      },
      required: ['outputId', 'taskPrompt', 'manifest'],
    },
  },
  {
    name: 'get_run_status',
    description: 'Get current status of a validation run',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'list_runs',
    description: 'List validation runs',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Filter by project ID' },
        status: {
          type: 'string',
          enum: ['PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ABORTED'],
          description: 'Filter by status',
        },
        limit: { type: 'number', description: 'Max results' },
      },
    },
  },
  {
    name: 'abort_run',
    description: 'Abort a running validation',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID to abort' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'upload_spec',
    description: 'Upload spec file to a run',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID' },
        specContent: { type: 'string', description: 'Content of the spec file' },
        specFileName: { type: 'string', description: 'Filename (e.g., Button.spec.tsx)' },
        planJson: { type: 'object', description: 'Optional plan.json content' },
      },
      required: ['runId', 'specContent', 'specFileName'],
    },
  },
  {
    name: 'continue_run',
    description: 'Continue/rerun a failed gate',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID' },
        gateNumber: { type: 'number', description: 'Gate to rerun (0-3)' },
      },
      required: ['runId'],
    },
  },
]

export async function handleRunTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'create_run': {
        const { outputId, taskPrompt, manifest, projectId, dangerMode } = args as {
          outputId?: string
          taskPrompt?: string
          manifest?: CreateRunInput['manifest']
          projectId?: string
          dangerMode?: boolean
        }

        if (!outputId || !taskPrompt || !manifest) {
          return {
            content: [{ type: 'text', text: 'Missing required fields: outputId, taskPrompt, manifest' }],
            isError: true,
          }
        }

        const input: CreateRunInput = {
          outputId,
          taskPrompt,
          manifest,
          projectId,
          dangerMode,
        }
        const result = await ctx.client.createRun(input)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'get_run_status': {
        const runId = args.runId as string
        if (!runId) {
          return {
            content: [{ type: 'text', text: 'Missing required field: runId' }],
            isError: true,
          }
        }
        const result = await ctx.client.getRun(runId)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'list_runs': {
        const limit = args.limit as number | undefined
        const result = await ctx.client.listRuns({ limit })
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'abort_run': {
        const runId = args.runId as string
        if (!runId) {
          return {
            content: [{ type: 'text', text: 'Missing required field: runId' }],
            isError: true,
          }
        }
        const result = await ctx.client.abortRun(runId)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'upload_spec': {
        const { runId, specContent, specFileName, planJson } = args as {
          runId: string
          specContent: string
          specFileName: string
          planJson?: Record<string, unknown>
        }

        if (!runId || !specContent || !specFileName) {
          return {
            content: [{ type: 'text', text: 'Missing required fields: runId, specContent, specFileName' }],
            isError: true,
          }
        }

        const files = [{ filename: specFileName, content: specContent }]
        if (planJson) {
          files.push({ filename: 'plan.json', content: JSON.stringify(planJson) })
        }

        const result = await ctx.client.uploadRunFiles(runId, files)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      case 'continue_run': {
        const { runId, gateNumber } = args as { runId: string; gateNumber?: number }
        if (!runId) {
          return {
            content: [{ type: 'text', text: 'Missing required field: runId' }],
            isError: true,
          }
        }
        const result = await ctx.client.continueRun(runId, gateNumber ?? 0)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown run tool: ${name}` }],
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
