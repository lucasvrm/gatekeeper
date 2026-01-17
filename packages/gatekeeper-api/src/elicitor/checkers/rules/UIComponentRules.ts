import { FieldDefinition, FieldPriority, ICompletenessRules } from '../types.js'
import { ElicitationState, TaskType } from '../../types/elicitor.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

const getBehaviors = (state: ElicitationState): Array<Record<string, unknown>> => {
  const raw = (state as unknown as Record<string, unknown>).behaviors
  return toRecordArray(raw)
}

const hasFeedback = (entry: unknown): boolean => {
  if (!isRecord(entry)) {
    return false
  }
  return Boolean(entry.feedback) || Boolean(entry.visual)
}

export class UIComponentRules implements ICompletenessRules {
  readonly taskType = TaskType.UI_COMPONENT
  readonly minScoreToGenerate = 70
  readonly minScoreComplete = 90

  readonly fields: FieldDefinition[] = [
    {
      name: 'Nome do Componente',
      path: 'name',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Nome em PascalCase do componente',
      validator: (value) => ({
        isValid: typeof value === 'string' && /^[A-Z][a-zA-Z0-9]*$/.test(value),
        isFilled: !!value,
        score: value ? 100 : 0,
        message: !value ? 'Nome do componente ‚ obrigat¢rio' : undefined,
      }),
    },
    {
      name: 'Comportamento Principal',
      path: 'behaviors',
      priority: FieldPriority.CRITICAL,
      weight: 10,
      description: 'Pelo menos um comportamento (trigger + action)',
      validator: (value) => {
        const behaviors = toRecordArray(value)
        const hasBehavior = behaviors.length > 0
        const hasComplete = hasBehavior && behaviors.some((b) => Boolean(b.trigger) && Boolean(b.action))
        return {
          isValid: hasComplete,
          isFilled: hasBehavior,
          score: hasComplete ? 100 : hasBehavior ? 50 : 0,
          message: !hasBehavior
            ? 'Defina pelo menos um comportamento'
            : !hasComplete
              ? 'Comportamento precisa de trigger e action'
              : undefined,
        }
      },
    },
    {
      name: 'Props',
      path: 'props',
      priority: FieldPriority.IMPORTANT,
      weight: 8,
      description: 'Pelo menos uma prop definida',
      validator: (value) => {
        const props = toRecordArray(value)
        const hasProps = props.length > 0
        const hasNamedProps = hasProps && props.every((p) => Boolean(p.name) && Boolean(p.type))
        return {
          isValid: hasNamedProps,
          isFilled: hasProps,
          score: hasNamedProps ? 100 : hasProps ? 60 : 0,
        }
      },
    },
    {
      name: 'Estado Default',
      path: 'states',
      priority: FieldPriority.IMPORTANT,
      weight: 7,
      description: 'Estado visual padrÆo definido',
      validator: (value) => {
        const states = toRecordArray(value)
        const hasStates = states.length > 0
        const hasDefault = hasStates && states.some((s) => s.state === 'default')
        return {
          isValid: hasDefault,
          isFilled: hasStates,
          score: hasDefault ? 100 : hasStates ? 70 : 0,
        }
      },
    },
    {
      name: 'Tratamento de Erro',
      path: 'behaviors[].onError',
      priority: FieldPriority.IMPORTANT,
      weight: 6,
      description: 'Feedback de erro definido',
      validator: (value, state) => {
        const behaviors = getBehaviors(state)
        if (behaviors.length === 0) {
          return { isValid: false, isFilled: false, score: 0 }
        }

        const hasErrorHandling = behaviors.some((b) => hasFeedback(b.onError))
        return {
          isValid: hasErrorHandling,
          isFilled: hasErrorHandling,
          score: hasErrorHandling ? 100 : 0,
        }
      },
    },
    {
      name: 'Feedback de Sucesso',
      path: 'behaviors[].onSuccess',
      priority: FieldPriority.IMPORTANT,
      weight: 5,
      description: 'Feedback de sucesso definido',
      validator: (value, state) => {
        const behaviors = getBehaviors(state)
        if (behaviors.length === 0) {
          return { isValid: false, isFilled: false, score: 0 }
        }

        const hasSuccessFeedback = behaviors.some((b) => hasFeedback(b.onSuccess))
        return {
          isValid: hasSuccessFeedback,
          isFilled: hasSuccessFeedback,
          score: hasSuccessFeedback ? 100 : 0,
        }
      },
    },
    {
      name: 'Acessibilidade',
      path: 'accessibility',
      priority: FieldPriority.OPTIONAL,
      weight: 5,
      description: 'Role ARIA ou aria-label definido',
      validator: (value) => {
        const a11y = isRecord(value) ? value : null
        const hasA11y = Boolean(a11y && (a11y.role || a11y.ariaLabel))
        const hasKeyboard = Array.isArray(a11y?.keyboard) && a11y.keyboard.length > 0
        return {
          isValid: hasA11y,
          isFilled: !!a11y,
          score: hasA11y && hasKeyboard ? 100 : hasA11y ? 70 : 0,
        }
      },
    },
    {
      name: 'Edge Cases',
      path: 'edgeCases',
      priority: FieldPriority.OPTIONAL,
      weight: 4,
      description: 'Pelo menos 2 edge cases definidos',
      validator: (value) => {
        const cases = toRecordArray(value)
        const count = cases.length
        return {
          isValid: count >= 2,
          isFilled: count > 0,
          score: count >= 2 ? 100 : count === 1 ? 50 : 0,
        }
      },
    },
    {
      name: 'Estado Hover',
      path: 'states',
      priority: FieldPriority.OPTIONAL,
      weight: 3,
      description: 'Comportamento no hover definido',
      validator: (value) => {
        const states = toRecordArray(value)
        const hasHover = states.some((s) => s.state === 'hover')
        return {
          isValid: hasHover,
          isFilled: hasHover,
          score: hasHover ? 100 : 0,
        }
      },
    },
    {
      name: 'Estado Loading',
      path: 'states',
      priority: FieldPriority.OPTIONAL,
      weight: 3,
      description: 'Estado de loading definido (se async)',
      validator: (value, state) => {
        const states = toRecordArray(value)
        const behaviors = getBehaviors(state)

        if (behaviors.length === 0) {
          return { isValid: true, isFilled: false, score: 0 }
        }

        const hasAsync = behaviors.some((b) => {
          const action = typeof b.action === 'string' ? b.action : ''
          return action.includes('await') || action.includes('fetch') || action.includes('api')
        })

        if (!hasAsync) {
          return { isValid: true, isFilled: true, score: 100 }
        }

        const hasLoading = states.some((s) => s.state === 'loading')
        return {
          isValid: hasLoading,
          isFilled: hasLoading,
          score: hasLoading ? 100 : 0,
        }
      },
    },
    {
      name: 'Estado Disabled',
      path: 'states',
      priority: FieldPriority.OPTIONAL,
      weight: 2,
      description: 'Estado disabled definido',
      validator: (value) => {
        const states = toRecordArray(value)
        const hasDisabled = states.some((s) => s.state === 'disabled')
        return {
          isValid: hasDisabled,
          isFilled: hasDisabled,
          score: hasDisabled ? 100 : 0,
        }
      },
    },
  ]

  getFieldDefinitions(): FieldDefinition[] {
    return this.fields
  }

  getRequiredFields(): FieldDefinition[] {
    return this.fields.filter((field) => field.priority === FieldPriority.CRITICAL)
  }

  getOptionalFields(): FieldDefinition[] {
    return this.fields.filter((field) => field.priority === FieldPriority.OPTIONAL)
  }
}
