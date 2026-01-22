import { ImportRealityCheckValidator } from '../../../src/domain/validators/gate1/ImportRealityCheck.ts'
import { TestFailsBeforeImplementationValidator } from '../../../src/domain/validators/gate1/TestFailsBeforeImplementation.ts'

console.log('=== TESTES 22-23: Gate 1 Validators (Batch 3 - Final) ===\n')

async function test() {
  try {
    const projectPath = 'C:\\Coding\\pipe'

    // Mock AST service
    const mockAST = {
      getImports: async (path) => {
        if (path.includes('valid-imports')) {
          return ['react', './Button', '@/components/Input']
        } else if (path.includes('invalid-imports')) {
          return ['./NonExistent', 'unknown-package']
        }
        return []
      }
    }

    // Mock Git service
    const mockGit = {
      getCurrentRef: async () => 'feature-branch',
      checkout: async (ref) => {
        console.log(`  [Mock] Checking out ${ref}`)
      },
      stash: async () => {
        console.log('  [Mock] Stashing changes')
      },
      stashPop: async () => {
        console.log('  [Mock] Popping stash')
      }
    }

    // Mock TestRunner service
    const mockTestRunner = {
      runSingleTest: async (path) => {
        if (path.includes('fails-on-base')) {
          return { passed: false, exitCode: 1, output: 'Test failed as expected', duration: 100 }
        } else if (path.includes('passes-on-base')) {
          return { passed: true, exitCode: 0, output: 'Test passed (violation!)', duration: 100 }
        }
        return { passed: false, exitCode: 1, output: '', duration: 100 }
      }
    }

    // Mock log service
    const mockLog = {
      warn: (msg, data) => console.log(`  [Mock Log] ${msg}`, data)
    }

    // ===== TESTE 22: ImportRealityCheck =====
    console.log('📋 TESTE 22: ImportRealityCheckValidator\n')

    console.log('  Cenário 1: Imports válidos (PASSED)')
    const result22_1 = await ImportRealityCheckValidator.execute({
      testFilePath: 'valid-imports.spec.tsx',
      projectPath,
      manifest: {
        files: [
          { path: 'src/components/Button.tsx', action: 'CREATE' },
          { path: 'src/components/Input.tsx', action: 'CREATE' }
        ]
      },
      services: { ast: mockAST, log: mockLog }
    })
    console.log('    passed:', result22_1.passed, '| Expected: true')
    console.log('    totalImports:', result22_1.metrics?.totalImports || 0)
    if (result22_1.passed) console.log('    ✅ Imports válidos')

    console.log('  Cenário 2: Imports inválidos (FAILED)')
    const result22_2 = await ImportRealityCheckValidator.execute({
      testFilePath: 'invalid-imports.spec.tsx',
      projectPath,
      manifest: { files: [] },
      services: { ast: mockAST, log: mockLog }
    })
    console.log('    passed:', result22_2.passed, '| Expected: false')
    console.log('    invalidImports:', result22_2.details?.invalidImports?.length || 0)
    if (!result22_2.passed) console.log('    ✅ Detectou imports inválidos')

    console.log('  Gate:', ImportRealityCheckValidator.gate, '| Order:', ImportRealityCheckValidator.order)
    console.log('  ✅ TESTE 22 CONCLUÍDO\n')

    // ===== TESTE 23: TestFailsBeforeImplementation =====
    console.log('📋 TESTE 23: TestFailsBeforeImplementationValidator\n')

    console.log('  Cenário 1: Teste FALHA no base_ref (PASSED - TDD correto)')
    const result23_1 = await TestFailsBeforeImplementationValidator.execute({
      testFilePath: 'fails-on-base.spec.tsx',
      baseRef: 'main',
      services: {
        git: mockGit,
        testRunner: mockTestRunner
      }
    })
    console.log('    passed:', result23_1.passed, '| Expected: true')
    console.log('    status:', result23_1.status)
    if (result23_1.passed) console.log('    ✅ TDD red phase confirmado')

    console.log('  Cenário 2: Teste PASSA no base_ref (FAILED - Violação TDD)')
    const result23_2 = await TestFailsBeforeImplementationValidator.execute({
      testFilePath: 'passes-on-base.spec.tsx',
      baseRef: 'main',
      services: {
        git: mockGit,
        testRunner: mockTestRunner
      }
    })
    console.log('    passed:', result23_2.passed, '| Expected: false')
    console.log('    status:', result23_2.status)
    if (!result23_2.passed && result23_2.message.includes('CLÁUSULA PÉTREA')) {
      console.log('    ✅ Detectou violação de CLÁUSULA PÉTREA')
    }

    console.log('  Gate:', TestFailsBeforeImplementationValidator.gate, '| Order:', TestFailsBeforeImplementationValidator.order)
    console.log('  ✅ TESTE 23 CONCLUÍDO\n')

    console.log('✅ BATCH 3 COMPLETO (Testes 22-23)')
    console.log('✅ FASE 3 COMPLETA - GATE 1 (10/10 validators testados)')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
