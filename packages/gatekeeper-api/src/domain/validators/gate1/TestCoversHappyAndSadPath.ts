import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { ContractV1 } from '../../../types/contract.types.js'
import type { TestCase } from '../../../utils/testMappingUtils.js'
import { parseClauseTags } from '../../../utils/clauseTagParser.js'
import { assignTagsToTests, extractTestCases } from '../../../utils/testMappingUtils.js'

const HAPPY_PATH_REGEX = /it\s*\(\s*['"].*?(success|should|when.*valid|passes)/i
const SAD_PATH_REGEX = /it\s*\(\s*['"].*?(error|fail|throws|invalid|when.*not)/i

const detectTestTone = (text: string) => ({
  happy: HAPPY_PATH_REGEX.test(text),
  sad: SAD_PATH_REGEX.test(text),
})

const buildTestSnippet = (lines: string[], testCase: TestCase): string => {
  const start = Math.max(0, testCase.startLine - 1)
  const end = Math.min(lines.length, testCase.endLine)
  return lines.slice(start, end).join(' ').trim()
}

export const TestCoversHappyAndSadPathValidator: ValidatorDefinition = {
  code: 'TEST_COVERS_HAPPY_AND_SAD_PATH',
  name: 'Test Covers Happy and Sad Path',
  description: 'Verifica cobertura de cenários positivos e negativos',
  gate: 1,
  order: 3,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    let fileContent: string
    try {
      fileContent = await ctx.services.git.readFile(ctx.testFilePath)
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to read test file: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    const contract: ContractV1 | undefined = ctx.contract
    const lines = fileContent.split('\n')
    const clauseTags = parseClauseTags(fileContent, ctx.testFilePath, {
      tagPattern: contract?.testMapping?.tagPattern,
    })
    const behaviorClauses = contract?.clauses?.filter((clause) => clause.kind === 'behavior') ?? []
    const contractAware = Boolean(contract && behaviorClauses.length > 0 && clauseTags.length > 0)
    const runLegacyCheck = (): ValidatorOutput => {
      const hasHappyPath = HAPPY_PATH_REGEX.test(fileContent)
      const hasSadPath = SAD_PATH_REGEX.test(fileContent)
      if (!hasHappyPath || !hasSadPath) {
        const missing: string[] = []
        if (!hasHappyPath) missing.push('happy path (success scenarios)')
        if (!hasSadPath) missing.push('sad path (error scenarios)')
        return {
          passed: false,
          status: 'FAILED',
          message: `Test missing coverage: ${missing.join(', ')}`,
          evidence: `Missing test scenarios:\n${missing.map((m) => `  - ${m}`).join('\n')}`,
          details: {
            hasHappyPath,
            hasSadPath,
            testFile: ctx.testFilePath,
          },
        }
      }
      return {
        passed: true,
        status: 'PASSED',
        message: 'Test covers both happy and sad paths',
        metrics: {
          happyPathTests: (fileContent.match(HAPPY_PATH_REGEX) || []).length,
          sadPathTests: (fileContent.match(SAD_PATH_REGEX) || []).length,
        },
      }
    }
    if (!contractAware) {
      return runLegacyCheck()
    }
    const tests = extractTestCases(fileContent)
    const { tests: mappedTests } = assignTagsToTests(tests, clauseTags)
    const clauseStats = new Map<string, {
      happy: number
      sad: number
      tests: TestCase[]
    }>()
    const clauseLookup = new Map(contract.clauses.map((clause) => [clause.id, clause]))
    behaviorClauses.forEach((clause) => {
      clauseStats.set(clause.id, { happy: 0, sad: 0, tests: [] })
    })
    for (const testCase of mappedTests) {
      const snippet = buildTestSnippet(lines, testCase)
      const tone = detectTestTone(snippet)
      const clauseIds = new Set(testCase.tags.map((tag) => tag.clauseId))
      clauseIds.forEach((clauseId) => {
        if (!clauseStats.has(clauseId)) {
          return
        }
        const stats = clauseStats.get(clauseId)!
        if (tone.happy) {
          stats.happy += 1
        }
        if (tone.sad) {
          stats.sad += 1
        }
        stats.tests.push(testCase)
      })
    }
    type CoverageIssue = {
      clauseId: string
      clauseTitle: string
      missing: 'tests' | 'happy' | 'sad'
    }
    const issues: CoverageIssue[] = []
    behaviorClauses.forEach((clause) => {
      const stats = clauseStats.get(clause.id)
      const hasTests = Boolean(stats && stats.tests.length > 0)
      const hasHappy = Boolean(stats && stats.happy > 0)
      const hasSad = Boolean(stats && stats.sad > 0)
      const requiresSad = (clause.negativeCases?.length ?? 0) > 0 || clause.normativity === 'MUST'
      if (!hasTests) {
        issues.push({ clauseId: clause.id, clauseTitle: clause.title, missing: 'tests' })
        return
      }
      if (!hasHappy) {
        issues.push({ clauseId: clause.id, clauseTitle: clause.title, missing: 'happy' })
      }
      if (requiresSad && !hasSad) {
        issues.push({ clauseId: clause.id, clauseTitle: clause.title, missing: 'sad' })
      }
    })
    const hasIssues = issues.length > 0
    const status = hasIssues
      ? contract.mode === 'CREATIVE'
        ? 'WARNING'
        : 'FAILED'
      : 'PASSED'
    const passed = contract.mode === 'CREATIVE' ? true : !hasIssues
    if (!hasIssues) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'Contract behavior clauses have happy and sad coverage',
        metrics: {
          clauseCount: contract.clauses.length,
          behaviorClauses: behaviorClauses.length,
          happyClauses: Array.from(clauseStats.values()).filter((stats) => stats.happy > 0)
            .length,
          sadClauses: Array.from(clauseStats.values()).filter((stats) => stats.sad > 0).length,
        },
      }
    }
    const evidenceLines = [
      'Missing clause coverage:',
      ...issues.map((issue) => `  - ${issue.clauseId} (${issue.clauseTitle}): missing ${issue.missing} coverage`),
      '',
      'Action: add @clause tags and scenario coverage for each behavior clause as required by the contract.',
    ]
    return {
      passed,
      status,
      message: `Contract coverage check reported ${issues.length} missing requirement(s)`,
      details: {
        missingClauseCoverage: issues,
        contractMode: contract.mode,
        clauseCount: behaviorClauses.length,
      },
      evidence: evidenceLines.join('\n'),
    }
  },
}
