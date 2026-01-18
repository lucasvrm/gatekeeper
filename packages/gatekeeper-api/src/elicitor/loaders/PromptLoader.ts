import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

import { TaskType } from '../types/elicitor.types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROMPTS_DIR = path.resolve(__dirname, '../prompts')

const schemaMap: Record<TaskType, string> = {
  [TaskType.UI_COMPONENT]: 'UIComponentContract.json',
  [TaskType.API_ENDPOINT]: 'APIEndpointContract.json',
  [TaskType.FEATURE]: 'FeatureContract.json',
  [TaskType.AUTH]: 'AuthContract.json',
  [TaskType.DATA]: 'DataContract.json',
  [TaskType.INTEGRATION]: '',
}

export class PromptLoader {
  private cache: Map<string, string> = new Map()

  async loadSystemPrompt(): Promise<string> {
    return this.loadFile('SYSTEM.md')
  }

  async loadQuestions(taskType: TaskType): Promise<string> {
    return this.loadFile(path.join('questions', `${taskType}.md`))
  }

  async loadDefaults(taskType: TaskType): Promise<Record<string, unknown>> {
    const content = await this.loadFile(path.join('defaults', `${taskType}.json`))
    return JSON.parse(content) as Record<string, unknown>
  }

  async loadSchema(taskType: TaskType): Promise<Record<string, unknown>> {
    const schemaFile = schemaMap[taskType]
    if (!schemaFile) {
      throw new Error(`No schema available for task type: ${taskType}`)
    }
    const content = await this.loadFile(path.join('schemas', schemaFile))
    return JSON.parse(content) as Record<string, unknown>
  }

  async loadFile(relativePath: string): Promise<string> {
    const cached = this.cache.get(relativePath)
    if (cached) {
      return cached
    }

    const fullPath = path.join(PROMPTS_DIR, relativePath)
    const content = await readFile(fullPath, 'utf8')
    this.cache.set(relativePath, content)
    return content
  }

  clearCache(): void {
    this.cache.clear()
  }
}
