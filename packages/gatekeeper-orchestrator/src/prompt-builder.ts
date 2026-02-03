/**
 * Gatekeeper Orchestrator — Prompt Builder
 *
 * Builds prompts for each pipeline step.
 * Reads reference docs from DOCS_DIR subfolders (same as MCP server).
 * Unlike the MCP prompts, these don't include STOP boundaries or save_artifacts
 * instructions — the orchestrator handles I/O externally.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { SessionContext, FixTarget } from './types.js'

// ─────────────────────────────────────────────────────────────────────────────
// Docs Reader (same as MCP's LocalDocsReader)
// ─────────────────────────────────────────────────────────────────────────────

function readDocsFolder(docsDir: string, subfolder: string): string {
  const dir = path.join(docsDir, subfolder)
  try {
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'))
    if (files.length === 0) return '[No reference docs found]'

    return files
      .map(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        return `### ${file}\n${content}`
      })
      .join('\n\n')
  } catch {
    return `[Docs folder not found: ${subfolder}]`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Create Plan
// ─────────────────────────────────────────────────────────────────────────────

export function buildPlanPrompt(
  taskDescription: string,
  outputId: string,
  docsDir: string,
  session: SessionContext,
  taskType?: string
): string {
  const docs = readDocsFolder(docsDir, 'create_plan')

  let prompt = `# Create Plan (Step 1/3)\n\n`
  prompt += `## Task\n${taskDescription}\n\n`
  prompt += `## OutputId\n${outputId}\n\n`

  if (taskType) {
    prompt += `## Task Type\n${taskType}\n\n`
  }

  prompt += `## Reference Documents\n${docs}\n\n`
  prompt += session.gitStrategy
  prompt += session.customInstructions

  prompt += `
## Output Required

Generate EXACTLY 3 artifacts as named code blocks:

1. **plan.json** — Structured task plan with fields:
   - outputId, taskPrompt, taskType
   - manifest (files to create/modify with descriptions)
   - baseRef, targetRef (git refs if applicable)

2. **contract.md** — Validation contract with:
   - Clause IDs (CL-001, CL-002, ...)
   - Each clause maps to a testable requirement
   - Acceptance criteria per clause

3. **task.spec.md** — Human-readable test specification:
   - Describes what each test should verify
   - Maps tests to clause IDs
   - Includes edge cases and expected behaviors

Do NOT generate test code or implementation code.
`

  return prompt
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Generate Spec Test
// ─────────────────────────────────────────────────────────────────────────────

export function buildSpecPrompt(
  outputId: string,
  planContent: string,
  contractContent: string,
  specContent: string,
  docsDir: string,
  session: SessionContext
): string {
  const docs = readDocsFolder(docsDir, 'generate_spec')

  let prompt = `# Generate Spec Test (Step 2/3)\n\n`
  prompt += `## OutputId\n${outputId}\n\n`
  prompt += `## Plan (plan.json)\n\`\`\`json\n${planContent}\n\`\`\`\n\n`
  prompt += `## Contract (contract.md)\n${contractContent}\n\n`
  prompt += `## Task Spec (task.spec.md)\n${specContent}\n\n`
  prompt += `## Reference Documents\n${docs}\n\n`
  prompt += session.gitStrategy
  prompt += session.customInstructions

  prompt += `
## Output Required

Generate a test code file as a single named code block. The filename should follow
the project's convention (e.g. \`feature-name.spec.ts\` or \`feature-name.test.ts\`).

Requirements:
- Implement EVERY test case described in task.spec.md
- Tag each test with its clause ID using \`// @clause CL-XXX\` comments
- Tests must be runnable (proper imports, setup, teardown)
- Use the testing framework indicated in the reference docs (or vitest/jest by default)

Do NOT implement production code. Only generate the test file.
`

  return prompt
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix: Correction after Gatekeeper rejection
// ─────────────────────────────────────────────────────────────────────────────

export function buildFixPrompt(
  target: FixTarget,
  outputId: string,
  artifacts: Record<string, string>,
  rejectionReport: string,
  failedValidators: string[],
  docsDir: string,
  session: SessionContext
): string {
  const subfolder = target === 'plan' ? 'create_plan' : 'generate_spec'
  const docs = readDocsFolder(docsDir, subfolder)

  let prompt = `# Fix ${target === 'plan' ? 'Plan' : 'Spec'} — Correction after Gatekeeper Rejection\n\n`
  prompt += `## OutputId\n${outputId}\n\n`

  // Include all current artifacts
  for (const [filename, content] of Object.entries(artifacts)) {
    const lang = filename.endsWith('.json') ? 'json' : ''
    prompt += `## Current: ${filename}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`
  }

  prompt += `## Gatekeeper Rejection Report\n${rejectionReport}\n\n`
  prompt += `## Failed Validators\n${failedValidators.map(v => `- ${v}`).join('\n')}\n\n`
  prompt += `## Reference Documents\n${docs}\n\n`
  prompt += session.gitStrategy
  prompt += session.customInstructions

  if (target === 'plan') {
    prompt += `
## Task

The Gatekeeper rejected the plan artifacts. Fix the issues described in the rejection report.

Output the CORRECTED versions of the affected artifacts as named code blocks:
- \`plan.json\` (if plan issues)
- \`contract.md\` (if contract issues)
- \`task.spec.md\` (if spec issues)

Only output files that need changes. Explain what you corrected before the code blocks.
`
  } else {
    prompt += `
## Task

The Gatekeeper rejected the test specification. Fix the issues described in the rejection report.

Output the CORRECTED test file as a named code block (same filename as the original).

Only output the test file. Explain what you corrected before the code block.
`
  }

  return prompt
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: Execute — Build prompt for Claude Agent SDK
// ─────────────────────────────────────────────────────────────────────────────

export function buildExecutionPrompt(
  outputId: string,
  artifacts: Record<string, string>,
  docsDir: string,
  session: SessionContext
): string {
  const docs = readDocsFolder(docsDir, 'implement_code')

  let prompt = `# Implement Code (Step 3/3)\n\n`
  prompt += `## OutputId\n${outputId}\n\n`

  // Include all artifacts
  for (const [filename, content] of Object.entries(artifacts)) {
    const lang = filename.endsWith('.json') ? 'json' : filename.endsWith('.ts') || filename.endsWith('.tsx') ? 'typescript' : ''
    prompt += `## ${filename}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`
  }

  prompt += `## Reference Documents\n${docs}\n\n`
  prompt += session.gitStrategy
  prompt += session.customInstructions

  prompt += `
## Task

Implement the production code so that ALL spec tests pass.

Rules:
- Do NOT modify any test file
- Do NOT modify task.spec.md, contract.md, or plan.json
- If a test seems incorrect, flag it but implement to pass it
- Run the tests after implementing to verify they pass
- Commit with a descriptive message referencing the outputId
`

  return prompt
}
