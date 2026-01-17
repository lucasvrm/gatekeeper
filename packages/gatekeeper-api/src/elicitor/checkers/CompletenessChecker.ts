import { ICompletenessChecker } from './ICompletenessChecker.js'
import {
  CompletenessResult,
  FieldDefinition,
  FieldPriority,
  FieldScore,
  ICompletenessRules,
  MissingField,
  ScoreBreakdown,
} from './types.js'
import { ElicitationState, TaskType } from '../types/elicitor.types.js'
import { APIEndpointRules } from './rules/APIEndpointRules.js'
import { AuthRules } from './rules/AuthRules.js'
import { DataRules } from './rules/DataRules.js'
import { FeatureRules } from './rules/FeatureRules.js'
import { UIComponentRules } from './rules/UIComponentRules.js'

export class CompletenessChecker implements ICompletenessChecker {
  private rules: Map<TaskType, ICompletenessRules> = new Map()

  constructor() {
    this.rules.set(TaskType.UI_COMPONENT, new UIComponentRules())
    this.rules.set(TaskType.API_ENDPOINT, new APIEndpointRules())
    this.rules.set(TaskType.FEATURE, new FeatureRules())
    this.rules.set(TaskType.AUTH, new AuthRules())
    this.rules.set(TaskType.DATA, new DataRules())
  }

  validate(state: ElicitationState, taskType: TaskType): CompletenessResult {
    const rules = this.getRules(taskType)
    const fields = rules.getFieldDefinitions()

    const fieldScores: Record<string, FieldScore> = {}
    const missingFields: MissingField[] = []
    const warnings: string[] = []

    let totalWeight = 0
    let achievedWeight = 0
    let criticalTotal = 0
    let criticalAchieved = 0
    let importantTotal = 0
    let importantAchieved = 0
    let optionalTotal = 0
    let optionalAchieved = 0

    for (const field of fields) {
      const value = this.getValueByPath(state as unknown as Record<string, unknown>, field.path)
      const result = field.validator(value, state)
      const weightedScore = (result.score / 100) * field.weight

      fieldScores[field.name] = {
        name: field.name,
        score: result.score,
        weight: field.weight,
        weightedScore,
        isFilled: result.isFilled,
        message: result.message,
      }

      totalWeight += field.weight
      achievedWeight += weightedScore

      switch (field.priority) {
        case FieldPriority.CRITICAL:
          criticalTotal += field.weight
          criticalAchieved += weightedScore
          break
        case FieldPriority.IMPORTANT:
          importantTotal += field.weight
          importantAchieved += weightedScore
          break
        case FieldPriority.OPTIONAL:
          optionalTotal += field.weight
          optionalAchieved += weightedScore
          break
      }

      if (!result.isFilled && field.priority !== FieldPriority.OPTIONAL) {
        missingFields.push({
          name: field.name,
          path: field.path,
          priority: field.priority,
          description: field.description,
          suggestedQuestion: this.generateQuestion(field),
        })
      }

      if (result.isFilled && !result.isValid && result.message) {
        warnings.push(`${field.name}: ${result.message}`)
      }
    }

    const completenessScore = totalWeight > 0
      ? Math.round((achievedWeight / totalWeight) * 100)
      : 0

    const breakdown: ScoreBreakdown = {
      criticalScore: criticalTotal > 0 ? Math.round((criticalAchieved / criticalTotal) * 100) : 100,
      importantScore: importantTotal > 0 ? Math.round((importantAchieved / importantTotal) * 100) : 100,
      optionalScore: optionalTotal > 0 ? Math.round((optionalAchieved / optionalTotal) * 100) : 100,
      totalWeight,
      achievedWeight,
    }

    const criticalOk = breakdown.criticalScore >= 80

    return {
      isComplete: completenessScore >= rules.minScoreComplete,
      canGenerate: completenessScore >= rules.minScoreToGenerate && criticalOk,
      completenessScore,
      missingFields: missingFields.sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority)),
      warnings,
      fieldScores,
      breakdown,
    }
  }

  getSuggestedQuestion(state: ElicitationState, taskType: TaskType): string | null {
    const result = this.validate(state, taskType)
    if (result.missingFields.length === 0) {
      return null
    }

    return result.missingFields[0].suggestedQuestion || null
  }

  getMissingFieldsByPriority(state: ElicitationState, taskType: TaskType): MissingField[] {
    return this.validate(state, taskType).missingFields
  }

  private getRules(taskType: TaskType): ICompletenessRules {
    const rules = this.rules.get(taskType)
    if (!rules) {
      throw new Error(`No rules defined for task type: ${taskType}`)
    }
    return rules
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined
      }

      if (typeof current !== 'object') {
        return undefined
      }

      const record = current as Record<string, unknown>
      const arrayMatch = part.match(/^(\w+)\[\]$/)
      if (arrayMatch) {
        const arrayName = arrayMatch[1]
        current = record[arrayName]
        continue
      }

      current = record[part]
    }

    return current
  }

  private priorityOrder(priority: FieldPriority): number {
    switch (priority) {
      case FieldPriority.CRITICAL:
        return 0
      case FieldPriority.IMPORTANT:
        return 1
      case FieldPriority.OPTIONAL:
        return 2
      default:
        return 3
    }
  }

  private generateQuestion(field: FieldDefinition): string {
    const templates: Record<string, string> = {
      'Nome do Componente': 'Como você chamaria esse componente?',
      'Comportamento Principal': 'O que deve acontecer quando o usuário interagir?',
      'Props': 'Quais informações o componente precisa receber?',
      'Estado Default': 'Como o componente deve aparecer normalmente?',
      'Tratamento de Erro': 'O que deve acontecer se der erro?',
      'Feedback de Sucesso': 'Como o usuário sabe que funcionou?',
      'Método HTTP': 'Qual tipo de operação? (buscar, criar, atualizar, deletar)',
      'Path do Endpoint': 'Qual o caminho da API?',
      'User Story': 'Quem vai usar e o que quer conseguir fazer?',
      'Fluxo Principal': 'Descreva passo a passo o que acontece quando tudo dá certo.',
    }

    return templates[field.name] || `Defina: ${field.description}`
  }
}
