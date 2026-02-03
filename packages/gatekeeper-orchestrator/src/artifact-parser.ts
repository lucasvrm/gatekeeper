/**
 * Gatekeeper Orchestrator — Artifact Parser
 *
 * Extracts named code blocks from LLM responses.
 *
 * Expected format from LLM:
 *
 *   ```plan.json
 *   { "outputId": "..." }
 *   ```
 *
 *   ```contract.md
 *   # Contract ...
 *   ```
 *
 * The parser is lenient: it handles optional language hints after the filename,
 * e.g. ```plan.json json  or  ```task.spec.md markdown
 */

import type { ParsedArtifact } from './types.js'

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
 * Returns list of missing filenames.
 */
export function validateArtifacts(
  artifacts: ParsedArtifact[],
  required: string[]
): string[] {
  const found = new Set(artifacts.map(a => a.filename))
  return required.filter(r => !found.has(r))
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
