/**
 * Gatekeeper Orchestrator — Artifact Parser
 *
 * Extracts named code blocks from LLM responses.
 *
 * Expected format from LLM:
 *
 *   ```microplans.json
 *   { "task": "...", "microplans": [...] }
 *   ```
 *
 *   ```plan.json  (deprecated, backwards compatible)
 *   { "outputId": "..." }
 *   ```
 *
 *   ```contract.md
 *   # Contract ...
 *   ```
 *
 * The parser is lenient: it handles optional language hints after the filename,
 * e.g. ```microplans.json json  or  ```task.spec.md markdown
 */

import type { ParsedArtifact } from './types.js'

/**
 * Required artifacts for microplans workflow (Step 1)
 */
export const MICROPLANS_REQUIRED = new Set(['microplans.json', 'task.spec.md'])

/**
 * Required artifacts for legacy plan workflow (Step 1)
 * @deprecated Use MICROPLANS_REQUIRED for new projects
 */
export const PLAN_REQUIRED = new Set(['plan.json', 'task.spec.md'])

/**
 * Extract all named code blocks from LLM text output.
 *
 * Pattern: ```<filename>[optional-extra]\n<content>\n```
 *
 * Filenames must contain a dot (to distinguish from plain language hints like ```json).
 */
export function parseArtifacts(text: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = []

  // Match: ```filename.ext[optional stuff]\n...\n```
  // The filename must contain at least one dot to be treated as a file
  const regex = /```([^\s`]+\.[^\s`]+)[^\n]*\n([\s\S]*?)```/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const filename = match[1].trim()
    const content = match[2].trimEnd()

    // Skip if filename looks like a language hint without a real extension
    // e.g. "typescript" has a dot-less name, but "plan.json" is fine
    if (!filename.includes('.')) continue

    artifacts.push({ filename, content })
  }

  return artifacts
}

/**
 * Validate that the required artifacts are present.
 * Supports both microplans.json (preferred) and plan.json (deprecated).
 * Returns list of missing filenames.
 */
export function validateArtifacts(
  artifacts: ParsedArtifact[],
  required: string[]
): string[] {
  const found = new Set(artifacts.map(a => a.filename))

  // Log deprecation warning if plan.json is used
  if (found.has('plan.json') && !found.has('microplans.json')) {
    console.log('⚠️ [DEPRECATED] plan.json is deprecated. Use microplans.json for new projects.')
  }

  // Accept either microplans.json OR plan.json
  const hasValidPlan = found.has('microplans.json') || found.has('plan.json')

  // Validate microplans.json schema if present
  if (found.has('microplans.json')) {
    const microplansArtifact = artifacts.find(a => a.filename === 'microplans.json')
    if (microplansArtifact) {
      try {
        const parsed = JSON.parse(microplansArtifact.content)

        // Basic schema validation
        if (!parsed.task || typeof parsed.task !== 'string') {
          console.error('❌ microplans.json: campo "task" (string) é obrigatório')
        }
        if (!Array.isArray(parsed.microplans) || parsed.microplans.length === 0) {
          console.error('❌ microplans.json: campo "microplans" (array não-vazio) é obrigatório')
        }
      } catch (err) {
        console.error(`❌ microplans.json: JSON inválido - ${(err as Error).message}`)
      }
    }
  }

  // Filter required artifacts, accepting either plan format
  return required.filter(r => {
    if (r === 'microplans.json' || r === 'plan.json') {
      return !hasValidPlan
    }
    return !found.has(r)
  })
}

/**
 * Extract the text content from an LLM response (excluding code blocks).
 * Useful for getting the LLM's commentary/corrections summary.
 */
export function extractCommentary(text: string): string {
  return text
    .replace(/```[^\n]*\n[\s\S]*?```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
