import { PathConventionValidator } from '../../../src/domain/validators/gate0/PathConvention.ts'

console.log('=== TESTE 13: PathConventionValidator ===\n')

async function test() {
  try {
    const projectPath = 'C:\\Coding\\pipe'

    // Cenário 1: SEM manifest (skipped)
    console.log('📋 Cenário 1: SEM manifest (deveria pular)')
    const noManifestContext = {
      manifest: null,
      testFilePath: 'C:\\Coding\\pipe\\src\\components\\Button.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result1 = await PathConventionValidator.execute(noManifestContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (result1.passed && result1.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente pulado quando não há manifest')
    } else {
      console.log('  ❌ FALHOU: Deveria ter retornado SKIPPED')
    }

    // Cenário 2: SEM testFilePath (skipped)
    console.log('\n📋 Cenário 2: SEM testFilePath (deveria pular)')
    const noPathContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'UPDATE' },
        ]
      },
      testFilePath: null,
      projectPath,
      config: {},
      services: {}
    }

    const result2 = await PathConventionValidator.execute(noPathContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)

    if (result2.passed && result2.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente pulado quando não há testFilePath')
    } else {
      console.log('  ❌ FALHOU: Deveria ter retornado SKIPPED')
    }

    // Cenário 3: Não conseguiu detectar tipo (WARNING)
    console.log('\n📋 Cenário 3: Arquivos sem padrão reconhecível (tipo não detectado)')
    const undetectableContext = {
      manifest: {
        files: [
          { path: 'src/random/file1.tsx', action: 'UPDATE' },
          { path: 'src/random/file2.tsx', action: 'UPDATE' },
        ]
      },
      testFilePath: 'C:\\Coding\\pipe\\src\\random\\test.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result3 = await PathConventionValidator.execute(undetectableContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    status:', result3.status)
    console.log('    message:', result3.message)

    if (result3.passed && result3.status === 'WARNING') {
      console.log('  ✅ PASSOU: Retornou WARNING quando não detectou tipo')
    } else {
      console.log('  ⚠️  INFO: Status:', result3.status)
    }

    // Cenário 4: Path CORRETO (component no diretório /components/)
    console.log('\n📋 Cenário 4: Path CORRETO (component em /components/)')
    const correctPathContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'UPDATE' },
          { path: 'src/components/Input.tsx', action: 'UPDATE' },
        ]
      },
      testFilePath: 'C:\\Coding\\pipe\\src\\components\\__tests__\\button.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result4 = await PathConventionValidator.execute(correctPathContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    status:', result4.status)
    console.log('    message:', result4.message)
    console.log('    metrics:', result4.metrics)

    if (result4.passed && result4.status === 'PASSED') {
      console.log('  ✅ PASSOU: Path correto detectado (component em /components/)')
    } else {
      console.log('  ⚠️  INFO: Status:', result4.status)
    }

    // Cenário 5: Path em ARTIFACTS (WARNING)
    console.log('\n📋 Cenário 5: Path ainda em ARTIFACTS (deveria avisar)')
    const artifactsContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'UPDATE' },
        ]
      },
      testFilePath: 'C:\\Coding\\pipe\\artifacts\\button-001\\button.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result5 = await PathConventionValidator.execute(artifactsContext)
    console.log('  Resultado:')
    console.log('    passed:', result5.passed)
    console.log('    status:', result5.status)
    console.log('    message:', result5.message)
    console.log('    metrics:', result5.metrics)

    if (result5.passed && result5.status === 'WARNING') {
      console.log('  ✅ PASSOU: Detectou arquivo em artifacts e retornou WARNING')
    } else {
      console.log('  ⚠️  INFO: Status:', result5.status)
    }

    // Cenário 6: Detectar hooks corretamente
    console.log('\n📋 Cenário 6: Detectar tipo "hook" corretamente')
    const hookContext = {
      manifest: {
        files: [
          { path: 'src/hooks/useAuth.ts', action: 'UPDATE' },
          { path: 'src/hooks/useData.ts', action: 'UPDATE' },
        ]
      },
      testFilePath: 'C:\\Coding\\pipe\\src\\hooks\\__tests__\\useAuth.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result6 = await PathConventionValidator.execute(hookContext)
    console.log('  Resultado:')
    console.log('    passed:', result6.passed)
    console.log('    status:', result6.status)
    console.log('    metrics:', result6.metrics)

    if (result6.metrics?.detectedType === 'hook') {
      console.log('  ✅ PASSOU: Tipo "hook" detectado corretamente')

      if (result6.status === 'PASSED') {
        console.log('  ✅ PASSOU: Path está correto para hooks')
      } else {
        console.log('  ⚠️  INFO: Status:', result6.status)
      }
    } else {
      console.log('  ⚠️  AVISO: Tipo detectado:', result6.metrics?.detectedType)
    }

    // Cenário 7: Files com DELETE action (devem ser ignorados na detecção)
    console.log('\n📋 Cenário 7: Files com DELETE action (ignorar na detecção)')
    const deleteActionContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'UPDATE' },
          { path: 'src/hooks/useOld.ts', action: 'DELETE' }, // Deve ser ignorado
          { path: 'src/hooks/useOld2.ts', action: 'DELETE' }, // Deve ser ignorado
        ]
      },
      testFilePath: 'C:\\Coding\\pipe\\src\\components\\__tests__\\button.spec.tsx',
      projectPath,
      config: {},
      services: {}
    }

    const result7 = await PathConventionValidator.execute(deleteActionContext)
    console.log('  Resultado:')
    console.log('    metrics:', result7.metrics)

    if (result7.metrics?.detectedType === 'component') {
      console.log('  ✅ PASSOU: Files com DELETE ignorados, detectou "component"')
    } else {
      console.log('  ⚠️  AVISO: Tipo detectado:', result7.metrics?.detectedType)
    }

    // Cenário 8: Verificar propriedades do validator
    console.log('\n📋 Cenário 8: Verificar propriedades do validator')
    console.log('  code:', PathConventionValidator.code)
    console.log('  gate:', PathConventionValidator.gate)
    console.log('  isHardBlock:', PathConventionValidator.isHardBlock)
    console.log('  order:', PathConventionValidator.order)

    if (
      PathConventionValidator.code === 'PATH_CONVENTION' &&
      PathConventionValidator.gate === 0 &&
      PathConventionValidator.isHardBlock === true &&
      PathConventionValidator.order === 6
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 6)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
