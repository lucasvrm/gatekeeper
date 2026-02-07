/**
 * ArtifactValidationService - Validação centralizada de artefatos do pipeline
 *
 * Valida estrutura e conteúdo de artefatos antes de persistir,
 * prevenindo transições prematuras de steps.
 */

export interface ArtifactValidationIssue {
  field: string
  expected: string
  actual: string | null
  severity: 'error' | 'warning'
}

export interface ArtifactValidationResult {
  valid: boolean
  severity: 'error' | 'warning' | 'success'
  message: string
  details: {
    filename: string
    issues: ArtifactValidationIssue[]
  }
}

export class ArtifactValidationService {
  /**
   * Valida plan.json
   *
   * HARD requirements:
   * - JSON parseável
   * - Campo manifest.testFile existe e é string não-vazia
   *
   * SOFT requirements (warnings):
   * - manifest.files não está vazio
   */
  validatePlanJson(content: string): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = []
    const filename = 'plan.json'

    // HARD: JSON must be parseable
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      return {
        valid: false,
        severity: 'error',
        message: 'JSON não parseável',
        details: {
          filename,
          issues: [{
            field: 'content',
            expected: 'Valid JSON',
            actual: String(err),
            severity: 'error'
          }]
        }
      }
    }

    // HARD: manifest must exist
    if (!parsed.manifest || typeof parsed.manifest !== 'object') {
      issues.push({
        field: 'manifest',
        expected: 'Object with testFile and files',
        actual: String(parsed.manifest),
        severity: 'error'
      })
    } else {
      // HARD: manifest.testFile must exist and be non-empty string
      if (!parsed.manifest.testFile || typeof parsed.manifest.testFile !== 'string' || parsed.manifest.testFile.trim() === '') {
        issues.push({
          field: 'manifest.testFile',
          expected: 'Non-empty string',
          actual: String(parsed.manifest.testFile),
          severity: 'error'
        })
      }

      // SOFT: manifest.files should not be empty
      if (!Array.isArray(parsed.manifest.files) || parsed.manifest.files.length === 0) {
        issues.push({
          field: 'manifest.files',
          expected: 'Non-empty array',
          actual: parsed.manifest.files ? `Array(${parsed.manifest.files.length})` : String(parsed.manifest.files),
          severity: 'warning'
        })
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    const hasWarnings = issues.some(i => i.severity === 'warning')

    return {
      valid: !hasErrors,
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      message: hasErrors
        ? `plan.json inválido: ${issues.filter(i => i.severity === 'error').map(i => i.field).join(', ')}`
        : hasWarnings
          ? `plan.json válido com warnings: ${issues.filter(i => i.severity === 'warning').map(i => i.field).join(', ')}`
          : 'plan.json válido',
      details: { filename, issues }
    }
  }

  /**
   * Valida contract.md
   *
   * HARD requirements:
   * - Content não-vazio (> 10 chars)
   *
   * SOFT requirements (warnings):
   * - Contém Markdown header (## ou #)
   */
  validateContractMd(content: string): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = []
    const filename = 'contract.md'

    // HARD: Content must not be empty
    if (!content || content.trim().length < 10) {
      issues.push({
        field: 'content',
        expected: 'At least 10 characters',
        actual: `${content?.length || 0} chars`,
        severity: 'error'
      })
    }

    // SOFT: Should contain Markdown header
    if (content && !/^#{1,6}\s+/m.test(content)) {
      issues.push({
        field: 'content',
        expected: 'Contains Markdown header (# or ##)',
        actual: 'No header found',
        severity: 'warning'
      })
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    const hasWarnings = issues.some(i => i.severity === 'warning')

    return {
      valid: !hasErrors,
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      message: hasErrors
        ? 'contract.md vazio ou muito curto'
        : hasWarnings
          ? 'contract.md válido mas sem header Markdown'
          : 'contract.md válido',
      details: { filename, issues }
    }
  }

  /**
   * Valida task.spec.md ou task_spec.md
   *
   * HARD requirements:
   * - Content não-vazio (> 10 chars)
   *
   * SOFT requirements (warnings):
   * - Contém Markdown header
   *
   * Aceita tanto task.spec.md quanto task_spec.md (backward compatibility)
   */
  validateTaskSpecMd(content: string, filename: 'task.spec.md' | 'task_spec.md' = 'task.spec.md'): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = []

    // HARD: Content must not be empty
    if (!content || content.trim().length < 10) {
      issues.push({
        field: 'content',
        expected: 'At least 10 characters',
        actual: `${content?.length || 0} chars`,
        severity: 'error'
      })
    }

    // SOFT: Should contain Markdown header
    if (content && !/^#{1,6}\s+/m.test(content)) {
      issues.push({
        field: 'content',
        expected: 'Contains Markdown header (# or ##)',
        actual: 'No header found',
        severity: 'warning'
      })
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    const hasWarnings = issues.some(i => i.severity === 'warning')

    return {
      valid: !hasErrors,
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      message: hasErrors
        ? `${filename} vazio ou muito curto`
        : hasWarnings
          ? `${filename} válido mas sem header Markdown`
          : `${filename} válido`,
      details: { filename, issues }
    }
  }

  /**
   * Valida arquivo de teste (step 2)
   *
   * HARD requirements:
   * - Filename match *.spec.{ts,js,tsx,jsx} ou *.test.{ts,js,tsx,jsx}
   * - Content > 20 chars
   *
   * SOFT requirements (warnings):
   * - Contém describe( ou test( ou it(
   * - Contém expect(
   */
  validateTestFile(filename: string, content: string): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = []

    // HARD: Filename must match test pattern
    const testPatternRegex = /\.(spec|test)\.(ts|js|tsx|jsx)$/
    if (!testPatternRegex.test(filename)) {
      issues.push({
        field: 'filename',
        expected: '*.spec.{ts,js,tsx,jsx} or *.test.{ts,js,tsx,jsx}',
        actual: filename,
        severity: 'error'
      })
    }

    // HARD: Content must not be empty
    if (!content || content.trim().length < 20) {
      issues.push({
        field: 'content',
        expected: 'At least 20 characters',
        actual: `${content?.length || 0} chars`,
        severity: 'error'
      })
    }

    if (content) {
      // SOFT: Should contain test block
      if (!/\b(describe|test|it)\s*\(/.test(content)) {
        issues.push({
          field: 'content',
          expected: 'Contains describe(, test(, or it(',
          actual: 'No test block found',
          severity: 'warning'
        })
      }

      // SOFT: Should contain assertions
      if (!/\bexpect\s*\(/.test(content)) {
        issues.push({
          field: 'content',
          expected: 'Contains expect(',
          actual: 'No assertions found',
          severity: 'warning'
        })
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    const hasWarnings = issues.some(i => i.severity === 'warning')

    return {
      valid: !hasErrors,
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      message: hasErrors
        ? `Arquivo de teste inválido: ${issues.filter(i => i.severity === 'error').map(i => i.field).join(', ')}`
        : hasWarnings
          ? `Arquivo de teste válido mas incompleto: ${issues.filter(i => i.severity === 'warning').map(i => i.field).join(', ')}`
          : `Arquivo de teste válido: ${filename}`,
      details: { filename, issues }
    }
  }

  /**
   * Valida artefatos de um step específico
   *
   * @param step - Step number (1, 2, 3, 4)
   * @param artifacts - Map de filename → content
   * @returns Resultado agregado de validação
   */
  validateStepArtifacts(
    step: 1 | 2 | 3 | 4,
    artifacts: Map<string, string>
  ): { valid: boolean; results: ArtifactValidationResult[] } {
    const results: ArtifactValidationResult[] = []

    if (step === 1) {
      // Step 1: Plan artifacts
      const planJson = artifacts.get('plan.json')
      const contractMd = artifacts.get('contract.md')
      const taskSpecMd = artifacts.get('task.spec.md') || artifacts.get('task_spec.md')

      // Validate plan.json (obrigatório)
      if (!planJson) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Artefato obrigatório ausente: plan.json',
          details: {
            filename: 'plan.json',
            issues: [{
              field: 'existence',
              expected: 'File exists',
              actual: 'File missing',
              severity: 'error'
            }]
          }
        })
      } else {
        results.push(this.validatePlanJson(planJson))
      }

      // Validate contract.md (obrigatório)
      if (!contractMd) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Artefato obrigatório ausente: contract.md',
          details: {
            filename: 'contract.md',
            issues: [{
              field: 'existence',
              expected: 'File exists',
              actual: 'File missing',
              severity: 'error'
            }]
          }
        })
      } else {
        results.push(this.validateContractMd(contractMd))
      }

      // Validate task.spec.md OR task_spec.md (pelo menos um obrigatório)
      if (!taskSpecMd) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Artefato obrigatório ausente: task.spec.md ou task_spec.md',
          details: {
            filename: 'task.spec.md',
            issues: [{
              field: 'existence',
              expected: 'task.spec.md or task_spec.md exists',
              actual: 'Both missing',
              severity: 'error'
            }]
          }
        })
      } else {
        const filename = artifacts.has('task.spec.md') ? 'task.spec.md' : 'task_spec.md'
        results.push(this.validateTaskSpecMd(taskSpecMd, filename))
      }
    } else if (step === 2) {
      // Step 2: Spec/test artifacts
      let hasTestFile = false

      for (const [filename, content] of artifacts.entries()) {
        // Check if this is a test file
        if (/\.(spec|test)\.(ts|js|tsx|jsx)$/.test(filename)) {
          hasTestFile = true
          results.push(this.validateTestFile(filename, content))
        }
      }

      if (!hasTestFile) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Nenhum arquivo de teste encontrado (*.spec.ts ou *.test.ts)',
          details: {
            filename: '*.spec.ts',
            issues: [{
              field: 'existence',
              expected: 'At least one test file',
              actual: 'No test files found',
              severity: 'error'
            }]
          }
        })
      }
    }
    // Step 3 e 4: menos rigorosos (não validamos execution artifacts por enquanto)

    const valid = results.every(r => r.valid)
    return { valid, results }
  }
}
