import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { DataRules } from '../src/elicitor/checkers/rules/DataRules.js'

describe('DataRules', () => {
  const rules = new DataRules()
  const fields = rules.getFieldDefinitions()

  const byPath = (path: string) => fields.find((field) => field.path === path)

  it('requires entity name', () => {
    const field = byPath('entity')
    expect(field).toBeDefined()

    const result = field!.validator('', { } as ElicitationState)
    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('requires operation', () => {
    const field = byPath('operation')
    expect(field).toBeDefined()

    const result = field!.validator('', { } as ElicitationState)
    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('requires deletion config for delete operations', () => {
    const field = byPath('deletion')
    expect(field).toBeDefined()

    const state = { operation: 'delete' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('does not require deletion config for read operations', () => {
    const field = byPath('deletion')
    expect(field).toBeDefined()

    const state = { operation: 'read' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })
})
