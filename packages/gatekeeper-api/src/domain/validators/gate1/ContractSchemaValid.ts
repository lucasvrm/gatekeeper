import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { ContractSchema } from '../../../api/schemas/validation.schema.js'
import type { ContractV1 } from '../../../types/contract.types.js'
import { contractJsonPreview, summarizeContract } from '../../../utils/contract.utils.js'

/**
 * CONTRACT_SCHEMA_VALID validator (T015, T018, T028)
 *
 * Validates the structure of the contract field when present.
 * - SKIPPED if contract field is absent (T015)
 * - FAILED if contract structure is invalid (T018)
 * - Provides actionable error messages (T028)
 */
export const ContractSchemaValidValidator: ValidatorDefinition = {
  code: 'CONTRACT_SCHEMA_VALID',
  name: 'Contract Schema Valid',
  description: 'Valida a estrutura do contrato quando presente',
  gate: 1,
  order: 1,
  isHardBlock: true, // T018: Hard-block in both STRICT and CREATIVE modes

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // T015: SKIP if contract field is absent
    const contract = (ctx as unknown as { contract?: ContractV1 }).contract
    const contractJson = (ctx as unknown as { contractJson?: string }).contractJson
    const contractParseError = (ctx as unknown as { contractParseError?: string }).contractParseError

    if (!contract && !contractParseError) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided; validator skipped',
      }
    }

    if (contractParseError) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Contract JSON could not be parsed',
        details: {
          error: contractParseError,
          preview: contractJsonPreview(contractJson),
        },
      }
    }

    // Validate contract structure using Zod schema
    const validation = ContractSchema.safeParse(contract)

    if (!validation.success) {
      const errors = validation.error.errors.map(err => {
        const path = err.path.join('.')
        return `${path}: ${err.message}`
      })

      return {
        passed: false,
        status: 'FAILED',
        message: `Contract structure is invalid: ${errors.length} error(s)`,
        details: {
          errors,
          errorCount: errors.length,
          contractSummary: summarizeContract(contract),
        },
        evidence: [
          'Contract validation errors:',
          ...errors.slice(0, 5),
          errors.length > 5 ? `...and ${errors.length - 5} more` : '',
          '',
          'Expected format:',
          '- mode: "STRICT" or "CREATIVE"',
          '- clauses: array with at least one clause',
          '- Each clause must have:',
          '  - id: format CL-<TYPE>-<SEQUENCE> (e.g., CL-ENDPOINT-001)',
          '  - description: non-empty string',
          '  - type: optional enum value',
          '',
          'Action required: Fix contract structure to match schema',
        ].filter(Boolean).join('\n'),
      }
    }

    const issues: Array<{ path: string; message: string; severity: 'ERROR' | 'WARNING' }> = []
    const addIssue = (path: string, message: string, severity: 'ERROR' | 'WARNING' = 'ERROR') => {
      issues.push({ path, message, severity })
    }

    const clauseIds = contract.clauses.map(c => c.id)
    const duplicates = clauseIds.filter((id, index) => clauseIds.indexOf(id) !== index)
    if (duplicates.length > 0) {
      addIssue('clauses', `Contract has duplicate clause IDs (${[...new Set(duplicates)].join(', ')})`)
    }

    if (contract.schemaVersion !== '1.0.0') {
      addIssue('schemaVersion', 'Only schemaVersion 1.0.0 is supported')
    }

    const hasSecurityClause = contract.clauses.some(clause => clause.kind === 'security')
    const hasErrorClause = contract.clauses.some(clause => clause.kind === 'error')

    if (contract.expectedCoverage) {
      if (contract.expectedCoverage.minTestsForMUST && !contract.clauses.some(clause => clause.normativity === 'MUST')) {
        addIssue('expectedCoverage.minTestsForMUST', 'No MUST clauses exist for the specified requirement')
      }

      if (contract.expectedCoverage.minTestsForSecurity && !hasSecurityClause) {
        addIssue('expectedCoverage.minTestsForSecurity', 'No security clauses exist for the specified requirement')
      }

      if (contract.expectedCoverage.minNegativeTestsForError && !hasErrorClause) {
        addIssue('expectedCoverage.minNegativeTestsForError', 'No error clauses exist for the specified requirement')
      }
    }

    if (contract.testMapping) {
      if (contract.testMapping.untaggedAllowlist && !contract.testMapping.allowUntagged) {
        addIssue(
          'testMapping.untaggedAllowlist',
          'untaggedAllowlist requires allowUntagged to be true',
        )
      }

      if (contract.mode === 'STRICT' && contract.testMapping.required === false) {
        addIssue('testMapping.required', 'STRICT mode always requires test mapping', 'ERROR')
      }
    }

    const hasAssertionSurface =
      contract.assertionSurface &&
      (
        (contract.assertionSurface.http?.endpoints?.length ?? 0) > 0 ||
        (contract.assertionSurface.errors?.codes?.length ?? 0) > 0 ||
        (contract.assertionSurface.payloadPaths?.length ?? 0) > 0 ||
        (contract.assertionSurface.ui?.routes?.length ?? 0) > 0 ||
        (contract.assertionSurface.effects?.database?.length ?? 0) > 0 ||
        (contract.assertionSurface.effects?.events?.length ?? 0) > 0
      )

    if (!hasAssertionSurface) {
      const severity = contract.mode === 'STRICT' ? 'ERROR' : 'WARNING'
      addIssue(
        'assertionSurface',
        'Assertion surface should describe observable behavior (required for STRICT mode)',
        severity,
      )
    }

    if (issues.length > 0) {
      const hasCritical = issues.some(issue => issue.severity === 'ERROR')
      const status = hasCritical ? 'FAILED' : 'WARNING'
      const filteredIssues = issues.map(({ path, message, severity }) => ({
        path,
        message,
        severity,
      }))
      const evidenceLines = [
        'Contract validation issues:',
        ...issues.slice(0, 5).map(
          issue => `  - [${issue.severity}] ${issue.path}: ${issue.message}`,
        ),
        issues.length > 5 ? `  ...and ${issues.length - 5} more` : '',
        '',
        `Contract summary: ${contract.slug} (${contract.mode}) — ${contract.clauses.length} clause(s)`,
        contractJsonPreview(ctx.contractJson) ? `Contract snippet: ${contractJsonPreview(ctx.contractJson)}` : undefined,
      ].filter(Boolean)

      return {
        passed: false,
        status,
        message: `Contract schema validation ${status === 'FAILED' ? 'failed' : 'returned warnings'}`,
        details: {
          issues: filteredIssues,
          errorCount: issues.filter(issue => issue.severity === 'ERROR').length,
          contractSummary: summarizeContract(contract),
        },
        evidence: evidenceLines.join('\n'),
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: `Contract is valid (mode: ${contract.mode}, clauses: ${contract.clauses.length})`,
      details: {
        mode: contract.mode,
        clauseCount: contract.clauses.length,
        clauseIds,
      },
    }
  },
}
