import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { ContractV1 } from '../../../types/contract.types.js'
import { parseClauseTags, findInvalidClauseTags } from '../../../utils/clauseTagParser.js'
import {
  assignTagsToTests,
  buildAllowlistMatchers,
  extractTestCases,
  matchesAllowlist,
} from '../../../utils/testMappingUtils.js'

/**
 * TEST_CLAUSE_MAPPING_VALID validator (T015, T021, T022, T028)
 *
 * Validates that all @clause tags in test files reference valid clause IDs.
 * - SKIPPED if contract field is absent (T015)
 * - Parses tags using regex from T022
 * - FAILED/WARNING based on contract mode (T016, T019)
 * - Provides actionable error messages (T028)
 */
export const TestClauseMappingValidValidator: ValidatorDefinition = {
  code: 'TEST_CLAUSE_MAPPING_VALID',
  name: 'Test Clause Mapping Valid',
  description: 'Valida que tags @clause referenciam cláusulas válidas',
  gate: 1,
  order: 2,
  isHardBlock: true, // Can be WARNING in CREATIVE mode (adjusted in execution)

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // T015: SKIP if contract field is absent
    const contract = (ctx as unknown as { contract?: ContractV1 }).contract

    if (!contract) {
    return {
      passed: true,
      status: 'SKIPPED',
      message: 'No contract provided; validator skipped',
    }
    }

    // Read test file content
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    let testFileContent: string
    try {
      testFileContent = await ctx.services.git.readFile(ctx.testFilePath, ctx.targetRef)
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to read test file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }

    // Parse @clause tags from test file with optional custom pattern
    const clauseTags = parseClauseTags(testFileContent, ctx.testFilePath, {
      tagPattern: contract.testMapping?.tagPattern,
    })

    const testCases = extractTestCases(testFileContent)
    const { tests, unassignedTags } = assignTagsToTests(testCases, clauseTags)

    // Get valid clause IDs from contract
    const validClauseIds = new Set(contract.clauses.map(c => c.id))

    // Find invalid tags (tags referencing non-existent clauses)
    const invalidTags = findInvalidClauseTags(clauseTags, validClauseIds)

    const allowMultiple = contract.testMapping?.allowMultiple ?? true
    const allowUntagged = contract.testMapping?.allowUntagged ?? contract.mode === 'CREATIVE'
    const requiredMapping = contract.testMapping?.required ?? contract.mode === 'STRICT'
    const allowlistRegexes = buildAllowlistMatchers(contract.testMapping?.untaggedAllowlist ?? [])

    const testsWithoutTags = tests.filter(
      (test) => test.tags.length === 0 && !(allowUntagged || matchesAllowlist(test.name, allowlistRegexes)),
    )

    const testsAllowedUntagged = tests.filter(
      (test) => test.tags.length === 0 && matchesAllowlist(test.name, allowlistRegexes),
    )

    const testsWithMultipleTags = allowMultiple
      ? []
      : tests.filter((test) => test.tags.length > 1)

    const issues: Array<{ path: string; message: string; severity: 'ERROR' | 'WARNING' }> = []

    if (invalidTags.length > 0) {
      issues.push({
        path: 'tags',
        message: `Found ${invalidTags.length} invalid @clause tag(s) referencing non-existent clauses`,
        severity: contract.mode === 'CREATIVE' ? 'WARNING' : 'ERROR',
      })
    }

    if (testsWithMultipleTags.length > 0) {
      issues.push({
        path: 'testMapping.allowMultiple',
        message: 'Multiple @clause tags are not allowed per test when allowMultiple=false',
        severity: 'ERROR',
      })
    }

    if (testsWithoutTags.length > 0 && requiredMapping) {
      issues.push({
        path: 'tests',
        message: `Found ${testsWithoutTags.length} test(s) without @clause tags`,
        severity: contract.mode === 'CREATIVE' ? 'WARNING' : 'ERROR',
      })
    }

    if (unassignedTags.length > 0) {
      issues.push({
        path: 'tags',
        message: 'Some @clause tags could not be mapped to a test definition',
        severity: 'WARNING',
      })
    }

    const hasErrors = issues.some((issue) => issue.severity === 'ERROR')

    const evidence: string[] = []

    if (invalidTags.length > 0) {
      evidence.push('Invalid @clause tags found:')
      evidence.push(
        ...invalidTags.slice(0, 10).map(
          (tag) => `  - ${tag.file}:${tag.line}: @clause ${tag.clauseId} (clause not defined)`,
        ),
      )
      if (invalidTags.length > 10) {
        evidence.push(`  ...and ${invalidTags.length - 10} more`)
      }
    }

    if (testsWithoutTags.length > 0) {
      evidence.push('')
      evidence.push(`${testsWithoutTags.length} test(s) missing tags:`)
      evidence.push(
        ...testsWithoutTags.slice(0, 10).map((test) => `  - ${test.name || '<unnamed>'} (line ${test.startLine})`),
      )
      if (testsWithoutTags.length > 10) {
        evidence.push(`  ...and ${testsWithoutTags.length - 10} more`)
      }
    }

    if (testsAllowedUntagged.length > 0) {
      evidence.push('')
      evidence.push(`Allowed untagged tests (${testsAllowedUntagged.length}):`)
      evidence.push(
        ...testsAllowedUntagged.slice(0, 5).map(
          (test) => `  - ${test.name || '<unnamed>'} (line ${test.startLine})`,
        ),
      )
    }

    if (testsWithMultipleTags.length > 0) {
      evidence.push('')
      evidence.push('Tests with multiple tags:')
      evidence.push(
        ...testsWithMultipleTags.map(
          (test) =>
            `  - ${test.name || '<unnamed>'} @ lines ${test.startLine} (${test.tags.length} tags)`,
        ),
      )
    }

    if (unassignedTags.length > 0) {
      evidence.push('')
      evidence.push('Tags without associated tests:')
      evidence.push(
        ...unassignedTags.map(
          (tag) => `  - ${tag.file}:${tag.line}: @clause ${tag.clauseId} (no test found)`,
        ),
      )
    }

    if (issues.length === 0) {
      return {
        passed: true,
        status: 'PASSED',
        message: `All ${tests.length} test(s) contain valid @clause tags`,
        details: {
          totalTagCount: clauseTags.length,
          totalTests: tests.length,
          uniqueClauseCount: new Set(clauseTags.map((t) => t.clauseId)).size,
          contractMode: contract.mode,
        },
      }
    }

    return {
      passed: !hasErrors,
      status: hasErrors ? 'FAILED' : 'WARNING',
      message: `Test clause mapping ${hasErrors ? 'failed' : 'returned warnings'}`,
      details: {
        totalTests: tests.length,
        totalTagCount: clauseTags.length,
        invalidTags: invalidTags.map((tag) => ({
          clauseId: tag.clauseId,
          file: tag.file,
          line: tag.line,
        })),
        testsWithoutTags: testsWithoutTags.map((test) => ({
          name: test.name,
          line: test.startLine,
        })),
        testsWithMultipleTags: testsWithMultipleTags.map((test) => ({
          name: test.name,
          tagCount: test.tags.length,
        })),
        allowedUntagged: testsAllowedUntagged.map((test) => test.name),
        contractMode: contract.mode,
      },
      evidence: evidence.filter(Boolean).join('\n'),
    }
  },
}
