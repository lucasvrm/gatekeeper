import { FullRegressionPassValidator } from '../../../src/domain/validators/gate3/FullRegressionPass.ts'
import { ProductionBuildPassValidator } from '../../../src/domain/validators/gate3/ProductionBuildPass.ts'

console.log('=== TESTES 29-30: Gate 3 Validators (Final) ===\n')

async function test() {
  try {
    // Mock test runner service
    const mockTestRunner = {
      runAllTests: async () => {
        if (Math.random() > 0.5) {
          return {
            passed: true,
            exitCode: 0,
            output: 'All 150 tests passed successfully',
            duration: 5000
          }
        } else {
          return {
            passed: false,
            exitCode: 1,
            output: 'Test suite failed: 3 tests failed out of 150',
            error: 'Test failures detected',
            duration: 4500
          }
        }
      }
    }

    // Mock build service
    const mockBuild = {
      build: async () => {
        if (Math.random() > 0.5) {
          return {
            success: true,
            exitCode: 0,
            output: 'Build completed successfully. Output: dist/'
          }
        } else {
          return {
            success: false,
            exitCode: 1,
            output: 'Build failed with compilation errors'
          }
        }
      }
    }

    // ===== TESTE 29: FullRegressionPass =====
    console.log('📋 TESTE 29: FullRegressionPassValidator\n')

    console.log('  Cenário 1: Todos os testes passam (PASSED)')
    const mockPassingRunner = {
      runAllTests: async () => ({
        passed: true,
        exitCode: 0,
        output: 'All 150 tests passed',
        duration: 5000
      })
    }

    const result29_1 = await FullRegressionPassValidator.execute({
      services: { testRunner: mockPassingRunner }
    })
    console.log('    passed:', result29_1.passed, '| Expected: true')
    console.log('    duration:', result29_1.metrics?.duration, 'ms')
    if (result29_1.passed) console.log('    ✅ Todos os testes passaram')

    console.log('  Cenário 2: Alguns testes falham (FAILED)')
    const mockFailingRunner = {
      runAllTests: async () => ({
        passed: false,
        exitCode: 1,
        output: '147 passed, 3 failed',
        error: 'Test failures detected',
        duration: 4500
      })
    }

    const result29_2 = await FullRegressionPassValidator.execute({
      services: { testRunner: mockFailingRunner }
    })
    console.log('    passed:', result29_2.passed, '| Expected: false')
    console.log('    exitCode:', result29_2.details?.exitCode)
    if (!result29_2.passed) console.log('    ✅ Detectou falhas nos testes')

    console.log('  Gate:', FullRegressionPassValidator.gate, '| Order:', FullRegressionPassValidator.order)
    console.log('  isHardBlock:', FullRegressionPassValidator.isHardBlock)
    console.log('  ✅ TESTE 29 CONCLUÍDO\n')

    // ===== TESTE 30: ProductionBuildPass =====
    console.log('📋 TESTE 30: ProductionBuildPassValidator\n')

    console.log('  Cenário 1: Build bem-sucedido (PASSED)')
    const mockSuccessBuild = {
      build: async () => ({
        success: true,
        exitCode: 0,
        output: 'Build completed: dist/ created'
      })
    }

    const result30_1 = await ProductionBuildPassValidator.execute({
      services: { build: mockSuccessBuild }
    })
    console.log('    passed:', result30_1.passed, '| Expected: true')
    console.log('    exitCode:', result30_1.metrics?.exitCode)
    if (result30_1.passed) console.log('    ✅ Build bem-sucedido')

    console.log('  Cenário 2: Build falha (FAILED)')
    const mockFailedBuild = {
      build: async () => ({
        success: false,
        exitCode: 1,
        output: 'Build failed: TypeScript errors'
      })
    }

    const result30_2 = await ProductionBuildPassValidator.execute({
      services: { build: mockFailedBuild }
    })
    console.log('    passed:', result30_2.passed, '| Expected: false')
    console.log('    exitCode:', result30_2.details?.exitCode)
    if (!result30_2.passed) console.log('    ✅ Detectou falha no build')

    console.log('  Gate:', ProductionBuildPassValidator.gate, '| Order:', ProductionBuildPassValidator.order)
    console.log('  isHardBlock:', ProductionBuildPassValidator.isHardBlock)
    console.log('  ✅ TESTE 30 CONCLUÍDO\n')

    console.log('✅ FASE 5 COMPLETA - GATE 3 (2/2 validators testados)')
    console.log('\n🎉 TODAS AS FASES CONCLUÍDAS (Fases 1-5, 30 testes)')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
