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
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot analyze decorative tests without a test file path.',
        },
      }
    }

    try {
      const content = await ctx.services.git.readFile(ctx.testFilePath)
      
      const issues: string[] = []
      const testNames = Array.from(content.matchAll(/it\s*\(\s*['"]([^'"]+)['"]/g)).map((match) => match[1])
      
      const emptyTestRegex = /it\s*\(\s*['"][^'"]*['"]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}\s*\)/g
      const emptyTests = content.match(emptyTestRegex)
      if (emptyTests && emptyTests.length > 0) {
        issues.push(`Found ${emptyTests.length} empty test(s) with no implementation`)
      }
      
      // Extract test blocks using brace balancing instead of regex [^}]*}
      // The old regex stopped at the first } in the body, missing assertions
      // that came after objects, JSX expressions, or destructuring.
      const testBlocks: string[] = []
      const testStartRegex = /it\s*\(\s*['"][^'"]*['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g
      let startMatch: RegExpExecArray | null
      while ((startMatch = testStartRegex.exec(content)) !== null) {
        const bodyStart = startMatch.index + startMatch[0].length - 1 // position of opening {
        let depth = 1
        let pos = bodyStart + 1
        while (pos < content.length && depth > 0) {
          const ch = content[pos]
          if (ch === '{') depth++
          else if (ch === '}') depth--
          // Skip string literals to avoid counting braces inside strings
          else if (ch === "'" || ch === '"' || ch === '`') {
            const quote = ch
            pos++
            while (pos < content.length && content[pos] !== quote) {
              if (content[pos] === '\\') pos++ // skip escaped chars
              pos++
            }
          }
          pos++
        }
        if (depth === 0) {
          testBlocks.push(content.slice(startMatch.index, pos))
        }
      }

      for (const block of testBlocks) {
        if (!block.includes('expect(') && !block.includes('assert(') && !block.includes('should')) {
          const testNameMatch = block.match(/it\s*\(\s*['"]([^'"]*)['"]/);
          const testName = testNameMatch ? testNameMatch[1] : 'unknown';
          // Extract only the body (between outer braces) for size check
          const bodyMatch = block.match(/=>\s*\{([\s\S]*)\}$/)
          const bodyLength = bodyMatch ? bodyMatch[1].trim().length : block.trim().length
          if (bodyLength < 200 && !block.includes('toMatchSnapshot')) {
            issues.push(`Test "${testName}" has no assertions`)
          }
        }
      }
      
      // Snapshot-only tests: check within properly extracted blocks
      for (const block of testBlocks) {
        if (block.includes('toMatchSnapshot()') && !block.includes('render(') && !block.includes('expect(')) {
          issues.push('Snapshot test without setup or expectations')
        }
      }

      // Render without assertions: check within properly extracted blocks
      for (const block of testBlocks) {
        if (block.includes('render(') && !block.includes('expect(') && !block.includes('assert(')) {
          issues.push('render() call without subsequent assertions')
        }
      }

      if (issues.length > 0) {
        return {
          passed: false,
          status: 'FAILED',
          message: `Found ${issues.length} decorative test issue(s)`,
          context: {
            inputs: [],
            analyzed: [{ label: 'Test Blocks', items: testNames }],
            findings: issues.map((issue) => ({ type: 'fail' as const, message: issue })),
            reasoning: 'Detected tests without meaningful assertions or setup.',
          },
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
        context: {
          inputs: [],
          analyzed: [{ label: 'Test Blocks', items: testNames }],
          findings: [{ type: 'pass', message: 'All tests contain substantive assertions' }],
          reasoning: 'All test blocks include meaningful assertions or setup.',
        },
        metrics: {
          totalTestBlocks: testBlocks.length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to analyze test file: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Failed to read test file for decorative analysis' }],
          reasoning: 'An error occurred while reading the test file.',
        },
      }
    }
  },
}
