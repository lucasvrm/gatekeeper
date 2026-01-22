import { TaskScopeSizeValidator } from '../../../src/domain/validators/gate0/TaskScopeSize.ts'

console.log('=== TESTE 9: TaskScopeSizeValidator ===\n')

async function test() {
  try {
    // Mock config service
    const mockConfig = {
      get: (key) => {
        if (key === 'MAX_FILES_PER_TASK') return '10'
        return null
      }
    }

    // Cenário 1: SEM manifest (skipped)
    console.log('📋 Cenário 1: SEM manifest (deveria pular)')
    const noManifestContext = {
      manifest: null,
      config: mockConfig,
      services: {}
    }

    const result1 = await TaskScopeSizeValidator.execute(noManifestContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (result1.passed && result1.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente pulado quando não há manifest')
    } else {
      console.log('  ❌ FALHOU: Deveria ter retornado SKIPPED')
    }

    // Cenário 2: Poucos arquivos (passa)
    console.log('\n📋 Cenário 2: Poucos arquivos (< max)')
    const smallScopeContext = {
      manifest: {
        files: [
          { path: 'file1.ts', content: '' },
          { path: 'file2.ts', content: '' },
          { path: 'file3.ts', content: '' },
        ]
      },
      config: mockConfig,
      services: {}
    }

    const result2 = await TaskScopeSizeValidator.execute(smallScopeContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)
    console.log('    metrics:', result2.metrics)

    if (result2.passed && result2.status === 'PASSED') {
      console.log('  ✅ PASSOU: Escopo pequeno aceito (3/10 arquivos)')
    } else {
      console.log('  ❌ FALHOU: Deveria passar com poucos arquivos')
    }

    // Cenário 3: Muitos arquivos (falha)
    console.log('\n📋 Cenário 3: Muitos arquivos (> max)')

    // Criar 15 arquivos (mais que o máximo de 10)
    const files = []
    for (let i = 1; i <= 15; i++) {
      files.push({ path: `file${i}.ts`, content: '' })
    }

    const largeScopeContext = {
      manifest: { files },
      config: mockConfig,
      services: {}
    }

    const result3 = await TaskScopeSizeValidator.execute(largeScopeContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    status:', result3.status)
    console.log('    message:', result3.message)
    console.log('    metrics:', result3.metrics)

    if (!result3.passed && result3.status === 'FAILED') {
      console.log('  ✅ PASSOU: Escopo grande corretamente rejeitado (15/10 arquivos)')

      if (result3.metrics.exceedsBy === 5) {
        console.log('  ✅ PASSOU: exceedsBy calculado corretamente (5)')
      } else {
        console.log('  ❌ FALHOU: exceedsBy incorreto')
      }
    } else {
      console.log('  ❌ FALHOU: Deveria falhar com muitos arquivos')
    }

    // Cenário 4: Exatamente no limite (passa)
    console.log('\n📋 Cenário 4: Exatamente no limite (= max)')

    const limitFiles = []
    for (let i = 1; i <= 10; i++) {
      limitFiles.push({ path: `file${i}.ts`, content: '' })
    }

    const limitContext = {
      manifest: { files: limitFiles },
      config: mockConfig,
      services: {}
    }

    const result4 = await TaskScopeSizeValidator.execute(limitContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    status:', result4.status)
    console.log('    message:', result4.message)
    console.log('    metrics:', result4.metrics)

    if (result4.passed && result4.status === 'PASSED') {
      console.log('  ✅ PASSOU: Limite exato aceito (10/10 arquivos)')
    } else {
      console.log('  ❌ FALHOU: Deveria passar no limite exato')
    }

    // Cenário 5: Verificar propriedades do validator
    console.log('\n📋 Cenário 5: Verificar propriedades do validator')
    console.log('  code:', TaskScopeSizeValidator.code)
    console.log('  gate:', TaskScopeSizeValidator.gate)
    console.log('  isHardBlock:', TaskScopeSizeValidator.isHardBlock)
    console.log('  order:', TaskScopeSizeValidator.order)

    if (
      TaskScopeSizeValidator.code === 'TASK_SCOPE_SIZE' &&
      TaskScopeSizeValidator.gate === 0 &&
      TaskScopeSizeValidator.isHardBlock === true &&
      TaskScopeSizeValidator.order === 2
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 2)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
