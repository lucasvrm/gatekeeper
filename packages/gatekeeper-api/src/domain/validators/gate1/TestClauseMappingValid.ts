import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import type { ContractV1 } from '../../../types/contract.types.js'
import { parseClauseTags, findInvalidClauseTags } from '../../../utils/clauseTagParser.js'

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

    // Get valid clause IDs from contract
    const validClauseIds = new Set(contract.clauses.map(c => c.id))

    // Find invalid tags (tags referencing non-existent clauses)
    const invalidTags = findInvalidClauseTags(clauseTags, validClauseIds)

    if (invalidTags.length > 0) {
      // T016/T019: In CREATIVE mode, this can be WARNING
      const isCreative = contract.mode === 'CREATIVE'
      const status = isCreative ? 'WARNING' : 'FAILED'

      return {
        passed: false,
        status,
        message: `Found ${invalidTags.length} invalid @clause tag(s) referencing non-existent clauses`,
        details: {
          invalidTagCount: invalidTags.length,
          totalTagCount: clauseTags.length,
          invalidTags: invalidTags.map(tag => ({
            clauseId: tag.clauseId,
            file: tag.file,
            line: tag.line,
          })),
          contractMode: contract.mode,
        },
        evidence: [
          'Invalid @clause tags found:',
          ...invalidTags.slice(0, 10).map(tag =>
            `  - ${tag.file}:${tag.line}: @clause ${tag.clauseId} (clause does not exist in contract)`
          ),
          invalidTags.length > 10 ? `  ...and ${invalidTags.length - 10} more` : '',
          '',
          'Valid clause IDs in contract:',
          ...Array.from(validClauseIds).slice(0, 20).map(id => `  - ${id}`),
          validClauseIds.size > 20 ? `  ...and ${validClauseIds.size - 20} more` : '',
          '',
          'Action required:',
          '  1. Fix typos in @clause tags, OR',
          '  2. Add missing clauses to contract, OR',
          '  3. Remove invalid @clause tags',
        ].filter(Boolean).join('\n'),
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: `All ${clauseTags.length} @clause tag(s) reference valid clauses`,
      details: {
        totalTagCount: clauseTags.length,
        uniqueClauseCount: new Set(clauseTags.map(t => t.clauseId)).size,
        contractMode: contract.mode,
      },
    }
  },
}
