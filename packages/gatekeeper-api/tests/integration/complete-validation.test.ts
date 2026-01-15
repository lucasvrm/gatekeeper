import { describe, it, expect, beforeEach } from 'vitest'
import type { ValidationContext, ManifestInput } from '../../../src/types/index'

describe('Gate 1 - CONTRACT Integration', () => {
  let baseContext: Partial<ValidationContext>

  beforeEach(() => {
    baseContext = {
      projectPath: '/test/project',
      taskPrompt: 'Implement user authentication with email validation',
      testFilePath: 'tests/auth.test.ts',
      manifest: {
        files: [
          { path: 'src/auth.ts', action: 'CREATE', reason: 'New auth module' },
        ],
        testFile: 'tests/auth.test.ts',
      } as ManifestInput,
      services: {
        git: {
          readFile: async () => '',
        } as any,
        ast: {
          parseFile: () => ({} as any),
          getImports: () => [],
        } as any,
      } as any,
    }
  })

  describe('All Gate 1 Validators', () => {
    it('should have all 9 validators', async () => {
      const { GATES_CONFIG } = await import('../../../src/config/gates.config')
      const gate1 = GATES_CONFIG.find(g => g.number === 1)
      
      expect(gate1?.validators).toHaveLength(9)
    })

    it('TestSyntaxValid - should validate test syntax', async () => {
      const { TestSyntaxValidValidator } = await import('../../../src/domain/validators/gate1/TestSyntaxValid')
      
      expect(TestSyntaxValidValidator.code).toBe('TEST_SYNTAX_VALID')
      expect(TestSyntaxValidValidator.order).toBe(1)
      expect(TestSyntaxValidValidator.isHardBlock).toBe(true)
    })

    it('TestHasAssertions - should check for assertions', async () => {
      const { TestHasAssertionsValidator } = await import('../../../src/domain/validators/gate1/TestHasAssertions')
      
      expect(TestHasAssertionsValidator.code).toBe('TEST_HAS_ASSERTIONS')
      expect(TestHasAssertionsValidator.order).toBe(2)
      expect(TestHasAssertionsValidator.isHardBlock).toBe(true)
    })

    it('TestCoversHappyAndSadPath - should verify path coverage', async () => {
      const { TestCoversHappyAndSadPathValidator } = await import('../../../src/domain/validators/gate1/TestCoversHappyAndSadPath')
      
      expect(TestCoversHappyAndSadPathValidator.code).toBe('TEST_COVERS_HAPPY_AND_SAD_PATH')
      expect(TestCoversHappyAndSadPathValidator.order).toBe(3)
      expect(TestCoversHappyAndSadPathValidator.isHardBlock).toBe(true)
    })

    it('TestFailsBeforeImplementation - CLAUSULA PETREA', async () => {
      const { TestFailsBeforeImplementationValidator } = await import('../../../src/domain/validators/gate1/TestFailsBeforeImplementation')
      
      expect(TestFailsBeforeImplementationValidator.code).toBe('TEST_FAILS_BEFORE_IMPLEMENTATION')
      expect(TestFailsBeforeImplementationValidator.order).toBe(4)
      expect(TestFailsBeforeImplementationValidator.isHardBlock).toBe(true)
      expect(TestFailsBeforeImplementationValidator.description).toContain('CLÁUSULA PÉTREA')
    })

    it('NoDecorativeTests - should block empty tests', async () => {
      const { NoDecorativeTestsValidator } = await import('../../../src/domain/validators/gate1/NoDecorativeTests')
      
      expect(NoDecorativeTestsValidator.code).toBe('NO_DECORATIVE_TESTS')
      expect(NoDecorativeTestsValidator.order).toBe(5)
      expect(NoDecorativeTestsValidator.isHardBlock).toBe(true)
    })

    it('ManifestFileLock - should verify manifest integrity', async () => {
      const { ManifestFileLockValidator } = await import('../../../src/domain/validators/gate1/ManifestFileLock')
      
      expect(ManifestFileLockValidator.code).toBe('MANIFEST_FILE_LOCK')
      expect(ManifestFileLockValidator.order).toBe(6)
      expect(ManifestFileLockValidator.isHardBlock).toBe(true)
    })

    it('NoImplicitFiles - should block vague references', async () => {
      const { NoImplicitFilesValidator } = await import('../../../src/domain/validators/gate1/NoImplicitFiles')
      
      expect(NoImplicitFilesValidator.code).toBe('NO_IMPLICIT_FILES')
      expect(NoImplicitFilesValidator.order).toBe(7)
      expect(NoImplicitFilesValidator.isHardBlock).toBe(true)
    })

    it('ImportRealityCheck - should verify imports exist', async () => {
      const { ImportRealityCheckValidator } = await import('../../../src/domain/validators/gate1/ImportRealityCheck')
      
      expect(ImportRealityCheckValidator.code).toBe('IMPORT_REALITY_CHECK')
      expect(ImportRealityCheckValidator.order).toBe(8)
      expect(ImportRealityCheckValidator.isHardBlock).toBe(true)
    })

    it('TestIntentAlignment - should check alignment (SOFT)', async () => {
      const { TestIntentAlignmentValidator } = await import('../../../src/domain/validators/gate1/TestIntentAlignment')
      
      expect(TestIntentAlignmentValidator.code).toBe('TEST_INTENT_ALIGNMENT')
      expect(TestIntentAlignmentValidator.order).toBe(9)
      expect(TestIntentAlignmentValidator.isHardBlock).toBe(false)
    })
  })
})

