import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { TaskType } from '../src/elicitor/types/elicitor.types.js'
import { ContractMdGenerator } from '../src/elicitor/generators/ContractMdGenerator.js'

describe('ContractMdGenerator', () => {
  const generator = new ContractMdGenerator()

  it('generates UI component contract sections', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      description: 'Primary action button.',
      behaviors: [{ trigger: 'click', action: 'submit', onError: { feedback: 'Error' } }],
      states: [{ state: 'default', description: 'Idle' }],
      accessibility: { keyboard: [{ key: 'Enter', action: 'submit' }] },
      edgeCases: [{ scenario: 'No data', behavior: 'Show empty' }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.UI_COMPONENT)

    expect(output).toContain('# Contrato:')
    expect(output).toContain('## O que e')
    expect(output).toContain('## Aparencia')
    expect(output).toContain('## Comportamento')
    expect(output).toContain('## Se der erro')
    expect(output).toContain('## Navegacao por teclado')
    expect(output).toContain('## Casos especiais')
    expect(output).toContain('## Resumo visual')
  })

  it('generates API endpoint contract sections', () => {
    const state = {
      type: TaskType.API_ENDPOINT,
      method: 'GET',
      path: '/users',
      description: 'List users',
      request: { query: { page: { type: 'number' } } },
      response: { success: { status: 200, body: { items: [] } }, errors: [{ status: 404, scenario: 'not found' }] },
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.API_ENDPOINT)

    expect(output).toContain('## O que precisa enviar')
    expect(output).toContain('## O que retorna')
    expect(output).toContain('## Possiveis erros')
  })

  it('generates FEATURE contract sections', () => {
    const state = {
      type: TaskType.FEATURE,
      name: 'ExportReport',
      userStory: { as: 'user', iWant: 'export a report', soThat: 'share results' },
      happyPath: [{ action: 'click export', result: 'file downloads' }],
      alternativePaths: [{ name: 'Error', trigger: 'fail', steps: [{ action: 'show error' }] }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.FEATURE)

    expect(output).toContain('## O que e')
    expect(output).toContain('## Fluxo principal')
    expect(output).toContain('## Fluxos alternativos')
  })

  it('generates AUTH contract sections', () => {
    const state = {
      type: TaskType.AUTH,
      description: 'Login flow',
      credentials: [{ name: 'email', type: 'email', required: true }],
      passwordPolicy: { minLength: 8 },
      redirects: { afterSuccess: '/app' },
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.AUTH)

    expect(output).toContain('## Campos necessarios')
    expect(output).toContain('## Regras de senha')
    expect(output).toContain('## Redirecionamentos')
  })

  it('generates DATA contract sections', () => {
    const state = {
      type: TaskType.DATA,
      entity: 'User',
      operation: 'create',
      fields: [{ name: 'email', type: 'string', description: 'Email' }],
      validations: [{ rule: 'email', errorMessage: 'Invalid' }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.DATA)

    expect(output).toContain('## Campos')
    expect(output).toContain('## Regras de validacao')
  })
})
