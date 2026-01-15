import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestHasAssertionsValidator: ValidatorDefinition = {
  code: 'TEST_HAS_ASSERTIONS',
  name: 'Test Has Assertions',
  description: 'Verifica se o teste contém asserções',
  gate: 1,
  order: 2,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    const content = await ctx.services.git.readFile(ctx.testFilePath)
    const assertionRegex = /expect\(|assert\(/
    const hasAssertions = assertionRegex.test(content)

    if (!hasAssertions) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file contains no assertions (expect or assert calls)',
        evidence: 'No expect() or assert() calls found in test file. Tests must contain assertions to validate behavior.',
      }
    }

    const assertionCount = (content.match(/expect\(/g) || []).length +
                           (content.match(/assert\(/g) || []).length

    return {
      passed: true,
      status: 'PASSED',
      message: `Test file contains assertions: ${assertionCount} found`,
      metrics: {
        assertionCount,
      },
    }
  },
}
