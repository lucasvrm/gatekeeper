import { TokenBudgetFitValidator } from '../../../src/domain/validators/gate0/TokenBudgetFit.ts'

console.log('=== TESTE 8: TokenBudgetFitValidator ===\n')

async function test() {
  try {
    // Mock config service
    const mockConfig = {
      get: (key) => {
        if (key === 'MAX_TOKEN_BUDGET') return '100000'
        if (key === 'TOKEN_SAFETY_MARGIN') return '0.8'
        return null
      }
    }

    // Mock token counter service
    const mockTokenCounter = {
      count: (text) => text.length / 4 // Simples aproximação: ~4 chars por token
    }

    // Cenário 1: Context que CABE no budget (passa)
    console.log('📋 Cenário 1: Context que CABE no budget')
    const smallContext = {
      taskPrompt: 'Small task prompt',
      manifest: { files: [{ path: 'test.ts', content: 'test' }] },
      baseRef: 'main',
      targetRef: 'feature',
      config: mockConfig,
      services: { tokenCounter: mockTokenCounter }
    }

    const result1 = await TokenBudgetFitValidator.execute(smallContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)
    console.log('    metrics:', result1.metrics)

    if (result1.passed && result1.status === 'PASSED') {
      console.log('  ✅ PASSOU: Context aceito dentro do budget')
    } else {
      console.log('  ❌ FALHOU: Deveria passar mas falhou')
    }

    // Cenário 2: Context que EXCEDE budget (falha)
    console.log('\n📋 Cenário 2: Context que EXCEDE budget')

    // Criar texto grande o suficiente para exceder 80000 tokens
    // 80000 tokens * 4 chars/token = 320000 chars
    const largeText = 'x'.repeat(400000)

    const largeContext = {
      taskPrompt: largeText,
      manifest: { files: [{ path: 'test.ts', content: 'test' }] },
      baseRef: 'main',
      targetRef: 'feature',
      config: mockConfig,
      services: { tokenCounter: mockTokenCounter }
    }

    const result2 = await TokenBudgetFitValidator.execute(largeContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)
    console.log('    metrics:', result2.metrics)

    if (!result2.passed && result2.status === 'FAILED') {
      console.log('  ✅ PASSOU: Context corretamente rejeitado (excede budget)')
    } else {
      console.log('  ❌ FALHOU: Deveria falhar mas passou')
    }

    // Cenário 3: Verificar métricas de utilização
    console.log('\n📋 Cenário 3: Verificar cálculos de métricas')

    const mediumContext = {
      taskPrompt: 'x'.repeat(200000), // 50000 tokens
      manifest: { files: [] },
      baseRef: 'main',
      targetRef: 'feature',
      config: mockConfig,
      services: { tokenCounter: mockTokenCounter }
    }

    const result3 = await TokenBudgetFitValidator.execute(mediumContext)
    console.log('  Métricas:')
    console.log('    tokenCount:', result3.metrics.tokenCount)
    console.log('    maxTokens:', result3.metrics.maxTokens)
    console.log('    effectiveMax:', result3.metrics.effectiveMax)
    console.log('    utilizationPercent:', result3.metrics.utilizationPercent + '%')

    const expectedEffective = 100000 * 0.8 // 80000
    if (result3.metrics.effectiveMax === expectedEffective) {
      console.log('  ✅ PASSOU: effectiveMax calculado corretamente (80000)')
    } else {
      console.log('  ❌ FALHOU: effectiveMax incorreto')
    }

    // Cenário 4: Verificar isHardBlock
    console.log('\n📋 Cenário 4: Verificar propriedades do validator')
    console.log('  code:', TokenBudgetFitValidator.code)
    console.log('  gate:', TokenBudgetFitValidator.gate)
    console.log('  isHardBlock:', TokenBudgetFitValidator.isHardBlock)
    console.log('  order:', TokenBudgetFitValidator.order)

    if (
      TokenBudgetFitValidator.code === 'TOKEN_BUDGET_FIT' &&
      TokenBudgetFitValidator.gate === 0 &&
      TokenBudgetFitValidator.isHardBlock === true &&
      TokenBudgetFitValidator.order === 1
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 1)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
