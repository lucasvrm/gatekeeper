/**
 * Create Plan Prompt
 * Generates a task plan using Gatekeeper methodology
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { LocalDocsReader } from './LocalDocsReader.js'

export const createPlanPrompt: Prompt = {
  name: 'create_plan',
  description: 'Generate a task plan using Gatekeeper methodology',
  arguments: [
    {
      name: 'taskDescription',
      description: 'Description of the task to plan',
      required: true,
    },
    {
      name: 'taskType',
      description: 'Type: A-M or UI (see questionnaire)',
      required: false,
    },
  ],
}

export function handleCreatePlanPrompt(
  args: Record<string, unknown>,
  docsDir: string
): { messages: PromptMessage[] } {
  const reader = new LocalDocsReader(docsDir)
  const taskDescription = args.taskDescription as string
  const taskType = args.taskType as string | undefined

  const questionnaires = reader.readFile('CONTRACT_QUESTIONNAIRES.md')
  const playbook = reader.readFile('PLANNER_PLAYBOOK.md')
  const contractTemplate = reader.readFile('contract_template.md')
  const planTemplate = reader.readFile('plan_template.json')

  let text = `# Create Plan

## Task
${taskDescription}
`

  if (taskType) {
    text += `
## Task Type
${taskType}
`
  }

  text += `
## CONTRACT_QUESTIONNAIRES
${questionnaires}

## PLANNER_PLAYBOOK
${playbook}

## Contract Template
${contractTemplate}

## Plan Template
${planTemplate}
`

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text,
        },
      },
    ],
  }
}
