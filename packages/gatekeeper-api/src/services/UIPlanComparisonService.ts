import type { UIClause } from './UIClauseGeneratorService.js'

export interface CoverageResult {
  coveragePercent: number
  coveredClauses: number
  totalClauses: number
  covered: string[]
  gaps: string[]
}

export class UIPlanComparisonService {
  /**
   * Compara cláusulas requeridas com o que está no plan/manifest
   * Para simplificação, assume que qualquer componente no manifest cobre suas cláusulas
   */
  comparePlan(
    requiredClauses: UIClause[],
    affectedComponents: string[]
  ): CoverageResult {
    if (requiredClauses.length === 0) {
      return {
        coveragePercent: 100,
        coveredClauses: 0,
        totalClauses: 0,
        covered: [],
        gaps: [],
      }
    }

    const covered: string[] = []
    const gaps: string[] = []

    for (const clause of requiredClauses) {
      if (affectedComponents.includes(clause.component)) {
        covered.push(clause.id)
      } else {
        gaps.push(clause.id)
      }
    }

    const coveragePercent = (covered.length / requiredClauses.length) * 100

    return {
      coveragePercent,
      coveredClauses: covered.length,
      totalClauses: requiredClauses.length,
      covered,
      gaps,
    }
  }
}
