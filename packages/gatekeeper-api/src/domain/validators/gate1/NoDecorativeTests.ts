import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const NoDecorativeTestsValidator: ValidatorDefinition = {
  code: 'NO_DECORATIVE_TESTS',
  name: 'No Decorative Tests',
  description: 'Bloqueia testes vazios ou sem asserções reais',
  gate: 1,
  order: 5,
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
      
      const issues: string[] = []
      
      const emptyTestRegex = /it\s*\(\s*['"][^'"]*['"]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g
      const emptyTests = content.match(emptyTestRegex)
      if (emptyTests && emptyTests.length > 0) {
        issues.push(`Found ${emptyTests.length} empty test(s) with no implementation`)
      }
      
      const testBlocks = content.match(/it\s*\(\s*['"][^'"]*['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*\}/gs) || []
      for (const block of testBlocks) {
        if (!block.includes('expect(') && !block.includes('assert(') && !block.includes('should')) {
          const testNameMatch = block.match(/it\s*\(\s*['"]([^'"]*)['"]/);
          const testName = testNameMatch ? testNameMatch[1] : 'unknown';
          if (block.trim().length < 100 && !block.includes('toMatchSnapshot')) {
            issues.push(`Test "${testName}" has no assertions`)
          }
        }
      }
      
      const snapshotOnlyRegex = /it\s*\([^)]*\)\s*=>\s*\{[^}]*toMatchSnapshot\(\)[^}]*\}/g
      const snapshotTests = content.match(snapshotOnlyRegex) || []
      for (const snapTest of snapshotTests) {
        if (!snapTest.includes('render(') && !snapTest.includes('expect(')) {
          issues.push('Snapshot test without setup or expectations')
        }
      }

      const renderWithoutAssert = /render\([^)]*\)(?!.*(?:expect\(|assert\())/gs
      if (renderWithoutAssert.test(content)) {
        const matches = content.match(/it\s*\([^)]*\)\s*=>\s*\{[^}]*render\([^)]*\)[^}]*\}/gs) || []
        for (const match of matches) {
          if (!match.includes('expect(') && !match.includes('assert(')) {
            issues.push('render() call without subsequent assertions')
          }
        }
      }

      if (issues.length > 0) {
        return {
          passed: false,
          status: 'FAILED',
          message: `Found ${issues.length} decorative test issue(s)`,
          evidence: `Decorative test problems:\n${issues.map(i => `  - ${i}`).join('\n')}`,
          details: {
            issues,
            testFile: ctx.testFilePath,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'All tests have substantial assertions',
        metrics: {
          totalTestBlocks: testBlocks.length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to analyze test file: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
