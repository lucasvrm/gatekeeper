import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TaskTestPassesValidator: ValidatorDefinition = {
  code: 'TASK_TEST_PASSES',
  name: 'Task Test Passes',
  description: 'Verifica se o teste da tarefa passa',
  gate: 2,
  order: 3,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-LOG-001: Diagnostic logging
    console.log('[TaskTestPasses] ctx.testFilePath:', ctx.testFilePath)
    console.log('[TaskTestPasses] ctx.manifest?.testFile:', ctx.manifest?.testFile)

    let resolvedPath: string | null = null

    // CL-PATH-004: Check if any path is available
    const manifestTestFile = ctx.manifest?.testFile
    const hasManifestPath = manifestTestFile && (manifestTestFile.includes('/') || manifestTestFile.includes('\\'))
    const hasTestFilePath = ctx.testFilePath && ctx.testFilePath.trim() !== ''

    if (!hasManifestPath && !hasTestFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
        context: {
          inputs: [{ label: 'TestFilePath', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Task test cannot run without a test file path.',
        },
      }
    }

    // CL-PATH-001 & CL-PATH-005: Prefer manifest.testFile if contains separators
    if (hasManifestPath) {
      resolvedPath = join(ctx.projectPath, manifestTestFile)

      // CL-PATH-005: Log when avoiding artifacts/ path
      if (ctx.testFilePath?.includes('/artifacts/') || ctx.testFilePath?.includes('\\artifacts\\')) {
        console.log('[TaskTestPasses] Detected artifacts/ in testFilePath, using manifest instead')
      }
    }

    // CL-PATH-002: Fallback to ctx.testFilePath
    if (!resolvedPath && ctx.testFilePath) {
      resolvedPath = ctx.testFilePath
    }

    console.log('[TaskTestPasses] Resolved path:', resolvedPath)

    // CL-PATH-003: Verify file exists
    if (resolvedPath && !existsSync(resolvedPath)) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file not found at resolved path',
        context: {
          inputs: [{ label: 'TestFilePath', value: resolvedPath }],
          analyzed: [],
          findings: [{ type: 'fail', message: `Test file not found: ${resolvedPath}` }],
          reasoning: 'Cannot run test - file does not exist at the resolved path.',
        },
      }
    }

    const result = await ctx.services.testRunner.runSingleTest(resolvedPath!)
    const testOutputSummary = [`exitCode: ${result.exitCode}`, `passed: ${result.passed}`]

    if (!result.passed) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Task test failed',
        context: {
          inputs: [{ label: 'TestFilePath', value: resolvedPath! }],
          analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
          findings: [{ type: 'fail', message: 'Task test failed' }],
          reasoning: 'Task test execution returned a failing result.',
        },
        details: {
          exitCode: result.exitCode,
          duration: result.duration,
          error: result.error,
        },
        evidence: `Test output:\n${result.output}${result.error ? `\n\nError: ${result.error}` : ''}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Task test passed',
      context: {
        inputs: [{ label: 'TestFilePath', value: resolvedPath! }],
        analyzed: [{ label: 'Test Run Output', items: testOutputSummary }],
        findings: [{ type: 'pass', message: 'Task test passed' }],
        reasoning: 'Task test execution completed successfully.',
      },
      metrics: {
        duration: result.duration,
        exitCode: result.exitCode,
      },
    }
  },
}
