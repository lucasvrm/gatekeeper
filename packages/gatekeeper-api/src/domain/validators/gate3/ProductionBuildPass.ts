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
    const buildCommand = 'npm run build'

    if (!result.success) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Production build failed',
        context: {
          inputs: [{ label: 'Build Command', value: buildCommand }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Production build failed' }],
          reasoning: 'Build command exited with a failure status.',
        },
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
      context: {
        inputs: [{ label: 'Build Command', value: buildCommand }],
        analyzed: [],
        findings: [{ type: 'pass', message: 'Production build succeeded' }],
        reasoning: 'Build command completed successfully.',
      },
      metrics: {
        exitCode: result.exitCode,
      },
    }
  },
}
