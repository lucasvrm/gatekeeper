import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestSyntaxValidValidator: ValidatorDefinition = {
  code: 'TEST_SYNTAX_VALID',
  name: 'Test Syntax Valid',
  description: 'Verifica se o arquivo de teste compila',
  gate: 1,
  order: 1,
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
          reasoning: 'Parser cannot validate syntax without a test file path.',
        },
      }
    }

    const result = await ctx.services.compiler.compile(ctx.testFilePath)

    if (!result.success) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Test file has compilation errors: ${result.errors.length} error(s)`,
        context: {
          inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
          analyzed: [],
          findings: result.errors.slice(0, 10).map((error) => ({
            type: 'fail' as const,
            message: error,
          })),
          reasoning: 'TypeScript parser detected compilation errors in the test file.',
        },
        details: {
          errors: result.errors,
          errorCount: result.errors.length,
        },
        evidence: `Compilation errors:\n${result.errors.slice(0, 10).join('\n')}\n${result.errors.length > 10 ? `\n...and ${result.errors.length - 10} more` : ''}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Test file compiles successfully',
      context: {
        inputs: [{ label: 'TestFilePath', value: ctx.testFilePath }],
        analyzed: [],
        findings: [{ type: 'pass', message: 'No syntax errors found' }],
        reasoning: 'TypeScript parser successfully parsed the test file without errors.',
      },
    }
  },
}
