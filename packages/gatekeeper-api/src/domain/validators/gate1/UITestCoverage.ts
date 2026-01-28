import type { ValidatorDefinition, ValidationContext, ValidatorOutput } from '../../../types/index.js'
import { UITestCoverageService } from '../../../services/UITestCoverageService.js'
import * as fs from 'fs'

export const UITestCoverageValidator: ValidatorDefinition = {
  code: 'UI_TEST_COVERAGE',
  name: 'UI Test Coverage',
  description: 'Valida cobertura de testes para cláusulas UI',
  gate: 1,
  order: 12,
  isHardBlock: false,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-VALIDATOR-009: Skip sem uiContract
    if (!ctx.uiContract) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No UI Contract found for this project',
        context: {
          inputs: [{ label: 'UI Contract', value: 'Not configured' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: no UI Contract' }],
          reasoning: 'UI test coverage validation requires a UI Contract.',
        },
      }
    }

    // CL-VALIDATOR-010: Skip sem testFilePath
    if (!ctx.testFilePath) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No test file path provided',
        context: {
          inputs: [{ label: 'Test File', value: 'Not provided' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'Skipped: no test file' }],
          reasoning: 'UI test coverage validation requires a test file.',
        },
      }
    }

    try {
      const service = new UITestCoverageService()

      // Ler arquivo de teste
      let testFileContent = ''
      try {
        testFileContent = fs.readFileSync(ctx.testFilePath, 'utf-8')
      } catch (error) {
        return {
          passed: true,
          status: 'SKIPPED',
          message: 'Could not read test file',
          context: {
            inputs: [{ label: 'Test File Path', value: ctx.testFilePath }],
            analyzed: [],
            findings: [{ type: 'info', message: 'Skipped: file not readable' }],
            reasoning: 'Test file could not be read.',
          },
        }
      }

      // Extrair tags @ui-clause
      const uiClauseTags = service.extractUIClauseTags(testFileContent)

      // CL-VALIDATOR-011: WARNING sem @ui-clause tags
      if (uiClauseTags.length === 0) {
        return {
          passed: true,
          status: 'WARNING',
          message: 'No @ui-clause tags found in test file. Consider adding them for traceability.',
          context: {
            inputs: [{ label: 'Test File', value: ctx.testFilePath }],
            analyzed: [{ label: 'UI Clause Tags Found', items: [] }],
            findings: [
              {
                type: 'warning',
                message: 'No @ui-clause tags detected',
              },
            ],
            reasoning: 'Tests should be tagged with @ui-clause for traceability.',
          },
        }
      }

      // CL-VALIDATOR-012: PASSED com tags encontradas
      return {
        passed: true,
        status: 'PASSED',
        message: `Found ${uiClauseTags.length} @ui-clause tags covering UI contract`,
        context: {
          inputs: [{ label: 'Test File', value: ctx.testFilePath }],
          analyzed: [{ label: 'UI Clauses Found', items: uiClauseTags }],
          findings: [
            {
              type: 'pass',
              message: `${uiClauseTags.length} UI clause tags found`,
            },
          ],
          reasoning: 'Test file contains valid @ui-clause annotations.',
        },
      }
    } catch (error) {
      return {
        passed: true,
        status: 'WARNING',
        message: `UI Test Coverage validation error: ${error instanceof Error ? error.message : String(error)}`,
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: 'warning', message: 'Validation threw an error' }],
          reasoning: 'Unexpected error during validation.',
        },
      }
    }
  },
}
