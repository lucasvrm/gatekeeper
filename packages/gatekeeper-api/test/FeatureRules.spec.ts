import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { FeatureRules } from '../src/elicitor/checkers/rules/FeatureRules.js'

describe('FeatureRules', () => {
  const rules = new FeatureRules()
  const fields = rules.getFieldDefinitions()

  const byName = (name: string) => fields.find((field) => field.name === name)

  it('requires user story actor', () => {
    const field = byName('User Story - Quem')
    expect(field).toBeDefined()

    const result = field!.validator('', { } as ElicitationState)
    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('requires at least two happy path steps', () => {
    const field = byName('Happy Path')
    expect(field).toBeDefined()

    const value = [{ step: 1, actor: 'user', action: 'click', result: 'done' }]
    const result = field!.validator(value, { } as ElicitationState)
    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })

  it('validates alternative paths structure', () => {
    const field = byName('Fluxos Alternativos')
    expect(field).toBeDefined()

    const value = [{ name: 'Error', trigger: 'fails', steps: [{ action: 'show error' }] }]
    const result = field!.validator(value, { } as ElicitationState)

    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('requires at least two acceptance criteria', () => {
    const field = fields.find((candidate) => candidate.path === 'acceptanceCriteria')
    expect(field).toBeDefined()

    const result = field!.validator(['Only one'], { } as ElicitationState)
    expect(result.isValid).toBe(false)
    expect(result.isFilled).toBe(false)
  })
})
