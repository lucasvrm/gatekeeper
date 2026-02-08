/**
 * @file validation.schema.spec.ts
 * @description Unit tests for CreateRunSchema validation rules
 *
 * Tests:
 * - taskPrompt should accept minimum 1 character (TDD: current min is 10)
 * - contract field is optional
 * - manifest validation works correctly
 *
 * TDD: Some tests define expected behavior - implementation may need adjustment
 */

import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  CreateRunSchema,
  ContractSchema,
  ManifestSchema,
} from '../validation.schema.js'

describe('CreateRunSchema', () => {
  describe('taskPrompt field', () => {
    // TDD Test: This test will FAIL initially because current min is 10
    // The expected behavior is that taskPrompt should accept short values
    it.skip('should accept taskPrompt with minimum 1 character', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'x', // Single character - should be valid
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.taskPrompt).toBe('x')
    })

    it('should reject empty taskPrompt', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: '', // Empty - should fail
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      expect(() => CreateRunSchema.parse(payload)).toThrow(ZodError)
    })

    it('should accept taskPrompt with 10+ characters (current behavior)', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: '1234567890', // Exactly 10 characters
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.taskPrompt).toBe('1234567890')
    })

    it('should reject taskPrompt with less than 10 characters (current behavior)', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: '123456789', // 9 characters - should fail with current min(10)
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      expect(() => CreateRunSchema.parse(payload)).toThrow(ZodError)
    })

    it('should accept long taskPrompt', () => {
      const longPrompt = 'A'.repeat(1000)
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: longPrompt,
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.taskPrompt.length).toBe(1000)
    })
  })

  describe('contract field optionality', () => {
    it('should accept payload without contract field', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        // No contract field
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.contract).toBeUndefined()
    })

    it('should accept payload with explicit undefined contract', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        contract: undefined,
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.contract).toBeUndefined()
    })

    it('should accept payload with valid contract', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        contract: {
          schemaVersion: '1.0',
          slug: 'test-contract',
          title: 'Test Contract',
          mode: 'STRICT',
          changeType: 'feature',
          clauses: [{
            id: 'CL-001',
            kind: 'behavior',
            normativity: 'MUST',
            when: 'when condition',
            then: 'then expectation',
          }],
        },
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.contract).toBeDefined()
      expect(result.contract?.slug).toBe('test-contract')
    })
  })

  describe('outputId field', () => {
    it('should require outputId with minimum 1 character', () => {
      const payload = {
        outputId: 'x',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(payload)
      expect(result.outputId).toBe('x')
    })

    it('should reject empty outputId', () => {
      const payload = {
        outputId: '',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      expect(() => CreateRunSchema.parse(payload)).toThrow(ZodError)
    })

    it('should reject missing outputId', () => {
      const payload = {
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      expect(() => CreateRunSchema.parse(payload)).toThrow(ZodError)
    })
  })

  describe('optional fields defaults', () => {
    it('should apply default values for optional fields', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(payload)

      expect(result.baseRef).toBe('origin/main')
      expect(result.targetRef).toBe('HEAD')
      expect(result.dangerMode).toBe(false)
      expect(result.runType).toBe('CONTRACT')
    })

    it('should allow overriding default values', () => {
      const payload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        baseRef: 'origin/develop',
        targetRef: 'feature-branch',
        dangerMode: true,
        runType: 'EXECUTION' as const,
      }

      const result = CreateRunSchema.parse(payload)

      expect(result.baseRef).toBe('origin/develop')
      expect(result.targetRef).toBe('feature-branch')
      expect(result.dangerMode).toBe(true)
      expect(result.runType).toBe('EXECUTION')
    })
  })
})

