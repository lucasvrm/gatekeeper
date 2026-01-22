import { NoDecorativeTestsValidator } from '../../../src/domain/validators/gate1/NoDecorativeTests.ts'
import { NoImplicitFilesValidator } from '../../../src/domain/validators/gate1/NoImplicitFiles.ts'
import { TestHasAssertionsValidator } from '../../../src/domain/validators/gate1/TestHasAssertions.ts'

console.log('=== TESTES 15-17: Gate 1 Validators (Batch 1) ===\n')

async function test() {
  try {
    // Mock git service
    const mockGitService = {
      readFile: async (path) => {
        if (path.includes('empty-test')) {
          return `
            describe('Empty tests', () => {
              it('test 1', () => {})
              it('test 2', async () => {})
            })
          `
        } else if (path.includes('no-assertions')) {
          return `
            describe('Tests without assertions', () => {
              it('renders component', () => {
                render(<Button />)
              })
            })
          `
        } else if (path.includes('valid-test')) {
          return `
            describe('Valid tests', () => {
              it('renders button', () => {
                render(<Button />)
                expect(screen.getByRole('button')).toBeInTheDocument()
              })
              it('handles click', () => {
                const handleClick = vi.fn()
                render(<Button onClick={handleClick} />)
                fireEvent.click(screen.getByRole('button'))
                expect(handleClick).toHaveBeenCalled()
              })
            })
          `
        } else if (path.includes('no-expect')) {
          return `
            describe('Tests without expect', () => {
              it('test without assertions', () => {
                const value = 1 + 1
                console.log(value)
              })
            })
          `
        }
        return ''
      }
    }

    // ===== TESTE 15: NoDecorativeTests =====
    console.log('📋 TESTE 15: NoDecorativeTestsValidator\n')

    // Cenário 1: Empty tests (FAILED)
    console.log('  Cenário 1: Testes vazios')
    const result15_1 = await NoDecorativeTestsValidator.execute({
      testFilePath: 'empty-test.spec.tsx',
      services: { git: mockGitService },
      config: {}
    })
    console.log('    passed:', result15_1.passed, '| Expected: false')
    console.log('    issues:', result15_1.details?.issues?.length || 0)

    if (!result15_1.passed && result15_1.details?.issues.some(i => i.includes('empty test'))) {
      console.log('    ✅ Detectou testes vazios')
    }

    // Cenário 2: No assertions (FAILED)
    console.log('  Cenário 2: Testes sem asserções')
    const result15_2 = await NoDecorativeTestsValidator.execute({
      testFilePath: 'no-assertions.spec.tsx',
      services: { git: mockGitService },
      config: {}
    })
    console.log('    passed:', result15_2.passed, '| Expected: false')

    if (!result15_2.passed) {
      console.log('    ✅ Detectou render sem asserções')
    }

    // Cenário 3: Valid tests (PASSED)
    console.log('  Cenário 3: Testes válidos')
    const result15_3 = await NoDecorativeTestsValidator.execute({
      testFilePath: 'valid-test.spec.tsx',
      services: { git: mockGitService },
      config: {}
    })
    console.log('    passed:', result15_3.passed, '| Expected: true')
    console.log('    totalTestBlocks:', result15_3.metrics?.totalTestBlocks || 0)

    if (result15_3.passed) {
      console.log('    ✅ Testes válidos aceitos')
    }

    console.log('  Gate:', NoDecorativeTestsValidator.gate, '| Order:', NoDecorativeTestsValidator.order)
    console.log('  ✅ TESTE 15 CONCLUÍDO\n')

    // ===== TESTE 16: NoImplicitFiles =====
    console.log('📋 TESTE 16: NoImplicitFilesValidator\n')

    // Cenário 1: Com termos implícitos (FAILED)
    console.log('  Cenário 1: Prompt com termos implícitos')
    const result16_1 = await NoImplicitFilesValidator.execute({
      taskPrompt: 'Update Button.tsx and other files related to the component',
      config: {}
    })
    console.log('    passed:', result16_1.passed, '| Expected: false')
    console.log('    foundTerms:', result16_1.details?.foundTerms.length || 0)

    if (!result16_1.passed && result16_1.details?.foundTerms.includes('other files')) {
      console.log('    ✅ Detectou "other files"')
    }

    // Cenário 2: Prompt explícito (PASSED)
    console.log('  Cenário 2: Prompt explícito')
    const result16_2 = await NoImplicitFilesValidator.execute({
      taskPrompt: 'Update Button.tsx and Input.tsx to use the new theme',
      config: {}
    })
    console.log('    passed:', result16_2.passed, '| Expected: true')

    if (result16_2.passed) {
      console.log('    ✅ Prompt explícito aceito')
    }

    // Cenário 3: Múltiplos termos (FAILED)
    console.log('  Cenário 3: Múltiplos termos implícitos')
    const result16_3 = await NoImplicitFilesValidator.execute({
      taskPrompt: 'Update arquivos relacionados, etc, e outros',
      config: {}
    })
    console.log('    passed:', result16_3.passed, '| Expected: false')
    console.log('    foundTerms:', result16_3.details?.foundTerms.length || 0)

    if (!result16_3.passed && result16_3.details?.foundTerms.length >= 3) {
      console.log('    ✅ Detectou múltiplos termos')
    }

    console.log('  Gate:', NoImplicitFilesValidator.gate, '| Order:', NoImplicitFilesValidator.order)
    console.log('  ✅ TESTE 16 CONCLUÍDO\n')

    // ===== TESTE 17: TestHasAssertions =====
    console.log('📋 TESTE 17: TestHasAssertionsValidator\n')

    // Cenário 1: Sem assertions (FAILED)
    console.log('  Cenário 1: Teste sem assertions')
    const result17_1 = await TestHasAssertionsValidator.execute({
      testFilePath: 'no-expect.spec.tsx',
      services: { git: mockGitService },
      config: {}
    })
    console.log('    passed:', result17_1.passed, '| Expected: false')

    if (!result17_1.passed) {
      console.log('    ✅ Detectou ausência de assertions')
    }

    // Cenário 2: Com assertions (PASSED)
    console.log('  Cenário 2: Teste com assertions')
    const result17_2 = await TestHasAssertionsValidator.execute({
      testFilePath: 'valid-test.spec.tsx',
      services: { git: mockGitService },
      config: {}
    })
    console.log('    passed:', result17_2.passed, '| Expected: true')
    console.log('    assertionCount:', result17_2.metrics?.assertionCount || 0)

    if (result17_2.passed && result17_2.metrics?.assertionCount >= 2) {
      console.log('    ✅ Assertions detectadas corretamente')
    }

    console.log('  Gate:', TestHasAssertionsValidator.gate, '| Order:', TestHasAssertionsValidator.order)
    console.log('  ✅ TESTE 17 CONCLUÍDO\n')

    console.log('✅ BATCH 1 COMPLETO (Testes 15-17)')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
