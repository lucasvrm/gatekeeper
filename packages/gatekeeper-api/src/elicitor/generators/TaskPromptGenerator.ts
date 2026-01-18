import { IGenerator } from './IGenerator.js'
import { ElicitationState, TaskType } from '../types/elicitor.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

type VisualState = {
  state: string
  description?: string
  condition?: string
  cssIndicators?: string[]
  icon?: string
  duration?: string
}

export class TaskPromptGenerator implements IGenerator<string> {
  generate(state: ElicitationState, taskType: TaskType): string {
    let basePrompt: string

    switch (taskType) {
      case TaskType.UI_COMPONENT:
        basePrompt = this.generateUIComponentPrompt(state)
        break
      case TaskType.API_ENDPOINT:
        basePrompt = this.generateAPIEndpointPrompt(state)
        break
      case TaskType.FEATURE:
        basePrompt = this.generateFeaturePrompt(state)
        break
      case TaskType.AUTH:
        basePrompt = this.generateAuthPrompt(state)
        break
      case TaskType.DATA:
        basePrompt = this.generateDataPrompt(state)
        break
      default:
        throw new Error(`Unsupported task type: ${taskType}`)
    }

    // T159: Append clause information for traceability when clauses exist
    return this.appendClauseInformation(basePrompt, state)
  }

  private generateUIComponentPrompt(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Component'
    const description = getString(s.description) || ''
    const lines: string[] = []

    lines.push(`Create a UI component: ${name}`)
    if (description) {
      lines.push(`\nDescription: ${description}`)
    }

    const visualStates = this.normalizeStateArray(
      Array.isArray(s.visualStates) ? s.visualStates : []
    )
    if (visualStates.length > 0) {
      lines.push('\nVisual States:')
      for (const st of visualStates) {
        const desc = st.description ? `: ${st.description}` : ''
        lines.push(`- ${st.state}${desc}`)
      }
    }

    const behaviors = toRecordArray(s.behaviors)
    if (behaviors.length > 0) {
      lines.push('\nBehaviors:')
      for (const behavior of behaviors) {
        lines.push(
          `- When ${getString(behavior.trigger)}, ${getString(behavior.action)}`
        )
      }
    }

    const acceptanceCriteria = this.formatAcceptanceCriteria(s.acceptanceCriteria)
    if (acceptanceCriteria.length > 0) {
      lines.push('\nAcceptance Criteria:')
      lines.push(...acceptanceCriteria)
    }

    return lines.join('\n')
  }

  private generateAPIEndpointPrompt(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const method = getString(s.method) || 'GET'
    const path = getString(s.path) || '/api/endpoint'
    const description = getString(s.description) || ''
    const lines: string[] = []

    lines.push(`Create API endpoint: ${method} ${path}`)
    if (description) {
      lines.push(`\nDescription: ${description}`)
    }

    const acceptanceCriteria = this.formatAcceptanceCriteria(s.acceptanceCriteria)
    if (acceptanceCriteria.length > 0) {
      lines.push('\nAcceptance Criteria:')
      lines.push(...acceptanceCriteria)
    }

    return lines.join('\n')
  }

  private generateFeaturePrompt(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Feature'
    const description = getString(s.description) || ''
    const lines: string[] = []

    lines.push(`Implement feature: ${name}`)
    if (description) {
      lines.push(`\nDescription: ${description}`)
    }

    const acceptanceCriteria = this.formatAcceptanceCriteria(s.acceptanceCriteria)
    if (acceptanceCriteria.length > 0) {
      lines.push('\nAcceptance Criteria:')
      lines.push(...acceptanceCriteria)
    }

    return lines.join('\n')
  }

  private generateAuthPrompt(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Authentication'
    const description = getString(s.description) || ''
    const lines: string[] = []

    lines.push(`Implement authentication: ${name}`)
    if (description) {
      lines.push(`\nDescription: ${description}`)
    }

    const acceptanceCriteria = this.formatAcceptanceCriteria(s.acceptanceCriteria)
    if (acceptanceCriteria.length > 0) {
      lines.push('\nAcceptance Criteria:')
      lines.push(...acceptanceCriteria)
    }

    return lines.join('\n')
  }

  private generateDataPrompt(state: ElicitationState): string {
    const s = state as unknown as Record<string, unknown>
    const name = getString(s.name) || 'Data Model'
    const description = getString(s.description) || ''
    const lines: string[] = []

    lines.push(`Implement data model: ${name}`)
    if (description) {
      lines.push(`\nDescription: ${description}`)
    }

    const acceptanceCriteria = this.formatAcceptanceCriteria(s.acceptanceCriteria)
    if (acceptanceCriteria.length > 0) {
      lines.push('\nAcceptance Criteria:')
      lines.push(...acceptanceCriteria)
    }

    return lines.join('\n')
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

  private formatAcceptanceCriteria(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    const lines: string[] = []
    for (const entry of value) {
      if (typeof entry === 'string') {
        const text = entry.trim()
        if (text) {
          lines.push(`- ${text}`)
        }
        continue
      }

      if (isRecord(entry)) {
        const text =
          getString(entry.text) ||
          getString(entry.value) ||
          getString(entry.criterion) ||
          getString(entry.description) ||
          ''
        if (text) {
          lines.push(`- ${text}`)
        }
      }
    }

    return lines
  }

  /**
   * T159: Append clause information to task prompt for traceability.
   * Includes clause IDs so test writers know which clauses to tag.
   */
  private appendClauseInformation(basePrompt: string, state: ElicitationState): string {
    if (!state.clauses || state.clauses.length === 0) {
      return basePrompt
    }

    const lines: string[] = [basePrompt, '']

    lines.push('\nContract Clauses (for test mapping):')
    lines.push('')

    for (const clause of state.clauses) {
      const clauseId = clause.id || '(ID will be generated)'
      lines.push(`- ${clauseId}: ${clause.title}`)
      lines.push(`  ${clause.normativity} ${clause.kind}`)
      lines.push(`  Spec: ${clause.spec.slice(0, 100)}${clause.spec.length > 100 ? '...' : ''}`)
      lines.push('')
    }

    lines.push('Test Tag Convention:')
    lines.push('Use // @clause <CLAUSE_ID> before each test to map it to a clause.')
    lines.push('')
    lines.push('Example:')
    lines.push(`// @clause ${state.clauses[0]?.id || 'CL-EXAMPLE-001'}`)
    lines.push(`test('${state.clauses[0]?.title || 'example test'}', () => {`)
    lines.push('  // test implementation')
    lines.push('})')

    return lines.join('\n')
  }
}
