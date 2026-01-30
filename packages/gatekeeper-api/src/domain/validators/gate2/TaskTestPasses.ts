import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TaskTestPassesValidator: ValidatorDefinition = {
  code: 'TASK_TEST_PASSES',
  name: 'Task Test Passes',
  description: 'Verifica se o teste da tarefa passa',
  gate: 2,
  order: 3,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    console.log('[TASK_TEST_PASSES] Using testFilePath:', ctx.testFilePath)

    if (!ctx.testFilePath || ctx.testFilePath.trim() === '') {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path configured',
        context: {
          inputs: [{ label: 'TestFilePath', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Task test cannot run without a test file path.',
        },
      }
    }

    const testPath = ctx.testFilePath
    const result = await ctx.services.testRunner.runSingleTest(testPath)
    const testOutputSummary = [`exitCode: ${result.exitCode}`, `passed: ${result.passed}`]

    if (!result.passed) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Task test failed',
        context: {
          inputs: [{ label: 'TestFilePath', value: testPath }],
          analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
          findings: [{ type: 'fail', message: 'Task test failed' }],
          reasoning: 'Task test execution returned a failing result.',
        },
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
      context: {
        inputs: [{ label: 'TestFilePath', value: testPath }],
        analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
        findings: [{ type: 'pass', message: 'Task test passed' }],
        reasoning: 'Task test execution completed successfully.',
      },
      metrics: {
        duration: result.duration,
        exitCode: result.exitCode,
      },
    }
  },
}
