import { ElicitationState, TaskType } from '../types/elicitor.types.js'
import { CompletenessResult, MissingField } from './types.js'

export interface ICompletenessChecker {
  validate(state: ElicitationState, taskType: TaskType): CompletenessResult
  getSuggestedQuestion(state: ElicitationState, taskType: TaskType): string | null
  getMissingFieldsByPriority(state: ElicitationState, taskType: TaskType): MissingField[]
}
