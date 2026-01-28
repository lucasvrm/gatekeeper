import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { UIComponentExtractorService } from '../../../services/UIComponentExtractorService.js'
import { UIClauseGeneratorService } from '../../../services/UIClauseGeneratorService.js'
import { UIPlanComparisonService } from '../../../services/UIPlanComparisonService.js'

export const UIPlanCoverageValidator: ValidatorDefinition = {
  code: 'UI_PLAN_COVERAGE',
  name: 'UI Plan Coverage',
  description: 'Valida cobertura de cláusulas UI no manifest/plan',
  gate: 1,
  order: 11,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-VALIDATOR-002: Skip sem uiContract
    if (!ctx.uiContract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No UI Contract found for this project',
        context: {
          inputs: [{ label: 'UI Contract', value: 'Not configured' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: no UI Contract' }],
          reasoning: 'UI plan coverage validation requires a UI Contract.',
        },
      }
    }

    // CL-VALIDATOR-003: Skip sem manifest
    if (!ctx.manifest) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest provided',
        context: {
          inputs: [{ label: 'Manifest', value: 'Not provided' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: no manifest' }],
          reasoning: 'UI plan coverage validation requires a manifest.',
        },
      }
    }

    try {
      const extractor = new UIComponentExtractorService()
      const generator = new UIClauseGeneratorService()
      const comparison = new UIPlanComparisonService()

      // Extrair componentes afetados pelo manifest
      const affectedComponents = extractor.extractAffectedComponents(ctx.manifest)

      // CL-VALIDATOR-004: PASSED sem componentes UI afetados
      if (affectedComponents.length === 0) {
        return {
          passed: true,
          status: 'PASSED',
          message: 'No UI components affected by manifest',
          context: {
            inputs: [
              { label: 'Manifest Files', value: ctx.manifest.files.length },
              { label: 'UI Components', value: affectedComponents },
            ],
            analyzed: [{ label: 'Affected Components', items: affectedComponents }],
            findings: [{ type: 'pass', message: 'No UI changes detected' }],
            reasoning: 'Manifest does not touch UI components.',
          },
          details: {
            affectedComponents: [],
          },
        }
      }

      // Gerar cláusulas necessárias
      const requiredClauses = generator.generateClauses(ctx.uiContract, affectedComponents)

      // Comparar cobertura
      const coverage = comparison.comparePlan(requiredClauses, affectedComponents)

      // CL-VALIDATOR-007: Incluir metrics
      const metrics = {
        coveragePercent: coverage.coveragePercent,
        coveredClauses: coverage.coveredClauses,
        totalClauses: coverage.totalClauses,
      }

      // CL-VALIDATOR-006: FAILED com gaps em required
      if (coverage.gaps.length > 0) {
        return {
          passed: false,
          status: 'FAILED',
          message: `Missing coverage for ${coverage.gaps.length} required UI clauses`,
          context: {
            inputs: [
              { label: 'Affected Components', value: affectedComponents },
              { label: 'Required Clauses', value: requiredClauses.length },
            ],
            analyzed: [
              { label: 'Covered', items: coverage.covered },
              { label: 'Gaps', items: coverage.gaps },
            ],
            findings: [
              { type: 'fail', message: `${coverage.gaps.length} required clauses not covered` },
            ],
            reasoning: 'Plan must cover all UI clauses for affected components.',
          },
          details: {
            gaps: coverage.gaps,
            covered: coverage.covered,
            affectedComponents,
          },
          metrics,
        }
      }

      // CL-VALIDATOR-005: PASSED com cobertura completa
      return {
        passed: true,
        status: 'PASSED',
        message: 'All required UI clauses covered by plan',
        context: {
          inputs: [
            { label: 'Affected Components', value: affectedComponents },
            { label: 'Required Clauses', value: requiredClauses.length },
          ],
          analyzed: [{ label: 'Covered Clauses', items: coverage.covered }],
          findings: [{ type: 'pass', message: '100% coverage achieved' }],
          reasoning: 'Plan covers all required UI clauses.',
        },
        details: {
          covered: coverage.covered,
          affectedComponents,
        },
        metrics,
      }
    } catch (error) {
      return {
        passed: false,
        status: 'FAILED',
        message: `UI Plan Coverage validation error: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Validation threw an error' }],
          reasoning: 'Unexpected error during validation.',
        },
      }
    }
  },
}
