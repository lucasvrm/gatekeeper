import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const ProductionBuildPassValidator: ValidatorDefinition = {
  code: 'PRODUCTION_BUILD_PASS',
  name: 'Production Build Pass',
  description: 'Verifica se build de produção funciona',
  gate: 3,
  order: 2,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const result = await ctx.services.build.build()

    if (!result.success) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Production build failed',
        details: {
          exitCode: result.exitCode,
        },
        evidence: `Build output:\n${result.output.slice(-2000)}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Production build successful',
      metrics: {
        exitCode: result.exitCode,
      },
    }
  },
}
