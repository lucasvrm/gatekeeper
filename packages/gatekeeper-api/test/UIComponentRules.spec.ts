import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { TaskType } from '../src/elicitor/types/elicitor.types.js'
import { UIComponentRules } from '../src/elicitor/checkers/rules/UIComponentRules.js'

describe('UIComponentRules', () => {
  const rules = new UIComponentRules()
  const fields = rules.getFieldDefinitions()

  const byName = (name: string) => fields.find((field) => field.name === name)

  it('validates Nome do Componente', () => {
    const field = byName('Nome do Componente')
    expect(field).toBeDefined()

    const result = field!.validator('PrimaryButton', { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Comportamento Principal', () => {
    const field = byName('Comportamento Principal')
    expect(field).toBeDefined()

    const result = field!.validator([{ trigger: 'click', action: 'save' }], { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Props', () => {
    const field = byName('Props')
    expect(field).toBeDefined()

    const result = field!.validator([{ name: 'label', type: 'string' }], { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Estado Default', () => {
    const field = byName('Estado Default')
    expect(field).toBeDefined()

    const result = field!.validator([{ state: 'default' }], { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Tratamento de Erro', () => {
    const field = byName('Tratamento de Erro')
    expect(field).toBeDefined()

    const state = {
      type: TaskType.UI_COMPONENT,
      behaviors: [{ trigger: 'click', action: 'save', onError: { feedback: 'Failed' } }],
    } as ElicitationState

    const result = field!.validator(undefined, state)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Feedback de Sucesso', () => {
    const field = byName('Feedback de Sucesso')
    expect(field).toBeDefined()

    const state = {
      type: TaskType.UI_COMPONENT,
      behaviors: [{ trigger: 'click', action: 'save', onSuccess: { feedback: 'Saved' } }],
    } as ElicitationState

    const result = field!.validator(undefined, state)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Acessibilidade', () => {
    const field = byName('Acessibilidade')
    expect(field).toBeDefined()

    const value = { role: 'button', keyboard: [{ key: 'Enter', action: 'submit' }] }
    const result = field!.validator(value, { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Edge Cases', () => {
    const field = byName('Edge Cases')
    expect(field).toBeDefined()

    const value = [
      { scenario: 'No data', behavior: 'Show empty' },
      { scenario: 'Timeout', behavior: 'Show error' },
    ]
    const result = field!.validator(value, { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Estado Hover', () => {
    const field = byName('Estado Hover')
    expect(field).toBeDefined()

    const value = [{ state: 'hover' }]
    const result = field!.validator(value, { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Estado Loading for async behaviors', () => {
    const field = byName('Estado Loading')
    expect(field).toBeDefined()

    const state = {
      type: TaskType.UI_COMPONENT,
      behaviors: [{ trigger: 'click', action: 'fetch /api/save' }],
    } as ElicitationState

    const value = [{ state: 'loading' }]
    const result = field!.validator(value, state)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })

  it('validates Estado Disabled', () => {
    const field = byName('Estado Disabled')
    expect(field).toBeDefined()

    const value = [{ state: 'disabled' }]
    const result = field!.validator(value, { type: TaskType.UI_COMPONENT } as ElicitationState)
    expect(result.isValid).toBe(true)
    expect(result.isFilled).toBe(true)
  })
})
