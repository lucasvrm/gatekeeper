import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { AuthRules } from '../src/elicitor/checkers/rules/AuthRules.js'

describe('AuthRules', () => {
  const rules = new AuthRules()
  const fields = rules.getFieldDefinitions()

  it('requires password policy for register', () => {
    const field = fields.find((candidate) => candidate.path === 'passwordPolicy')
    expect(field).toBeDefined()

    const state = { type: 'register' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('does not require password policy for logout', () => {
    const field = fields.find((candidate) => candidate.path === 'passwordPolicy')
    expect(field).toBeDefined()

    const state = { type: 'logout' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('requires session config for login', () => {
    const field = fields.find((candidate) => candidate.path === 'session')
    expect(field).toBeDefined()

    const state = { type: 'login' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })
})
