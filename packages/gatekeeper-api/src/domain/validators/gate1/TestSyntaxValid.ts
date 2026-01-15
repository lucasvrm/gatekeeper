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
      }
    }

    const result = await ctx.services.compiler.compile(ctx.testFilePath)

    if (!result.success) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Test file has compilation errors: ${result.errors.length} error(s)`,
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
    }
  },
}
