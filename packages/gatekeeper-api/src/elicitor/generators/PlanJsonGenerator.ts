import path from 'node:path'
import { minimatch } from 'minimatch'
import { IGenerator, GeneratorContext } from './IGenerator.js'
import { ElicitationState, ManifestFile, TaskType } from '../types/elicitor.types.js'
import { TaskPromptGenerator } from './TaskPromptGenerator.js'

export interface PlanJson {
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: {
    files: ManifestFile[]
    testFile: string
  }
  testFilePath: string
  dangerMode: boolean
}

const DEFAULT_BASE_REF = 'HEAD~1'
const DEFAULT_TARGET_REF = 'HEAD'

const SENSITIVE_PATTERNS = [
  '.env*',
  '**/.env',
  '**/migrations/**',
  '**/.github/**',
  '**/*.pem',
  '**/*.key',
]

export class PlanJsonGenerator implements IGenerator<PlanJson> {
  private taskPromptGenerator = new TaskPromptGenerator()

  generate(_state: ElicitationState, _taskType: TaskType): PlanJson {
    throw new Error('PlanJsonGenerator requires context. Use generateWithContext(context).')
  }

  generateWithContext(context: GeneratorContext): PlanJson {
    const taskPrompt = this.taskPromptGenerator.generate(context.state, context.taskType)
    const testFilePath = this.generateTestFilePath(context)
    const manifest = this.generateManifest(context.state, testFilePath)
    const dangerMode = this.requiresDangerMode(manifest.files)

    return {
      outputId: context.outputId,
      projectPath: context.projectPath,
      baseRef: DEFAULT_BASE_REF,
      targetRef: DEFAULT_TARGET_REF,
      taskPrompt,
      manifest,
      testFilePath,
      dangerMode,
    }
  }

  private generateManifest(
    state: ElicitationState,
    testFilePath: string
  ): { files: ManifestFile[]; testFile: string } {
    const files = this.getManifestFiles(state)
    return { files, testFile: testFilePath }
  }

  private generateTestFilePath(context: GeneratorContext): string {
    const state = context.state
    const name = typeof state.name === 'string' ? state.name.trim() : ''
    const entityValue = (state as { entity?: string | { name?: string } }).entity
    const entity = typeof entityValue === 'string' ? entityValue : entityValue?.name
    const slugSource = name || entity || context.outputId
    const slug = this.toKebabCase(slugSource)
    const fileName = `${slug}.spec.tsx`
    return path.join(context.outputDir, context.outputId, fileName)
  }

  private requiresDangerMode(files: ManifestFile[]): boolean {
    for (const file of files) {
      for (const pattern of SENSITIVE_PATTERNS) {
        if (minimatch(file.path, pattern, { dot: true })) {
          return true
        }
      }
    }
    return false
  }

  private getManifestFiles(state: ElicitationState): ManifestFile[] {
    const files = state.manifestFiles

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('manifestFiles is required and must be a non-empty array.')
    }

    for (const file of files) {
      if (!file || typeof file.path !== 'string' || file.path.trim() === '') {
        throw new Error('manifestFiles entries must include a non-empty path.')
      }
      if (!file.action || !this.isValidAction(file.action)) {
        throw new Error('manifestFiles entries must include a valid action (CREATE, MODIFY, DELETE).')
      }
      if (file.reason !== undefined && String(file.reason).trim() === '') {
        throw new Error('manifestFiles entries must not include empty reason values.')
      }
    }

    return files
  }

  private isValidAction(action: string): action is ManifestFile['action'] {
    return action === 'CREATE' || action === 'MODIFY' || action === 'DELETE'
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  }
}
