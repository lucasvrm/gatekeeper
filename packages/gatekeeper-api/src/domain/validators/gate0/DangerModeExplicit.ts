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
        context: {
          inputs: [
            { label: 'DangerMode', value: false },
            { label: 'Sensitive Files Detected', value: 0 },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: danger mode not enabled' }],
          reasoning: 'Danger mode is disabled, so explicit sensitive-file justification is not required.',
        },
      }
    }

    if (!ctx.manifest) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Danger mode enabled but no manifest provided',
        context: {
          inputs: [
            { label: 'DangerMode', value: true },
            { label: 'Sensitive Files Detected', value: 0 },
          ],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest missing while danger mode is enabled' }],
          reasoning: 'Danger mode requires a manifest to confirm sensitive files are explicitly listed.',
        },
      }
    }

    let hasSensitiveFile = false
    let sensitiveCount = 0

    for (const file of ctx.manifest.files) {
      for (const pattern of ctx.sensitivePatterns) {
        if (minimatch(file.path, pattern)) {
          hasSensitiveFile = true
          sensitiveCount++
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
        context: {
          inputs: [
            { label: 'DangerMode', value: true },
            { label: 'Sensitive Files Detected', value: 0 },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: no sensitive files detected in manifest' }],
          reasoning: 'Danger mode is enabled but no sensitive files were detected in the manifest.',
        },
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Danger mode correctly enabled for sensitive files',
      context: {
        inputs: [
          { label: 'DangerMode', value: true },
          { label: 'Sensitive Files Detected', value: sensitiveCount },
        ],
        analyzed: [],
        findings: [{ type: 'pass', message: 'Danger mode enabled for sensitive file access' }],
        reasoning: 'Danger mode is enabled and sensitive files were detected in the manifest.',
      },
    }
  },
}
