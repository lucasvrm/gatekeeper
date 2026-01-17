import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { APIEndpointRules } from '../src/elicitor/checkers/rules/APIEndpointRules.js'

describe('APIEndpointRules', () => {
  const rules = new APIEndpointRules()
  const fields = rules.getFieldDefinitions()

  const byName = (name: string) => fields.find((field) => field.name === name)

  it('requires body for POST', () => {
    const field = byName('Request Body')
    expect(field).toBeDefined()

    const state = { method: 'POST' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('does not require body for GET', () => {
    const field = byName('Request Body')
    expect(field).toBeDefined()

    const state = { method: 'GET' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('requires params when path has placeholders', () => {
    const field = byName('Path Parameters')
    expect(field).toBeDefined()

    const state = { path: '/users/:id' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('accepts params when path has placeholders', () => {
    const field = byName('Path Parameters')
    expect(field).toBeDefined()

    const state = { path: '/users/:id' } as unknown as ElicitationState
    const result = field!.validator({ id: { type: 'string' } }, state)

    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('scores query params lower when missing for GET', () => {
    const field = byName('Query Parameters')
    expect(field).toBeDefined()

    const state = { method: 'GET' } as unknown as ElicitationState
    const result = field!.validator(undefined, state)

    expect(result.isFilled).toBe(false)
    expect(result.score).toBe(70)
  })
})
