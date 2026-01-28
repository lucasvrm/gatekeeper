import type { UIContractSchema } from '../types/ui-contract.types.js'

export interface UIClause {
  id: string
  component: string
  variant: string
  required: boolean
}

export class UIClauseGeneratorService {
  /**
   * Gera cláusulas de UI a partir de componentes afetados e UIContract
   */
  generateClauses(uiContract: UIContractSchema, affectedComponents: string[]): UIClause[] {
    const clauses: UIClause[] = []

    for (const componentName of affectedComponents) {
      const component = uiContract.components[componentName]
      if (!component) continue

      for (const variant of component.variants || []) {
        clauses.push({
          id: `CL-UI-${componentName}-${variant}`,
          component: componentName,
          variant,
          required: true,
        })
      }
    }

    return clauses
  }
}
