import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { access, copyFile, mkdir, rm } from 'fs/promises'
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
    console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Using testFilePath:', ctx.testFilePath)
    if (!ctx.testFilePath) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Test file path not configured',
        context: {
          inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Test file path not provided' }],
          reasoning: 'Cannot validate base_ref behavior without a test file path.',
        },
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
    const testInWorktreeNormalized = testInWorktree.replace(/\\/g, '/')

    try {
      try {
        await access(ctx.testFilePath)
      } catch {
        return {
          passed: false,
          status: 'FAILED',
          message: `Test file not found: ${ctx.testFilePath}`,
          context: {
            inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
            analyzed: [],
            findings: [{ type: 'fail', message: 'Test file not found' }],
            reasoning: 'Cannot run base_ref test because the test file does not exist.',
          },
        }
      }

      // Ensure clean sandbox directory
      await rm(worktreePath, { recursive: true, force: true })
      await mkdir(worktreeParent, { recursive: true })

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Creating baseRef worktree:', {
        baseRef: ctx.baseRef,
        worktreePath,
      })

      await ctx.services.git.createWorktree(ctx.baseRef, worktreePath)

      const runner = new TestRunnerService(worktreePath)

      const testDir = dirname(testInWorktree)
      const testDirNormalized = testDir.replace(/\\/g, '/')
      await mkdir(testDirNormalized, { recursive: true })
      await copyFile(ctx.testFilePath, testInWorktreeNormalized)
      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Copied spec to worktree:', testInWorktreeNormalized)

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Running test in worktree:', {
        testFilePath: ctx.testFilePath,
        testInWorktree,
      })

      const result = await runner.runSingleTest(testInWorktreeNormalized)

      if (result.passed) {
        return {
          passed: false,
          status: 'FAILED',
          message: 'CLÁUSULA PÉTREA VIOLATION: Test passed on base_ref but should fail (TDD red phase required)',
          context: {
            inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
            analyzed: [{ label: 'Test Run Result', items: [`passed: ${result.passed}`, `exitCode: ${result.exitCode}`] }],
            findings: [{ type: 'fail', message: 'Test passed on base_ref; should fail in red phase' }],
            reasoning: 'Test execution on base_ref unexpectedly passed.',
          },
          evidence:
            `Test output on ${ctx.baseRef} (worktree):\n${result.output}\n\n` +
            `This violates TDD principles - the test must fail before implementation.`,
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
          context: {
            inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
            analyzed: [{ label: 'Test Run Result', items: ['test file not found'] }],
            findings: [{ type: 'pass', message: 'Test file missing on base_ref (acceptable)' }],
            reasoning: 'Missing test file on base_ref is treated as a failing baseline, which is acceptable.',
          },
          evidence: `BaseRef ${ctx.baseRef} (worktree) missing test file:\n${result.output}`,
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
        context: {
          inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
          analyzed: [{ label: 'Test Run Result', items: [`passed: ${result.passed}`, `exitCode: ${result.exitCode}`] }],
          findings: [{ type: 'pass', message: 'Test failed on base_ref as expected' }],
          reasoning: 'Test failure on base_ref confirms the TDD red phase.',
        },
        evidence: `Test failed as expected on ${ctx.baseRef} (worktree):\n${result.output}`,
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
        context: {
          inputs: [{ label: 'BaseRef', value: ctx.baseRef }],
          analyzed: [{ label: 'Test Run Result', items: ['error running test in worktree'] }],
          findings: [{ type: 'fail', message: 'Worktree test execution failed' }],
          reasoning: 'An error occurred while running the test in the base_ref worktree.',
        },
        evidence:
          `BaseRef: ${ctx.baseRef}\n` +
          `Worktree: ${worktreePath}\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
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
      } catch {
        // Intentionally ignored - cleanup is best-effort only
      }
    }
  },
}
