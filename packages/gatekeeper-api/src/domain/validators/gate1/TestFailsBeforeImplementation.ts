import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { mkdir, rm } from 'fs/promises'
import { dirname, isAbsolute, join, relative as pathRelative } from 'path'
import { tmpdir } from 'os'
import { TestRunnerService } from '../../../services/TestRunnerService.js'

export const TestFailsBeforeImplementationValidator: ValidatorDefinition = {
  code: 'TEST_FAILS_BEFORE_IMPLEMENTATION',
  name: 'Test Fails Before Implementation',
  description: 'CLÁUSULA PÉTREA: Teste deve falhar no base_ref',
  gate: 1,
  order: 4,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No test file path provided',
      }
    }

    // Sandbox path: %TEMP%\gatekeeper\<runId>\baseRef
    const worktreePath = join(tmpdir(), 'gatekeeper', ctx.runId, 'baseRef')
    const worktreeParent = dirname(worktreePath)

    // If testFilePath is absolute in the real repo, re-resolve inside the worktree.
    const rel = isAbsolute(ctx.testFilePath)
      ? pathRelative(ctx.projectPath, ctx.testFilePath)
      : ctx.testFilePath
    const testInWorktree = join(worktreePath, rel)

    try {
      // Ensure clean sandbox directory
      await rm(worktreePath, { recursive: true, force: true })
      await mkdir(worktreeParent, { recursive: true })

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Creating baseRef worktree:', {
        baseRef: ctx.baseRef,
        worktreePath,
      })

      await ctx.services.git.createWorktree(ctx.baseRef, worktreePath)

      const runner = new TestRunnerService(worktreePath)

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Running test in worktree:', {
        testFilePath: ctx.testFilePath,
        testInWorktree,
      })

      const result = await runner.runSingleTest(testInWorktree)

      if (result.passed) {
        return {
          passed: false,
          status: 'FAILED',
          message: 'CLÁUSULA PÉTREA VIOLATION: Test passed on base_ref but should fail (TDD red phase required)',
          evidence:
            Test output on  (worktree):\n\n\n +
            This violates TDD principles - the test must fail before implementation.,
          details: {
            baseRef: ctx.baseRef,
            testPassed: true,
            exitCode: result.exitCode,
            worktreePath,
          },
        }
      }

      // If the test file doesn't exist yet on baseRef, it's acceptable (still a "red" condition).
      const missingFile = result.output.includes('Test file not found')
      if (missingFile) {
        return {
          passed: true,
          status: 'PASSED',
          message: 'Test file does not exist on base_ref (acceptable - file may not exist yet)',
          evidence: BaseRef  (worktree) missing test file:\n,
          metrics: {
            baseRef: ctx.baseRef,
            exitCode: result.exitCode,
            duration: result.duration,
          },
        }
      }

      // Test failed - correct for TDD red phase
      return {
        passed: true,
        status: 'PASSED',
        message: 'Test correctly fails on base_ref (TDD red phase confirmed)',
        evidence: Test failed as expected on  (worktree):\n,
        metrics: {
          baseRef: ctx.baseRef,
          exitCode: result.exitCode,
          duration: result.duration,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Failed to run base_ref test in worktree',
        evidence:
          BaseRef: \n +
          Worktree: \n +
          Error: ,
      }
    } finally {
      try {
        await ctx.services.git.removeWorktree(worktreePath)
      } catch (cleanupError) {
        console.warn(
          '[TEST_FAILS_BEFORE_IMPLEMENTATION] Failed to remove worktree:',
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        )
      }

      // Best-effort filesystem cleanup
      try {
        await rm(worktreePath, { recursive: true, force: true })
      } catch {}
    }
  },
}