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
        context: {
          inputs: [{ label: 'Manifest', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: manifest not provided' }],
          reasoning: 'Task scope size cannot be evaluated without a manifest.',
        },
      }
    }

    const maxFiles = parseInt(ctx.config.get('MAX_FILES_PER_TASK') || '10')
    const fileCount = ctx.manifest.files.length
    const manifestFiles = ctx.manifest.files.map((file) => file.path)

    if (fileCount > maxFiles) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Task scope too large: ${fileCount} files > ${maxFiles} max`,
        context: {
          inputs: [{ label: 'Manifest', value: { files: fileCount, testFile: ctx.manifest.testFile } }],
          analyzed: [{ label: 'Files List', items: manifestFiles }],
          findings: [{ type: 'fail', message: `Manifest has ${fileCount} files, exceeds max ${maxFiles}` }],
          reasoning: `Manifest lists ${fileCount} files, exceeding configured maximum ${maxFiles}.`,
        },
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
      context: {
        inputs: [{ label: 'Manifest', value: { files: fileCount, testFile: ctx.manifest.testFile } }],
        analyzed: [{ label: 'Files List', items: manifestFiles }],
        findings: [{ type: 'pass', message: `Manifest has ${fileCount} files within limit ${maxFiles}` }],
        reasoning: `Manifest lists ${fileCount} files, within configured maximum ${maxFiles}.`,
      },
      metrics: {
        fileCount,
        maxFiles,
      },
    }
  },
}
