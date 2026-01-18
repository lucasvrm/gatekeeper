import { ClauseTag } from '../types/contract.types.js'

export interface TestCase {
  name: string
  startLine: number
  endLine: number
  tags: ClauseTag[]
}

const TEST_DEFINITION_REGEX = /\b(it|test)(?:\.(?:only|skip|todo|concurrent))?\s*\(\s*['"`]([^'"`]+)['"`]/g

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const extractTestCases = (fileContent: string): TestCase[] => {
  const lines = fileContent.split('\n')
  const tests: TestCase[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let match: RegExpExecArray | null
    TEST_DEFINITION_REGEX.lastIndex = 0
    while ((match = TEST_DEFINITION_REGEX.exec(line)) !== null) {
      tests.push({
        name: match[2].trim(),
        startLine: i + 1,
        endLine: i + 1,
        tags: [],
      })
    }
  }

  for (let idx = 0; idx < tests.length; idx++) {
    tests[idx].endLine = idx < tests.length - 1 ? tests[idx + 1].startLine - 1 : lines.length
  }

  return tests
}

export const assignTagsToTests = (
  tests: TestCase[],
  tags: ClauseTag[],
): { tests: TestCase[]; unassignedTags: ClauseTag[] } => {
  const sortedTests = [...tests].sort((a, b) => a.startLine - b.startLine)
  const unassigned: ClauseTag[] = []

  for (const tag of tags) {
    const target = sortedTests.find(
      (test) => tag.line >= test.startLine && tag.line <= (test.endLine || test.startLine),
    )

    if (target) {
      target.tags.push(tag)
      tag.testName = target.name
      continue
    }

    const nextTest = sortedTests.find((test) => test.startLine > tag.line)
    if (nextTest) {
      nextTest.tags.push(tag)
      continue
    }

    if (sortedTests.length > 0) {
      sortedTests[sortedTests.length - 1].tags.push(tag)
      continue
    }

    unassigned.push(tag)
  }

  return {
    tests: sortedTests,
    unassignedTags: unassigned,
  }
}

export const buildAllowlistMatchers = (patterns: string[]): RegExp[] => {
  return patterns
    .filter(Boolean)
    .map((pattern) => {
      try {
        return new RegExp(pattern)
      } catch {
        return new RegExp(escapeRegExp(pattern))
      }
    })
}

export const matchesAllowlist = (name: string, regexes: RegExp[]): boolean => {
  return regexes.some((regex) => regex.test(name))
}
