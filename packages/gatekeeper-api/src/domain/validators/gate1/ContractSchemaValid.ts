import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { ContractSchema } from '../../../api/schemas/validation.schema.js'
import type { Contract } from '../../../types/contract.types.js'

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
    const contract = (ctx as unknown as { contract?: Contract }).contract

    if (!contract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided - validation skipped',
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
          contract,
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

    // Validate clause ID uniqueness
    const clauseIds = contract.clauses.map(c => c.id)
    const duplicates = clauseIds.filter((id, index) => clauseIds.indexOf(id) !== index)

    if (duplicates.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Contract has duplicate clause IDs: ${duplicates.length} duplicate(s)`,
        details: {
          duplicateIds: [...new Set(duplicates)],
          totalClauses: contract.clauses.length,
        },
        evidence: [
          'Duplicate clause IDs found:',
          ...Array.from(new Set(duplicates)).map(id => `  - ${id}`),
          '',
          'Action required: Ensure all clause IDs are unique',
        ].join('\n'),
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
