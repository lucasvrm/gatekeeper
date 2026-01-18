import type { TestAssertion, ClauseTag } from '../types/contract.types.js'

/**
 * Regex patterns for detecting different types of assertions in test files.
 * Following T024-T025 decisions for assertion detection.
 */
const ASSERTION_PATTERNS = {
  // expect() calls: expect(...).toBe(), expect(...).toEqual(), etc.
  expect: /expect\s*\(/,
  // assert() calls: assert(...), assert.equal(), etc.
  assert: /assert\s*[(.]/,
  // snapshot assertions: toMatchSnapshot(), toMatchInlineSnapshot()
  snapshot: /toMatchSnapshot|toMatchInlineSnapshot/,
  // mock/spy assertions: toHaveBeenCalled, etc.
  mock: /toHaveBeenCalled|toHaveBeenCalledWith|toHaveBeenCalledTimes/,
  // structural assertions: toBeDefined, toBeNull, toBeUndefined, etc.
  structural: /toBeDefined|toBeNull|toBeUndefined|toBeTruthy|toBeFalsy|toBeInstanceOf/,
} as const

/**
 * Parses assertions from test file content.
 * Returns array of TestAssertion objects with line numbers and types.
 *
 * @param fileContent - The test file content as string
 * @param filePath - Path to the test file (for reporting)
 * @returns Array of TestAssertion objects found in the file
 */
export function parseAssertions(fileContent: string, filePath: string): TestAssertion[] {
  const lines = fileContent.split('\n')
  const assertions: TestAssertion[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Skip comments and empty lines
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue
    }

    // Check each assertion pattern
    for (const [type, pattern] of Object.entries(ASSERTION_PATTERNS)) {
      if (pattern.test(line)) {
        assertions.push({
          type: type as TestAssertion['type'],
          file: filePath,
          line: i + 1, // 1-indexed line numbers
          code: trimmed,
          mappedClauses: [], // Will be filled by mapAssertionsToClauses()
        })
        break // Only count one assertion per line
      }
    }
  }

  return assertions
}

/**
 * Maps assertions to clause IDs based on nearby @clause tags.
 * Uses a simple heuristic: an assertion is mapped to the most recent @clause tag(s)
 * that appear before it (up to a maximum distance).
 *
 * @param assertions - Array of parsed assertions
 * @param clauseTags - Array of parsed @clause tags
 * @param maxDistance - Maximum line distance to consider (default: 50 lines)
 * @returns Assertions with mappedClauses populated
 */
export function mapAssertionsToClauses(
  assertions: TestAssertion[],
  clauseTags: ClauseTag[],
  maxDistance: number = 50
): TestAssertion[] {
  return assertions.map(assertion => {
    // Find @clause tags that appear before this assertion (within maxDistance)
    const applicableTags = clauseTags.filter(tag => {
      const distance = assertion.line - tag.line
      return distance > 0 && distance <= maxDistance
    })

    // Sort by proximity (closest first)
    applicableTags.sort((a, b) => (assertion.line - b.line) - (assertion.line - a.line))

    // Group consecutive @clause tags (within 5 lines of each other)
    const mappedClauses: string[] = []
    let lastTagLine = -1

    for (const tag of applicableTags) {
      if (lastTagLine === -1 || (lastTagLine - tag.line) <= 5) {
        if (!mappedClauses.includes(tag.clauseId)) {
          mappedClauses.push(tag.clauseId)
        }
        lastTagLine = tag.line
      } else {
        // Too far from previous tag, stop looking
        break
      }
    }

    return {
      ...assertion,
      mappedClauses,
    }
  })
}

/**
 * Finds assertions that have no clause mappings (out-of-contract assertions).
 *
 * @param assertions - Array of assertions with mappedClauses populated
 * @returns Array of unmapped assertions
 */
export function findUnmappedAssertions(assertions: TestAssertion[]): TestAssertion[] {
  return assertions.filter(assertion => assertion.mappedClauses.length === 0)
}