describe('Gate 2 - EXECUTION Integration', () => {
  describe('All Gate 2 Validators', () => {
    it('should have all 5 validators', async () => {
      const { GATES_CONFIG } = await import('../../../src/config/gates.config')
      const gate2 = GATES_CONFIG.find(g => g.number === 2)
      
      expect(gate2?.validators).toHaveLength(5)
    })

    it('StrictCompilation - should verify compilation', async () => {
      const { StrictCompilationValidator } = await import('../../../src/domain/validators/gate2/StrictCompilation')
      
      expect(StrictCompilationValidator.code).toBe('STRICT_COMPILATION')
      expect(StrictCompilationValidator.order).toBe(4)
      expect(StrictCompilationValidator.isHardBlock).toBe(true)
    })

    it('StyleConsistencyLint - should check code style', async () => {
      const { StyleConsistencyLintValidator } = await import('../../../src/domain/validators/gate2/StyleConsistencyLint')
      
      expect(StyleConsistencyLintValidator.code).toBe('STYLE_CONSISTENCY_LINT')
      expect(StyleConsistencyLintValidator.order).toBe(5)
      expect(StyleConsistencyLintValidator.isHardBlock).toBe(true)
    })
  })
})

describe('Complete Validation System', () => {
  it('should have all 21 validators across all gates', async () => {
    const { GATES_CONFIG } = await import('../../../src/config/gates.config')
    
    const gate0Count = GATES_CONFIG[0].validators.length
    const gate1Count = GATES_CONFIG[1].validators.length
    const gate2Count = GATES_CONFIG[2].validators.length
    const gate3Count = GATES_CONFIG[3].validators.length
    
    expect(gate0Count).toBe(5)
    expect(gate1Count).toBe(9)
    expect(gate2Count).toBe(5)
    expect(gate3Count).toBe(2)
    
    const total = gate0Count + gate1Count + gate2Count + gate3Count
    expect(total).toBe(21)
  })

  it('should have correct gate structure', async () => {
    const { GATES_CONFIG } = await import('../../../src/config/gates.config')
    
    expect(GATES_CONFIG[0].name).toBe('SANITIZATION')
    expect(GATES_CONFIG[0].emoji).toBe('🧹')
    
    expect(GATES_CONFIG[1].name).toBe('CONTRACT')
    expect(GATES_CONFIG[1].emoji).toBe('📜')
    
    expect(GATES_CONFIG[2].name).toBe('EXECUTION')
    expect(GATES_CONFIG[2].emoji).toBe('⚙️')
    
    expect(GATES_CONFIG[3].name).toBe('INTEGRITY')
    expect(GATES_CONFIG[3].emoji).toBe('🏗️')
  })
})
