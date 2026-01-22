import { SensitiveFilesLockValidator } from '../../../src/domain/validators/gate0/SensitiveFilesLock.ts'

console.log('=== TESTE 11: SensitiveFilesLockValidator ===\n')

async function test() {
  try {
    // Padrões de arquivos sensíveis comuns
    const sensitivePatterns = [
      '**/.env*',
      '**/package.json',
      '**/tsconfig.json',
      '**/*.config.js',
      '**/prisma/schema.prisma',
      '**/database/**',
    ]

    // Cenário 1: SEM manifest (skipped)
    console.log('📋 Cenário 1: SEM manifest (deveria pular)')
    const noManifestContext = {
      manifest: null,
      sensitivePatterns,
      dangerMode: false,
      config: {},
      services: {}
    }

    const result1 = await SensitiveFilesLockValidator.execute(noManifestContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (result1.passed && result1.status === 'SKIPPED') {
      console.log('  ✅ PASSOU: Corretamente pulado quando não há manifest')
    } else {
      console.log('  ❌ FALHOU: Deveria ter retornado SKIPPED')
    }

    // Cenário 2: SEM arquivos sensíveis (passa)
    console.log('\n📋 Cenário 2: SEM arquivos sensíveis')
    const safeContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
          { path: 'src/utils/helpers.ts', content: '' },
          { path: 'src/types/index.ts', content: '' },
        ]
      },
      sensitivePatterns,
      dangerMode: false,
      config: {},
      services: {}
    }

    const result2 = await SensitiveFilesLockValidator.execute(safeContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)

    if (result2.passed && result2.status === 'PASSED') {
      console.log('  ✅ PASSOU: Arquivos não-sensíveis aceitos')
    } else {
      console.log('  ❌ FALHOU: Deveria passar sem arquivos sensíveis')
    }

    // Cenário 3: COM arquivos sensíveis (falha)
    console.log('\n📋 Cenário 3: COM arquivos sensíveis (deveria falhar)')
    const sensitiveContext = {
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', content: '' },
          { path: '.env', content: '' },
          { path: 'package.json', content: '' },
          { path: 'prisma/schema.prisma', content: '' },
        ]
      },
      sensitivePatterns,
      dangerMode: false,
      config: {},
      services: {}
    }

    const result3 = await SensitiveFilesLockValidator.execute(sensitiveContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    status:', result3.status)
    console.log('    message:', result3.message)
    console.log('    details:', result3.details)

    if (!result3.passed && result3.status === 'FAILED') {
      console.log('  ✅ PASSOU: Arquivos sensíveis corretamente bloqueados')

      const expectedBlocked = ['.env', 'package.json', 'prisma/schema.prisma']
      const allBlocked = expectedBlocked.every(f => result3.details.blockedFiles.includes(f))

      if (allBlocked) {
        console.log('  ✅ PASSOU: Todos os arquivos sensíveis detectados:', result3.details.blockedFiles)
      } else {
        console.log('  ⚠️  AVISO: Nem todos os arquivos sensíveis foram bloqueados')
        console.log('    Esperados:', expectedBlocked)
        console.log('    Bloqueados:', result3.details.blockedFiles)
      }
    } else {
      console.log('  ❌ FALHOU: Deveria falhar com arquivos sensíveis')
    }

    // Cenário 4: Danger mode BYPASSA proteção
    console.log('\n📋 Cenário 4: Danger mode BYPASSA proteção')
    const dangerModeContext = {
      manifest: {
        files: [
          { path: '.env', content: '' },
          { path: 'package.json', content: '' },
        ]
      },
      sensitivePatterns,
      dangerMode: true, // ✅ DANGER MODE ATIVADO
      config: {},
      services: {}
    }

    const result4 = await SensitiveFilesLockValidator.execute(dangerModeContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    status:', result4.status)
    console.log('    message:', result4.message)

    if (result4.passed && result4.status === 'PASSED') {
      console.log('  ✅ PASSOU: Danger mode corretamente bypassa proteção')
    } else {
      console.log('  ❌ FALHOU: Danger mode deveria permitir arquivos sensíveis')
    }

    // Cenário 5: Glob patterns (wildcards)
    console.log('\n📋 Cenário 5: Glob patterns funcionando')
    const globContext = {
      manifest: {
        files: [
          { path: 'src/config/database.config.js', content: '' },
          { path: '.env.local', content: '' },
          { path: 'database/migrations/001.sql', content: '' },
        ]
      },
      sensitivePatterns,
      dangerMode: false,
      config: {},
      services: {}
    }

    const result5 = await SensitiveFilesLockValidator.execute(globContext)
    console.log('  Resultado:')
    console.log('    passed:', result5.passed)
    console.log('    blockedFiles:', result5.details?.blockedFiles || [])

    if (!result5.passed) {
      const blockedCount = result5.details.blockedFiles.length
      if (blockedCount === 3) {
        console.log('  ✅ PASSOU: Todos os padrões glob detectaram arquivos corretamente')
      } else {
        console.log('  ⚠️  AVISO: Esperava 3 arquivos bloqueados, encontrou:', blockedCount)
      }
    } else {
      console.log('  ❌ FALHOU: Deveria ter bloqueado arquivos que correspondem aos patterns')
    }

    // Cenário 6: Verificar propriedades do validator
    console.log('\n📋 Cenário 6: Verificar propriedades do validator')
    console.log('  code:', SensitiveFilesLockValidator.code)
    console.log('  gate:', SensitiveFilesLockValidator.gate)
    console.log('  isHardBlock:', SensitiveFilesLockValidator.isHardBlock)
    console.log('  order:', SensitiveFilesLockValidator.order)

    if (
      SensitiveFilesLockValidator.code === 'SENSITIVE_FILES_LOCK' &&
      SensitiveFilesLockValidator.gate === 0 &&
      SensitiveFilesLockValidator.isHardBlock === true &&
      SensitiveFilesLockValidator.order === 4
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 4)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
