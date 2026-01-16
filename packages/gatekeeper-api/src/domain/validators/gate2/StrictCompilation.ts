import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const StrictCompilationValidator: ValidatorDefinition = {
  code: 'STRICT_COMPILATION',
  name: 'Strict Compilation',
  description: 'Verifica compilação sem erros',
  gate: 2,
  order: 4,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    try {
      const result = await ctx.services.compiler.compile()

      if (!result.success) {
        return {
          passed: false,
          status: 'FAILED',
          message: `TypeScript compilation failed with ${result.errors.length} error(s)`,
          evidence: `Compilation errors:\n${result.errors.slice(0, 10).map(e => `  - ${e}`).join('\n')}${result.errors.length > 10 ? `\n  ... and ${result.errors.length - 10} more` : ''}`,
          details: {
            errorCount: result.errors.length,
            errors: result.errors.slice(0, 20),
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'TypeScript compilation successful',
        metrics: {
          compiled: 1,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Compilation check failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
