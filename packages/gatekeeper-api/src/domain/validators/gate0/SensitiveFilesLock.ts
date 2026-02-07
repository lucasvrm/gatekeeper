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
    if (!ctx.microplan || !ctx.microplan.files) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No microplan provided',
        context: {
          inputs: [
            { label: 'Microplan Files', value: [] },
            { label: 'Sensitive Patterns', value: ctx.sensitivePatterns },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: microplan not provided' }],
          reasoning: 'Sensitive file checks require a microplan.',
        },
      }
    }

    if (ctx.dangerMode) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'Danger mode enabled - sensitive file lock bypassed',
        context: {
          inputs: [
            { label: 'Microplan Files', value: ctx.microplan.files.map((file) => file.path) },
            { label: 'Sensitive Patterns', value: ctx.sensitivePatterns },
          ],
          analyzed: [{ label: 'Files Checked', items: ctx.microplan.files.map((file) => file.path) }],
          findings: [{ type: 'info', message: 'Danger mode enabled; sensitive file lock bypassed' }],
          reasoning: 'Danger mode allows modifying files that match sensitive patterns.',
        },
      }
    }

    const blockedFiles: string[] = []
    const microplanFiles = ctx.microplan.files.map((file) => file.path)

    for (const file of ctx.microplan.files) {
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
        context: {
          inputs: [
            { label: 'Microplan Files', value: microplanFiles },
            { label: 'Sensitive Patterns', value: ctx.sensitivePatterns },
          ],
          analyzed: [{ label: 'Files Checked', items: microplanFiles }],
          findings: [
            ...blockedFiles.map((file) => ({
              type: 'fail' as const,
              message: `File ${file} matches sensitive pattern`,
              location: file,
            })),
          ],
          reasoning: `Detected ${blockedFiles.length} sensitive file(s) in microplan without danger mode.`,
        },
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
      message: 'No sensitive files in microplan',
      context: {
        inputs: [
          { label: 'Microplan Files', value: microplanFiles },
          { label: 'Sensitive Patterns', value: ctx.sensitivePatterns },
        ],
        analyzed: [{ label: 'Files Checked', items: microplanFiles }],
        findings: [{ type: 'pass', message: 'No microplan files match sensitive patterns' }],
        reasoning: 'No sensitive file patterns matched microplan files.',
      },
    }
  },
}
