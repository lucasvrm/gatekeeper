/**
 * MCP Prompts Registry
 * Exports all prompt definitions and handlers
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { createPlanPrompt, handleCreatePlanPrompt } from './create_plan.prompt.js'
import { generateSpecPrompt, handleGenerateSpecPrompt } from './generate_spec.prompt.js'
import { implementCodePrompt, handleImplementCodePrompt } from './implement_code.prompt.js'
import { fixGateFailurePrompt, handleFixGateFailurePrompt } from './fix_gate_failure.prompt.js'

export interface PromptResult {
  messages: PromptMessage[]
}

/**
 * Get all registered prompts
 */
export function getAllPrompts(): Prompt[] {
  return [
    createPlanPrompt,
    generateSpecPrompt,
    implementCodePrompt,
    fixGateFailurePrompt,
  ]
}

/**
 * Handle a prompt request
 */
export function handlePromptRequest(
  name: string,
  args: Record<string, unknown>,
  docsDir: string
): PromptResult {
  switch (name) {
    case 'create_plan':
      return handleCreatePlanPrompt(args, docsDir)

    case 'generate_spec':
      return handleGenerateSpecPrompt(args, docsDir)

    case 'implement_code':
      return handleImplementCodePrompt(args, docsDir)

    case 'fix_gate_failure':
      return handleFixGateFailurePrompt(args)

    default:
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Unknown prompt: ${name}`,
            },
          },
        ],
      }
  }
}

export { LocalDocsReader } from './LocalDocsReader.js'
