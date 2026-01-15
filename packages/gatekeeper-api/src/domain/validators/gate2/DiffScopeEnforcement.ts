import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'

export const DiffScopeEnforcementValidator: ValidatorDefinition = {
  code: 'DIFF_SCOPE_ENFORCEMENT',
  name: 'Diff Scope Enforcement',
  description: 'Verifica se diff está contido no manifesto',
  gate: 2,
  order: 1,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No manifest provided',
      }
    }

    const diffFiles = await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
    const manifestPaths = new Set(ctx.manifest.files.map((f) => f.path))
    
    const violations: string[] = []

    for (const diffFile of diffFiles) {
      if (!manifestPaths.has(diffFile)) {
        violations.push(diffFile)
      }
    }

    if (violations.length > 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Diff contains files not in manifest: ${violations.length} file(s)`,
        details: {
          violations,
          violationCount: violations.length,
          diffFileCount: diffFiles.length,
          manifestFileCount: ctx.manifest.files.length,
        },
        evidence: `Files in diff but not in manifest:\n${violations.map((f) => `  - ${f}`).join('\n')}\n\nAll changed files must be declared in the manifest.`,
      }
    }

    return {
      passed: true,
      status: 'PASSED',
      message: 'All diff files are declared in manifest',
      metrics: {
        diffFileCount: diffFiles.length,
        manifestFileCount: ctx.manifest.files.length,
      },
    }
  },
}
