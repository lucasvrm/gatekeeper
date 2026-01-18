import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { parseClauseTags } from '../../../utils/clauseTagParser.js'

export const TestIntentAlignmentValidator: ValidatorDefinition = {
  code: 'TEST_INTENT_ALIGNMENT',
  name: 'Test Intent Alignment',
  description: 'Verifica alinhamento entre prompt e teste',
  gate: 1,
  order: 9,
  isHardBlock: false,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    try {
      const testContent = await ctx.services.git.readFile(ctx.testFilePath)
      
      const extractKeywords = (text: string): Set<string> => {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'should', 'could', 'would', 'test', 'tests', 'it', 'should'])
        
        const words = text.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3 && !stopWords.has(word))
        
        return new Set(words)
      }
      
      const promptKeywords = extractKeywords(ctx.taskPrompt)
      
      const testDescriptions = testContent.match(/(?:describe|it)\s*\(\s*['"]([^'"]+)['"]/g) || []
      const testText = testDescriptions.join(' ')
      const testKeywords = extractKeywords(testText)
      
      const clauseTags = parseClauseTags(testContent, ctx.testFilePath, {
        tagPattern: ctx.contract?.testMapping?.tagPattern,
      })
      const deEmphasizeAlignment = Boolean(ctx.contract?.clauses?.length && clauseTags.length > 0)

      const commonKeywords = Array.from(promptKeywords).filter(word => testKeywords.has(word))
      
      const alignmentRatio = promptKeywords.size > 0 
        ? commonKeywords.length / promptKeywords.size 
        : 0
      
      const threshold = 0.3

      if (alignmentRatio < threshold) {
        const evidence = `Prompt keywords: ${Array.from(promptKeywords).slice(0, 10).join(', ')}\n` +
          `Test keywords: ${Array.from(testKeywords).slice(0, 10).join(', ')}\n` +
          `Common keywords: ${commonKeywords.length > 0 ? commonKeywords.slice(0, 10).join(', ') : 'none'}`

        if (deEmphasizeAlignment) {
          return {
            passed: true,
            status: 'PASSED',
            message: `Low alignment (${Math.round(alignmentRatio * 100)}%) but contract clause tags are present; prioritizing clause coverage.`,
            evidence: `${evidence}\nClause tags detected; alignment warnings de-emphasized when clauses drive validation.`,
            details: {
              alignmentRatio: Math.round(alignmentRatio * 100) / 100,
              promptKeywordCount: promptKeywords.size,
              testKeywordCount: testKeywords.size,
              commonKeywordCount: commonKeywords.length,
              threshold,
              clauseTagCount: clauseTags.length,
              alignmentDeemphasized: true,
            },
          }
        }

        return {
          passed: true,
          status: 'WARNING',
          message: `Low alignment between prompt and test (${Math.round(alignmentRatio * 100)}%)`,
          evidence,
          details: {
            alignmentRatio: Math.round(alignmentRatio * 100) / 100,
            promptKeywordCount: promptKeywords.size,
            testKeywordCount: testKeywords.size,
            commonKeywordCount: commonKeywords.length,
            threshold,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: `Good alignment between prompt and test (${Math.round(alignmentRatio * 100)}%)`,
        metrics: {
          alignmentRatio: Math.round(alignmentRatio * 100) / 100,
          promptKeywordCount: promptKeywords.size,
          testKeywordCount: testKeywords.size,
          commonKeywordCount: commonKeywords.length,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Failed to check alignment: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
