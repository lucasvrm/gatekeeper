import { minimatch } from 'minimatch'
import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const DangerModeExplicitValidator: ValidatorDefinition = {
  code: 'DANGER_MODE_EXPLICIT',
  name: 'Danger Mode Explicit',
  description: 'Exige arquivo sensível se dangerMode ativado',
  gate: 0,
  order: 5,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.dangerMode) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'Danger mode not enabled',
      }
    }

    if (!ctx.manifest) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Danger mode enabled but no manifest provided',
      }
    }

    let hasSensitiveFile = false

    for (const file of ctx.manifest.files) {
      for (const pattern of ctx.sensitivePatterns) {
        if (minimatch(file.path, pattern)) {
          hasSensitiveFile = true
          break
        }
      }
      if (hasSensitiveFile) break
    }

    if (!hasSensitiveFile) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'Danger mode enabled but no sensitive files in manifest (unnecessary)',
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Danger mode correctly enabled for sensitive files',
    }
  },
}
