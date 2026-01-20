import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ValidationContext, ValidatorOutput, ContractInput } from '@/types/index'
import { TestClauseMappingValidValidator } from '../../packages/gatekeeper-api/src/domain/validators/gate1/TestClauseMappingValid.ts'

// Mock types para o contract (assumindo TASK_add_contract_support implementada)
interface Contract {
  schemaVersion: string
  slug: string
  title: string
  mode: 'STRICT' | 'CREATIVE'
  changeType: string
  clauses: Array<{
    id: string
    kind: string
    normativity: string
    when: string
    then: string
  }>
  testMapping?: {
    tagPattern?: string
  }
}

interface TestBlock {
  name: string
  startLine: number
  precedingComments: string[]
}

// Mock services
const mockGetTestBlocksWithComments = vi.fn<[string], Promise<TestBlock[]>>()
const mockReadFile = vi.fn<[string, string?], Promise<string>>()

function createMockContext(overrides: Partial<ValidationContext & { contract?: Contract | null }> = {}): ValidationContext & { contract?: Contract | null } {
  return {
    runId: 'test-run-001',
    projectPath: '/test/project',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'Create TEST_CLAUSE_MAPPING_VALID validator',
    manifest: {
      files: [{ path: 'src/validators/TestClauseMappingValid.ts', action: 'CREATE' as const }],
      testFile: 'TestClauseMappingValid.spec.tsx'
    },
    testFilePath: '/test/project/TestClauseMappingValid.spec.tsx',
    dangerMode: false,
    services: {
      git: {
        diff: vi.fn(),
        readFile: mockReadFile,
        checkout: vi.fn(),
        getDiffFiles: vi.fn(),
        getCurrentRef: vi.fn(),
      },
      ast: {
        parseFile: vi.fn(),
        getImports: vi.fn(),
        getTestBlocksWithComments: mockGetTestBlocksWithComments,
      },
      testRunner: {
        runSingleTest: vi.fn(),
        runAllTests: vi.fn(),
      },
      compiler: {
        compile: vi.fn(),
      },
      lint: {
        lint: vi.fn(),
      },
      build: {
        build: vi.fn(),
      },
      tokenCounter: {
        count: vi.fn(),
      },
      log: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
    config: new Map<string, string>([
      ['ALLOW_UNTAGGED_TESTS', 'false'],
      ['TEST_CLAUSE_MAPPING_VALID', 'true'],
    ]),
    sensitivePatterns: [],
    ambiguousTerms: [],
    contract: {
      schemaVersion: '1.0',
      slug: 'test-contract',
      title: 'Test Contract',
      mode: 'STRICT',
      changeType: 'new-validator',
      clauses: [
        { id: 'CLAUSE_001', kind: 'behavior', normativity: 'MUST', when: 'condition', then: 'result' },
        { id: 'CLAUSE_002', kind: 'error', normativity: 'MUST', when: 'error condition', then: 'error result' }
      ],
      testMapping: {
        tagPattern: '// @clause'
      }
    },
    ...overrides
  } as ValidationContext & { contract?: Contract | null }
}

describe('TestClauseMappingValid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Validator Metadata', () => {
    // @clause TCM_008
    it('should have correct validator code', () => {
      expect(TestClauseMappingValidValidator.code).toBe('TEST_CLAUSE_MAPPING_VALID')
    })

    // @clause TCM_008
    it('should belong to Gate 1', () => {
      expect(TestClauseMappingValidValidator.gate).toBe(1)
    })

    // @clause TCM_008
    it('should be a hard block by default', () => {
      expect(TestClauseMappingValidValidator.isHardBlock).toBe(true)
    })
  })

  describe('Contract Presence', () => {
    // @clause TCM_001
    it('should return SKIPPED when contract is null', async () => {
      const ctx = createMockContext({ contract: null })
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
      expect(result.message).toContain('No contract provided')
    })

    // @clause TCM_001
    it('should return SKIPPED when contract is undefined', async () => {
      const ctx = createMockContext({ contract: undefined })
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
      expect(result.message).toContain('No contract provided')
    })
  })

  describe('AST Extraction', () => {
    // @clause TCM_002
    it('should call getTestBlocksWithComments with testFilePath', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(mockGetTestBlocksWithComments).toHaveBeenCalledWith(ctx.testFilePath)
    })

    // @clause TCM_009
    it('should receive TestBlock array with name, startLine, and precedingComments', async () => {
      const ctx = createMockContext()
      const mockBlocks: TestBlock[] = [
        { name: 'should do something', startLine: 15, precedingComments: ['// @clause CLAUSE_001'] },
        { name: 'should handle error', startLine: 25, precedingComments: ['// @clause CLAUSE_002'] }
      ]
      mockGetTestBlocksWithComments.mockResolvedValue(mockBlocks)
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })
  })

  describe('Tag Pattern Configuration', () => {
    // @clause TCM_003
    it('should use tagPattern from contract.testMapping', async () => {
      const ctx = createMockContext({
        contract: {
          ...createMockContext().contract!,
          testMapping: { tagPattern: '// @test-clause' }
        }
      })
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @test-clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })

    // @clause TCM_003
    it('should use default tagPattern when testMapping is undefined', async () => {
      const ctx = createMockContext({
        contract: {
          ...createMockContext().contract!,
          testMapping: undefined
        }
      })
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })

    // @clause TCM_003
    it('should use default tagPattern when tagPattern is undefined', async () => {
      const ctx = createMockContext({
        contract: {
          ...createMockContext().contract!,
          testMapping: {}
        }
      })
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })
  })

  describe('Missing Tag Detection (STRICT mode)', () => {
    // @clause TCM_004
    it('should return FAILED when test has no clause tag and ALLOW_UNTAGGED_TESTS is false', async () => {
      const ctx = createMockContext()
      ctx.config.set('ALLOW_UNTAGGED_TESTS', 'false')
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test without tag', startLine: 20, precedingComments: [] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
      expect(result.message).toContain('test without tag')
      expect(result.message).toContain('line 20')
      expect(result.message).toContain('no @clause tag')
    })

    // @clause TCM_004
    it('should return FAILED when preceding comment does not match tagPattern', async () => {
      const ctx = createMockContext()
      ctx.config.set('ALLOW_UNTAGGED_TESTS', 'false')
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with wrong comment', startLine: 15, precedingComments: ['// just a regular comment'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('no @clause tag')
    })
  })

  describe('Missing Tag Detection (PERMISSIVE mode)', () => {
    // @clause TCM_005
    it('should return WARNING when test has no clause tag and ALLOW_UNTAGGED_TESTS is true', async () => {
      const ctx = createMockContext()
      ctx.config.set('ALLOW_UNTAGGED_TESTS', 'true')
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test without tag', startLine: 20, precedingComments: [] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('WARNING')
      expect(result.passed).toBe(true)
      expect(result.message).toContain('test without tag')
      expect(result.message).toContain('Consider adding')
    })

    // @clause TCM_005
    it('should not block pipeline when ALLOW_UNTAGGED_TESTS is true', async () => {
      const ctx = createMockContext()
      ctx.config.set('ALLOW_UNTAGGED_TESTS', 'true')
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'untagged test', startLine: 10, precedingComments: [] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.passed).toBe(true)
    })
  })

  describe('Unknown Clause ID Detection', () => {
    // @clause TCM_006
    it('should return FAILED when clause ID does not exist in contract', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with unknown clause', startLine: 30, precedingComments: ['// @clause UNKNOWN_ID'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
      expect(result.message).toContain('test with unknown clause')
      expect(result.message).toContain('UNKNOWN_ID')
      expect(result.message).toContain('Valid clause IDs')
      expect(result.message).toContain('CLAUSE_001')
    })

    // @clause TCM_006
    it('should pass when clause ID exists in contract', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with valid clause', startLine: 30, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
      expect(result.passed).toBe(true)
    })
  })

  describe('Malformed Tag Detection', () => {
    // @clause TCM_007
    it('should return FAILED when tag has no clause ID after pattern', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with empty tag', startLine: 25, precedingComments: ['// @clause'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
      expect(result.message).toContain('malformed @clause tag')
      expect(result.message).toContain('line 25')
      expect(result.message).toContain('Expected format')
    })

    // @clause TCM_007
    it('should return FAILED when tag has only whitespace after pattern', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with whitespace tag', startLine: 35, precedingComments: ['// @clause   '] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('malformed @clause tag')
    })

    // @clause TCM_010
    it('should accept tag with multiple spaces between pattern and ID', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test with spaced tag', startLine: 40, precedingComments: ['// @clause    CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })
  })

  describe('All Tests Valid', () => {
    // @clause TCM_008
    it('should return PASSED when all tests have valid clause tags', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @clause CLAUSE_001'] },
        { name: 'test 2', startLine: 20, precedingComments: ['// @clause CLAUSE_002'] },
        { name: 'test 3', startLine: 30, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
      expect(result.passed).toBe(true)
      expect(result.metrics?.validatedTests).toBe(3)
    })

    // @clause TCM_008
    it('should include count of validated tests in success message', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test 1', startLine: 10, precedingComments: ['// @clause CLAUSE_001'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
      expect(result.message).toMatch(/1.*test/i)
    })
  })

  describe('Regex Extraction', () => {
    // @clause TCM_010
    it('should extract clause ID using regex pattern', async () => {
      const ctx = createMockContext()
      ctx.contract!.clauses.push({ 
        id: 'MY_CLAUSE_123', 
        kind: 'behavior', 
        normativity: 'MUST', 
        when: 'w', 
        then: 't' 
      })
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test', startLine: 10, precedingComments: ['// @clause MY_CLAUSE_123'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })

    // @clause TCM_010
    it('should treat comment without pattern match as no tag', async () => {
      const ctx = createMockContext()
      ctx.config.set('ALLOW_UNTAGGED_TESTS', 'false')
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test', startLine: 10, precedingComments: ['// some other comment'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('no @clause tag')
    })
  })

  describe('Edge Cases', () => {
    // @clause TCM_002
    it('should handle empty test file with no test blocks', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
      expect(result.passed).toBe(true)
      expect(result.metrics?.validatedTests).toBe(0)
    })

    // @clause TCM_006
    it('should handle contract with empty clauses array', async () => {
      const ctx = createMockContext({
        contract: {
          ...createMockContext().contract!,
          clauses: []
        }
      })
      mockGetTestBlocksWithComments.mockResolvedValue([
        { name: 'test', startLine: 10, precedingComments: ['// @clause ANY_ID'] }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('FAILED')
      expect(result.message).toContain('unknown clause')
    })

    // @clause TCM_004
    it('should check all preceding comments for tag', async () => {
      const ctx = createMockContext()
      mockGetTestBlocksWithComments.mockResolvedValue([
        { 
          name: 'test with multiple comments', 
          startLine: 10, 
          precedingComments: [
            '// This is a description',
            '// @clause CLAUSE_001',
            '// Another comment'
          ] 
        }
      ])
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('PASSED')
    })

    // @clause TCM_001
    it('should return SKIPPED when testFilePath is null', async () => {
      const ctx = createMockContext({ testFilePath: null })
      
      const result = await TestClauseMappingValidValidator.execute(ctx as unknown as ValidationContext)
      
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
    })
  })
})
