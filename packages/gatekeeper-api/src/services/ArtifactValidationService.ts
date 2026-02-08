/**
 * ArtifactValidationService - Validação centralizada de artefatos do pipeline
 *
 * Valida estrutura e conteúdo de artefatos antes de persistir,
 * prevenindo transições prematuras de steps.
 */

import type { MicroplansDocument } from '../types/gates.types.js'

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
   * Valida microplans.json
   *
   * HARD requirements:
   * - JSON parseável
   * - Campo task existe e é string não-vazia
   * - Campo microplans existe e é array não-vazio
   *
   * SOFT requirements (warnings):
   * - Cada microplan tem id, goal, files válidos
   */
  validateMicroplansJson(content: string): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = []
    const filename = 'microplans.json'

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

    // HARD: task must exist and be non-empty string
    if (!parsed.task || typeof parsed.task !== 'string' || parsed.task.trim() === '') {
      issues.push({
        field: 'task',
        expected: 'Non-empty string',
        actual: String(parsed.task),
        severity: 'error'
      })
    }

    // HARD: microplans must exist and be non-empty array
    if (!Array.isArray(parsed.microplans)) {
      issues.push({
        field: 'microplans',
        expected: 'Array',
        actual: typeof parsed.microplans,
        severity: 'error'
      })
    } else if (parsed.microplans.length === 0) {
      issues.push({
        field: 'microplans',
        expected: 'Non-empty array',
        actual: 'Empty array',
        severity: 'error'
      })
    } else {
      // SOFT: Each microplan should have id, goal, files
      parsed.microplans.forEach((mp: any, idx: number) => {
        if (!mp.id || typeof mp.id !== 'string' || mp.id.trim() === '') {
          issues.push({
            field: `microplans[${idx}].id`,
            expected: 'Non-empty string',
            actual: String(mp.id),
            severity: 'warning'
          })
        }

        if (!mp.goal || typeof mp.goal !== 'string' || mp.goal.trim() === '') {
          issues.push({
            field: `microplans[${idx}].goal`,
            expected: 'Non-empty string',
            actual: String(mp.goal),
            severity: 'warning'
          })
        }

        if (!Array.isArray(mp.files)) {
          issues.push({
            field: `microplans[${idx}].files`,
            expected: 'Array',
            actual: typeof mp.files,
            severity: 'warning'
          })
        }
      })
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    const hasWarnings = issues.some(i => i.severity === 'warning')

    return {
      valid: !hasErrors,
      severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
      message: hasErrors
        ? `microplans.json inválido: ${issues.filter(i => i.severity === 'error').map(i => i.field).join(', ')}`
        : hasWarnings
          ? `microplans.json válido com warnings: ${issues.filter(i => i.severity === 'warning').map(i => i.field).join(', ')}`
          : 'microplans.json válido',
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
      // Step 1: Plan artifacts (microplans.json)
      const microplansJson = artifacts.get('microplans.json')

      // Validate microplans.json (obrigatório)
      if (!microplansJson) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Artefato obrigatório ausente: microplans.json',
          details: {
            filename: 'microplans.json',
            issues: [{
              field: 'existence',
              expected: 'File exists',
              actual: 'File missing',
              severity: 'error'
            }]
          }
        })
      } else {
        results.push(this.validateMicroplansJson(microplansJson))
      }

      // NEW: Validate task_prompt.md
      const taskPromptMd = artifacts.get('task_prompt.md')

      if (!taskPromptMd) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'Artefato obrigatório ausente: task_prompt.md',
          details: {
            filename: 'task_prompt.md',
            issues: [{
              field: 'existence',
              expected: 'File exists',
              actual: 'File missing',
              severity: 'error'
            }]
          }
        })
      } else {
        // Strip header "# Task Prompt\n\n" and validate content length
        const content = taskPromptMd.replace(/^# Task Prompt\n\n/, '').trim()

        if (content.length < 10) {
          results.push({
            valid: false,
            severity: 'error',
            message: 'task_prompt.md muito curto (< 10 chars após header)',
            details: {
              filename: 'task_prompt.md',
              issues: [{
                field: 'content',
                expected: 'At least 10 characters (after header)',
                actual: `${content.length} characters`,
                severity: 'error'
              }]
            }
          })
        } else {
          results.push({
            valid: true,
            severity: 'success',
            message: 'task_prompt.md válido',
            details: { filename: 'task_prompt.md', issues: [] }
          })
        }
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

  /**
   * Valida artifacts da fase Discovery (substep do Step 1).
   * Espera apenas discovery_report.md como obrigatório.
   *
   * @param artifacts - Map de filename → content
   * @returns Resultado agregado de validação
   */
  validateDiscoveryArtifacts(
    artifacts: Map<string, string>
  ): { valid: boolean; results: ArtifactValidationResult[] } {
    const results: ArtifactValidationResult[] = []

    const discoveryReport = artifacts.get('discovery_report.md')

    if (!discoveryReport) {
      results.push({
        valid: false,
        severity: 'error',
        message: 'Artefato obrigatório ausente: discovery_report.md',
        details: {
          filename: 'discovery_report.md',
          issues: [{
            field: 'existence',
            expected: 'File exists',
            actual: 'File missing',
            severity: 'error'
          }]
        }
      })
    } else {
      // Validação básica: não pode estar vazio, deve ter conteúdo mínimo
      if (discoveryReport.trim().length < 100) {
        results.push({
          valid: false,
          severity: 'error',
          message: 'discovery_report.md muito curto (< 100 chars)',
          details: {
            filename: 'discovery_report.md',
            issues: [{
              field: 'content',
              expected: 'At least 100 characters',
              actual: `${discoveryReport.length} characters`,
              severity: 'error'
            }]
          }
        })
      } else {
        results.push({
          valid: true,
          severity: 'success',
          message: 'discovery_report.md válido',
          details: { filename: 'discovery_report.md', issues: [] }
        })
      }
    }

    const valid = results.every(r => r.valid)
    return { valid, results }
  }
}
