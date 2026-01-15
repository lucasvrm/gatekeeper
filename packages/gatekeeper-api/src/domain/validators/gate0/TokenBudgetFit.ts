import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TokenBudgetFitValidator: ValidatorDefinition = {
  code: 'TOKEN_BUDGET_FIT',
  name: 'Token Budget Fit',
  description: 'Verifica se o contexto cabe na janela da LLM com folga',
  gate: 0,
  order: 1,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const maxTokenBudget = parseInt(ctx.config.get('MAX_TOKEN_BUDGET') || '100000')
    const safetyMargin = parseFloat(ctx.config.get('TOKEN_SAFETY_MARGIN') || '0.8')
    const effectiveMax = Math.floor(maxTokenBudget * safetyMargin)

    const contextText = [
      ctx.taskPrompt,
      ctx.manifest ? JSON.stringify(ctx.manifest) : '',
      `Base: ${ctx.baseRef}, Target: ${ctx.targetRef}`,
    ].join('\n')

    const tokenCount = ctx.services.tokenCounter.count(contextText)

    if (tokenCount > effectiveMax) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Context exceeds token budget: ${tokenCount} > ${effectiveMax}`,
        metrics: {
          tokenCount,
          maxTokens: maxTokenBudget,
          effectiveMax,
          safetyMargin,
          utilizationPercent: ((tokenCount / effectiveMax) * 100).toFixed(2),
        },
        evidence: `Token count: ${tokenCount}\nEffective max: ${effectiveMax}\nUtilization: ${((tokenCount / effectiveMax) * 100).toFixed(2)}%`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: `Token budget OK: ${tokenCount} / ${effectiveMax}`,
      metrics: {
        tokenCount,
        maxTokens: maxTokenBudget,
        effectiveMax,
        utilizationPercent: ((tokenCount / effectiveMax) * 100).toFixed(2),
      },
    }
  },
}
