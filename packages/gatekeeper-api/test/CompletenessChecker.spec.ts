import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { TaskType } from '../src/elicitor/types/elicitor.types.js'
import { CompletenessChecker } from '../src/elicitor/checkers/CompletenessChecker.js'
import { FieldPriority } from '../src/elicitor/checkers/types.js'

describe('CompletenessChecker', () => {
  const checker = new CompletenessChecker()

  it('returns 0 for empty UI component state', () => {
    const state = { type: TaskType.UI_COMPONENT } as ElicitationState
    const result = checker.validate(state, TaskType.UI_COMPONENT)

    expect(result.completenessScore).toBe(0)
    expect(result.missingFields.length).toBeGreaterThan(0)
  })

  it('returns ~30% for name-only UI component state', () => {
    const state = { type: TaskType.UI_COMPONENT, name: 'PrimaryButton' } as ElicitationState
    const result = checker.validate(state, TaskType.UI_COMPONENT)

    expect(result.completenessScore).toBeGreaterThanOrEqual(15)
    expect(result.completenessScore).toBeLessThanOrEqual(35)
  })

  it('returns ~70% for critical and important UI component fields', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      props: [{ name: 'label', type: 'string', required: true }],
      states: [{ state: 'default', description: 'Idle' }],
      behaviors: [
        {
          trigger: 'click',
          action: 'save',
          onSuccess: { feedback: 'Saved' },
          onError: { feedback: 'Failed' },
        },
      ],
    } as ElicitationState

    const result = checker.validate(state, TaskType.UI_COMPONENT)
    expect(result.completenessScore).toBeGreaterThanOrEqual(70)
    expect(result.completenessScore).toBeLessThanOrEqual(80)
  })

  it('returns 90%+ for complete UI component state', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      props: [{ name: 'label', type: 'string', required: true }],
      states: [
        { state: 'default', description: 'Idle' },
        { state: 'hover', description: 'Hover' },
        { state: 'loading', description: 'Loading' },
        { state: 'disabled', description: 'Disabled' },
      ],
      behaviors: [
        {
          trigger: 'click',
          action: 'fetch /api/save',
          onSuccess: { feedback: 'Saved', visual: 'toast' },
          onError: { feedback: 'Failed', visual: 'toast' },
        },
      ],
      accessibility: {
        role: 'button',
        ariaLabel: 'Save',
        keyboard: [{ key: 'Enter', action: 'submit' }],
      },
      edgeCases: [
        { scenario: 'No data', behavior: 'Show empty' },
        { scenario: 'Server error', behavior: 'Show error' },
      ],
    } as ElicitationState

    const result = checker.validate(state, TaskType.UI_COMPONENT)
    expect(result.completenessScore).toBeGreaterThanOrEqual(90)
  })

  it('orders missingFields with critical first', () => {
    const state = { type: TaskType.UI_COMPONENT } as ElicitationState
    const result = checker.validate(state, TaskType.UI_COMPONENT)

    expect(result.missingFields[0].priority).toBe(FieldPriority.CRITICAL)
  })

  it('does not allow generate when critical fields are invalid', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'button',
      props: [{ name: 'label', type: 'string', required: true }],
      states: [
        { state: 'default', description: 'Idle' },
        { state: 'hover', description: 'Hover' },
        { state: 'loading', description: 'Loading' },
        { state: 'disabled', description: 'Disabled' },
      ],
      behaviors: [
        {
          trigger: 'click',
          action: '',
          onSuccess: { feedback: 'Saved' },
          onError: { feedback: 'Failed' },
        },
      ],
      accessibility: {
        role: 'button',
        ariaLabel: 'Save',
        keyboard: [{ key: 'Enter', action: 'submit' }],
      },
      edgeCases: [
        { scenario: 'No data', behavior: 'Show empty' },
        { scenario: 'Server error', behavior: 'Show error' },
      ],
    } as ElicitationState

    const result = checker.validate(state, TaskType.UI_COMPONENT)
    expect(result.completenessScore).toBeGreaterThanOrEqual(80)
    expect(result.canGenerate).toBe(false)
  })

  it('requires method for API_ENDPOINT', () => {
    const state = {
      type: TaskType.API_ENDPOINT,
      path: '/users',
      description: 'List users',
      response: { success: { status: 200 } },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.API_ENDPOINT)
    expect(result.missingFields.some((field) => field.path === 'method')).toBe(true)
  })

  it('requires body for POST endpoints', () => {
    const state = {
      type: TaskType.API_ENDPOINT,
      method: 'POST',
      path: '/users',
      description: 'Create user',
      response: { success: { status: 201 } },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.API_ENDPOINT)
    expect(result.missingFields.some((field) => field.path === 'request.body')).toBe(true)
  })

  it('does not require body for GET endpoints', () => {
    const state = {
      type: TaskType.API_ENDPOINT,
      method: 'GET',
      path: '/users',
      description: 'List users',
      response: { success: { status: 200 } },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.API_ENDPOINT)
    expect(result.missingFields.some((field) => field.path === 'request.body')).toBe(false)
  })

  it('requires complete user story for FEATURE', () => {
    const state = {
      type: TaskType.FEATURE,
      name: 'Export report',
      userStory: { as: 'user', iWant: 'export a report' },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.FEATURE)
    expect(result.missingFields.some((field) => field.path === 'userStory.soThat')).toBe(true)
  })

  it('requires at least two happy path steps for FEATURE', () => {
    const state = {
      type: TaskType.FEATURE,
      name: 'Export report',
      userStory: { as: 'user', iWant: 'export a report', soThat: 'share results' },
      happyPath: [{ step: 1, actor: 'user', action: 'click export', result: 'file downloads' }],
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.FEATURE)
    expect(result.missingFields.some((field) => field.path === 'happyPath')).toBe(true)
  })

  it('requires password policy for register', () => {
    const state = {
      name: 'Register',
      type: 'register',
      credentials: [{ name: 'email', type: 'email', required: true }],
      redirects: { afterRegister: '/welcome' },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.AUTH)
    expect(result.missingFields.some((field) => field.path === 'passwordPolicy')).toBe(true)
  })

  it('does not require password policy for logout', () => {
    const state = {
      name: 'Logout',
      type: 'logout',
      credentials: [{ name: 'token', type: 'string', required: true }],
      redirects: { afterLogout: '/login' },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.AUTH)
    expect(result.missingFields.some((field) => field.path === 'passwordPolicy')).toBe(false)
  })

  it('requires entity and operation for DATA', () => {
    const state = { type: TaskType.DATA } as unknown as ElicitationState
    const result = checker.validate(state, TaskType.DATA)

    expect(result.missingFields.some((field) => field.path === 'entity')).toBe(true)
    expect(result.missingFields.some((field) => field.path === 'operation')).toBe(true)
  })

  it('requires deletion config for delete operations', () => {
    const state = {
      type: TaskType.DATA,
      entity: 'User',
      operation: 'delete',
      fields: [{ name: 'id', type: 'string', required: true }],
      permissions: { delete: { roles: ['admin'] } },
    } as unknown as ElicitationState

    const result = checker.validate(state, TaskType.DATA)
    expect(result.missingFields.some((field) => field.path === 'deletion')).toBe(true)
  })
})