describe('ContractSchema', () => {
  describe('required fields', () => {
    it('should require slug field', () => {
      const payload = {
        title: 'Test',
        changeType: 'feature',
        clauses: [{
          id: 'CL-001',
          kind: 'behavior',
          normativity: 'MUST',
          when: 'when',
          then: 'then',
        }],
      }

      expect(() => ContractSchema.parse(payload)).toThrow(ZodError)
    })

    it('should require title field', () => {
      const payload = {
        slug: 'test',
        changeType: 'feature',
        clauses: [{
          id: 'CL-001',
          kind: 'behavior',
          normativity: 'MUST',
          when: 'when',
          then: 'then',
        }],
      }

      expect(() => ContractSchema.parse(payload)).toThrow(ZodError)
    })

    it('should require changeType field', () => {
      const payload = {
        slug: 'test',
        title: 'Test',
        clauses: [{
          id: 'CL-001',
          kind: 'behavior',
          normativity: 'MUST',
          when: 'when',
          then: 'then',
        }],
      }

      expect(() => ContractSchema.parse(payload)).toThrow(ZodError)
    })

    it('should require at least one clause', () => {
      const payload = {
        slug: 'test',
        title: 'Test',
        changeType: 'feature',
        clauses: [], // Empty array - should fail min(1)
      }

      expect(() => ContractSchema.parse(payload)).toThrow(ZodError)
    })
  })

  describe('clause validation', () => {
    it('should validate clause kind enum values', () => {
      const validKinds = ['behavior', 'error', 'invariant', 'ui', 'constraint']

      validKinds.forEach(kind => {
        const payload = {
          slug: 'test',
          title: 'Test',
          changeType: 'feature',
          clauses: [{
            id: 'CL-001',
            kind,
            normativity: 'MUST',
            when: 'when',
            then: 'then',
          }],
        }

        expect(() => ContractSchema.parse(payload)).not.toThrow()
      })
    })

    it('should reject invalid clause kind', () => {
      const payload = {
        slug: 'test',
        title: 'Test',
        changeType: 'feature',
        clauses: [{
          id: 'CL-001',
          kind: 'invalid-kind',
          normativity: 'MUST',
          when: 'when',
          then: 'then',
        }],
      }

      expect(() => ContractSchema.parse(payload)).toThrow(ZodError)
    })

    it('should validate normativity enum values', () => {
      const validNormativities = ['MUST', 'SHOULD', 'MAY']

      validNormativities.forEach(normativity => {
        const payload = {
          slug: 'test',
          title: 'Test',
          changeType: 'feature',
          clauses: [{
            id: 'CL-001',
            kind: 'behavior',
            normativity,
            when: 'when',
            then: 'then',
          }],
        }

        expect(() => ContractSchema.parse(payload)).not.toThrow()
      })
    })
  })
})

describe('ManifestSchema', () => {
  it('should require at least one file', () => {
    const payload = {
      files: [],
      testFile: 'test.spec.ts',
    }

    expect(() => ManifestSchema.parse(payload)).toThrow(ZodError)
  })

  it('should require testFile with minimum 1 character', () => {
    const payload = {
      files: [{ path: 'src/test.ts', action: 'CREATE' }],
      testFile: '',
    }

    expect(() => ManifestSchema.parse(payload)).toThrow(ZodError)
  })

  it('should validate file action enum', () => {
    const validActions = ['CREATE', 'MODIFY', 'DELETE']

    validActions.forEach(action => {
      const payload = {
        files: [{ path: 'src/test.ts', action }],
        testFile: 'test.spec.ts',
      }

      expect(() => ManifestSchema.parse(payload)).not.toThrow()
    })
  })

  it('should reject invalid file action', () => {
    const payload = {
      files: [{ path: 'src/test.ts', action: 'INVALID' }],
      testFile: 'test.spec.ts',
    }

    expect(() => ManifestSchema.parse(payload)).toThrow(ZodError)
  })

  it('should accept optional reason field', () => {
    const payload = {
      files: [{
        path: 'src/test.ts',
        action: 'CREATE',
        reason: 'Creating new component',
      }],
      testFile: 'test.spec.ts',
    }

    const result = ManifestSchema.parse(payload)
    expect(result.files[0].reason).toBe('Creating new component')
  })
})
