import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { Contract } from '../../../types/contract.types.js'
import { parseClauseTags } from '../../../utils/clauseTagParser.js'
import { parseAssertions, mapAssertionsToClauses, findUnmappedAssertions } from '../../../utils/assertionParser.js'

/**
 * NO_OUT_OF_CONTRACT_ASSERTIONS validator (T015, T018, T019, T024, T025, T028)
 *
 * Validates that all test assertions are mapped to contract clauses via @clause tags.
 * - SKIPPED if contract field is absent (T015)
 * - In STRICT mode: all assertions must be mapped (T018)
 * - In CREATIVE mode: allows unmapped assertions with WARNING (T019)
 * - Detects expect, assert, snapshot, mock, and structural assertions (T024, T025)
 * - Provides actionable error messages (T028)
 */
export const NoOutOfContractAssertionsValidator: ValidatorDefinition = {
  code: 'NO_OUT_OF_CONTRACT_ASSERTIONS',
  name: 'No Out-of-Contract Assertions',
  description: 'Valida que todas as asserções estão mapeadas a cláusulas do contrato',
  gate: 1,
  order: 4,
  isHardBlock: true, // Can be WARNING in CREATIVE mode (adjusted in execution)

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // T015: SKIP if contract field is absent
    const contract = (ctx as unknown as { contract?: Contract }).contract

    if (!contract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided - validation skipped',
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

    // Parse @clause tags from test file
    const clauseTags = parseClauseTags(testFileContent, ctx.testFilePath)

    // Parse assertions from test file
    const assertions = parseAssertions(testFileContent, ctx.testFilePath)

    // Map assertions to clauses based on proximity
    const mappedAssertions = mapAssertionsToClauses(assertions, clauseTags)

    // Find unmapped assertions (out-of-contract)
    const unmappedAssertions = findUnmappedAssertions(mappedAssertions)

    if (unmappedAssertions.length > 0) {
      // T018/T019: In STRICT mode, fail on unmapped assertions
      // In CREATIVE mode, allow with WARNING
      const isCreative = contract.mode === 'CREATIVE'
      const status = isCreative ? 'WARNING' : 'FAILED'

      const mappedCount = assertions.length - unmappedAssertions.length
      const mappingPercent = assertions.length > 0 ? (mappedCount / assertions.length) * 100 : 0

      return {
        passed: false,
        status,
        message: `Found ${unmappedAssertions.length} unmapped assertion(s) - ${mappingPercent.toFixed(1)}% coverage`,
        details: {
          totalAssertions: assertions.length,
          mappedAssertions: mappedCount,
          unmappedAssertions: unmappedAssertions.length,
          mappingPercent,
          contractMode: contract.mode,
        },
        evidence: [
          `Assertion mapping: ${mappingPercent.toFixed(1)}% (${mappedCount}/${assertions.length} assertions mapped)`,
          '',
          `Unmapped assertions (${unmappedAssertions.length}):`,
          ...unmappedAssertions.slice(0, 15).map(assertion =>
            `  - ${assertion.file}:${assertion.line} [${assertion.type}]: ${assertion.code.substring(0, 80)}${assertion.code.length > 80 ? '...' : ''}`
          ),
          unmappedAssertions.length > 15 ? `  ...and ${unmappedAssertions.length - 15} more` : '',
          '',
          'Action required:',
          '  1. Add @clause tags before unmapped assertions to link them to contract clauses',
          '  2. Example: // @clause CL-ENDPOINT-001',
          '  3. Each assertion should be within 50 lines of its @clause tag',
          '',
          `Mode: ${contract.mode} (${isCreative ? 'unmapped assertions allowed with WARNING' : 'all assertions must be mapped'})`,
        ].filter(Boolean).join('\n'),
      }
    }

    // All assertions are mapped
    const mappingPercent = 100

    return {
      passed: true,
      status: 'PASSED',
      message: `All ${assertions.length} assertion(s) are mapped to contract clauses`,
      details: {
        totalAssertions: assertions.length,
        mappedAssertions: assertions.length,
        unmappedAssertions: 0,
        mappingPercent,
        contractMode: contract.mode,
        assertionTypes: {
          expect: assertions.filter(a => a.type === 'expect').length,
          assert: assertions.filter(a => a.type === 'assert').length,
          snapshot: assertions.filter(a => a.type === 'snapshot').length,
          mock: assertions.filter(a => a.type === 'mock').length,
          structural: assertions.filter(a => a.type === 'structural').length,
        },
      },
      evidence: [
        `Assertion mapping: 100% (${assertions.length}/${assertions.length} assertions mapped)`,
        `Total @clause tags: ${clauseTags.length}`,
        '',
        'Assertion types:',
        `  - expect: ${assertions.filter(a => a.type === 'expect').length}`,
        `  - assert: ${assertions.filter(a => a.type === 'assert').length}`,
        `  - snapshot: ${assertions.filter(a => a.type === 'snapshot').length}`,
        `  - mock: ${assertions.filter(a => a.type === 'mock').length}`,
        `  - structural: ${assertions.filter(a => a.type === 'structural').length}`,
      ].join('\n'),
    }
  },
}
