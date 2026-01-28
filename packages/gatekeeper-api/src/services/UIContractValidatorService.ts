import type { UIContractSchema } from '../types/ui-contract.types.js'

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export class UIContractValidatorService {
  /**
   * Valida schema de UIContract
   * @returns ValidationResult com valid e lista de erros
   */
  validate(contract: unknown): ValidationResult {
    const errors: ValidationError[] = []

    if (typeof contract !== 'object' || contract === null) {
      errors.push({ path: 'root', message: 'Contract must be an object' })
      return { valid: false, errors }
    }

    const c = contract as Record<string, unknown>

    // Validar campos obrigatórios
    if (!c.version) {
      errors.push({ path: 'version', message: 'Required' })
    }

    if (!c.metadata) {
      errors.push({ path: 'metadata', message: 'Required' })
    } else {
      const metadata = c.metadata as Record<string, unknown>
      const requiredMetadataFields = ['projectName', 'exportedFrom', 'exportedAt', 'hash']

      for (const field of requiredMetadataFields) {
        if (!metadata[field]) {
          errors.push({ path: `metadata.${field}`, message: 'Required' })
        }
      }
    }

    if (!c.components) {
      errors.push({ path: 'components', message: 'Required' })
    } else {
      const components = c.components as Record<string, unknown>
      if (Object.keys(components).length === 0) {
        errors.push({ path: 'components', message: 'Must have at least one component' })
      }
    }

    if (!c.styles) {
      errors.push({ path: 'styles', message: 'Required' })
    } else {
      const styles = c.styles as Record<string, unknown>
      const validKeyPattern = /^[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+\.[A-Za-z]+$/

      for (const key of Object.keys(styles)) {
        if (!validKeyPattern.test(key)) {
          errors.push({
            path: `styles.${key}`,
            message: 'Invalid key format. Expected: component.variant.part.state.property'
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
