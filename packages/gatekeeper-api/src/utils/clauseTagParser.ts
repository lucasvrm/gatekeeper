import type { ClauseTag } from '../types/contract.types.js'

/**
 * Regex for parsing @clause tags following T022 decision.
 * Format: // @clause CL-<TYPE>-<SEQUENCE>
 * Example: // @clause CL-ENDPOINT-001
 */
const CLAUSE_TAG_REGEX = /^\s*\/\/\s*@clause\s+(CL-[A-Z_]+-\d{3,})\s*$/

/**
 * Parses @clause tags from test file content.
 * Following T021 and T022 decisions.
 *
 * @param fileContent - The test file content as string
 * @param filePath - Path to the test file (for reporting)
 * @returns Array of ClauseTag objects found in the file
 */
export function parseClauseTags(fileContent: string, filePath: string): ClauseTag[] {
  const lines = fileContent.split('\n')
  const tags: ClauseTag[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line?.match(CLAUSE_TAG_REGEX)

    if (match && match[1]) {
      tags.push({
        clauseId: match[1],
        file: filePath,
        line: i + 1, // 1-indexed line numbers
      })
    }
  }

  return tags
}

/**
 * Validates that all clause IDs in tags exist in the contract.
 *
 * @param tags - Array of ClauseTag objects from test files
 * @param validClauseIds - Set of valid clause IDs from contract
 * @returns Array of invalid tags (tags referencing non-existent clauses)
 */
export function findInvalidClauseTags(
  tags: ClauseTag[],
  validClauseIds: Set<string>
): ClauseTag[] {
  return tags.filter(tag => !validClauseIds.has(tag.clauseId))
}

/**
 * Groups clause tags by clause ID.
 *
 * @param tags - Array of ClauseTag objects
 * @returns Map of clause ID to array of tags
 */
export function groupTagsByClauseId(tags: ClauseTag[]): Map<string, ClauseTag[]> {
  const grouped = new Map<string, ClauseTag[]>()

  for (const tag of tags) {
    const existing = grouped.get(tag.clauseId) || []
    existing.push(tag)
    grouped.set(tag.clauseId, existing)
  }

  return grouped
}
