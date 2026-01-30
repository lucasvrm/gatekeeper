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
    const eslintConfigFilesStr = ctx.config.get('ESLINT_CONFIG_FILES')
      || 'eslint.config.js,eslint.config.mjs,eslint.config.cjs,.eslintrc.js,.eslintrc.json,.eslintrc'
    const eslintConfigs = eslintConfigFilesStr
      .split(',')
      .map((config) => config.trim())
      .filter(Boolean)
    const skipIfNoConfig = ctx.config.get('SKIP_LINT_IF_NO_CONFIG') !== 'false'

    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided, skipping lint check',
        context: {
          inputs: [
            { label: 'ESLint Config Files', value: eslintConfigs },
            { label: 'Skip If No Config', value: skipIfNoConfig },
          ],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: manifest not provided' }],
          reasoning: 'Linting requires a manifest to determine which files to check.',
        },
        details: {
          eslintConfigs,
          skipIfNoConfig,
        },
      }
    }

    let hasEslintConfig = false
    for (const config of eslintConfigs) {
      if (existsSync(resolve(ctx.projectPath, config))) {
        hasEslintConfig = true
        break
      }
    }

    if (!hasEslintConfig) {
      if (skipIfNoConfig) {
        return {
          passed: true,
          status: 'SKIPPED',
          message: 'No ESLint configuration found, skipping lint check',
          context: {
            inputs: [
              { label: 'ESLint Config Files', value: eslintConfigs },
              { label: 'Skip If No Config', value: skipIfNoConfig },
            ],
            analyzed: [],
            findings: [{ type: 'info', message: 'Skipped: ESLint config not found' }],
            reasoning: 'Linting skipped because no ESLint configuration exists.',
          },
          details: {
            eslintConfigs,
            skipIfNoConfig,
          },
        }
      }
      return {
        passed: false,
        status: 'FAILED',
        message: 'No ESLint configuration found and SKIP_LINT_IF_NO_CONFIG=false',
        context: {
          inputs: [
            { label: 'ESLint Config Files', value: eslintConfigs },
            { label: 'Skip If No Config', value: skipIfNoConfig },
          ],
          analyzed: [],
          findings: [{ type: 'fail', message: 'ESLint config not found' }],
          reasoning: 'Linting cannot proceed without ESLint configuration.',
        },
        details: {
          eslintConfigs,
          skipIfNoConfig,
        },
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
          context: {
            inputs: [
              { label: 'ESLint Config Files', value: eslintConfigs },
              { label: 'Skip If No Config', value: skipIfNoConfig },
            ],
            analyzed: [{ label: 'Files Linted', items: [] }],
            findings: [{ type: 'info', message: 'Skipped: no lintable files found' }],
            reasoning: 'Manifest contains no JS/TS files to lint.',
          },
          details: {
            eslintConfigs,
            skipIfNoConfig,
          },
        }
      }

      const result = await ctx.services.lint.lint(filePaths)

      if (!result.success) {
        return {
          passed: false,
          status: 'FAILED',
          message: `ESLint found ${result.errorCount} error(s) and ${result.warningCount} warning(s)`,
          context: {
            inputs: [
              { label: 'ESLint Config Files', value: eslintConfigs },
              { label: 'Skip If No Config', value: skipIfNoConfig },
            ],
            analyzed: [{ label: 'Files Linted', items: filePaths }],
            findings: [
              { type: 'fail', message: `ESLint errors: ${result.errorCount}` },
              { type: 'warning', message: `ESLint warnings: ${result.warningCount}` },
            ],
            reasoning: 'Linting reported errors and/or warnings in manifest files.',
          },
          evidence: result.output.substring(0, 2000),
          details: {
            errorCount: result.errorCount,
            warningCount: result.warningCount,
            filesChecked: filePaths.length,
            eslintConfigs,
            skipIfNoConfig,
          },
        }
      }

      return {
        passed: true,
        status: 'PASSED',
        message: 'All files pass ESLint checks',
        context: {
          inputs: [
            { label: 'ESLint Config Files', value: eslintConfigs },
            { label: 'Skip If No Config', value: skipIfNoConfig },
          ],
          analyzed: [{ label: 'Files Linted', items: filePaths }],
          findings: [{ type: 'pass', message: 'ESLint checks passed' }],
          reasoning: 'All linted files passed ESLint rules.',
        },
        metrics: {
          filesChecked: filePaths.length,
          errorCount: 0,
          warningCount: result.warningCount,
        },
        details: {
          eslintConfigs,
          skipIfNoConfig,
        },
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Lint check failed: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [
            { label: 'ESLint Config Files', value: eslintConfigs },
            { label: 'Skip If No Config', value: skipIfNoConfig },
          ],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Lint execution failed' }],
          reasoning: 'An error occurred while running ESLint.',
        },
        details: {
          eslintConfigs,
          skipIfNoConfig,
        },
      }
    }
  },
}
