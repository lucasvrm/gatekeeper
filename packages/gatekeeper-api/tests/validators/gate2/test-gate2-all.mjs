import { DiffScopeEnforcementValidator } from '../../../src/domain/validators/gate2/DiffScopeEnforcement.ts'
import { StyleConsistencyLintValidator } from '../../../src/domain/validators/gate2/StyleConsistencyLint.ts'
import { TaskTestPassesValidator } from '../../../src/domain/validators/gate2/TaskTestPasses.ts'
import { StrictCompilationValidator } from '../../../src/domain/validators/gate2/StrictCompilation.ts'
import { TestReadOnlyEnforcementValidator } from '../../../src/domain/validators/gate2/TestReadOnlyEnforcement.ts'

console.log('=== TESTES 24-28: Gate 2 Validators (Todos) ===\n')

async function test() {
  try {
    const projectPath = 'C:\\Coding\\pipe'

    // Mock services
    const mockGit = {
      getDiffFiles: async (base, target) => {
        if (target.includes('extra-files')) {
          return ['src/Button.tsx', 'src/Input.tsx', 'src/Extra.tsx']
        } else if (target.includes('modified-tests')) {
          return ['src/Button.tsx', 'src/__tests__/old-test.spec.tsx']
        }
        return ['src/Button.tsx', 'src/Input.tsx']
      }
    }

    const mockLint = {
      lint: async (files) => {
        if (files.some(f => f.includes('error'))) {
          return { success: false, errorCount: 2, warningCount: 1, output: 'ESLint errors found' }
        }
        return { success: true, errorCount: 0, warningCount: 0, output: '' }
      }
    }

    const mockCompiler = {
      compile: async (file) => {
        if (file?.includes('error')) {
          return { success: false, errors: ['Type error 1', 'Type error 2'] }
        }
        return { success: true, errors: [] }
      }
    }

    const mockTestRunner = {
      runSingleTest: async (path) => {
        if (path.includes('failing')) {
          return { passed: false, exitCode: 1, output: 'Test failed', duration: 100, error: 'Assertion failed' }
        }
        return { passed: true, exitCode: 0, output: 'All tests passed', duration: 200 }
      }
    }

    // ===== TESTE 24: DiffScopeEnforcement =====
    console.log('📋 TESTE 24: DiffScopeEnforcementValidator\n')

    console.log('  Cenário 1: Diff contido no manifest (PASSED)')
    const result24_1 = await DiffScopeEnforcementValidator.execute({
      baseRef: 'main',
      targetRef: 'feature',
      manifest: {
        files: [
          { path: 'src/Button.tsx', action: 'MODIFY' },
          { path: 'src/Input.tsx', action: 'CREATE' }
        ]
      },
      services: { git: mockGit }
    })
    console.log('    passed:', result24_1.passed, '| Expected: true')
    if (result24_1.passed) console.log('    ✅ Diff contido no manifest')

    console.log('  Cenário 2: Diff com arquivos extras (FAILED)')
    const result24_2 = await DiffScopeEnforcementValidator.execute({
      baseRef: 'main',
      targetRef: 'feature-extra-files',
      manifest: {
        files: [
          { path: 'src/Button.tsx', action: 'MODIFY' }
        ]
      },
      services: { git: mockGit }
    })
    console.log('    passed:', result24_2.passed, '| Expected: false')
    console.log('    violations:', result24_2.details?.violations.length || 0)
    if (!result24_2.passed) console.log('    ✅ Detectou arquivos não declarados')

    console.log('  Gate:', DiffScopeEnforcementValidator.gate, '| Order:', DiffScopeEnforcementValidator.order)
    console.log('  ✅ TESTE 24 CONCLUÍDO\n')

    // ===== TESTE 25: TestReadOnlyEnforcement =====
    console.log('📋 TESTE 25: TestReadOnlyEnforcementValidator\n')

    console.log('  Cenário 1: Nenhum teste modificado (PASSED)')
    const result25_1 = await TestReadOnlyEnforcementValidator.execute({
      baseRef: 'main',
      targetRef: 'feature',
      projectPath,
      testFilePath: 'src/__tests__/button.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result25_1.passed, '| Expected: true')
    if (result25_1.passed) console.log('    ✅ Nenhum teste modificado')

    console.log('  Cenário 2: Teste existente modificado (FAILED)')
    const result25_2 = await TestReadOnlyEnforcementValidator.execute({
      baseRef: 'main',
      targetRef: 'feature-modified-tests',
      projectPath,
      testFilePath: 'src/__tests__/button.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result25_2.passed, '| Expected: false')
    console.log('    modifiedTests:', result25_2.details?.modifiedTests.length || 0)
    if (!result25_2.passed) console.log('    ✅ Detectou modificação de teste existente')

    console.log('  Gate:', TestReadOnlyEnforcementValidator.gate, '| Order:', TestReadOnlyEnforcementValidator.order)
    console.log('  ✅ TESTE 25 CONCLUÍDO\n')

    // ===== TESTE 26: TaskTestPasses =====
    console.log('📋 TESTE 26: TaskTestPassesValidator\n')

    console.log('  Cenário 1: Teste passa (PASSED)')
    const result26_1 = await TaskTestPassesValidator.execute({
      testFilePath: 'passing-test.spec.tsx',
      services: { testRunner: mockTestRunner }
    })
    console.log('    passed:', result26_1.passed, '| Expected: true')
    console.log('    duration:', result26_1.metrics?.duration, 'ms')
    if (result26_1.passed) console.log('    ✅ Teste passou')

    console.log('  Cenário 2: Teste falha (FAILED)')
    const result26_2 = await TaskTestPassesValidator.execute({
      testFilePath: 'failing-test.spec.tsx',
      services: { testRunner: mockTestRunner }
    })
    console.log('    passed:', result26_2.passed, '| Expected: false')
    if (!result26_2.passed) console.log('    ✅ Detectou falha no teste')

    console.log('  Gate:', TaskTestPassesValidator.gate, '| Order:', TaskTestPassesValidator.order)
    console.log('  ✅ TESTE 26 CONCLUÍDO\n')

    // ===== TESTE 27: StrictCompilation =====
    console.log('📋 TESTE 27: StrictCompilationValidator\n')

    console.log('  Cenário 1: Compila sem erros (PASSED)')
    const result27_1 = await StrictCompilationValidator.execute({
      services: { compiler: mockCompiler }
    })
    console.log('    passed:', result27_1.passed, '| Expected: true')
    if (result27_1.passed) console.log('    ✅ Compilação bem-sucedida')

    console.log('  Cenário 2: Erro de compilação (FAILED)')
    const result27_2 = await StrictCompilationValidator.execute({
      services: { compiler: { compile: async () => ({ success: false, errors: ['Error 1', 'Error 2'] }) } }
    })
    console.log('    passed:', result27_2.passed, '| Expected: false')
    console.log('    errorCount:', result27_2.details?.errorCount || 0)
    if (!result27_2.passed) console.log('    ✅ Detectou erros de compilação')

    console.log('  Gate:', StrictCompilationValidator.gate, '| Order:', StrictCompilationValidator.order)
    console.log('  ✅ TESTE 27 CONCLUÍDO\n')

    // ===== TESTE 28: StyleConsistencyLint =====
    console.log('📋 TESTE 28: StyleConsistencyLintValidator\n')

    console.log('  Cenário 1: Sem ESLint config (SKIPPED)')
    const result28_1 = await StyleConsistencyLintValidator.execute({
      projectPath: '/tmp/no-eslint',
      manifest: { files: [{ path: 'test.ts', action: 'CREATE' }] },
      services: { lint: mockLint }
    })
    console.log('    passed:', result28_1.passed, '| Expected: true')
    console.log('    status:', result28_1.status, '| Expected: SKIPPED')
    if (result28_1.status === 'SKIPPED') console.log('    ✅ Pulado quando sem config')

    console.log('  Cenário 2: Sem manifest (SKIPPED)')
    const result28_2 = await StyleConsistencyLintValidator.execute({
      projectPath,
      manifest: null,
      services: { lint: mockLint }
    })
    console.log('    passed:', result28_2.passed, '| Expected: true')
    console.log('    status:', result28_2.status, '| Expected: SKIPPED')
    if (result28_2.status === 'SKIPPED') console.log('    ✅ Pulado quando sem manifest')

    console.log('  Gate:', StyleConsistencyLintValidator.gate, '| Order:', StyleConsistencyLintValidator.order)
    console.log('  ✅ TESTE 28 CONCLUÍDO\n')

    console.log('✅ FASE 4 COMPLETA - GATE 2 (5/5 validators testados)')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
