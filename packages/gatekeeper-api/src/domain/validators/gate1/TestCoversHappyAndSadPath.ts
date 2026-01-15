import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TestCoversHappyAndSadPathValidator: ValidatorDefinition = {
  code: 'TEST_COVERS_HAPPY_AND_SAD_PATH',
  name: 'Test Covers Happy and Sad Path',
  description: 'Verifica cobertura de cenários positivos e negativos',
  gate: 1,
  order: 3,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    try {
      const content = await ctx.services.git.readFile(ctx.testFilePath)
      
      const happyPathRegex = /it\s*\(\s*['"].*?(success|should|when.*valid|passes)/i
      const sadPathRegex = /it\s*\(\s*['"].*?(error|fail|throws|invalid|when.*not)/i
      
      const hasHappyPath = happyPathRegex.test(content)
      const hasSadPath = sadPathRegex.test(content)

      if (!hasHappyPath || !hasSadPath) {
        const missing = []
        if (!hasHappyPath) missing.push('happy path (success scenarios)')
        if (!hasSadPath) missing.push('sad path (error scenarios)')
        
        return {
          passed: false,
          status: 'FAILED',
          message: `Test missing coverage: ${missing.join(', ')}`,
          evidence: `Missing test scenarios:\n${missing.map(m => `  - ${m}`).join('\n')}`,
          details: {
            hasHappyPath,
            hasSadPath,
            testFile: ctx.testFilePath,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'Test covers both happy and sad paths',
        metrics: {
          happyPathTests: (content.match(happyPathRegex) || []).length,
          sadPathTests: (content.match(sadPathRegex) || []).length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to read test file: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
