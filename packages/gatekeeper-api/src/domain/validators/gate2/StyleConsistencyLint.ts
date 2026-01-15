import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { existsSync } from 'fs'
import { resolve } from 'path'

export const StyleConsistencyLintValidator: ValidatorDefinition = {
  code: 'STYLE_CONSISTENCY_LINT',
  name: 'Style Consistency Lint',
  description: 'Verifica conformidade com ESLint',
  gate: 2,
  order: 5,
  isHardBlock: true,
  
  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided, skipping lint check',
      }
    }

    const eslintConfigs = [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc',
    ]

    let hasEslintConfig = false
    for (const config of eslintConfigs) {
      if (existsSync(resolve(ctx.projectPath, config))) {
        hasEslintConfig = true
        break
      }
    }

    if (!hasEslintConfig) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No ESLint configuration found, skipping lint check',
      }
    }

    try {
      const filePaths = ctx.manifest.files
        .filter(f => f.action !== 'DELETE')
        .map(f => f.path)
        .filter(path => /\.(ts|tsx|js|jsx)$/.test(path))

      if (filePaths.length === 0) {
        return {
          passed: true,
          status: 'SKIPPED',
          message: 'No lintable files in manifest',
        }
      }

      const result = await ctx.services.lint.lint(filePaths)

      if (!result.success) {
        return {
          passed: false,
          status: 'FAILED',
          message: `ESLint found ${result.errorCount} error(s) and ${result.warningCount} warning(s)`,
          evidence: result.output.substring(0, 2000),
          details: {
            errorCount: result.errorCount,
            warningCount: result.warningCount,
            filesChecked: filePaths.length,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'All files pass ESLint checks',
        metrics: {
          filesChecked: filePaths.length,
          errorCount: 0,
          warningCount: result.warningCount,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Lint check failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  },
}
