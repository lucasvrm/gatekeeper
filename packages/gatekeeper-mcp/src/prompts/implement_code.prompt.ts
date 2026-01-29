/**
 * Implement Code Prompt
 * Implements code following the spec and contract
 */

import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { LocalDocsReader } from './LocalDocsReader.js'

export const implementCodePrompt: Prompt = {
  name: 'implement_code',
  description: 'Implement code following the spec and contract',
  arguments: [
    {
      name: 'specContent',
      description: 'Content of the spec file',
      required: true,
    },
    {
      name: 'contractContent',
      description: 'Content of contract.md',
      required: true,
    },
  ],
}

export function handleImplementCodePrompt(
  args: Record<string, unknown>,
  docsDir: string
): { messages: PromptMessage[] } {
  const reader = new LocalDocsReader(docsDir)
  const specContent = args.specContent as string
  const contractContent = args.contractContent as string

  const playbook = reader.readFile('EXECUTOR_PLAYBOOK.md')

  const text = `# Implement Code

## Contract
${contractContent}

## Spec
${specContent}

## EXECUTOR_PLAYBOOK
${playbook}

Implement the code to make all tests pass.
Follow the manifest strictly - only modify files listed in the manifest.
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
