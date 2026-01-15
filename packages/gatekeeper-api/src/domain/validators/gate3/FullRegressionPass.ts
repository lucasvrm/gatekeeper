import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const FullRegressionPassValidator: ValidatorDefinition = {
  code: 'FULL_REGRESSION_PASS',
  name: 'Full Regression Pass',
  description: 'Verifica se todos os testes passam',
  gate: 3,
  order: 1,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const result = await ctx.services.testRunner.runAllTests()

    if (!result.passed) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Full test suite failed',
        details: {
          exitCode: result.exitCode,
          duration: result.duration,
          error: result.error,
        },
        evidence: `Test output:\n${result.output.slice(-2000)}${result.error ? `\n\nError: ${result.error}` : ''}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'All tests passed',
      metrics: {
        duration: result.duration,
        exitCode: result.exitCode,
      },
    }
  },
}
