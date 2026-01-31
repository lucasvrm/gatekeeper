import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { resolve, isAbsolute } from 'path'
import { minimatch } from 'minimatch'

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase()
}

export const TestReadOnlyEnforcementValidator: ValidatorDefinition = {
  code: 'TEST_READ_ONLY_ENFORCEMENT',
  name: 'Test Read Only Enforcement',
  description: 'Verifica se arquivos de teste não foram modificados',
  gate: 2,
  order: 2,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    console.log('[TEST_READ_ONLY_ENFORCEMENT] Using testFilePath:', ctx.testFilePath)
    console.log('[TEST_READ_ONLY_ENFORCEMENT] Using manifest.testFile:', ctx.manifest?.testFile)
    const useWorkingTree = ctx.config.get('DIFF_SCOPE_INCLUDE_WORKING_TREE') === 'true'
    const excludedPatternsStr = ctx.config.get('TEST_READ_ONLY_EXCLUDED_PATHS')
    const excludedPatterns = excludedPatternsStr
      ? excludedPatternsStr.split(',').map((pattern) => pattern.trim()).filter(Boolean)
      : ['artifacts/**']

    const diffFiles = useWorkingTree
      ? await ctx.services.git.getDiffFilesWithWorkingTree(ctx.baseRef)
      : await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)

    // Build array of allowed test paths (both testFilePath and manifest.testFile)
    const allowedTestPaths: string[] = []

    if (ctx.testFilePath) {
      allowedTestPaths.push(normalizePath(resolve(ctx.projectPath, ctx.testFilePath)))
    }

    if (ctx.manifest?.testFile) {
      allowedTestPaths.push(normalizePath(resolve(ctx.projectPath, ctx.manifest.testFile)))
    }

    const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/
    const modifiedTests = diffFiles.filter((file) => {
      if (!testFilePattern.test(file)) return false

      const normalizedFile = file.replace(/\\/g, '/')
      if (excludedPatterns.some((pattern) => minimatch(normalizedFile, pattern, { dot: true }))) {
        return false
      }

      const diffAbsolute = resolve(ctx.projectPath, file)
      const diffNormalized = normalizePath(diffAbsolute)

      // Check if file is in allowed test paths
      if (allowedTestPaths.includes(diffNormalized)) {
        return false
      }

      return true
    })

    // Build list of allowed test paths for display
    const allowedTestsDisplay: string[] = []
    if (ctx.testFilePath) allowedTestsDisplay.push(ctx.testFilePath)
    if (ctx.manifest?.testFile) allowedTestsDisplay.push(ctx.manifest.testFile)

    if (modifiedTests.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Existing test files were modified: ${modifiedTests.length} file(s)`,
        context: {
          inputs: [
            { label: 'AllowedTests', value: allowedTestsDisplay.length > 0 ? allowedTestsDisplay : 'none' },
            { label: 'TestFilePath', value: ctx.testFilePath ?? 'none' },
            { label: 'ManifestTestFile', value: ctx.manifest?.testFile ?? 'none' },
            { label: 'ExcludedPatterns', value: excludedPatterns },
          ],
          analyzed: [{ label: 'Diff Files', items: diffFiles }],
          findings: modifiedTests.map((file) => ({
            type: 'fail' as const,
            message: `Modified test file: ${file}`,
            location: file,
          })),
          reasoning: 'Existing test files should remain read-only during execution.',
        },
        details: {
          modifiedTests,
          allowedTests: allowedTestsDisplay,
          excludedPatterns,
        },
        evidence: `Modified test files:\n${modifiedTests.map((f) => `  - ${f}`).join('\n')}\n\nExisting tests should not be modified. Allowed test files: ${allowedTestsDisplay.length > 0 ? allowedTestsDisplay.join(', ') : 'N/A'}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'No existing test files were modified',
      context: {
        inputs: [
          { label: 'AllowedTests', value: allowedTestsDisplay.length > 0 ? allowedTestsDisplay : 'none' },
          { label: 'TestFilePath', value: ctx.testFilePath ?? 'none' },
          { label: 'ManifestTestFile', value: ctx.manifest?.testFile ?? 'none' },
          { label: 'ExcludedPatterns', value: excludedPatterns },
        ],
        analyzed: [{ label: 'Diff Files', items: diffFiles }],
        findings: [{ type: 'pass', message: 'No modified test files detected' }],
        reasoning: 'Diff does not include modifications to existing test files.',
      },
      metrics: {
        totalDiffFiles: diffFiles.length,
        modifiedTestFiles: 0,
      },
      details: {
        allowedTests: allowedTestsDisplay,
        excludedPatterns,
      },
    }
  },
}
