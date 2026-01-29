/**
 * Validator Tools
 * Tools for listing validators
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { ToolContext, ToolResult } from './index.js'
import type { GatekeeperError } from '../client/types.js'

export const validatorTools: Tool[] = [
  {
    name: 'list_validators',
    description: 'List all available validators',
    inputSchema: {
      type: 'object',
      properties: {
        gate: { type: 'number', description: 'Filter by gate number (0-3)' },
      },
    },
  },
]

export async function handleValidatorTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'list_validators': {
        const gate = args.gate as number | undefined
        let validators = await ctx.client.listValidators()

        if (gate !== undefined) {
          validators = validators.filter(v => v.gate === gate)
        }

        return { content: [{ type: 'text', text: JSON.stringify(validators) }] }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown validator tool: ${name}` }],
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
    return {
      content: [{ type: 'text', text: `error: ${err.message}` }],
      isError: true,
    }
  }
}
