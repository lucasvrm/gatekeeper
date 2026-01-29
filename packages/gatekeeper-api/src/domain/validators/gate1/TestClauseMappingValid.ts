import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestClauseMappingValidValidator: ValidatorDefinition = {
  code: 'TEST_CLAUSE_MAPPING_VALID',
  name: 'Test Clause Mapping Valid',
  description: 'Valida mapeamento entre testes e cláusulas do contrato',
  gate: 1,
  order: 10,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // Get patterns from contract or use defaults
    const tagPattern = ctx.contract?.testMapping?.tagPattern || '// @clause'

    // TCM_001: Contract presence check
    if (!ctx.contract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No contract provided, skipping clause mapping validation',
        context: {
          inputs: [
            { label: 'Contract Clauses', value: [] },
            { label: 'TagPattern', value: tagPattern },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: contract not provided' }],
          reasoning: 'Clause mapping validation requires a contract.',
        },
      }
    }

    // TCM_001: testFilePath check
    if (!ctx.testFilePath) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No test file path provided, skipping clause mapping validation',
        context: {
          inputs: [
            { label: 'Contract Clauses', value: ctx.contract.clauses.map((clause) => clause.id) },
            { label: 'TagPattern', value: tagPattern },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: test file path not provided' }],
          reasoning: 'Clause mapping validation requires a test file.',
        },
      }
    }

    try {
      // TCM_002: Extract test blocks with comments
      const testBlocks = await ctx.services.ast.getTestBlocksWithComments(ctx.testFilePath)

      // Build set of valid clause IDs
      const validClauseIds = new Set(ctx.contract.clauses.map(clause => clause.id))

      // Get config for untagged tests
      const allowUntaggedTests = ctx.config.get('ALLOW_UNTAGGED_TESTS') === 'true'

      const errors: string[] = []
      const warnings: string[] = []

      // TCM_010: Create regex patterns for @clause
      const escapedPattern = tagPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const tagPatternRegex = new RegExp(escapedPattern) // Pattern detection
      const tagRegex = new RegExp(escapedPattern + '\\s+(\\S+)') // Pattern + ID extraction

      for (const testBlock of testBlocks) {
        // Check if any preceding comment contains the tag
        let clauseId: string | null = null
        let hasMatchingTag = false
        let hasMalformedTag = false

        for (const comment of testBlock.precedingComments) {
          // Check for @clause pattern
          if (tagPatternRegex.test(comment)) {
            // Pattern found, now try to extract the ID
            const match = tagRegex.exec(comment)
            if (match && match[1]) {
              clauseId = match[1].trim()

              // TCM_007: Check if ID is empty after trimming
              if (clauseId === '') {
                hasMalformedTag = true
                errors.push(
                  `Test "${testBlock.name}" has malformed @clause tag at line ${testBlock.startLine}. Expected format: "// @clause CLAUSE_ID"`
                )
                break
              }

              // TCM_006: Check if clause ID exists in contract
              if (!validClauseIds.has(clauseId)) {
                const validIds = Array.from(validClauseIds).join(', ')
                errors.push(
                  `Test "${testBlock.name}" references unknown clause "${clauseId}". Valid clause IDs: ${validIds}`
                )
                break
              }

              // Valid tag found
              hasMatchingTag = true
              break
            } else {
              // TCM_007: Pattern exists but no valid ID after it
              hasMalformedTag = true
              errors.push(
                `Test "${testBlock.name}" has malformed @clause tag at line ${testBlock.startLine}. Expected format: "// @clause CLAUSE_ID"`
              )
              break
            }
          }
        }

        // Skip missing tag check if we found a malformed tag
        if (hasMalformedTag) {
          continue
        }

        // TCM_004 & TCM_005: Handle missing tags
        if (!hasMatchingTag) {
          if (allowUntaggedTests) {
            // TCM_005: WARNING mode when ALLOW_UNTAGGED_TESTS is true
            warnings.push(
              `Test "${testBlock.name}" at line ${testBlock.startLine} has no @clause tag. Consider adding "// @clause <CLAUSE_ID>" for traceability.`
            )
          } else {
            // TCM_004: FAILED mode when ALLOW_UNTAGGED_TESTS is false
            errors.push(
              `Test "${testBlock.name}" at line ${testBlock.startLine} has no @clause tag. Add "// @clause <CLAUSE_ID>" before the test.`
            )
          }
        }
      }

      // Return results based on errors and warnings
      if (errors.length > 0) {
        return {
          passed: false,
          status: 'FAILED',
          message: errors.join('\n'),
          context: {
            inputs: [
              { label: 'Contract Clauses', value: ctx.contract.clauses.map((clause) => clause.id) },
              { label: 'TagPattern', value: tagPattern },
            ],
            analyzed: [{ label: 'Test Blocks', items: testBlocks.map((block) => block.name) }],
            findings: errors.map((error) => ({ type: 'fail' as const, message: error })),
            reasoning: 'One or more test blocks have invalid or missing clause mappings.',
          },
          details: {
            errorCount: errors.length,
            errors,
          },
        }
      }

      if (warnings.length > 0) {
        // TCM_005: WARNING status
        return {
          passed: true,
          status: 'WARNING',
          message: warnings.join('\n'),
          context: {
            inputs: [
              { label: 'Contract Clauses', value: ctx.contract.clauses.map((clause) => clause.id) },
              { label: 'TagPattern', value: tagPattern },
            ],
            analyzed: [{ label: 'Test Blocks', items: testBlocks.map((block) => block.name) }],
            findings: warnings.map((warning) => ({ type: 'warning' as const, message: warning })),
            reasoning: 'Some test blocks are missing clause tags, but warnings are allowed by configuration.',
          },
          details: {
            warningCount: warnings.length,
            warnings,
          },
          metrics: {
            validatedTests: testBlocks.length,
          },
        }
      }

      // TCM_008: All tests valid
      return {
        passed: true,
        status: 'PASSED',
        message: `All ${testBlocks.length} test${testBlocks.length === 1 ? '' : 's'} have valid clause mappings`,
        context: {
          inputs: [
            { label: 'Contract Clauses', value: ctx.contract.clauses.map((clause) => clause.id) },
            { label: 'TagPattern', value: tagPattern },
          ],
          analyzed: [{ label: 'Test Blocks', items: testBlocks.map((block) => block.name) }],
          findings: [{ type: 'pass', message: 'All test blocks have valid clause mappings' }],
          reasoning: 'Every test block has a valid @clause tag that matches the contract.',
        },
        metrics: {
          validatedTests: testBlocks.length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to validate clause mappings: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [
            { label: 'Contract Clauses', value: ctx.contract?.clauses.map((clause) => clause.id) ?? [] },
            { label: 'TagPattern', value: ctx.contract?.testMapping?.tagPattern ?? '// @clause' },
          ],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Clause mapping validation failed' }],
          reasoning: 'An error occurred while analyzing clause mappings.',
        },
      }
    }
  },
}
