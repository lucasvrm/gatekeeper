import { ElicitationState, TaskType } from '../types/elicitor.types.js'

export interface IGenerator<T> {
  generate(state: ElicitationState, taskType: TaskType): T
}

export interface GeneratorContext {
  outputId: string
  projectPath: string
  outputDir: string
  taskType: TaskType
  state: ElicitationState
}
