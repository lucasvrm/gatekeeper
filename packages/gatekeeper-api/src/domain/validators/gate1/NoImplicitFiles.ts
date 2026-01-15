import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const NoImplicitFilesValidator: ValidatorDefinition = {
  code: 'NO_IMPLICIT_FILES',
  name: 'No Implicit Files',
  description: 'Bloqueia referências implícitas no prompt',
  gate: 1,
  order: 7,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const implicitTerms = [
      'outros arquivos',
      'other files',
      'arquivos relacionados',
      'related files',
      'arquivos necessários',
      'necessary files',
      'arquivos adicionais',
      'additional files',
      'e outros',
      'and others',
      'etc',
      'etcetera',
      'e tal',
      'entre outros',
      'among others',
      'demais arquivos',
      'remaining files',
      'todos os arquivos',
      'all files',
      'qualquer arquivo',
      'any file',
      '...',
    ]

    const prompt = ctx.taskPrompt.toLowerCase()
    const foundTerms: string[] = []

    for (const term of implicitTerms) {
      if (prompt.includes(term.toLowerCase())) {
        foundTerms.push(term)
      }
    }

    if (foundTerms.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Task prompt contains ${foundTerms.length} implicit file reference(s)`,
        evidence: `Implicit references found:\n${foundTerms.map(t => `  - "${t}"`).join('\n')}\n\nAll files must be explicitly listed in the manifest.`,
        details: {
          foundTerms,
          promptLength: ctx.taskPrompt.length,
        },
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Task prompt has explicit file references only',
      metrics: {
        promptLength: ctx.taskPrompt.length,
        checkedTerms: implicitTerms.length,
      },
    }
  },
}
