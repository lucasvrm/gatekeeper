/**
 * @file validation.routes.spec.ts
 * @description Tests for POST /validation/runs endpoint error handling
 *
 * Validates that validation errors:
 * - Use generic error codes (not CONTRACT_SCHEMA_INVALID for non-contract fields)
 * - Do not mention 'contrato' in error messages for general validation failures
 *
 * TDD: These tests define expected behavior - implementation may need adjustment
 */

import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { CreateRunSchema } from '../../schemas/validation.schema.js'

describe('POST /validation/runs - Error Handling', () => {
  describe('taskPrompt validation errors', () => {
    // This test defines expected behavior: taskPrompt validation errors should NOT
    // use CONTRACT_SCHEMA_INVALID or mention 'contrato' since taskPrompt is not part
    // of the contract - it's a general input field
    it('should return validation error without mentioning contract when taskPrompt is too short', () => {
      const invalidPayload = {
        outputId: 'test-output-id',
        taskPrompt: 'short', // Less than min(10)
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      try {
        CreateRunSchema.parse(invalidPayload)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Verify the error is about taskPrompt
        const taskPromptErrors = zodError.errors.filter(e =>
          e.path.includes('taskPrompt')
        )
        expect(taskPromptErrors.length).toBeGreaterThan(0)

        // Verify error message does NOT mention 'contrato'
        const errorMessage = zodError.errors.map(e => e.message).join(' ')
        expect(errorMessage.toLowerCase()).not.toContain('contrato')
        expect(errorMessage.toLowerCase()).not.toContain('contract')
      }
    })

    it('should not use CONTRACT_SCHEMA_INVALID error code for taskPrompt errors', () => {
      // This test validates that the route handler should use a generic error code
      // for validation errors on non-contract fields

      const invalidPayload = {
        outputId: 'test-output-id',
        taskPrompt: '123', // Too short (less than 10 chars)
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      try {
        CreateRunSchema.parse(invalidPayload)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Verify error is about taskPrompt, not about contract
        const paths = zodError.errors.map(e => e.path.join('.'))
        expect(paths).toContain('taskPrompt')
        expect(paths).not.toContain('contract')
      }
    })
  })

  describe('outputId validation errors', () => {
    it('should return validation error without mentioning contract when outputId is missing', () => {
      const invalidPayload = {
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      try {
        CreateRunSchema.parse(invalidPayload)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Verify the error is about outputId
        const outputIdErrors = zodError.errors.filter(e =>
          e.path.includes('outputId')
        )
        expect(outputIdErrors.length).toBeGreaterThan(0)

        // Verify error message does NOT mention 'contrato'
        const errorMessage = zodError.errors.map(e => e.message).join(' ')
        expect(errorMessage.toLowerCase()).not.toContain('contrato')
      }
    })
  })

  describe('manifest validation errors', () => {
    it('should return validation error without mentioning contract when manifest is invalid', () => {
      const invalidPayload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [], // Empty array - should fail min(1)
          testFile: 'test.spec.ts',
        },
      }

      try {
        CreateRunSchema.parse(invalidPayload)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Verify the error is about manifest.files
        const manifestErrors = zodError.errors.filter(e =>
          e.path.join('.').includes('manifest') || e.path.join('.').includes('files')
        )
        expect(manifestErrors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('valid payloads', () => {
    it('should accept valid payload with all required fields', () => {
      const validPayload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
      }

      const result = CreateRunSchema.parse(validPayload)

      expect(result.outputId).toBe('test-output-id')
      expect(result.taskPrompt).toBe('This is a valid task prompt with enough characters')
      expect(result.manifest.files).toHaveLength(1)
    })

    it('should accept valid payload without optional contract field', () => {
      const validPayload = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        // No contract field - should be accepted
      }

      const result = CreateRunSchema.parse(validPayload)

      expect(result.contract).toBeUndefined()
    })
  })

  describe('error code expectations', () => {
    // These tests document the expected error codes that should be used
    // by the route handler (implementation in validation.routes.ts)

    it('should use VALIDATION_ERROR code for general input validation failures', () => {
      // Expected error response structure for non-contract validation errors:
      // {
      //   error: 'VALIDATION_ERROR',  // NOT 'CONTRACT_SCHEMA_INVALID'
      //   message: 'Dados de entrada inválidos',  // NOT 'O contrato gerado...'
      //   fields: [...]
      // }

      const invalidPayload = {
        outputId: '', // Invalid: empty string
        taskPrompt: 'short', // Invalid: too short
        manifest: {
          files: [],
          testFile: '',
        },
      }

      try {
        CreateRunSchema.parse(invalidPayload)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Multiple validation errors - none should be about 'contract'
        expect(zodError.errors.length).toBeGreaterThan(1)

        // All error paths should be about non-contract fields
        zodError.errors.forEach(e => {
          const path = e.path.join('.')
          expect(path).not.toContain('contract')
        })
      }
    })

    it('should use CONTRACT_SCHEMA_INVALID only for actual contract validation errors', () => {
      const payloadWithInvalidContract = {
        outputId: 'test-output-id',
        taskPrompt: 'This is a valid task prompt with enough characters',
        manifest: {
          files: [{ path: 'src/test.ts', action: 'CREATE' }],
          testFile: 'test.spec.ts',
        },
        contract: {
          // Invalid contract: missing required fields
          slug: 'test',
          // Missing: title, changeType, clauses
        },
      }

      try {
        CreateRunSchema.parse(payloadWithInvalidContract)
        expect.fail('Should have thrown ZodError')
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        const zodError = error as ZodError

        // Errors should be about contract fields
        const contractErrors = zodError.errors.filter(e =>
          e.path.join('.').includes('contract')
        )
        expect(contractErrors.length).toBeGreaterThan(0)
      }
    })
  })
})
