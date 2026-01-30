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
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot evaluate happy/sad path coverage without a test file path.',
        },
      }
    }

    try {
      const content = await ctx.services.git.readFile(ctx.testFilePath)

      const happyKeywordsStr = ctx.config.get('HAPPY_PATH_KEYWORDS') || 'success,should,valid,passes,correctly,works,returns'
      const sadKeywordsStr = ctx.config.get('SAD_PATH_KEYWORDS') || 'error,fail,throws,invalid,not,reject,deny,block'
      const happyKeywords = happyKeywordsStr.split(',').map((k) => k.trim()).filter(Boolean)
      const sadKeywords = sadKeywordsStr.split(',').map((k) => k.trim()).filter(Boolean)

      const buildKeywordRegex = (keywords: string[]) => {
        const escaped = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        return new RegExp(`it\\s*\\(\\s*['"].*?(${escaped.join('|')})`, 'i')
      }

      const happyPathRegex = buildKeywordRegex(happyKeywords)
      const sadPathRegex = buildKeywordRegex(sadKeywords)
      const testNames = Array.from(content.matchAll(/it\s*\(\s*['"]([^'"]+)['"]/g)).map((match) => match[1])
      
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
          context: {
            inputs: [],
            analyzed: [{ label: 'Test Names', items: testNames }],
            findings: missing.map((item) => ({ type: 'fail' as const, message: `Missing ${item}` })),
            reasoning: 'Test suite does not include both happy and sad path scenarios.',
          },
          evidence: `Missing test scenarios:\n${missing.map(m => `  - ${m}`).join('\n')}`,
          details: {
            hasHappyPath,
            hasSadPath,
            testFile: ctx.testFilePath,
            happyKeywords,
            sadKeywords,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'Test covers both happy and sad paths',
        context: {
          inputs: [],
          analyzed: [{ label: 'Test Names', items: testNames }],
          findings: [
            { type: 'pass', message: 'Happy path coverage detected' },
            { type: 'pass', message: 'Sad path coverage detected' },
          ],
          reasoning: 'Test file includes both success and error scenarios.',
        },
        metrics: {
          happyPathTests: (content.match(happyPathRegex) || []).length,
          sadPathTests: (content.match(sadPathRegex) || []).length,
        },
        details: {
          happyKeywords,
          sadKeywords,
          hasHappyPath,
          hasSadPath,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to read test file: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Unable to read test file for coverage analysis' }],
          reasoning: 'An error occurred while loading the test file for analysis.',
        },
      }
    }
  },
}
