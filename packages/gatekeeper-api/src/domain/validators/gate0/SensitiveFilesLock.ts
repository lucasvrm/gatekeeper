import { minimatch } from 'minimatch'
import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const SensitiveFilesLockValidator: ValidatorDefinition = {
  code: 'SENSITIVE_FILES_LOCK',
  name: 'Sensitive Files Lock',
  description: 'Bloqueia modificação de arquivos sensíveis',
  gate: 0,
  order: 4,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided',
      }
    }

    if (ctx.dangerMode) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'Danger mode enabled - sensitive file lock bypassed',
      }
    }

    const blockedFiles: string[] = []

    for (const file of ctx.manifest.files) {
      for (const pattern of ctx.sensitivePatterns) {
        if (minimatch(file.path, pattern)) {
          blockedFiles.push(file.path)
          break
        }
      }
    }

    if (blockedFiles.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Sensitive files detected: ${blockedFiles.length} file(s)`,
        details: {
          blockedFiles,
          patterns: ctx.sensitivePatterns,
        },
        evidence: `Blocked files:\n${blockedFiles.map((f) => `  - ${f}`).join('\n')}\n\nTo modify these files, enable danger mode.`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'No sensitive files in manifest',
    }
  },
}
