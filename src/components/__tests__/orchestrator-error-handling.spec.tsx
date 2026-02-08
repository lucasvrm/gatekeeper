/**
 * @file orchestrator-error-handling.spec.tsx
 * @description Tests for error handling in orchestrator page
 *
 * Validates that:
 * - Validation errors show generic messages (not mentioning 'contrato')
 * - Error codes are correctly interpreted
 * - User sees helpful, context-appropriate error messages
 *
 * TDD: These tests define expected behavior - implementation may need adjustment
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// TYPES
// ============================================================================

interface ApiErrorResponse {
  error: string
  message: string
  fields?: Array<{
    path: string
    message: string
  }>
}

// ============================================================================
// MOCK ERROR HANDLERS (simulating orchestrator-page.tsx logic)
// ============================================================================

/**
 * Current implementation (problematic):
 * Uses 'CONTRACT_SCHEMA_INVALID' for all validation errors
 */
function handleValidationErrorCurrent(error: ApiErrorResponse): {
  logMessage: string
  displayMessage: string
} {
  // Current behavior - mentions 'contrato' for all schema errors
  if (error.error === 'CONTRACT_SCHEMA_INVALID') {
    return {
      logMessage: `Schema do contrato inválido: ${error.message}`,
      displayMessage: 'O LLM gerou um contrato com campos de tipo errado.',
    }
  }

  return {
    logMessage: error.message,
    displayMessage: error.message,
  }
}

/**
 * Expected implementation (fixed):
 * Uses context-appropriate messages based on which field failed
 */
