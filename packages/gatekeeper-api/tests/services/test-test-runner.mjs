import { TestRunnerService } from '../../src/services/TestRunnerService.ts'

console.log('=== TESTE 5: TestRunnerService.runSingleTest() ===\n')

async function test() {
  const testProjectRoot = 'C:\\Coding\\pipe'
  const testRunner = new TestRunnerService(testProjectRoot)

  try {
    // Cenário 1: Teste que passa (existente no pipedesk)
    console.log('📋 Cenário 1: Teste que PASSA')
    const passingTest = 'src/ui/layout/__tests__/layout-rail-sidebar.spec.tsx'
    console.log('  Executando:', passingTest)

    const result1 = await testRunner.runSingleTest(passingTest)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    exitCode:', result1.exitCode)
    console.log('    duration:', result1.duration, 'ms')
    console.log('    output (primeiras 200 chars):', result1.output.substring(0, 200))

    if (result1.passed && result1.exitCode === 0) {
      console.log('  ✅ PASSOU: Teste executado e passou')
    } else {
      console.log('  ❌ FALHOU: Teste deveria passar mas não passou')
      console.log('  Output completo:', result1.output)
    }

    // Cenário 2: Teste que falha (vamos criar um temporário)
    console.log('\n📋 Cenário 2: Teste que FALHA (arquivo inexistente)')
    const failingTest = 'src/__tests__/nonexistent-test.spec.tsx'
    console.log('  Executando:', failingTest)

    const result2 = await testRunner.runSingleTest(failingTest)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    exitCode:', result2.exitCode)
    console.log('    error:', result2.error ? result2.error.substring(0, 100) : 'N/A')

    if (!result2.passed && result2.exitCode !== 0) {
      console.log('  ✅ PASSOU: Teste falhou como esperado (arquivo não existe)')
    } else {
      console.log('  ❌ FALHOU: Teste deveria falhar mas passou')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
