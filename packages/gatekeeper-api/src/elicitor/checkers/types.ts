import { ElicitationState, TaskType } from '../types/elicitor.types.js'

export enum FieldPriority {
  CRITICAL = 'CRITICAL',
  IMPORTANT = 'IMPORTANT',
  OPTIONAL = 'OPTIONAL',
}

export interface FieldDefinition {
  name: string
  path: string
  priority: FieldPriority
  weight: number
  description: string
  validator: FieldValidator
  dependsOn?: string[]
}

export type FieldValidator = (value: unknown, state: ElicitationState) => FieldValidationResult

export interface FieldValidationResult {
  isValid: boolean
  isFilled: boolean
  score: number
  message?: string
}

export interface CompletenessResult {
  isComplete: boolean
  canGenerate: boolean
  completenessScore: number
  missingFields: MissingField[]
  warnings: string[]
  fieldScores: Record<string, FieldScore>
  breakdown: ScoreBreakdown
}

export interface MissingField {
  name: string
  path: string
  priority: FieldPriority
  description: string
  suggestedQuestion?: string
}

export interface FieldScore {
  name: string
  score: number
  weight: number
  weightedScore: number
  isFilled: boolean
  message?: string
}

export interface ScoreBreakdown {
  criticalScore: number
  importantScore: number
  optionalScore: number
  totalWeight: number
  achievedWeight: number
}

export interface ICompletenessRules {
  readonly taskType: TaskType
  readonly fields: FieldDefinition[]
  readonly minScoreToGenerate: number
  readonly minScoreComplete: number

  getFieldDefinitions(): FieldDefinition[]
  getRequiredFields(): FieldDefinition[]
  getOptionalFields(): FieldDefinition[]
}
