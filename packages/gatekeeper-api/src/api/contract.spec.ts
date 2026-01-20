import { describe, it, expect } from 'vitest'

/**
 * Tests for Contract Schema Validation
 * 
 * TDD Requirement (Cláusula Pétrea): This test MUST fail on origin/main because:
 * - ContractSchema does not exist in validation.schema.ts yet
 * - The import below will throw "export not found" error on baseRef
 * - After implementation, the import succeeds and tests pass
 */

// THIS IMPORT MUST FAIL ON baseRef - ContractSchema doesn't exist yet!
import { ContractSchema } from '../../packages/gatekeeper-api/src/api/schemas/validation.schema'

describe('Contract Schema Validation', () => {
  const validContract = {
    schemaVersion: '1.0',
    slug: 'test-contract',
    title: 'Test Contract',
    mode: 'STRICT' as const,
    changeType: 'FEATURE',
    criticality: 'MEDIUM' as const,
    clauses: [
      {
        id: 'TEST_001',
        kind: 'behavior' as const,
        normativity: 'MUST' as const,
        when: 'Request is made with valid data',
        then: 'Returns success response',
      },
    ],
    assertionSurface: {
      http: {
        methods: ['POST'],
        successStatuses: [201],
        errorStatuses: [400],
      },
    },
    testMapping: {
      tagPattern: '// @clause',
    },
  }

  describe('Happy Paths', () => {
    // @clause CLAUSE_001
    it('should accept undefined contract (field is optional)', () => {
      const result = ContractSchema.optional().safeParse(undefined)
      expect(result.success).toBe(true)
    })

    // @clause CLAUSE_002
    it('should accept valid contract with all required fields', () => {
      const result = ContractSchema.safeParse(validContract)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBe('test-contract')
        expect(result.data.clauses).toHaveLength(1)
      }
    })

    // @clause CLAUSE_008
    it('should default mode to STRICT when not provided', () => {
      const contractWithoutMode = {
        slug: 'test-default-mode',
        title: 'Test Default Mode',
        changeType: 'FEATURE',
        clauses: [
          {
            id: 'MODE_001',
            kind: 'behavior' as const,
            normativity: 'MUST' as const,
            when: 'Test condition',
            then: 'Test result',
          },
        ],
      }

      const result = ContractSchema.safeParse(contractWithoutMode)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mode).toBe('STRICT')
      }
    })

    // @clause CLAUSE_009
    it('should default schemaVersion to 1.0 when not provided', () => {
      const contractWithoutVersion = {
        slug: 'test-default-version',
        title: 'Test Default Version',
        mode: 'STRICT' as const,
        changeType: 'FEATURE',
        clauses: [
          {
            id: 'VER_001',
            kind: 'behavior' as const,
            normativity: 'MUST' as const,
            when: 'Test condition',
            then: 'Test result',
          },
        ],
      }

      const result = ContractSchema.safeParse(contractWithoutVersion)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.schemaVersion).toBe('1.0')
      }
    })

    // @clause CLAUSE_010
    it('should accept testMapping without tagPattern (tagPattern is optional)', () => {
      const contractWithEmptyTestMapping = {
        slug: 'test-optional-tagpattern',
        title: 'Test Optional TagPattern',
        mode: 'STRICT' as const,
        changeType: 'FEATURE',
        clauses: [
          {
            id: 'TAG_001',
            kind: 'behavior' as const,
            normativity: 'MUST' as const,
            when: 'Test condition',
            then: 'Test result',
          },
        ],
        testMapping: {},
      }

      const result = ContractSchema.safeParse(contractWithEmptyTestMapping)
      expect(result.success).toBe(true)
    })
  })

  describe('Sad Paths - Contract Validation Errors', () => {
    // @clause CLAUSE_003
    it('should reject contract when slug is empty', () => {
      const invalidContract = { ...validContract, slug: '' }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_003
    it('should reject contract when title is missing', () => {
      const { title, ...contractWithoutTitle } = validContract
      const result = ContractSchema.safeParse(contractWithoutTitle)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_003
    it('should reject contract when changeType is empty', () => {
      const invalidContract = { ...validContract, changeType: '' }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_004
    it('should reject contract when clauses array is empty', () => {
      const invalidContract = { ...validContract, clauses: [] }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_005
    it('should reject clause when id is empty', () => {
      const invalidContract = {
        ...validContract,
        clauses: [{ id: '', kind: 'behavior' as const, normativity: 'MUST' as const, when: 'Condition', then: 'Result' }],
      }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_005
    it('should reject clause when kind is invalid enum value', () => {
      const invalidContract = {
        ...validContract,
        clauses: [{ id: 'INVALID_KIND', kind: 'invalid_kind_value', normativity: 'MUST', when: 'Condition', then: 'Result' }],
      }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_005
    it('should reject clause when normativity is not MUST/SHOULD/MAY', () => {
      const invalidContract = {
        ...validContract,
        clauses: [{ id: 'INVALID_NORM', kind: 'behavior', normativity: 'REQUIRED', when: 'Condition', then: 'Result' }],
      }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_005
    it('should reject clause when "when" field is empty', () => {
      const invalidContract = {
        ...validContract,
        clauses: [{ id: 'EMPTY_WHEN', kind: 'behavior' as const, normativity: 'MUST' as const, when: '', then: 'Result' }],
      }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })

    // @clause CLAUSE_005
    it('should reject clause when "then" field is empty', () => {
      const invalidContract = {
        ...validContract,
        clauses: [{ id: 'EMPTY_THEN', kind: 'behavior' as const, normativity: 'MUST' as const, when: 'Condition', then: '' }],
      }
      const result = ContractSchema.safeParse(invalidContract)
      expect(result.success).toBe(false)
    })
  })

  describe('Contract Context Propagation', () => {
    // @clause CLAUSE_006
    it('should successfully parse valid contract for context propagation', () => {
      const result = ContractSchema.safeParse(validContract)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.slug).toBe(validContract.slug)
        expect(result.data.clauses).toHaveLength(validContract.clauses.length)
        expect(result.data.clauses[0].id).toBe(validContract.clauses[0].id)
      }
    })

    // @clause CLAUSE_007
    it('should allow null/undefined contract (ctx.contract = null)', () => {
      const optionalContractSchema = ContractSchema.optional().nullable()
      const resultNull = optionalContractSchema.safeParse(null)
      expect(resultNull.success).toBe(true)
      if (resultNull.success) expect(resultNull.data).toBeNull()

      const resultUndefined = optionalContractSchema.safeParse(undefined)
      expect(resultUndefined.success).toBe(true)
      if (resultUndefined.success) expect(resultUndefined.data).toBeUndefined()
    })
  })
})
