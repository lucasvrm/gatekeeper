import { ManifestFileLockValidator } from '../../../src/domain/validators/gate1/ManifestFileLock.ts'

console.log('=== TESTE 14: ManifestFileLockValidator ===\n')

async function test() {
  try {
    // Cenário 1: SEM manifest (FAILED)
    console.log('📋 Cenário 1: SEM manifest (deveria falhar)')
    const noManifestContext = {
      manifest: null,
      config: {},
      services: {}
    }

    const result1 = await ManifestFileLockValidator.execute(noManifestContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (!result1.passed && result1.status === 'FAILED') {
      console.log('  ✅ PASSOU: Corretamente falhou quando não há manifest')
    } else {
      console.log('  ❌ FALHOU: Deveria ter falhado sem manifest')
    }

    // Cenário 2: Manifest VÁLIDO (PASSED)
    console.log('\n📋 Cenário 2: Manifest VÁLIDO')
    const validContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'CREATE', reason: 'Create button component' },
          { path: 'src/components/Input.tsx', action: 'MODIFY', reason: 'Update input styles' },
          { path: 'src/utils/old.ts', action: 'DELETE', reason: 'Remove deprecated utility' },
        ],
        testFile: 'src/components/__tests__/button.spec.tsx'
      },
      config: {},
      services: {}
    }

    const result2 = await ManifestFileLockValidator.execute(validContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)
    console.log('    metrics:', result2.metrics)

    if (result2.passed && result2.status === 'PASSED') {
      console.log('  ✅ PASSOU: Manifest válido aceito')
      if (result2.metrics.createCount === 1 && result2.metrics.modifyCount === 1 && result2.metrics.deleteCount === 1) {
        console.log('  ✅ PASSOU: Métricas corretas (1 CREATE, 1 MODIFY, 1 DELETE)')
      }
    } else {
      console.log('  ❌ FALHOU: Deveria passar com manifest válido')
    }

    // Cenário 3: Files vazio (FAILED)
    console.log('\n📋 Cenário 3: Manifest.files vazio')
    const emptyFilesContext = {
      manifest: {
        files: [],
        testFile: 'test.spec.tsx'
      },
      config: {},
      services: {}
    }

    const result3 = await ManifestFileLockValidator.execute(emptyFilesContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    details:', result3.details)

    if (!result3.passed && result3.details?.issues.includes('Manifest.files cannot be empty')) {
      console.log('  ✅ PASSOU: Detectou files vazio')
    } else {
      console.log('  ❌ FALHOU: Deveria detectar files vazio')
    }

    // Cenário 4: Path com glob patterns (FAILED)
    console.log('\n📋 Cenário 4: Path com glob patterns (* ou ?)')
    const globContext = {
      manifest: {
        files: [
          { path: 'src/components/*.tsx', action: 'MODIFY' },
        ],
        testFile: 'test.spec.tsx'
      },
      config: {},
      services: {}
    }

    const result4 = await ManifestFileLockValidator.execute(globContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    details:', result4.details)

    if (!result4.passed) {
      const hasGlobIssue = result4.details?.issues.some(i => i.includes('glob patterns'))
      if (hasGlobIssue) {
        console.log('  ✅ PASSOU: Detectou glob pattern em path')
      } else {
        console.log('  ⚠️  AVISO: Não detectou glob pattern')
      }
    }

    // Cenário 5: Path com referências vagas (etc, other, ...)
    console.log('\n📋 Cenário 5: Path com referências vagas')
    const vagueContext = {
      manifest: {
        files: [
          { path: 'src/components/button.tsx', action: 'MODIFY' },
          { path: 'src/etc/config.ts', action: 'MODIFY' },
          { path: 'src/other/file.ts', action: 'MODIFY' },
        ],
        testFile: 'test.spec.tsx'
      },
      config: {},
      services: {}
    }

    const result5 = await ManifestFileLockValidator.execute(vagueContext)
    console.log('  Resultado:')
    console.log('    passed:', result5.passed)
    console.log('    details:', result5.details)

    if (!result5.passed) {
      const vagueIssues = result5.details?.issues.filter(i => i.includes('vague references'))
      console.log('  ✅ PASSOU: Detectou', vagueIssues.length, 'referências vagas')
    }

    // Cenário 6: Action inválida
    console.log('\n📋 Cenário 6: Action inválida')
    const invalidActionContext = {
      manifest: {
        files: [
          { path: 'src/test.tsx', action: 'UPDATE' }, // ❌ UPDATE não é válido
        ],
        testFile: 'test.spec.tsx'
      },
      config: {},
      services: {}
    }

    const result6 = await ManifestFileLockValidator.execute(invalidActionContext)
    console.log('  Resultado:')
    console.log('    passed:', result6.passed)
    console.log('    details:', result6.details)

    if (!result6.passed) {
      const hasActionIssue = result6.details?.issues.some(i => i.includes('invalid action'))
      if (hasActionIssue) {
        console.log('  ✅ PASSOU: Detectou action inválida')
      }
    }

    // Cenário 7: testFile sem extensão .spec ou .test
    console.log('\n📋 Cenário 7: testFile sem extensão .spec ou .test')
    const invalidTestFileContext = {
      manifest: {
        files: [
          { path: 'src/test.tsx', action: 'CREATE' },
        ],
        testFile: 'src/mytest.tsx' // ❌ Não tem .spec ou .test
      },
      config: {},
      services: {}
    }

    const result7 = await ManifestFileLockValidator.execute(invalidTestFileContext)
    console.log('  Resultado:')
    console.log('    passed:', result7.passed)
    console.log('    details:', result7.details)

    if (!result7.passed) {
      const hasExtIssue = result7.details?.issues.some(i => i.includes('.test or .spec extension'))
      if (hasExtIssue) {
        console.log('  ✅ PASSOU: Detectou testFile sem extensão correta')
      }
    }

    // Cenário 8: Verificar propriedades do validator
    console.log('\n📋 Cenário 8: Verificar propriedades do validator')
    console.log('  code:', ManifestFileLockValidator.code)
    console.log('  gate:', ManifestFileLockValidator.gate)
    console.log('  isHardBlock:', ManifestFileLockValidator.isHardBlock)
    console.log('  order:', ManifestFileLockValidator.order)

    if (
      ManifestFileLockValidator.code === 'MANIFEST_FILE_LOCK' &&
      ManifestFileLockValidator.gate === 1 &&
      ManifestFileLockValidator.isHardBlock === true &&
      ManifestFileLockValidator.order === 6
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 1, Hard Block, Order 6)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
