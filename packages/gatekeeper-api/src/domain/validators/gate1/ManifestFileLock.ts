import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const ManifestFileLockValidator: ValidatorDefinition = {
  code: 'MANIFEST_FILE_LOCK',
  name: 'Manifest File Lock',
  description: 'Verifica integridade do manifesto',
  gate: 1,
  order: 7,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No manifest provided',
        evidence: 'Manifest is required for validation',
        context: {
          inputs: [{ label: 'Manifest', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest not provided' }],
          reasoning: 'Manifest is required to validate scope and file integrity.',
        },
      }
    }

    const issues: string[] = []
    const manifestFiles = ctx.manifest.files?.map((file) => file.path) ?? []

    if (!ctx.manifest.files || !Array.isArray(ctx.manifest.files)) {
      issues.push('Manifest.files must be an array')
    } else if (ctx.manifest.files.length === 0) {
      issues.push('Manifest.files cannot be empty')
    } else {
      for (let i = 0; i < ctx.manifest.files.length; i++) {
        const file = ctx.manifest.files[i]
        
        if (!file.path || typeof file.path !== 'string' || file.path.trim() === '') {
          issues.push(`File at index ${i} has invalid or empty path`)
        } else {
          if (file.path.includes('*') || file.path.includes('?')) {
            issues.push(`File path "${file.path}" contains glob patterns (not allowed)`)
          }
          
          if (/\betc\b|\bother\b|\.{3,}/.test(file.path.toLowerCase())) {
            issues.push(`File path "${file.path}" contains vague references (etc, other, ...)`)
          }
        }
        
        if (!file.action || !['CREATE', 'MODIFY', 'DELETE'].includes(file.action)) {
          issues.push(`File "${file.path}" has invalid action: "${file.action}"`)
        }
        
        if (file.reason !== undefined && (typeof file.reason !== 'string' || file.reason.trim() === '')) {
          issues.push(`File "${file.path}" has empty or invalid reason`)
        }
      }
    }

    if (!ctx.manifest.testFile || typeof ctx.manifest.testFile !== 'string' || ctx.manifest.testFile.trim() === '') {
      issues.push('Manifest.testFile must be a non-empty string')
    } else {
      if (ctx.manifest.testFile.includes('*') || ctx.manifest.testFile.includes('?')) {
        issues.push(`Test file path "${ctx.manifest.testFile}" contains glob patterns (not allowed)`)
      }
      
      if (!/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(ctx.manifest.testFile)) {
        issues.push(`Test file "${ctx.manifest.testFile}" must have .test or .spec extension`)
      }
    }

    if (issues.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Manifest has ${issues.length} integrity issue(s)`,
        context: {
          inputs: [{ label: 'Manifest', value: ctx.manifest }],
          analyzed: [{ label: 'Files', items: [...manifestFiles, ctx.manifest.testFile] }],
          findings: issues.map((issue) => ({ type: 'fail' as const, message: issue })),
          reasoning: 'Manifest contains structural or value issues that must be fixed.',
        },
        evidence: `Manifest problems:\n${issues.map(i => `  - ${i}`).join('\n')}`,
        details: {
          issues,
          manifestFileCount: ctx.manifest.files?.length || 0,
        },
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'Manifest structure is valid',
      context: {
        inputs: [{ label: 'Manifest', value: ctx.manifest }],
        analyzed: [{ label: 'Files', items: [...manifestFiles, ctx.manifest.testFile] }],
        findings: [{ type: 'pass', message: 'Manifest structure is valid' }],
        reasoning: 'Manifest files and testFile paths are valid and explicit.',
      },
      metrics: {
        fileCount: ctx.manifest.files.length,
        createCount: ctx.manifest.files.filter(f => f.action === 'CREATE').length,
        modifyCount: ctx.manifest.files.filter(f => f.action === 'MODIFY').length,
        deleteCount: ctx.manifest.files.filter(f => f.action === 'DELETE').length,
      },
    }
  },
}
