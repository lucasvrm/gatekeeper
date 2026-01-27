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
    const contextItems = ['taskPrompt', ctx.manifest ? 'manifest' : 'manifest (none)', 'refs']

    if (tokenCount > effectiveMax) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Context exceeds token budget: ${tokenCount} > ${effectiveMax}`,
        context: {
          inputs: [
            { label: 'MAX_TOKEN_BUDGET', value: maxTokenBudget },
            { label: 'TOKEN_SAFETY_MARGIN', value: safetyMargin },
          ],
          analyzed: [{ label: 'Context Items', items: contextItems }],
          findings: [{ type: 'fail', message: `Token count ${tokenCount} exceeds limit ${effectiveMax}` }],
          reasoning: `Token count ${tokenCount} exceeds effective limit ${effectiveMax} (max ${maxTokenBudget} * margin ${safetyMargin}).`,
        },
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
      context: {
        inputs: [
          { label: 'MAX_TOKEN_BUDGET', value: maxTokenBudget },
          { label: 'TOKEN_SAFETY_MARGIN', value: safetyMargin },
        ],
        analyzed: [{ label: 'Context Items', items: contextItems }],
        findings: [{ type: 'pass', message: `Token count ${tokenCount} within limit ${effectiveMax}` }],
        reasoning: `Token count ${tokenCount} is within effective limit ${effectiveMax} (max ${maxTokenBudget} * margin ${safetyMargin}).`,
      },
      metrics: {
        tokenCount,
        maxTokens: maxTokenBudget,
        effectiveMax,
        utilizationPercent: ((tokenCount / effectiveMax) * 100).toFixed(2),
      },
    }
  },
}
