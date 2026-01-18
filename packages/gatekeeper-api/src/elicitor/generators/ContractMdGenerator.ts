import { IGenerator } from './IGenerator.js'
import { ElicitationState, TaskType } from '../types/elicitor.types.js'
import { Contract } from '../../types/contract.types.js'

const FOOTER = '*Este contrato foi gerado pelo Elicitor. Valide se esta correto antes de prosseguir.*'

type VisualState = {
  state: string
  description?: string
  condition?: string
  cssIndicators?: string[]
  icon?: string
  duration?: string
}

type ParamEntry = { name: string; type: string; required?: boolean; default?: unknown }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

export class ContractMdGenerator implements IGenerator<string> {
  generate(state: ElicitationState, taskType: TaskType): string {
    switch (taskType) {
      case TaskType.UI_COMPONENT:
        return this.generateUIComponentContract(state)
      case TaskType.API_ENDPOINT:
        return this.generateAPIEndpointContract(state)
      case TaskType.FEATURE:
        return this.generateFeatureContract(state)
      case TaskType.AUTH:
        return this.generateAuthContract(state)
      case TaskType.DATA:
        return this.generateDataContract(state)
      default:
        throw new Error(`Unsupported task type: ${taskType}`)
    }
  }

  private generateUIComponentContract(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Componente'
    const lines: string[] = []

    lines.push(`# Contrato: ${name}`)
    lines.push('')
    lines.push('## O que e')
    lines.push(getString(s.description) || `Um componente de interface chamado ${name}.`)
    lines.push('')

    lines.push('## Aparencia')
    const visualStates = this.normalizeStates(s)
    if (visualStates.length === 0) {
      lines.push('Nao informado.')
    } else {
      for (const st of visualStates) {
        const description = st.description ? `: ${st.description}` : ''
        lines.push(`- **${st.state}**${description}`)
      }
    }
    lines.push('')

    lines.push('## Comportamento')
    const behaviors = toRecordArray(s.behaviors)
    if (behaviors.length > 0) {
      let index = 1
      for (const behavior of behaviors) {
        const condition = getString(behavior.condition)
        const conditionText = condition ? ` (condicao: ${condition})` : ''
        lines.push(`${index}. Quando ocorre "${getString(behavior.trigger)}", ${getString(behavior.action)}.${conditionText}`)
        if (behavior.onSuccess) {
          lines.push(`   - Sucesso: ${this.formatFeedback(behavior.onSuccess)}`)
        }
        if (behavior.onError) {
          lines.push(`   - Erro: ${this.formatFeedback(behavior.onError)}`)
        }
        index++
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Se der erro')
    const errorLines = this.collectErrorDescriptions(s)
    if (errorLines.length === 0) {
      lines.push('Nao informado.')
    } else {
      for (const errorLine of errorLines) {
        lines.push(`- ${errorLine}`)
      }
    }
    lines.push('')

    lines.push('## Navegacao por teclado')
    const accessibility = isRecord(s.accessibility) ? s.accessibility : null
    const keyboard = Array.isArray(accessibility?.keyboard) ? accessibility?.keyboard : []
    if (keyboard.length > 0) {
      for (const kb of keyboard) {
        const record = isRecord(kb) ? kb : null
        lines.push(`- ${getString(record?.key)}: ${getString(record?.action)}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Casos especiais')
    const edgeCases = toRecordArray(s.edgeCases)
    if (edgeCases.length > 0) {
      lines.push('| Situacao | O que acontece |')
      lines.push('|----------|----------------|')
      for (const edge of edgeCases) {
        lines.push(`| ${getString(edge.scenario)} | ${getString(edge.behavior)} |`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Resumo visual')
    lines.push('```')
    lines.push(...this.buildVisualSummary(name, s))
    lines.push('```')
    lines.push('')
    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }

  private generateAPIEndpointContract(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || `${getString(s.method)} ${getString(s.path)}`.trim() || 'Endpoint'
    const lines: string[] = []

    lines.push(`# Contrato: ${name}`)
    lines.push('')
    lines.push('## O que e')
    const description = getString(s.description) || `Endpoint ${getString(s.method)} ${getString(s.path)}`.trim()
    lines.push(description || 'Endpoint de API.')
    lines.push('')

    lines.push('## O que precisa enviar')
    const requestLines: string[] = []
    const request = isRecord(s.request) ? s.request : null
    const params = this.normalizeParamEntries(request?.params)
    if (params.length > 0) {
      requestLines.push('Params:')
      for (const param of params) {
        requestLines.push(`- ${param.name}: ${param.type}`)
      }
    }
    const query = this.normalizeParamEntries(request?.query)
    if (query.length > 0) {
      requestLines.push('Query:')
      for (const param of query) {
        requestLines.push(`- ${param.name}: ${param.type}${param.required ? ' (obrigatorio)' : ''}`)
      }
    }
    if (request?.body && isRecord(request.body)) {
      requestLines.push('Body:')
      const body = request.body
      const bodySchema = body.schema || body.example || body
      requestLines.push('```json')
      requestLines.push(JSON.stringify(bodySchema, null, 2))
      requestLines.push('```')
    }
    if (requestLines.length === 0) {
      lines.push('Nao informado.')
    } else {
      lines.push(...requestLines)
    }
    lines.push('')

    lines.push('## O que retorna')
    const response = isRecord(s.response) ? s.response : null
    const success = response && isRecord(response.success) ? response.success : null
    if (success) {
      lines.push(`Status: ${success.status}`)
      if (success.body || success.example) {
        lines.push('```json')
        lines.push(JSON.stringify(success.body || success.example, null, 2))
        lines.push('```')
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Possiveis erros')
    const errors = response ? toRecordArray(response.errors) : []
    if (errors.length > 0) {
      for (const error of errors) {
        const body = isRecord(error.body) ? error.body : null
        const message = getString(body?.error) || getString(body?.message)
        lines.push(`- ${error.status}: ${getString(error.scenario)}${message ? ` - ${message}` : ''}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')
    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }

  private generateFeatureContract(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Funcionalidade'
    const lines: string[] = []

    lines.push(`# Contrato: ${name}`)
    lines.push('')
    lines.push('## O que e')
    const userStory = isRecord(s.userStory) ? s.userStory : null
    if (userStory) {
      lines.push(`Como ${getString(userStory.as)}, eu quero ${getString(userStory.iWant)}, para ${getString(userStory.soThat)}.`)
    } else if (getString(s.description)) {
      lines.push(getString(s.description))
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Fluxo principal')
    const happyPath = toRecordArray(s.happyPath)
    if (happyPath.length > 0) {
      for (let i = 0; i < happyPath.length; i++) {
        const step = happyPath[i]
        const result = getString(step.result)
        lines.push(`${i + 1}. ${getString(step.action)}${result ? ` (${result})` : ''}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Fluxos alternativos')
    const alternatives = toRecordArray(s.alternativePaths)
    if (alternatives.length > 0) {
      for (const path of alternatives) {
        lines.push(`- ${getString(path.name)}: ${getString(path.trigger)}`)
        const steps = Array.isArray(path.steps) ? path.steps : []
        for (const step of steps) {
          const record = isRecord(step) ? step : null
          lines.push(`  - ${getString(record?.action)}`)
        }
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')
    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }

  private generateAuthContract(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.type) || getString(s.name) || 'Autenticacao'
    const lines: string[] = []

    lines.push(`# Contrato: ${name}`)
    lines.push('')
    lines.push('## O que e')
    lines.push(getString(s.description) || `Fluxo de autenticacao: ${name}.`)
    lines.push('')

    lines.push('## Campos necessarios')
    const credentials = toRecordArray(s.credentials)
    if (credentials.length > 0) {
      for (const field of credentials) {
        const required = field.required === true ? ' *' : ''
        lines.push(`- ${getString(field.name)} (${getString(field.type)})${required}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Regras de senha')
    const passwordPolicy = isRecord(s.passwordPolicy) ? s.passwordPolicy : null
    if (passwordPolicy) {
      if (passwordPolicy.minLength) lines.push(`- Minimo: ${passwordPolicy.minLength}`)
      if (passwordPolicy.maxLength) lines.push(`- Maximo: ${passwordPolicy.maxLength}`)
      if (passwordPolicy.requireUppercase) lines.push('- Requer maiuscula')
      if (passwordPolicy.requireLowercase) lines.push('- Requer minuscula')
      if (passwordPolicy.requireNumber) lines.push('- Requer numero')
      if (passwordPolicy.requireSpecial) lines.push('- Requer especial')
      if (passwordPolicy.noSpaces) lines.push('- Sem espacos')
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Redirecionamentos')
    const redirects = isRecord(s.redirects) ? s.redirects : null
    if (redirects) {
      if (redirects.afterSuccess) lines.push(`- Depois do sucesso: ${redirects.afterSuccess}`)
      if (redirects.afterLogout) lines.push(`- Depois do logout: ${redirects.afterLogout}`)
      if (redirects.unauthenticated) lines.push(`- Nao autenticado: ${redirects.unauthenticated}`)
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')
    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }

  private generateDataContract(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const entityValue = s.entity
    const entityName = typeof entityValue === 'string' ? entityValue : isRecord(entityValue) ? getString(entityValue.name) : ''
    const name = entityName || 'Entidade'
    const lines: string[] = []

    lines.push(`# Contrato: ${name}`)
    lines.push('')
    lines.push('## O que e')
    if (getString(s.description)) {
      lines.push(getString(s.description))
    } else {
      lines.push(`Operacao ${getString(s.operation)} na entidade ${name}.`.trim())
    }
    lines.push('')

    lines.push('## Campos')
    const fields = toRecordArray(s.fields)
    if (fields.length > 0) {
      for (const field of fields) {
        const label = getString(field.label) || getString(field.description)
        const labelText = label ? `: ${label}` : ''
        lines.push(`- ${getString(field.name)} (${getString(field.type)})${labelText}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')

    lines.push('## Regras de validacao')
    const validations = toRecordArray(s.validations)
    if (validations.length > 0) {
      for (const validation of validations) {
        lines.push(`- ${getString(validation.rule)}: ${getString(validation.errorMessage)}`)
      }
    } else {
      lines.push('Nao informado.')
    }
    lines.push('')
    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }

  private formatFeedback(feedback: unknown): string {
    if (!isRecord(feedback)) {
      return ''
    }
    const parts: string[] = []
    if (feedback.visual) parts.push(`visual: ${feedback.visual}`)
    if (feedback.feedback) parts.push(`mensagem: "${feedback.feedback}"`)
    if (feedback.navigate) parts.push(`navegar: ${feedback.navigate}`)
    return parts.join(', ')
  }

  private collectErrorDescriptions(state: Record<string, unknown>): string[] {
    const errors: string[] = []
    const behaviors = toRecordArray(state.behaviors)
    for (const behavior of behaviors) {
      if (behavior.onError) {
        const formatted = this.formatFeedback(behavior.onError)
        if (formatted) {
          errors.push(formatted)
        }
      }
    }
    const messages = isRecord(state.messages) ? state.messages : null
    const errorsRecord = messages && isRecord(messages.errors) ? messages.errors : null
    if (errorsRecord) {
      for (const value of Object.values(errorsRecord)) {
        errors.push(String(value))
      }
    }
    return errors
  }

  private buildVisualSummary(name: string, state: Record<string, unknown>): string[] {
    const lines: string[] = []
    const behaviors = toRecordArray(state.behaviors)
    const visualStates = this.normalizeStates(state)

    const firstBehavior = behaviors[0] ?? {}
    const trigger = getString(firstBehavior.trigger) || 'acao'
    const onSuccess = isRecord(firstBehavior.onSuccess) ? firstBehavior.onSuccess : null
    const onError = isRecord(firstBehavior.onError) ? firstBehavior.onError : null
    const success = getString(onSuccess?.feedback) || getString(onSuccess?.visual)
    const error = getString(onError?.feedback) || getString(onError?.visual)

    lines.push(`[usuario] --${trigger}--> [${name}]`)
    if (success) {
      lines.push(`           |-- ok --> ${success}`)
    }
    if (error) {
      lines.push(`           |-- erro -> ${error}`)
    }

    if (visualStates.length > 0) {
      lines.push('')
      lines.push('Estados:')
      for (const st of visualStates) {
        lines.push(`- ${st.state}`)
      }
    }

    return lines
  }

  private normalizeStates(state: Record<string, unknown>): VisualState[] {
    const visualStates = state.visualStates
    const states = state.states

    if (Array.isArray(visualStates)) {
      return this.normalizeStateArray(visualStates)
    }
    if (Array.isArray(states)) {
      return this.normalizeStateArray(states)
    }
    if (isRecord(visualStates)) {
      return Object.entries(visualStates).map(([key, value]) => {
        const record = isRecord(value) ? value : null
        return {
          state: key,
          description: getString(record?.description) || getString(record?.effect) || undefined,
        }
      })
    }
    return []
  }

  private normalizeStateArray(values: unknown[]): VisualState[] {
    return toRecordArray(values).map((value) => ({
      state: getString(value.state),
      description: getString(value.description) || getString(value.effect) || undefined,
      condition: getString(value.condition) || undefined,
      cssIndicators: Array.isArray(value.cssIndicators)
        ? value.cssIndicators.filter((entry) => typeof entry === 'string')
        : undefined,
      icon: getString(value.icon) || undefined,
      duration: getString(value.duration) || undefined,
    }))
  }

  private normalizeParamEntries(value: unknown): ParamEntry[] {
    if (Array.isArray(value)) {
      return toRecordArray(value).map((param) => ({
        name: getString(param.name),
        type: getString(param.type) || 'string',
        required: param.required === true,
        default: param.default,
      }))
    }
    if (isRecord(value)) {
      return Object.entries(value).map(([name, config]) => {
        const record = isRecord(config) ? config : null
        return {
          name,
          type: getString(record?.type) || 'string',
          required: record?.required === true,
          default: record?.default,
        }
      })
    }
    return []
  }

  /**
   * T156, T159: Generate structured contract markdown from Contract object.
   * This includes clause IDs, normativity, and assertion surface information.
   */
  generateStructuredContract(contract: Contract): string {
    const lines: string[] = []

    // Header
    lines.push(`# ${contract.title}`)
    lines.push('')
    lines.push(`**Slug:** \`${contract.slug}\``)
    lines.push(`**Mode:** ${contract.mode}`)
    lines.push(`**Change Type:** ${contract.changeType}`)
    if (contract.criticality) {
      lines.push(`**Criticality:** ${contract.criticality}`)
    }
    if (contract.scope) {
      lines.push(`**Scope:** ${contract.scope}`)
    }
    lines.push('')

    // Target Artifacts
    lines.push('## Target Artifacts')
    lines.push('')
    for (const artifact of contract.targetArtifacts) {
      lines.push(`- \`${artifact}\``)
    }
    lines.push('')

    // Owners
    if (contract.owners && contract.owners.length > 0) {
      lines.push('## Owners')
      lines.push('')
      for (const owner of contract.owners) {
        lines.push(`- ${owner}`)
      }
      lines.push('')
    }

    // Clauses
    lines.push('## Contract Clauses')
    lines.push('')
    for (const clause of contract.clauses) {
      // Clause header with ID and normativity (T160)
      lines.push(`### ${clause.id} - ${clause.title}`)
      lines.push('')
      lines.push(`**Kind:** ${clause.kind}`)
      lines.push(`**Normativity:** ${clause.normativity}`) // T160
      lines.push(`**Observables:** ${clause.observables.join(', ')}`)
      lines.push('')

      // Specification
      lines.push('**Specification:**')
      lines.push('')
      lines.push(clause.spec)
      lines.push('')

      // Preconditions (when)
      if (clause.when && clause.when.length > 0) {
        lines.push('**Preconditions:**')
        lines.push('')
        for (const condition of clause.when) {
          lines.push(`- ${condition}`)
        }
        lines.push('')
      }

      // Inputs
      if (clause.inputs && Object.keys(clause.inputs).length > 0) {
        lines.push('**Inputs:**')
        lines.push('')
        for (const [key, value] of Object.entries(clause.inputs)) {
          lines.push(`- \`${key}\`: ${value}`)
        }
        lines.push('')
      }

      // Outputs
      if (clause.outputs && Object.keys(clause.outputs).length > 0) {
        lines.push('**Outputs:**')
        lines.push('')
        for (const [key, value] of Object.entries(clause.outputs)) {
          lines.push(`- \`${key}\`: ${value}`)
        }
        lines.push('')
      }

      // Negative Cases
      if (clause.negativeCases && clause.negativeCases.length > 0) {
        lines.push('**Negative Cases:**')
        lines.push('')
        for (const negativeCase of clause.negativeCases) {
          lines.push(`- ${negativeCase}`)
        }
        lines.push('')
      }

      // Tags
      if (clause.tags && clause.tags.length > 0) {
        lines.push(`**Tags:** ${clause.tags.join(', ')}`)
        lines.push('')
      }

      // Notes
      if (clause.notes) {
        lines.push('**Notes:**')
        lines.push('')
        lines.push(clause.notes)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }

    // Metadata
    lines.push('## Metadata')
    lines.push('')
    lines.push(`**Schema Version:** ${contract.schemaVersion}`)
    if (contract.createdAt) {
      lines.push(`**Created At:** ${contract.createdAt}`)
    }
    if (contract.elicitorVersion) {
      lines.push(`**Elicitor Version:** ${contract.elicitorVersion}`)
    }
    if (contract.inputsHash) {
      lines.push(`**Inputs Hash:** ${contract.inputsHash}`)
    }
    lines.push('')

    // Tag Convention (T174)
    lines.push('## Test Tag Convention')
    lines.push('')
    lines.push('Use the following format to map tests to clauses:')
    lines.push('')
    lines.push('```typescript')
    lines.push('// @clause CL-<TYPE>-<SEQUENCE>')
    lines.push('test("test description", () => {')
    lines.push('  // test implementation')
    lines.push('})')
    lines.push('```')
    lines.push('')
    lines.push('**Example:**')
    lines.push('')
    lines.push('```typescript')
    if (contract.clauses.length > 0) {
      lines.push(`// @clause ${contract.clauses[0].id}`)
      lines.push(`test("${contract.clauses[0].title}", () => {`)
    } else {
      lines.push('// @clause CL-EXAMPLE-001')
      lines.push('test("example test", () => {')
    }
    lines.push('  // test implementation')
    lines.push('})')
    lines.push('```')
    lines.push('')

    lines.push('---')
    lines.push(FOOTER)

    return lines.join('\n')
  }
}
