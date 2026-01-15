import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const TaskScopeSizeValidator: ValidatorDefinition = {
  code: 'TASK_SCOPE_SIZE',
  name: 'Task Scope Size',
  description: 'Verifica se o escopo da tarefa é adequado',
  gate: 0,
  order: 2,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided',
      }
    }

    const maxFiles = parseInt(ctx.config.get('MAX_FILES_PER_TASK') || '10')
    const fileCount = ctx.manifest.files.length

    if (fileCount > maxFiles) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Task scope too large: ${fileCount} files > ${maxFiles} max`,
        metrics: {
          fileCount,
          maxFiles,
          exceedsBy: fileCount - maxFiles,
        },
        evidence: `Files in manifest: ${fileCount}\nMax allowed: ${maxFiles}\nExceeds by: ${fileCount - maxFiles}`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: `Task scope OK: ${fileCount} / ${maxFiles} files`,
      metrics: {
        fileCount,
        maxFiles,
      },
    }
  },
}
