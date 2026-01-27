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
        context: {
          inputs: [
            { label: 'Manifest', value: 'none' },
            { label: 'BaseRef', value: ctx.baseRef },
            { label: 'TargetRef', value: ctx.targetRef },
          ],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest not provided' }],
          reasoning: 'Diff scope cannot be validated without a manifest.',
        },
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
        context: {
          inputs: [
            { label: 'Manifest', value: ctx.manifest },
            { label: 'BaseRef', value: ctx.baseRef },
            { label: 'TargetRef', value: ctx.targetRef },
          ],
          analyzed: [{ label: 'Diff Files', items: diffFiles }],
          findings: violations.map((file) => ({
            type: 'fail' as const,
            message: `${file} not declared in manifest`,
            location: file,
          })),
          reasoning: 'Diff contains files outside the manifest scope.',
        },
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
      context: {
        inputs: [
          { label: 'Manifest', value: ctx.manifest },
          { label: 'BaseRef', value: ctx.baseRef },
          { label: 'TargetRef', value: ctx.targetRef },
        ],
        analyzed: [{ label: 'Diff Files', items: diffFiles }],
        findings: [{ type: 'pass', message: 'All diff files declared in manifest' }],
        reasoning: 'Every file in the diff is listed in the manifest.',
      },
      metrics: {
        diffFileCount: diffFiles.length,
        manifestFileCount: ctx.manifest.files.length,
      },
    }
  },
}
