import { TestSyntaxValidValidator } from '../../../src/domain/validators/gate1/TestSyntaxValid.ts'
import { TestCoversHappyAndSadPathValidator } from '../../../src/domain/validators/gate1/TestCoversHappyAndSadPath.ts'
import { TestIntentAlignmentValidator } from '../../../src/domain/validators/gate1/TestIntentAlignment.ts'
import { TestClauseMappingValidValidator } from '../../../src/domain/validators/gate1/TestClauseMappingValid.ts'

console.log('=== TESTES 18-21: Gate 1 Validators (Batch 2) ===\n')

async function test() {
  try {
    // Mock compiler service
    const mockCompiler = {
      compile: async (path) => {
        if (path.includes('error')) {
          return { success: false, errors: ['Type error: Cannot find name Button', 'Syntax error: Unexpected token'] }
        }
        return { success: true, errors: [] }
      }
    }

    // Mock git service
    const mockGit = {
      readFile: async (path) => {
        if (path.includes('happy-only')) {
          return `
            describe('Button', () => {
              it('should render successfully', () => {
                expect(true).toBe(true)
              })
            })
          `
        } else if (path.includes('sad-only')) {
          return `
            describe('Button', () => {
              it('should throw error when invalid', () => {
                expect(() => fn()).toThrow()
              })
            })
          `
        } else if (path.includes('both-paths')) {
          return `
            describe('Auth', () => {
              it('should login when valid credentials', () => {})
              it('should fail when invalid password', () => {})
            })
          `
        } else if (path.includes('intent-test')) {
          return `
            describe('Button component', () => {
              it('renders button with correct text', () => {})
              it('handles click events properly', () => {})
            })
          `
        }
        return ''
      }
    }

    // Mock AST service
    const mockAST = {
      getTestBlocksWithComments: async (path) => {
        if (path.includes('valid-clauses')) {
          return [
            { name: 'test 1', startLine: 10, precedingComments: ['// @clause UI_001'] },
            { name: 'test 2', startLine: 20, precedingComments: ['// @clause BEH_001'] }
          ]
        } else if (path.includes('no-tags')) {
          return [
            { name: 'untagged test', startLine: 10, precedingComments: ['// regular comment'] }
          ]
        } else if (path.includes('invalid-clause')) {
          return [
            { name: 'test with bad id', startLine: 10, precedingComments: ['// @clause INVALID_999'] }
          ]
        }
        return []
      }
    }

    // Mock config
    const mockConfig = {
      get: (key) => key === 'ALLOW_UNTAGGED_TESTS' ? 'false' : null
    }

    // ===== TESTE 18: TestSyntaxValid =====
    console.log('📋 TESTE 18: TestSyntaxValidValidator\n')

    console.log('  Cenário 1: Arquivo compila (PASSED)')
    const result18_1 = await TestSyntaxValidValidator.execute({
      testFilePath: 'valid.spec.tsx',
      services: { compiler: mockCompiler }
    })
    console.log('    passed:', result18_1.passed, '| Expected: true')
    if (result18_1.passed) console.log('    ✅ Arquivo compila')

    console.log('  Cenário 2: Erro de compilação (FAILED)')
    const result18_2 = await TestSyntaxValidValidator.execute({
      testFilePath: 'error.spec.tsx',
      services: { compiler: mockCompiler }
    })
    console.log('    passed:', result18_2.passed, '| Expected: false')
    console.log('    errorCount:', result18_2.details?.errorCount || 0)
    if (!result18_2.passed) console.log('    ✅ Detectou erros de compilação')

    console.log('  Gate:', TestSyntaxValidValidator.gate, '| Order:', TestSyntaxValidValidator.order)
    console.log('  ✅ TESTE 18 CONCLUÍDO\n')

    // ===== TESTE 19: TestCoversHappyAndSadPath =====
    console.log('📋 TESTE 19: TestCoversHappyAndSadPathValidator\n')

    console.log('  Cenário 1: Só happy path (FAILED)')
    const result19_1 = await TestCoversHappyAndSadPathValidator.execute({
      testFilePath: 'happy-only.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result19_1.passed, '| Expected: false')
    console.log('    hasSadPath:', result19_1.details?.hasSadPath)
    if (!result19_1.passed) console.log('    ✅ Detectou falta de sad path')

    console.log('  Cenário 2: Só sad path (FAILED)')
    const result19_2 = await TestCoversHappyAndSadPathValidator.execute({
      testFilePath: 'sad-only.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result19_2.passed, '| Expected: false')
    console.log('    hasHappyPath:', result19_2.details?.hasHappyPath)
    if (!result19_2.passed) console.log('    ✅ Detectou falta de happy path')

    console.log('  Cenário 3: Ambos os paths (PASSED)')
    const result19_3 = await TestCoversHappyAndSadPathValidator.execute({
      testFilePath: 'both-paths.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result19_3.passed, '| Expected: true')
    if (result19_3.passed) console.log('    ✅ Ambos os paths detectados')

    console.log('  Gate:', TestCoversHappyAndSadPathValidator.gate, '| Order:', TestCoversHappyAndSadPathValidator.order)
    console.log('  ✅ TESTE 19 CONCLUÍDO\n')

    // ===== TESTE 20: TestIntentAlignment =====
    console.log('📋 TESTE 20: TestIntentAlignmentValidator\n')

    console.log('  Cenário 1: Bom alinhamento (PASSED)')
    const result20_1 = await TestIntentAlignmentValidator.execute({
      taskPrompt: 'Create a button component that handles click events and renders text',
      testFilePath: 'intent-test.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result20_1.passed, '| Expected: true')
    console.log('    alignmentRatio:', result20_1.metrics?.alignmentRatio || result20_1.details?.alignmentRatio)
    if (result20_1.status === 'PASSED') console.log('    ✅ Bom alinhamento detectado')

    console.log('  Cenário 2: Baixo alinhamento (WARNING)')
    const result20_2 = await TestIntentAlignmentValidator.execute({
      taskPrompt: 'Implement authentication with JWT tokens and refresh mechanism',
      testFilePath: 'intent-test.spec.tsx',
      services: { git: mockGit }
    })
    console.log('    passed:', result20_2.passed, '| Expected: true')
    console.log('    status:', result20_2.status, '| Expected: WARNING')
    if (result20_2.status === 'WARNING') console.log('    ✅ Baixo alinhamento detectado')

    console.log('  Gate:', TestIntentAlignmentValidator.gate, '| Order:', TestIntentAlignmentValidator.order)
    console.log('  isHardBlock:', TestIntentAlignmentValidator.isHardBlock, '| Expected: false')
    console.log('  ✅ TESTE 20 CONCLUÍDO\n')

    // ===== TESTE 21: TestClauseMappingValid =====
    console.log('📋 TESTE 21: TestClauseMappingValidValidator\n')

    console.log('  Cenário 1: Sem contrato (SKIPPED)')
    const result21_1 = await TestClauseMappingValidValidator.execute({
      contract: null,
      testFilePath: 'test.spec.tsx',
      services: { ast: mockAST },
      config: mockConfig
    })
    console.log('    passed:', result21_1.passed, '| Expected: true')
    console.log('    status:', result21_1.status, '| Expected: SKIPPED')
    if (result21_1.status === 'SKIPPED') console.log('    ✅ Pulado quando sem contrato')

    console.log('  Cenário 2: Cláusulas válidas (PASSED)')
    const result21_2 = await TestClauseMappingValidValidator.execute({
      contract: {
        clauses: [
          { id: 'UI_001', kind: 'ui' },
          { id: 'BEH_001', kind: 'behavior' }
        ]
      },
      testFilePath: 'valid-clauses.spec.tsx',
      services: { ast: mockAST },
      config: mockConfig
    })
    console.log('    passed:', result21_2.passed, '| Expected: true')
    console.log('    validatedTests:', result21_2.metrics?.validatedTests)
    if (result21_2.passed) console.log('    ✅ Cláusulas válidas')

    console.log('  Cenário 3: Teste sem tag (FAILED)')
    const result21_3 = await TestClauseMappingValidValidator.execute({
      contract: {
        clauses: [{ id: 'UI_001', kind: 'ui' }]
      },
      testFilePath: 'no-tags.spec.tsx',
      services: { ast: mockAST },
      config: mockConfig
    })
    console.log('    passed:', result21_3.passed, '| Expected: false')
    if (!result21_3.passed) console.log('    ✅ Detectou falta de @clause tag')

    console.log('  Gate:', TestClauseMappingValidValidator.gate, '| Order:', TestClauseMappingValidValidator.order)
    console.log('  ✅ TESTE 21 CONCLUÍDO\n')

    console.log('✅ BATCH 2 COMPLETO (Testes 18-21)')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
