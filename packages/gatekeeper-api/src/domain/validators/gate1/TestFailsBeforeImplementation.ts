import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

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

    const originalRef = await ctx.services.git.getCurrentRef()

    try {
      // Stash all uncommitted changes (including untracked files in artifacts/) before checkout
      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Stashing uncommitted changes...')
      await ctx.services.git.stash()

      console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Checking out baseRef:', ctx.baseRef)
      await ctx.services.git.checkout(ctx.baseRef)

      try {
        console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Running test at:', ctx.testFilePath)
        const result = await ctx.services.testRunner.runSingleTest(ctx.testFilePath)

        // Restore original ref first, then apply stash (must be strict)
        try {
          await ctx.services.git.checkout(originalRef)
          console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Restoring stashed files...')
          await ctx.services.git.stashPop()
        } catch (restoreError) {
          return {
            passed: false,
            status: 'FAILED',
            message: 'Failed to restore repo state after running base_ref test',
            evidence:
              'Restore error: ' + (restoreError instanceof Error ? restoreError.message : String(restoreError)) + '\n' +
              'OriginalRef: ' + originalRef + '\n' +
              'BaseRef: ' + ctx.baseRef + '\n' +
              'If your repo is now in a merge-conflict state, run:\n' +
              '  git reset --hard\n  git clean -fd\n  git stash list',
          }
        }

        console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Test result on baseRef:', {
          passed: result.passed,
          exitCode: result.exitCode,
        })

        if (result.passed) {
          return {
            passed: false,
            status: 'FAILED',
            message: 'CLÁUSULA PÉTREA VIOLATION: Test passed on base_ref but should fail (TDD red phase required)',
            evidence: `Test output on ${ctx.baseRef}:\n${result.output}\n\nThis violates TDD principles - the test must fail before implementation.`,
            details: {
              baseRef: ctx.baseRef,
              testPassed: true,
              exitCode: result.exitCode,
            },
          }
        }

        // Test failed - this is correct for TDD red phase
        return {
          passed: true,
          status: 'PASSED',
          message: 'Test correctly fails on base_ref (TDD red phase confirmed)',
          evidence: `Test failed as expected on ${ctx.baseRef}:\n${result.output}`,
          metrics: {
            baseRef: ctx.baseRef,
            exitCode: result.exitCode,
            duration: result.duration,
          },
        }
      } catch (testError) {
        // Restore original ref and stash even on test error
        try {
          await ctx.services.git.checkout(originalRef)
          console.log('[TEST_FAILS_BEFORE_IMPLEMENTATION] Restoring stashed files after test error...')
          await ctx.services.git.stashPop()
        } catch (restoreError) {
          return {
            passed: false,
            status: 'FAILED',
            message: 'Failed to restore repo state after test error on base_ref',
            evidence:
              'Restore error: ' + (restoreError instanceof Error ? restoreError.message : String(restoreError)) + '\n' +
              'Test error (base_ref): ' + (testError instanceof Error ? testError.message : String(testError)) + '\n' +
              'OriginalRef: ' + originalRef + '\n' +
              'BaseRef: ' + ctx.baseRef,
          }
        }

        return {
          passed: false,
          status: 'FAILED',
          message: 'Failed to execute test on base_ref',
          evidence:
            'Test error (base_ref): ' + (testError instanceof Error ? testError.message : String(testError)) + '\n' +
            'OriginalRef: ' + originalRef + '\n' +
            'BaseRef: ' + ctx.baseRef,
        }
      }
    } catch (checkoutError) {
      // Try to restore original state even if checkout failed
      try {
        await ctx.services.git.checkout(originalRef)
        await ctx.services.git.stashPop()
      } catch (restoreError) {
        console.error('[TEST_FAILS_BEFORE_IMPLEMENTATION] Failed to restore original state:', restoreError)
      }
      
      return {
        passed: false,
        status: 'FAILED',
        message: 'Failed to checkout base_ref for test execution',
        evidence: `Checkout error: ${checkoutError instanceof Error ? checkoutError.message : String(checkoutError)}`,
      }
    }
  },
}
