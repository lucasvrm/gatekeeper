import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestReadOnlyEnforcementValidator: ValidatorDefinition = {
  code: 'TEST_READ_ONLY_ENFORCEMENT',
  name: 'Test Read Only Enforcement',
  description: 'Verifica se arquivos de teste não foram modificados',
  gate: 2,
  order: 2,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    const diffFiles = await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
    
    const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/
    const modifiedTests = diffFiles.filter((file) => {
      if (!testFilePattern.test(file)) return false
      
      if (ctx.testFilePath && file === ctx.testFilePath) {
        return false
      }
      
      return true
    })

    if (modifiedTests.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Existing test files were modified: ${modifiedTests.length} file(s)`,
        details: {
          modifiedTests,
          allowedTest: ctx.testFilePath,
        },
        evidence: `Modified test files:\n${modifiedTests.map((f) => `  - ${f}`).join('\n')}\n\nExisting tests should not be modified. Only the task's test file (${ctx.testFilePath || 'N/A'}) is allowed.`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'No existing test files were modified',
      metrics: {
        totalDiffFiles: diffFiles.length,
        modifiedTestFiles: 0,
      },
    }
  },
}
