import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const NoImplicitFilesValidator: ValidatorDefinition = {
  code: 'NO_IMPLICIT_FILES',
  name: 'No Implicit Files',
  description: 'Bloqueia referências implícitas no prompt',
  gate: 1,
  order: 8,
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
    let imports: string[] = []

    if (ctx.testFilePath) {
      try {
        imports = await ctx.services.ast.getImports(ctx.testFilePath)
      } catch {
        imports = []
      }
    }

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
        context: {
          inputs: [
            { label: 'Manifest', value: ctx.manifest ?? 'none' },
            { label: 'TestFile', value: ctx.testFilePath ?? 'none' },
          ],
          analyzed: [{ label: 'Imports Found', items: imports }],
          findings: foundTerms.map((term) => ({
            type: 'fail' as const,
            message: `Implicit reference found: "${term}"`,
          })),
          reasoning: 'Prompt contains implicit references to files outside the manifest.',
        },
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
      context: {
        inputs: [
          { label: 'Manifest', value: ctx.manifest ?? 'none' },
          { label: 'TestFile', value: ctx.testFilePath ?? 'none' },
        ],
        analyzed: [{ label: 'Imports Found', items: imports }],
        findings: [{ type: 'pass', message: 'No implicit file references found in prompt' }],
        reasoning: 'Prompt references files explicitly, with no implicit scope expansion.',
      },
      metrics: {
        promptLength: ctx.taskPrompt.length,
        checkedTerms: implicitTerms.length,
      },
    }
  },
}
