import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type {
  ContractV1,
  ClauseCoverageReport,
  ContractClause,
  ExpectedCoverage,
  Criticality,
} from '../../../types/contract.types.js'
import { parseClauseTags, groupTagsByClauseId } from '../../../utils/clauseTagParser.js'

const CREATIVE_COVERAGE_THRESHOLDS: Record<Criticality, number> = {
  low: 60,
  medium: 80,
  high: 90,
  critical: 100,
}

const deriveClauseMinTests = (
  clause: ContractClause,
  expectedCoverage?: ExpectedCoverage,
): number => {
  const requiresTests =
    clause.normativity !== 'MAY' || clause.kind === 'error' || clause.kind === 'security'
  let minTests = requiresTests ? 1 : 0

  if (!expectedCoverage) {
    return minTests
  }

  if (expectedCoverage.minTestsPerClause !== undefined) {
    minTests = Math.max(minTests, expectedCoverage.minTestsPerClause)
  }

  if (clause.normativity === 'MUST' && expectedCoverage.minTestsForMUST !== undefined) {
    minTests = Math.max(minTests, expectedCoverage.minTestsForMUST)
  }

  if (clause.kind === 'security' && expectedCoverage.minTestsForSecurity !== undefined) {
    minTests = Math.max(minTests, expectedCoverage.minTestsForSecurity)
  }

  if (clause.kind === 'error' && expectedCoverage.minNegativeTestsForError !== undefined) {
    minTests = Math.max(minTests, expectedCoverage.minNegativeTestsForError)
  }

  return minTests
}

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
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const contract = (ctx as unknown as { contract?: ContractV1 }).contract

    if (!contract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided; validator skipped',
      }
    }

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

    const clauseTags = parseClauseTags(testFileContent, ctx.testFilePath)
    const clauseToTests = groupTagsByClauseId(clauseTags)

    const totalClauses = contract.clauses.length
    if (totalClauses === 0) {
      const treatAsStrict = contract.mode === 'STRICT' || contract.criticality === 'critical'
      return {
        passed: false,
        status: treatAsStrict ? 'FAILED' : 'WARNING',
        message: 'Contract does not define any clauses',
        details: {
          contractMode: contract.mode,
          criticality: contract.criticality ?? 'medium',
        },
        evidence: [
          'Contract validation requires at least one clause to assess coverage.',
          'Add clauses to the contract before running coverage checks.',
          `Mode: ${contract.mode} (${treatAsStrict ? 'STRICT enforces clauses' : 'CREATIVE allows warnings'})`,
        ].join('\n'),
      }
    }

    const clauseRequirements = contract.clauses.map((clause) => ({
      clause,
      minTests: deriveClauseMinTests(clause, contract.expectedCoverage),
      tests: clauseToTests.get(clause.id) ?? [],
    }))

    const requiredClauses = clauseRequirements.filter((entry) => entry.minTests > 0)
    const coveredRequiredClauses = requiredClauses.filter((entry) => entry.tests.length >= entry.minTests)

    const coveragePercent =
      requiredClauses.length === 0
        ? 100
        : (coveredRequiredClauses.length / requiredClauses.length) * 100

    const underCoveredClauses = requiredClauses.filter((entry) => entry.tests.length < entry.minTests)
    const clausesCoveredSet = new Set(clauseTags.map((tag) => tag.clauseId))
    const clauseToTestsObject = Object.fromEntries(Array.from(clauseToTests.entries()))

    const treatAsStrict = contract.mode === 'STRICT' || contract.criticality === 'critical'
    const status =
      underCoveredClauses.length === 0 ? 'PASSED' : treatAsStrict ? 'FAILED' : 'WARNING'

    const coverageReport: ClauseCoverageReport = {
      totalClauses,
      coveredClauses: clausesCoveredSet.size,
      coveragePercent,
      uncoveredClauseIds: underCoveredClauses.map((entry) => entry.clause.id),
      clauseToTests: clauseToTestsObject,
    }

    const evidenceLines: string[] = []
    const requiredClauseCount = requiredClauses.length || 1
    evidenceLines.push(
      `Coverage: ${coveragePercent.toFixed(1)}% (${coveredRequiredClauses.length}/${requiredClauseCount} required clauses satisfied)`,
    )
    const threshold = CREATIVE_COVERAGE_THRESHOLDS[contract.criticality ?? 'medium']
    evidenceLines.push(
      `Mode: ${contract.mode}${treatAsStrict ? ' (STRICT)' : ` (CREATIVE target >= ${threshold}% coverage)`}`,
    )

    if (underCoveredClauses.length > 0) {
      evidenceLines.push('', `Clauses missing coverage (${underCoveredClauses.length}):`)
      underCoveredClauses.slice(0, 10).forEach((entry) => {
        evidenceLines.push(
          `  - ${entry.clause.id} (${entry.clause.title}) -> ${entry.tests.length}/${entry.minTests} tags`,
        )
      })
      if (underCoveredClauses.length > 10) {
        evidenceLines.push(`  ...and ${underCoveredClauses.length - 10} more`)
      }
      evidenceLines.push(
        '',
        'Action required:',
        '  1. Tag tests with // @clause <CLAUSE_ID> for the missing clauses.',
        '  2. Remove unused clauses or mark them informational (normativity: MAY).',
      )
    }

    evidenceLines.push('', 'Clause coverage snapshot:')
    contract.clauses.slice(0, 5).forEach((clause) => {
      const tags = clauseToTests.get(clause.id) ?? []
      const snippet =
        tags.length === 0
          ? 'no tags yet'
          : tags
              .slice(0, 3)
              .map((tag) => `${tag.file}:${tag.line}`)
              .join(', ')
      evidenceLines.push(`  - ${clause.id}: ${tags.length} tag(s) (${snippet})`)
    })
    if (contract.clauses.length > 5) {
      evidenceLines.push(`  ...and ${contract.clauses.length - 5} more clauses recorded`)
    }

    if (status !== 'PASSED') {
      return {
        passed: false,
        status,
        message: `Contract clause coverage ${status === 'FAILED' ? 'failed' : 'returned warnings'}`,
        details: {
          coverageReport,
          contractMode: contract.mode,
          criticality: contract.criticality ?? 'medium',
          clauseIssues: underCoveredClauses.map((entry) => ({
            clauseId: entry.clause.id,
            title: entry.clause.title,
            minTests: entry.minTests,
            actualTests: entry.tests.length,
            normativity: entry.clause.normativity,
            kind: entry.clause.kind,
          })),
        },
        evidence: evidenceLines.join('\n'),
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: `Full contract coverage: ${clausesCoveredSet.size}/${totalClauses} clause(s) covered by ${clauseTags.length} mapping(s)`,
      details: {
        coverageReport,
        contractMode: contract.mode,
        criticality: contract.criticality ?? 'medium',
      },
      evidence: evidenceLines.join('\n'),
    }
  },
}
