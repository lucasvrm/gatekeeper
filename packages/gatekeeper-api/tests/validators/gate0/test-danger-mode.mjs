import { DangerModeExplicitValidator } from '../../../src/domain/validators/gate0/DangerModeExplicit.ts'

console.log('=== TESTE 12: DangerModeExplicitValidator ===\n')

async function test() {
  try {
    const sensitivePatterns = [
      '**/.env*',
      '**/package.json',
      '**/tsconfig.json',
      '**/*.config.js',
    ]

    // Cenário 1: Danger mode DESATIVADO (skipped)
    console.log('📋 Cenário 1: Danger mode DESATIVADO (deveria pular)')
    const noDangerContext = {
      dangerMode: false,
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
        ]
      },
      sensitivePatterns,
      config: {},
      services: {}
    }

    const result1 = await DangerModeExplicitValidator.execute(noDangerContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (result1.passed && result1.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente pulado quando danger mode desativado')
    } else {
      console.log('  ❌ FALHOU: Deveria ter retornado SKIPPED')
    }

    // Cenário 2: Danger mode ativado SEM manifest (FAILED)
    console.log('\n📋 Cenário 2: Danger mode ativado SEM manifest (erro de configuração)')
    const noManifestContext = {
      dangerMode: true,
      manifest: null,
      sensitivePatterns,
      config: {},
      services: {}
    }

    const result2 = await DangerModeExplicitValidator.execute(noManifestContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)

    if (!result2.passed && result2.status === 'FAILED') {
      console.log('  ✅ PASSOU: Corretamente falhou (danger mode sem manifest é erro)')
    } else {
      console.log('  ❌ FALHOU: Deveria ter falhado quando não há manifest')
    }

    // Cenário 3: Danger mode ativado SEM arquivos sensíveis (SKIPPED - desnecessário)
    console.log('\n📋 Cenário 3: Danger mode ativado SEM arquivos sensíveis (desnecessário)')
    const unnecessaryDangerContext = {
      dangerMode: true,
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
          { path: 'src/utils/helpers.ts', content: '' },
        ]
      },
      sensitivePatterns,
      config: {},
      services: {}
    }

    const result3 = await DangerModeExplicitValidator.execute(unnecessaryDangerContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    status:', result3.status)
    console.log('    message:', result3.message)

    if (result3.passed && result3.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente marcado como desnecessário')
      console.log('  ℹ️  INFO: Danger mode ativado mas não há arquivos sensíveis')
    } else {
      console.log('  ❌ FALHOU: Deveria retornar SKIPPED quando danger mode desnecessário')
    }

    // Cenário 4: Danger mode ativado COM arquivos sensíveis (PASSED - uso correto)
    console.log('\n📋 Cenário 4: Danger mode ativado COM arquivos sensíveis (uso correto)')
    const correctDangerContext = {
      dangerMode: true,
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
          { path: '.env', content: '' },
          { path: 'package.json', content: '' },
        ]
      },
      sensitivePatterns,
      config: {},
      services: {}
    }

    const result4 = await DangerModeExplicitValidator.execute(correctDangerContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    status:', result4.status)
    console.log('    message:', result4.message)

    if (result4.passed && result4.status === 'PASSED') {
      console.log('  ✅ PASSOU: Danger mode corretamente usado para arquivos sensíveis')
    } else {
      console.log('  ❌ FALHOU: Deveria passar quando danger mode é necessário')
    }

    // Cenário 5: Verificar lógica de detecção de arquivo sensível
    console.log('\n📋 Cenário 5: Detecção de arquivo sensível com glob patterns')
    const globContext = {
      dangerMode: true,
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
          { path: 'src/config/database.config.js', content: '' }, // Match: **/*.config.js
        ]
      },
      sensitivePatterns,
      config: {},
      services: {}
    }

    const result5 = await DangerModeExplicitValidator.execute(globContext)
    console.log('  Resultado:')
    console.log('    passed:', result5.passed)
    console.log('    status:', result5.status)

    if (result5.passed && result5.status === 'PASSED') {
      console.log('  ✅ PASSOU: Glob pattern detectou arquivo sensível corretamente')
    } else {
      console.log('  ❌ FALHOU: Deveria ter detectado database.config.js como sensível')
    }

    // Cenário 6: Verificar propriedades do validator
    console.log('\n📋 Cenário 6: Verificar propriedades do validator')
    console.log('  code:', DangerModeExplicitValidator.code)
    console.log('  gate:', DangerModeExplicitValidator.gate)
    console.log('  isHardBlock:', DangerModeExplicitValidator.isHardBlock)
    console.log('  order:', DangerModeExplicitValidator.order)

    if (
      DangerModeExplicitValidator.code === 'DANGER_MODE_EXPLICIT' &&
      DangerModeExplicitValidator.gate === 0 &&
      DangerModeExplicitValidator.isHardBlock === true &&
      DangerModeExplicitValidator.order === 5
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 5)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
