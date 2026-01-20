import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunPanel } from '@/components/run-panel'
import type { RunWithResults } from '@/lib/types'

// Factory para criar mock de run
function createMockRun(overrides: Partial<RunWithResults> = {}): RunWithResults {
  return {
    id: 'run-001',
    outputId: '2026_01_19_001_test',
    status: 'RUNNING',
    passed: null,
    runType: 'CONTRACT',
    taskPrompt: 'Test task prompt',
    currentGate: 1,
    failedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    gateResults: [
      {
        gateNumber: 0,
        gateName: 'SANITIZATION',
        status: 'PASSED',
        passed: true,
        passedCount: 5,
        failedCount: 0,
        warningCount: 0,
        completedAt: new Date().toISOString(),
      },
      {
        gateNumber: 1,
        gateName: 'CONTRACT',
        status: 'RUNNING',
        passed: null,
        passedCount: 5,
        failedCount: 0,
        warningCount: 0,
        completedAt: null,
      },
    ],
    validatorResults: [
      { validatorCode: 'TOKEN_BUDGET_FIT', validatorName: 'Token Budget Fit', gateNumber: 0, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TASK_SCOPE_SIZE', validatorName: 'Task Scope Size', gateNumber: 0, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TASK_CLARITY_CHECK', validatorName: 'Task Clarity Check', gateNumber: 0, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'SENSITIVE_FILES_LOCK', validatorName: 'Sensitive Files Lock', gateNumber: 0, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'DANGER_MODE_EXPLICIT', validatorName: 'Danger Mode Explicit', gateNumber: 0, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TEST_SYNTAX_VALID', validatorName: 'Test Syntax Valid', gateNumber: 1, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TEST_HAS_ASSERTIONS', validatorName: 'Test Has Assertions', gateNumber: 1, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TEST_COVERS_HAPPY_SAD', validatorName: 'Test Covers Happy and Sad Path', gateNumber: 1, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'TEST_FAILS_BEFORE_IMPL', validatorName: 'Test Fails Before Implementation', gateNumber: 1, status: 'PASSED', passed: true, isHardBlock: true, message: 'OK' },
      { validatorCode: 'NO_DECORATIVE_TESTS', validatorName: 'No Decorative Tests', gateNumber: 1, status: 'PENDING', passed: null, isHardBlock: true, message: null },
    ],
    ...overrides,
  } as RunWithResults
}

describe('RunPanel with Tabs and Progress Bar', () => {
  describe('Progress Bar', () => {
    // @clause RPT_001
    it('should render progress bar with correct testId and role', () => {
      const run = createMockRun()
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('role', 'progressbar')
    })

    // @clause RPT_002
    it('should display progress label with percentage format', () => {
      const run = createMockRun()
      render(<RunPanel run={run} />)

      const progressLabel = screen.getByTestId('gate-progress-label')
      expect(progressLabel).toBeInTheDocument()
      expect(progressLabel.textContent).toMatch(/^\d+%$/)
    })

    // @clause RPT_003
    it('should calculate progress correctly for CONTRACT run with 10 of 15 validators completed', () => {
      const run = createMockRun({
        runType: 'CONTRACT',
        validatorResults: Array(15).fill(null).map((_, i) => ({
          validatorCode: `VALIDATOR_${i}`,
          validatorName: `Validator ${i}`,
          gateNumber: i < 5 ? 0 : 1,
          status: i < 10 ? 'PASSED' : 'PENDING',
          passed: i < 10 ? true : null,
          isHardBlock: true,
          message: i < 10 ? 'OK' : null,
        })),
      })
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      const progressLabel = screen.getByTestId('gate-progress-label')
      
      expect(progressBar).toHaveAttribute('aria-valuenow', '67')
      expect(progressLabel).toHaveTextContent('67%')
    })

    // @clause RPT_004
    it('should calculate progress correctly for EXECUTION run with 3 of 7 validators completed', () => {
      const run = createMockRun({
        runType: 'EXECUTION',
        gateResults: [
          { gateNumber: 2, gateName: 'EXECUTION', status: 'RUNNING', passed: null, passedCount: 3, failedCount: 0, warningCount: 0, completedAt: null },
          { gateNumber: 3, gateName: 'INTEGRITY', status: 'PENDING', passed: null, passedCount: 0, failedCount: 0, warningCount: 0, completedAt: null },
        ],
        validatorResults: Array(7).fill(null).map((_, i) => ({
          validatorCode: `VALIDATOR_${i}`,
          validatorName: `Validator ${i}`,
          gateNumber: i < 5 ? 2 : 3,
          status: i < 3 ? 'PASSED' : 'PENDING',
          passed: i < 3 ? true : null,
          isHardBlock: true,
          message: i < 3 ? 'OK' : null,
        })),
      })
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      const progressLabel = screen.getByTestId('gate-progress-label')
      
      expect(progressBar).toHaveAttribute('aria-valuenow', '43')
      expect(progressLabel).toHaveTextContent('43%')
    })

    // @clause RPT_010
    it('should have success color when run status is PASSED', () => {
      const run = createMockRun({ status: 'PASSED', passed: true })
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      expect(progressBar.className).toMatch(/passed|success|green/i)
    })

    // @clause RPT_011
    it('should have error color when run status is FAILED', () => {
      const run = createMockRun({ status: 'FAILED', passed: false, failedAt: 1 })
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      expect(progressBar.className).toMatch(/failed|error|red/i)
    })

    // @clause RPT_011
    it('should not have error color when run status is PASSED', () => {
      const run = createMockRun({ status: 'PASSED', passed: true })
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      expect(progressBar.className).not.toMatch(/failed|error|red/i)
    })

    // @clause RPT_013
    it('should have correct aria attributes for accessibility', () => {
      const run = createMockRun()
      render(<RunPanel run={run} />)

      const progressBar = screen.getByTestId('gate-progress')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-valuenow')
    })
  })

  describe('Tabs', () => {
    // @clause RPT_005
    it('should render tabs container with correct testId', () => {
      const run = createMockRun()
      render(<RunPanel run={run} />)

      const tabsContainer = screen.getByTestId('gate-tabs')
      expect(tabsContainer).toBeInTheDocument()
    })

    // @clause RPT_006
    it('should render Sanitization and Contract tabs for CONTRACT run', () => {
      const run = createMockRun({ runType: 'CONTRACT' })
      render(<RunPanel run={run} />)

      expect(screen.getByTestId('tab-sanitization')).toBeInTheDocument()
      expect(screen.getByTestId('tab-contract')).toBeInTheDocument()
      expect(screen.queryByTestId('tab-execution')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tab-integrity')).not.toBeInTheDocument()
    })

    // @clause RPT_007
    it('should render Execution and Integrity tabs for EXECUTION run', () => {
      const run = createMockRun({
        runType: 'EXECUTION',
        gateResults: [
          { gateNumber: 2, gateName: 'EXECUTION', status: 'RUNNING', passed: null, passedCount: 0, failedCount: 0, warningCount: 0, completedAt: null },
          { gateNumber: 3, gateName: 'INTEGRITY', status: 'PENDING', passed: null, passedCount: 0, failedCount: 0, warningCount: 0, completedAt: null },
        ],
      })
      render(<RunPanel run={run} />)

      expect(screen.getByTestId('tab-execution')).toBeInTheDocument()
      expect(screen.getByTestId('tab-integrity')).toBeInTheDocument()
      expect(screen.queryByTestId('tab-sanitization')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tab-contract')).not.toBeInTheDocument()
    })

    // @clause RPT_008
    it('should switch active tab when clicking different tab', () => {
      const run = createMockRun({ runType: 'CONTRACT' })
      render(<RunPanel run={run} />)

      const contractTab = screen.getByTestId('tab-contract')
      fireEvent.click(contractTab)

      expect(contractTab).toHaveAttribute('data-state', 'active')
    })

    // @clause RPT_009
    it('should display validators of active gate in tab content', () => {
      const run = createMockRun({ runType: 'CONTRACT' })
      render(<RunPanel run={run} />)

      // Gate 0 validators should be visible by default (Sanitization tab)
      expect(screen.getByText('Token Budget Fit')).toBeVisible()
      expect(screen.getByText('Task Scope Size')).toBeVisible()
    })

    // @clause RPT_009
    it('should show different validators when switching tabs', () => {
      const run = createMockRun({ runType: 'CONTRACT' })
      render(<RunPanel run={run} />)

      // Click Contract tab (Gate 1)
      const contractTab = screen.getByTestId('tab-contract')
      fireEvent.click(contractTab)

      // Gate 1 validators should be visible
      expect(screen.getByText('Test Syntax Valid')).toBeVisible()
      expect(screen.getByText('Test Has Assertions')).toBeVisible()
    })

    // @clause RPT_012
    it('should have Sanitization tab active by default for CONTRACT run', () => {
      const run = createMockRun({ runType: 'CONTRACT' })
      render(<RunPanel run={run} />)

      const sanitizationTab = screen.getByTestId('tab-sanitization')
      expect(sanitizationTab).toHaveAttribute('data-state', 'active')
    })

    // @clause RPT_012
    it('should have Execution tab active by default for EXECUTION run', () => {
      const run = createMockRun({
        runType: 'EXECUTION',
        gateResults: [
          { gateNumber: 2, gateName: 'EXECUTION', status: 'RUNNING', passed: null, passedCount: 0, failedCount: 0, warningCount: 0, completedAt: null },
          { gateNumber: 3, gateName: 'INTEGRITY', status: 'PENDING', passed: null, passedCount: 0, failedCount: 0, warningCount: 0, completedAt: null },
        ],
        validatorResults: [
          { validatorCode: 'DIFF_SCOPE', validatorName: 'Diff Scope Enforcement', gateNumber: 2, status: 'PENDING', passed: null, isHardBlock: true, message: null },
        ],
      })
      render(<RunPanel run={run} />)

      const executionTab = screen.getByTestId('tab-execution')
      expect(executionTab).toHaveAttribute('data-state', 'active')
    })
  })
})
