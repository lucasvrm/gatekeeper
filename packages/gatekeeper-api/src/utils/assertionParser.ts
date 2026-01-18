import type { AssertionTarget, TestAssertion, ClauseTag } from '../types/contract.types.js'

/**
 * Regex patterns for detecting different types of assertions in test files.
 * Following T024-T025 decisions for assertion detection.
 */
const HTTP_CALL_PATTERN = /\b(?:request|agent|supertest|axios|client)\([^)]*\)\.(?:get|post|put|patch|delete|options|head)\s*\(/i

const ASSERTION_PATTERNS = {
  helper: /\b(render|fireEvent|screen\.|console\.)/i,
  httpCall: HTTP_CALL_PATTERN,
  expect: /expect\s*\(/,
  assert: /assert\s*[(.]/,
  snapshot: /toMatchSnapshot|toMatchInlineSnapshot/,
  mock: /toHaveBeenCalled|toHaveBeenCalledWith|toHaveBeenCalledTimes/,
  structural: /toBeDefined|toBeNull|toBeUndefined|toBeTruthy|toBeFalsy|toBeInstanceOf/,
} as const

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']
const ENDPOINT_METHOD_PATTERN = HTTP_METHODS.join('|')
const ERROR_HINT_REGEX = /(error|code|status)/i

const extractEndpointTargets = (line: string): AssertionTarget[] => {
  const targets: AssertionTarget[] = []
  const endpointRegex = new RegExp(
    `\\.(${ENDPOINT_METHOD_PATTERN})\\s*\\(\\s*['"\\u0060](/[^'"\\u0060\\s]+)['"\\u0060]`,
    'gi'
  )
  let match: RegExpExecArray | null

  while ((match = endpointRegex.exec(line)) !== null) {
    const method = match[1].toUpperCase()
    const path = match[2]
    if (!path.startsWith('/')) {
      continue
    }
    const value = `${method} ${path}`
    targets.push({
      type: 'endpoint',
      value,
      context: value,
    })
  }

  const fetchRegex = new RegExp(
    `fetch\\s*\\(\\s*['"\\u0060](/[^'"\\u0060\\s]+)['"\\u0060]`,
    'gi'
  )
  while ((match = fetchRegex.exec(line)) !== null) {
    if (!match[1].startsWith('/')) {
      continue
    }
    const value = `GET ${match[1]}`
    targets.push({
      type: 'endpoint',
      value,
      context: value,
    })
  }

  return targets
}

const extractStatusCodeTargets = (line: string, contexts: string[]): AssertionTarget[] => {
  const targets: AssertionTarget[] = []
  const statusRegex = /\.(?:status|statusCode)\s*\(\s*(\d{3})\s*\)/gi
  const assertionRegex = /\.(?:toBe|toEqual|toStrictEqual|toMatchObject|toHaveStatus)\s*\(\s*(\d{3})\s*\)/gi
  let match: RegExpExecArray | null

  while ((match = statusRegex.exec(line)) !== null) {
    targets.push({
      type: 'statusCode',
      value: match[1],
      context: contexts[0],
    })
  }

  while ((match = assertionRegex.exec(line)) !== null) {
    targets.push({
      type: 'statusCode',
      value: match[1],
      context: contexts[0],
    })
  }

  return targets
}

const extractErrorCodeTargets = (line: string): AssertionTarget[] => {
  if (!ERROR_HINT_REGEX.test(line)) {
    return []
  }

  const regex = /['"]([A-Z][_A-Z0-9]{2,})['"]/g
  const targets: AssertionTarget[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    targets.push({
      type: 'errorCode',
      value: match[1],
    })
  }

  return targets
}

const extractPayloadPathTargets = (line: string): AssertionTarget[] => {
  const targets: AssertionTarget[] = []
  const payloadRegex = /\b(?:response|res)\.body((?:\.\??[a-zA-Z0-9_]+)+)/gi
  let match: RegExpExecArray | null

  while ((match = payloadRegex.exec(line)) !== null) {
    const raw = match[1].replace(/\?\./g, '.').replace(/^\./, '')
    targets.push({
      type: 'payloadPath',
      value: raw,
    })
  }

  return targets
}

const extractSelectorTargets = (line: string): AssertionTarget[] => {
  const targets: AssertionTarget[] = []
  const selectorRegex = /(?:\.|cy\.)(?:get|find|querySelector(?:All)?)\s*\(\s*['"`]([^'"`]+)['"`]/gi
  let match: RegExpExecArray | null

  while ((match = selectorRegex.exec(line)) !== null) {
    targets.push({
      type: 'selector',
      value: match[1],
    })
  }

  return targets
}

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
        const endpointTargets = extractEndpointTargets(line)
        const targets: AssertionTarget[] = [
          ...endpointTargets,
          ...extractStatusCodeTargets(line, endpointTargets.map((target) => target.value)),
          ...extractErrorCodeTargets(line),
          ...extractPayloadPathTargets(line),
          ...extractSelectorTargets(line),
        ]

        assertions.push({
          type: type as TestAssertion['type'],
          file: filePath,
          line: i + 1, // 1-indexed line numbers
          code: trimmed,
          mappedClauses: [], // Will be filled by mapAssertionsToClauses()
          targets,
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
