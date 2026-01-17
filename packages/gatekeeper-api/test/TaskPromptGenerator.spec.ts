import { describe, it, expect } from 'vitest'
import type { ElicitationState } from '../src/elicitor/types/elicitor.types.js'
import { TaskType } from '../src/elicitor/types/elicitor.types.js'
import { TaskPromptGenerator } from '../src/elicitor/generators/TaskPromptGenerator.js'

describe('TaskPromptGenerator', () => {
  const generator = new TaskPromptGenerator()

  it('generates UI component prompt with sections', () => {
    const state = {
      type: TaskType.UI_COMPONENT,
      name: 'PrimaryButton',
      filePath: 'src/components/PrimaryButton.tsx',
      description: 'Primary call to action button.',
      props: [{ name: 'label', type: 'string', required: true, description: 'Label text' }],
      states: [{ state: 'default', description: 'Idle' }],
      behaviors: [{ trigger: 'click', action: 'submit', onSuccess: { feedback: 'Saved' } }],
      accessibility: { role: 'button', ariaLabel: 'Save', keyboard: [{ key: 'Enter', action: 'submit' }] },
      edgeCases: [{ scenario: 'No data', behavior: 'Show empty' }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.UI_COMPONENT)

    expect(output).toContain('TIPO: UI_COMPONENT')
    expect(output).toContain('## PROPS')
    expect(output).toContain('## ESTADOS VISUAIS')
    expect(output).toContain('## COMPORTAMENTOS')
    expect(output).toContain('## ACESSIBILIDADE')
    expect(output).toContain('## EDGE CASES')
    expect(output).toContain('## TESTES OBRIGATORIOS')
  })

  it('generates API endpoint prompt with sections', () => {
    const state = {
      type: TaskType.API_ENDPOINT,
      name: 'CreateUser',
      handler: 'src/api/users/create.ts',
      method: 'POST',
      path: '/users',
      description: 'Create a user',
      request: {
        body: { contentType: 'application/json', schema: { name: 'string' } },
      },
      response: { success: { status: 201, body: { id: '1' } }, errors: [{ status: 400, scenario: 'invalid', body: { error: 'bad' } }] },
      authentication: { required: true, type: 'bearer' },
      validations: [{ field: 'name', rule: 'required' }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.API_ENDPOINT)

    expect(output).toContain('TIPO: API_ENDPOINT')
    expect(output).toContain('## ENDPOINT')
    expect(output).toContain('## REQUEST')
    expect(output).toContain('## RESPONSE')
    expect(output).toContain('## AUTENTICACAO')
    expect(output).toContain('## VALIDACOES')
    expect(output).toContain('## TESTES OBRIGATORIOS')
  })

  it('generates FEATURE prompt with sections', () => {
    const state = {
      type: TaskType.FEATURE,
      name: 'ExportReport',
      userStory: { as: 'user', iWant: 'export a report', soThat: 'share results' },
      happyPath: [
        { actor: 'user', action: 'click export', result: 'download starts' },
        { actor: 'system', action: 'generate file', result: 'file ready' },
      ],
      alternativePaths: [{ name: 'Error', type: 'error', trigger: 'fail', steps: [] }],
      entryPoints: [{ location: 'Reports page', trigger: 'button' }],
      exitPoints: [{ type: 'success', destination: 'Downloads' }],
      acceptanceCriteria: ['Exports file', 'Shows success'],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.FEATURE)

    expect(output).toContain('TIPO: FEATURE')
    expect(output).toContain('## USER STORY')
    expect(output).toContain('## HAPPY PATH')
    expect(output).toContain('## ALTERNATIVE PATHS')
    expect(output).toContain('## ENTRY POINTS')
    expect(output).toContain('## EXIT POINTS')
    expect(output).toContain('## ACCEPTANCE CRITERIA')
    expect(output).toContain('## TESTES OBRIGATORIOS')
  })

  it('generates AUTH prompt with sections', () => {
    const state = {
      type: TaskType.AUTH,
      credentials: [{ name: 'email', type: 'email', required: true }],
      passwordPolicy: { minLength: 8 },
      session: { duration: '1h', storage: 'cookie' },
      security: { bruteForce: { enabled: true, maxAttempts: 5 } },
      messages: { errors: { invalid: 'Invalid' }, success: { ok: 'Ok' } },
      redirects: { afterSuccess: '/app' },
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.AUTH)

    expect(output).toContain('TIPO: AUTH')
    expect(output).toContain('## TIPO DE FLUXO')
    expect(output).toContain('## CREDENCIAIS')
    expect(output).toContain('## POLITICA DE SENHA')
    expect(output).toContain('## SESSAO')
    expect(output).toContain('## SEGURANCA')
    expect(output).toContain('## MENSAGENS')
    expect(output).toContain('## REDIRECIONAMENTO')
    expect(output).toContain('## TESTES OBRIGATORIOS')
  })

  it('generates DATA prompt with sections', () => {
    const state = {
      type: TaskType.DATA,
      entity: 'User',
      operation: 'create',
      fields: [{ name: 'email', type: 'string', required: true }],
      validations: [{ rule: 'email', errorMessage: 'Invalid' }],
      permissions: { create: { roles: ['admin'] } },
      relationships: [{ name: 'account', type: 'belongsTo', target: 'Account' }],
      sideEffects: [{ trigger: 'create', action: 'send email' }],
    } as unknown as ElicitationState

    const output = generator.generate(state, TaskType.DATA)

    expect(output).toContain('TIPO: DATA')
    expect(output).toContain('## ENTIDADE E OPERACAO')
    expect(output).toContain('## CAMPOS')
    expect(output).toContain('## VALIDACOES')
    expect(output).toContain('## PERMISSOES')
    expect(output).toContain('## RELACIONAMENTOS')
    expect(output).toContain('## EFEITOS')
    expect(output).toContain('## TESTES OBRIGATORIOS')
  })
})
