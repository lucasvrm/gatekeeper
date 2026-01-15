import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TaskClarityCheckValidator: ValidatorDefinition = {
  code: 'TASK_CLARITY_CHECK',
  name: 'Task Clarity Check',
  description: 'Verifica se o prompt não contém termos ambíguos',
  gate: 0,
  order: 3,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const foundTerms: string[] = []

    for (const term of ctx.ambiguousTerms) {
      const regex = new RegExp(term, 'i')
      if (regex.test(ctx.taskPrompt)) {
        foundTerms.push(term)
      }
    }

    if (foundTerms.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Ambiguous terms found in prompt: ${foundTerms.join(', ')}`,
        details: {
          foundTerms,
          totalFound: foundTerms.length,
        },
        evidence: `Ambiguous terms: ${foundTerms.join(', ')}\n\nThese terms make the task unclear. Please be specific about what needs to be done.`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Prompt is clear - no ambiguous terms found',
    }
  },
}
