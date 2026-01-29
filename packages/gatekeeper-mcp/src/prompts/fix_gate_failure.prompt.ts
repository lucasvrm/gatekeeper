/**
 * Fix Gate Failure Prompt
 * Generates guidance to fix a gate failure
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'

export const fixGateFailurePrompt: Prompt = {
  name: 'fix_gate_failure',
  description: 'Generate guidance to fix a gate failure',
  arguments: [
    {
      name: 'validatorCode',
      description: 'Code of the failed validator',
      required: true,
    },
    {
      name: 'errorMessage',
      description: 'Error message from validator',
      required: true,
    },
    {
      name: 'context',
      description: 'Additional context (diff, files)',
      required: false,
    },
  ],
}

export function handleFixGateFailurePrompt(
  args: Record<string, unknown>
): { messages: PromptMessage[] } {
  const validatorCode = args.validatorCode as string
  const errorMessage = args.errorMessage as string
  const context = args.context as string | undefined

  let text = `# Fix Gate Failure

## Validator: ${validatorCode}

## Error
${errorMessage}
`

  if (context) {
    text += `
## Additional Context
${context}
`
  }

  text += `
## Guidance

Analyze the failure above and provide:
1. Root cause analysis
2. Specific fix recommendations
3. Code changes needed (if applicable)

Focus on the minimum change required to pass this validator.
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
