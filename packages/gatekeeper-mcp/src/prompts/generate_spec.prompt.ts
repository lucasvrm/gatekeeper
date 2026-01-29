/**
 * Generate Spec Prompt
 * Generates test specification from contract
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { LocalDocsReader } from './LocalDocsReader.js'

export const generateSpecPrompt: Prompt = {
  name: 'generate_spec',
  description: 'Generate test specification from contract',
  arguments: [
    {
      name: 'contractContent',
      description: 'Content of contract.md',
      required: true,
    },
    {
      name: 'planContent',
      description: 'Content of plan.json',
      required: false,
    },
  ],
}

export function handleGenerateSpecPrompt(
  args: Record<string, unknown>,
  docsDir: string
): { messages: PromptMessage[] } {
  const reader = new LocalDocsReader(docsDir)
  const contractContent = args.contractContent as string
  const planContent = args.planContent as string | undefined

  const playbook = reader.readFile('SPEC_WRITER_PLAYBOOK.md')

  let text = `# Generate Spec

## Contract
${contractContent}
`

  if (planContent) {
    text += `
## Plan
${planContent}
`
  }

  text += `
## SPEC_WRITER_PLAYBOOK
${playbook}

Generate a test specification that covers all clauses in the contract.
Each test should be tagged with its corresponding clause ID using \`// @clause CL-XXX\` comments.
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
