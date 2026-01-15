import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TaskTestPassesValidator: ValidatorDefinition = {
  code: 'TASK_TEST_PASSES',
  name: 'Task Test Passes',
  description: 'Verifica se o teste da tarefa passa',
  gate: 2,
  order: 3,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    const result = await ctx.services.testRunner.runSingleTest(ctx.testFilePath)

    if (!result.passed) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Task test failed',
        details: {
          exitCode: result.exitCode,
          duration: result.duration,
          error: result.error,
        },
        evidence: `Test output:\n${result.output}${result.error ? `\n\nError: ${result.error}` : ''}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Task test passed',
      metrics: {
        duration: result.duration,
        exitCode: result.exitCode,
      },
    }
  },
}