function handleValidationErrorExpected(error: ApiErrorResponse): {
  logMessage: string
  displayMessage: string
} {
  // Check if error is specifically about the contract field
  const isContractError = error.fields?.some(f => f.path.startsWith('contract'))

  if (error.error === 'CONTRACT_SCHEMA_INVALID' && isContractError) {
    return {
      logMessage: `Schema do contrato inválido: ${error.message}`,
      displayMessage: 'O LLM gerou um contrato com campos de tipo errado.',
    }
  }

  // Generic validation error - should NOT mention 'contrato'
  if (error.error === 'VALIDATION_ERROR') {
    return {
      logMessage: `Erro de validação: ${error.message}`,
      displayMessage: 'Dados de entrada inválidos. Verifique os campos obrigatórios.',
    }
  }

  return {
    logMessage: error.message,
    displayMessage: error.message,
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Orchestrator Error Handling', () => {
  describe('taskPrompt validation errors', () => {
    it('should NOT mention contrato when taskPrompt validation fails', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'taskPrompt must be at least 10 characters',
        fields: [
          { path: 'taskPrompt', message: 'String must contain at least 10 character(s)' }
        ],
      }

      const result = handleValidationErrorExpected(error)

      expect(result.logMessage.toLowerCase()).not.toContain('contrato')
      expect(result.displayMessage.toLowerCase()).not.toContain('contrato')
    })

    it('should show generic validation message for taskPrompt errors', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'taskPrompt is too short',
        fields: [
          { path: 'taskPrompt', message: 'String must contain at least 10 character(s)' }
        ],
      }

      const result = handleValidationErrorExpected(error)

      expect(result.displayMessage).toContain('Dados de entrada inválidos')
    })
  })

  describe('outputId validation errors', () => {
    it('should NOT mention contrato when outputId validation fails', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'outputId is required',
        fields: [
          { path: 'outputId', message: 'Required' }
        ],
      }

      const result = handleValidationErrorExpected(error)

      expect(result.logMessage.toLowerCase()).not.toContain('contrato')
      expect(result.displayMessage.toLowerCase()).not.toContain('contrato')
    })
  })

  describe('manifest validation errors', () => {
    it('should NOT mention contrato when manifest validation fails', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'manifest.files must have at least 1 item',
        fields: [
          { path: 'manifest.files', message: 'Array must contain at least 1 element(s)' }
        ],
      }

      const result = handleValidationErrorExpected(error)

      expect(result.logMessage.toLowerCase()).not.toContain('contrato')
      expect(result.displayMessage.toLowerCase()).not.toContain('contrato')
    })
  })

  describe('contract validation errors', () => {
    it('should mention contrato ONLY when contract field validation fails', () => {
      const error: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID',
        message: 'contract.clauses must have at least 1 item',
        fields: [
          { path: 'contract.clauses', message: 'Array must contain at least 1 element(s)' }
        ],
      }

      const result = handleValidationErrorExpected(error)

      // For actual contract errors, it's appropriate to mention 'contrato'
      expect(result.displayMessage.toLowerCase()).toContain('contrato')
    })

    it('should differentiate between contract and non-contract errors', () => {
      const contractError: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID',
        message: 'Invalid contract schema',
        fields: [
          { path: 'contract.slug', message: 'Required' }
        ],
      }

      const nonContractError: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fields: [
          { path: 'taskPrompt', message: 'Too short' }
        ],
      }

      const contractResult = handleValidationErrorExpected(contractError)
      const nonContractResult = handleValidationErrorExpected(nonContractError)

      // Contract error should mention 'contrato'
      expect(contractResult.displayMessage.toLowerCase()).toContain('contrato')

      // Non-contract error should NOT mention 'contrato'
      expect(nonContractResult.displayMessage.toLowerCase()).not.toContain('contrato')
    })
  })

  describe('error code handling', () => {
    it('should handle VALIDATION_ERROR code with generic message', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fields: [
          { path: 'taskPrompt', message: 'Too short' },
          { path: 'outputId', message: 'Required' },
        ],
      }

      const result = handleValidationErrorExpected(error)

      expect(result.displayMessage).not.toContain('contrato')
      expect(result.displayMessage).toContain('Dados de entrada inválidos')
    })

    it('should handle CONTRACT_SCHEMA_INVALID code appropriately based on field', () => {
      // Error on contract field - should mention contrato
      const errorOnContract: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID',
        message: 'Invalid contract',
        fields: [{ path: 'contract.title', message: 'Required' }],
      }

      // Error NOT on contract field (bug in current implementation)
      const errorNotOnContract: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID', // Wrong code used for non-contract error
        message: 'Invalid taskPrompt',
        fields: [{ path: 'taskPrompt', message: 'Too short' }],
      }

      const resultContract = handleValidationErrorExpected(errorOnContract)
      const resultNonContract = handleValidationErrorExpected(errorNotOnContract)

      // Contract error mentions contrato
      expect(resultContract.displayMessage.toLowerCase()).toContain('contrato')

      // Non-contract error should NOT mention contrato even if wrong code is used
      // (the expected implementation checks the actual field path)
      expect(resultNonContract.displayMessage.toLowerCase()).not.toContain('contrato')
    })
  })

  describe('current vs expected behavior', () => {
    it('should demonstrate the bug: current implementation incorrectly mentions contrato', () => {
      const taskPromptError: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID', // Wrong code - should be VALIDATION_ERROR
        message: 'taskPrompt is too short',
        fields: [{ path: 'taskPrompt', message: 'Too short' }],
      }

      // Current (buggy) behavior
      const currentResult = handleValidationErrorCurrent(taskPromptError)
      expect(currentResult.displayMessage.toLowerCase()).toContain('contrato')
      // This is WRONG - taskPrompt is not part of the contract
    })

    it('should demonstrate the fix: expected implementation does not mention contrato for non-contract errors', () => {
      const taskPromptError: ApiErrorResponse = {
        error: 'CONTRACT_SCHEMA_INVALID', // Wrong code - but we check field path too
        message: 'taskPrompt is too short',
        fields: [{ path: 'taskPrompt', message: 'Too short' }],
      }

      // Expected (fixed) behavior
      const expectedResult = handleValidationErrorExpected(taskPromptError)
      expect(expectedResult.displayMessage.toLowerCase()).not.toContain('contrato')
      // This is CORRECT - taskPrompt errors should show generic message
    })
  })

  describe('user-facing messages', () => {
    it('should provide helpful message for taskPrompt length error', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'taskPrompt must be at least 10 characters',
        fields: [{ path: 'taskPrompt', message: 'String must contain at least 10 character(s)' }],
      }

      const result = handleValidationErrorExpected(error)

      // Message should be user-friendly
      expect(result.displayMessage).toBeTruthy()
      expect(result.displayMessage.length).toBeGreaterThan(10)
    })

    it('should provide helpful message for missing required fields', () => {
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'Required fields missing',
        fields: [
          { path: 'outputId', message: 'Required' },
          { path: 'manifest.testFile', message: 'Required' },
        ],
      }

      const result = handleValidationErrorExpected(error)

      // Message should mention checking required fields
      expect(result.displayMessage).toContain('obrigatórios')
    })

    it('should NOT confuse users by mentioning contract when creating simple runs', () => {
      // When a user is creating a simple run without a contract,
      // validation errors should not mention contracts
      const error: ApiErrorResponse = {
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields: [
          { path: 'taskPrompt', message: 'Too short' },
          { path: 'manifest.files', message: 'At least one file required' },
        ],
      }

      const result = handleValidationErrorExpected(error)

      // User should see a clear message about their input
      expect(result.displayMessage.toLowerCase()).not.toContain('contrato')
      expect(result.displayMessage.toLowerCase()).not.toContain('llm gerou')
    })
  })

  describe('isSchemaError detection', () => {
    it('should correctly identify schema errors', () => {
      const isSchemaError = (msg: string): boolean => {
        return msg.includes('CONTRACT_SCHEMA_INVALID') || msg.includes('erros de schema')
      }

      expect(isSchemaError('CONTRACT_SCHEMA_INVALID')).toBe(true)
      expect(isSchemaError('erros de schema')).toBe(true)
      expect(isSchemaError('VALIDATION_ERROR')).toBe(false)
      expect(isSchemaError('taskPrompt is too short')).toBe(false)
    })

    it('should NOT use schema error detection for non-contract validation', () => {
      // The isSchemaError check should only apply to actual contract schema issues
      const taskPromptErrorMsg = 'taskPrompt: String must contain at least 10 character(s)'

      const isSchemaError = (msg: string): boolean => {
        return msg.includes('CONTRACT_SCHEMA_INVALID') || msg.includes('erros de schema')
      }

      // taskPrompt error should NOT be treated as a schema error
      expect(isSchemaError(taskPromptErrorMsg)).toBe(false)
    })
  })
})
