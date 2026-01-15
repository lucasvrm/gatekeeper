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
      await ctx.services.git.checkout(ctx.baseRef)
      
      try {
        const result = await ctx.services.testRunner.runSingleTest(ctx.testFilePath)
        
        await ctx.services.git.checkout(originalRef)

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

        return {
          passed: true,
          status: 'PASSED',
          message: 'Test correctly fails on base_ref (TDD red phase confirmed)',
          metrics: {
            baseRef: ctx.baseRef,
            exitCode: result.exitCode,
            duration: result.duration,
          },
        }
      } catch (testError) {
        await ctx.services.git.checkout(originalRef)
        
        return {
          passed: true,
          status: 'PASSED',
          message: 'Test fails on base_ref (error is expected)',
          details: {
            error: testError instanceof Error ? testError.message : String(testError),
          },
        }
      }
    } catch (checkoutError) {
      try {
        await ctx.services.git.checkout(originalRef)
      } catch {
        // Ignore checkout back error
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
