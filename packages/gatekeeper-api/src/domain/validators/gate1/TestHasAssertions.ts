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
        context: {
          inputs: [{ label: 'TestFilePath', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot verify assertions without a test file path.',
        },
      }
    }

    const content = await ctx.services.git.readFile(ctx.testFilePath)
    const assertionRegex = /expect\(|assert\(/
    const hasAssertions = assertionRegex.test(content)
    const testBlocks = Array.from(content.matchAll(/it\s*\(\s*['"]([^'"]+)['"]/g)).map((match) => match[1])

    if (!hasAssertions) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file contains no assertions (expect or assert calls)',
        context: {
          inputs: [],
          analyzed: [{ label: 'Test Blocks', items: testBlocks }],
          findings: [{ type: 'fail', message: 'No expect() or assert() calls found' }],
          reasoning: 'Assertions are required to validate behavior in tests.',
        },
        evidence: 'No expect() or assert() calls found in test file. Tests must contain assertions to validate behavior.',
      }
    }

    const assertionCount = (content.match(/expect\(/g) || []).length +
                           (content.match(/assert\(/g) || []).length

    return {
      passed: true,
      status: 'PASSED',
      message: `Test file contains assertions: ${assertionCount} found`,
      context: {
        inputs: [],
        analyzed: [{ label: 'Test Blocks', items: testBlocks }],
        findings: [{ type: 'pass', message: `Found ${assertionCount} assertion(s)` }],
        reasoning: 'Test file includes expect()/assert() calls within test blocks.',
      },
      metrics: {
        assertionCount,
      },
    }
  },
}
