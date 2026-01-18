import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { ContractV1, ClauseCoverageReport } from '../../../types/contract.types.js'
import { parseClauseTags, groupTagsByClauseId } from '../../../utils/clauseTagParser.js'

/**
 * CONTRACT_CLAUSE_COVERAGE validator (T015, T018, T019, T023, T028)
 *
 * Validates that all contract clauses have at least one test mapping.
 * - SKIPPED if contract field is absent (T015)
 * - In STRICT mode: requires 100% coverage (T018)
 * - In CREATIVE mode: allows partial coverage with WARNING (T019)
 * - Provides coverage report and actionable messages (T023, T028)
 */
export const ContractClauseCoverageValidator: ValidatorDefinition = {
  code: 'CONTRACT_CLAUSE_COVERAGE',
  name: 'Contract Clause Coverage',
  description: 'Valida que todas as cláusulas do contrato têm testes mapeados',
  gate: 1,
  order: 3,
  isHardBlock: true, // Can be WARNING in CREATIVE mode (adjusted in execution)

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // T015: SKIP if contract field is absent
    const contract = (ctx as unknown as { contract?: ContractV1 }).contract

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

    // Group tags by clause ID
    const clauseToTests = groupTagsByClauseId(clauseTags)

    // Calculate coverage
    const totalClauses = contract.clauses.length
    if (totalClauses === 0) {
      const isCreative = contract.mode === 'CREATIVE'
      return {
        passed: false,
        status: isCreative ? 'WARNING' : 'FAILED',
        message: 'Contract does not define any clauses',
        details: {
          contractMode: contract.mode,
        },
        evidence: [
          'Contract validation requires at least one clause to assess coverage.',
          'Add clauses to the contract before running coverage checks.',
          `Mode: ${contract.mode} (${isCreative ? 'warnings allow zero clauses' : 'STRICT requires clauses to fail fast'})`,
        ].join('\n'),
      }
    }
    const coveredClauseIds = new Set(clauseTags.map(tag => tag.clauseId))
    const coveredClauses = coveredClauseIds.size
    const coveragePercent = totalClauses > 0 ? (coveredClauses / totalClauses) * 100 : 0

    // Find uncovered clauses
    const uncoveredClauseIds = contract.clauses
      .filter(clause => !coveredClauseIds.has(clause.id))
      .map(clause => clause.id)

    const coverageReport: ClauseCoverageReport = {
      totalClauses,
      coveredClauses,
      coveragePercent,
      uncoveredClauseIds,
      clauseToTests: Object.fromEntries(clauseToTests),
    }

    // Check if coverage is acceptable
    const hasFullCoverage = uncoveredClauseIds.length === 0

    if (!hasFullCoverage) {
      // T018/T019: In STRICT mode, require 100% coverage (FAILED)
      // In CREATIVE mode, allow partial coverage (WARNING)
      const isCreative = contract.mode === 'CREATIVE'
      const status = isCreative ? 'WARNING' : 'FAILED'

      return {
        passed: false,
        status,
        message: `Contract clause coverage is ${coveragePercent.toFixed(1)}% (${coveredClauses}/${totalClauses} clauses covered)`,
        details: {
          coverageReport,
          contractMode: contract.mode,
        },
        evidence: [
          `Coverage: ${coveragePercent.toFixed(1)}% (${coveredClauses}/${totalClauses} clauses)`,
          '',
          `Uncovered clauses (${uncoveredClauseIds.length}):`,
          ...uncoveredClauseIds.slice(0, 20).map(id => {
            const clause = contract.clauses.find(c => c.id === id)
            return `  - ${id}: ${clause?.title || '(no title)'}`
          }),
          uncoveredClauseIds.length > 20 ? `  ...and ${uncoveredClauseIds.length - 20} more` : '',
          '',
          'Action required:',
          '  1. Add @clause tags to test file for uncovered clauses, OR',
          '  2. Remove unused clauses from contract',
          '',
          `Mode: ${contract.mode} (${isCreative ? 'partial coverage allowed with WARNING' : '100% coverage required'})`,
        ].filter(Boolean).join('\n'),
      }
    }

    // Full coverage achieved
    return {
      passed: true,
      status: 'PASSED',
      message: `Full contract coverage: ${totalClauses} clause(s) covered by ${clauseTags.length} test mapping(s)`,
      details: {
        coverageReport,
        contractMode: contract.mode,
      },
      evidence: [
        `Coverage: 100% (${totalClauses}/${totalClauses} clauses)`,
        `Total @clause tags: ${clauseTags.length}`,
        '',
        'All clauses have test coverage:',
        ...contract.clauses.slice(0, 10).map(clause => {
          const testCount = clauseToTests.get(clause.id)?.length || 0
          return `  - ${clause.id}: ${testCount} test(s)`
        }),
        contract.clauses.length > 10 ? `  ...and ${contract.clauses.length - 10} more` : '',
      ].filter(Boolean).join('\n'),
    }
  },
}
