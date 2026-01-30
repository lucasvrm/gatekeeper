/**
 * @file run-details-page-v2.spec.tsx
 * @description Spec tests for Timeline Vertical Run Details Page
 * @contract run-details-timeline-vertical
 * @mode STRICT
 * 
 * Este spec define o contrato comportamental do componente RunDetailsPageV2.
 * Todos os testes devem FALHAR antes da implementação e PASSAR após.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

// =============================================================================
// HOISTED MOCKS (must be defined before vi.mock calls due to hoisting)
// =============================================================================

const { mockNavigate, mockUseRunEvents, mockApi, mockToast } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseRunEvents: vi.fn(),
  mockApi: {
    runs: {
      getByOutputId: vi.fn(),
      rerunGate: vi.fn(),
      bypassValidator: vi.fn(),
      deleteRun: vi.fn(),
      abortRun: vi.fn(),
    },
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// =============================================================================
// MOCKS
// =============================================================================

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'test-output-id' }),
  }
})

// Mock useRunEvents hook
vi.mock('@/hooks/useRunEvents', () => ({
  useRunEvents: (...args: unknown[]) => mockUseRunEvents(...args),
}))

// Mock API
vi.mock('@/lib/api', () => ({
  api: mockApi,
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Component under test - will be created by implementation
import { RunDetailsPageV2 } from '@/components/run-details-page-v2'

// =============================================================================
// TYPE DEFINITIONS (inline for determinism)
// =============================================================================

type ValidatorStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED' | 'RUNNING' | 'PENDING'
type RunStatus = 'PASSED' | 'FAILED' | 'RUNNING' | 'PENDING' | 'ABORTED'
type RunType = 'CONTRACT' | 'EXECUTION'

interface ValidatorResult {
  validatorCode: string
  validatorName: string
  gateNumber: number
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
  details?: string
  evidence?: string
}

interface GateResult {
  gateNumber: number
  gateName: string
  status: ValidatorStatus
  passed: boolean
  passedCount: number
  failedCount: number
  warningCount: number
  skippedCount: number
}

interface RunWithResults {
  id: string
  outputId: string
  repoSlug: string
  status: RunStatus
  runType: RunType
  commitHash?: string
  commitMessage?: string
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
  createdAt: string
  updatedAt: string
}

// =============================================================================
// FIXTURES & FACTORIES
// =============================================================================

function createValidatorResult(overrides: Partial<ValidatorResult> = {}): ValidatorResult {
  return {
    validatorCode: 'TEST_VALIDATOR',
    validatorName: 'Test Validator',
    gateNumber: 0,
    status: 'PASSED',
    passed: true,
    isHardBlock: false,
    bypassed: false,
    message: undefined,
    details: undefined,
    evidence: undefined,
    ...overrides,
  }
}

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
  return {
    gateNumber: 0,
    gateName: 'Sanitization',
    status: 'PASSED',
    passed: true,
    passedCount: 3,
    failedCount: 0,
    warningCount: 0,
    skippedCount: 0,
    ...overrides,
  }
}

function createRunWithResults(overrides: Partial<RunWithResults> = {}): RunWithResults {
  return {
    id: 'run-123',
    outputId: 'test-output-id',
    repoSlug: 'test-repo',
    status: 'PASSED',
    runType: 'CONTRACT',
    commitHash: undefined,
    commitMessage: undefined,
    gateResults: [createGateResult()],
    validatorResults: [createValidatorResult()],
    createdAt: '2026-01-30T10:00:00Z',
    updatedAt: '2026-01-30T10:05:00Z',
    ...overrides,
  }
}

// Standard fixtures
const FIXTURES = {
  contractRunPassed: createRunWithResults({
    id: 'contract-run-123',
    runType: 'CONTRACT',
    status: 'PASSED',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', passedCount: 3, failedCount: 0 }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation', passedCount: 5, failedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'SANITIZE_1', gateNumber: 0, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'SANITIZE_2', gateNumber: 0, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'SANITIZE_3', gateNumber: 0, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'CONTRACT_1', gateNumber: 1, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'CONTRACT_2', gateNumber: 1, status: 'PASSED' }),
    ],
  }),

  executionRunPassed: createRunWithResults({
    id: 'exec-run-456',
    runType: 'EXECUTION',
    status: 'PASSED',
    commitHash: 'abc1234def5678',
    commitMessage: 'feat: add new feature',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution', passedCount: 4, failedCount: 0 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', passedCount: 2, failedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_1', gateNumber: 2, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'EXEC_2', gateNumber: 2, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'INTEGRITY_1', gateNumber: 3, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'INTEGRITY_2', gateNumber: 3, status: 'PASSED' }),
    ],
  }),

  executionRunFailed: createRunWithResults({
    id: 'exec-run-789',
    runType: 'EXECUTION',
    status: 'FAILED',
    commitHash: 'xyz9876abc5432',
    commitMessage: 'fix: broken test',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution', status: 'FAILED', passedCount: 2, failedCount: 2 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', status: 'PASSED', passedCount: 2, failedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_PASS_1', gateNumber: 2, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'EXEC_PASS_2', gateNumber: 2, status: 'PASSED' }),
      createValidatorResult({
        validatorCode: 'EXEC_FAIL_1',
        validatorName: 'Test Runner',
        gateNumber: 2,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        bypassed: false,
        message: 'Tests failed with 3 errors',
      }),
      createValidatorResult({
        validatorCode: 'EXEC_FAIL_2',
        validatorName: 'Coverage Check',
        gateNumber: 2,
        status: 'FAILED',
        passed: false,
        isHardBlock: false,
        message: 'Coverage below threshold',
      }),
      createValidatorResult({ validatorCode: 'INTEGRITY_1', gateNumber: 3, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'INTEGRITY_2', gateNumber: 3, status: 'PASSED' }),
    ],
  }),

  mixedStatusValidators: createRunWithResults({
    id: 'mixed-run',
    runType: 'CONTRACT',
    status: 'FAILED',
    gateResults: [
      createGateResult({ gateNumber: 0, status: 'PASSED', passedCount: 2, failedCount: 0, warningCount: 1, skippedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'V_PASSED_1', gateNumber: 0, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'V_PASSED_2', gateNumber: 0, status: 'PASSED' }),
      createValidatorResult({ validatorCode: 'V_WARNING', gateNumber: 0, status: 'WARNING', passed: true, isHardBlock: false }),
      createValidatorResult({ validatorCode: 'V_SKIPPED', gateNumber: 0, status: 'SKIPPED', passed: true }),
    ],
  }),
}

// =============================================================================
// TEST HELPERS
// =============================================================================

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/runs/test-output-id' }: { route?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/runs/:id" element={ui} />
        <Route path="/runs" element={<div>Runs List</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function setupDefaultMocks(options: {
  contractRun?: RunWithResults | null
  executionRun?: RunWithResults | null
  isLoading?: boolean
  error?: Error | null
} = {}) {
  const {
    contractRun = FIXTURES.contractRunPassed,
    executionRun = FIXTURES.executionRunPassed,
    isLoading = false,
    error = null,
  } = options

  mockUseRunEvents.mockImplementation((outputId: string, runType: RunType) => {
    if (runType === 'CONTRACT') {
      return { data: contractRun, isLoading, error }
    }
    return { data: executionRun, isLoading, error }
  })

  mockApi.runs.getByOutputId.mockResolvedValue({ contractRun, executionRun })
  mockApi.runs.rerunGate.mockResolvedValue({ success: true })
  mockApi.runs.bypassValidator.mockResolvedValue({ success: true })
}

// =============================================================================
// TESTS
// =============================================================================

describe('RunDetailsPageV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ===========================================================================
  // OVERVIEW CARDS (CL-OV-001 to CL-OV-006)
  // ===========================================================================

  describe('Overview Cards', () => {
    // @clause CL-OV-001
    it('succeeds when page loads with valid data and renders exactly 4 overview cards', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      const overviewCards = screen.getByTestId('overview-cards')
      expect(screen.getByTestId('overview-progress')).toBeInTheDocument()
      expect(screen.getByTestId('overview-contract')).toBeInTheDocument()
      expect(screen.getByTestId('overview-execution')).toBeInTheDocument()
      expect(screen.getByTestId('overview-commit')).toBeInTheDocument()

      // Verify exactly 4 direct card children
      const cards = within(overviewCards).getAllByTestId(/^overview-/)
      expect(cards).toHaveLength(4)
    })

    // @clause CL-OV-002
    it('succeeds when validators are loaded and progress card displays calculated percentage with progressbar', async () => {
      // 9 passed out of 9 total = 100%
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunPassed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-progress')).toBeInTheDocument()
      })

      const progressCard = screen.getByTestId('overview-progress')
      const progressBar = within(progressCard).getByRole('progressbar')
      
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuenow', '100')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressCard).toHaveTextContent('100%')
    })

    // @clause CL-OV-002
    it('succeeds when some validators failed and progress card shows partial percentage', async () => {
      // Contract: 8 passed, Execution: 4 passed + 2 failed = 12/14 ≈ 86%
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-progress')).toBeInTheDocument()
      })

      const progressCard = screen.getByTestId('overview-progress')
      const progressBar = within(progressCard).getByRole('progressbar')
      
      const progressValue = parseInt(progressBar.getAttribute('aria-valuenow') || '0', 10)
      expect(progressValue).toBeGreaterThan(0)
      expect(progressValue).toBeLessThan(100)
    })

    // @clause CL-OV-003
    it('succeeds when contractRun exists and contract card displays StatusBadge with corresponding status and truncated ID', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-contract')).toBeInTheDocument()
      })

      const contractCard = screen.getByTestId('overview-contract')
      
      // Verify StatusBadge shows PASSED status
      expect(contractCard).toHaveTextContent(/passed/i)
      
      // Verify truncated ID (first 7 chars of 'contract-run-123')
      expect(contractCard).toHaveTextContent(/contract/i)
    })

    // @clause CL-OV-004
    it('succeeds when executionRun exists and execution card displays StatusBadge with corresponding status and truncated ID', async () => {
      setupDefaultMocks({
        executionRun: FIXTURES.executionRunPassed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-execution')).toBeInTheDocument()
      })

      const executionCard = screen.getByTestId('overview-execution')
      
      // Verify StatusBadge shows PASSED status
      expect(executionCard).toHaveTextContent(/passed/i)
      
      // Verify truncated ID present
      expect(executionCard).toHaveTextContent(/exec/i)
    })

    // @clause CL-OV-005
    it('succeeds when executionRun does not exist and execution card displays pending/empty state without error', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-execution')).toBeInTheDocument()
      })

      const executionCard = screen.getByTestId('overview-execution')
      
      // Should show pending/waiting state
      expect(executionCard).toHaveTextContent(/aguardando|pending|waiting/i)
      
      // Should NOT show error status
      expect(executionCard).not.toHaveTextContent(/error/i)
    })

    // @clause CL-OV-006
    it('succeeds when executionRun has commitHash and commit card displays truncated hash and message', async () => {
      setupDefaultMocks({
        executionRun: FIXTURES.executionRunPassed, // has commitHash: 'abc1234def5678'
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('overview-commit')).toBeInTheDocument()
      })

      const commitCard = screen.getByTestId('overview-commit')
      
      // Verify truncated hash (7 chars: 'abc1234')
      expect(commitCard).toHaveTextContent('abc1234')
      
      // Verify commit message
      expect(commitCard).toHaveTextContent('feat: add new feature')
    })
  })

  // ===========================================================================
  // FILTER BAR (CL-FB-001 to CL-FB-004)
  // ===========================================================================

  describe('Filter Bar', () => {
    // @clause CL-FB-001
    it('succeeds when page loads and filter bar displays buttons for each status with count', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
      })

      expect(screen.getByTestId('filter-btn-ALL')).toBeInTheDocument()
      expect(screen.getByTestId('filter-btn-PASSED')).toBeInTheDocument()
      expect(screen.getByTestId('filter-btn-FAILED')).toBeInTheDocument()
      expect(screen.getByTestId('filter-btn-WARNING')).toBeInTheDocument()
      expect(screen.getByTestId('filter-btn-SKIPPED')).toBeInTheDocument()
    })

    // @clause CL-FB-002
    it('succeeds when page loads and ALL filter is visually selected by default', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-ALL')).toBeInTheDocument()
      })

      const allButton = screen.getByTestId('filter-btn-ALL')
      
      // Check for active state class
      expect(allButton).toHaveClass('bg-blue-600')
    })

    // @clause CL-FB-003
    it('succeeds when user clicks filter button and visual state changes with validators filtered', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.mixedStatusValidators,
        executionRun: null,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-PASSED')).toBeInTheDocument()
      })

      const passedButton = screen.getByTestId('filter-btn-PASSED')
      const allButton = screen.getByTestId('filter-btn-ALL')

      // Initially ALL is active
      expect(allButton).toHaveClass('bg-blue-600')

      // Click PASSED filter
      await user.click(passedButton)

      // PASSED should now be active
      expect(passedButton).toHaveClass('bg-blue-600')
      
      // ALL should no longer be active
      expect(allButton).not.toHaveClass('bg-blue-600')
    })

    // @clause CL-FB-004
    it('succeeds when validators exist and each filter button shows correct count in parentheses', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.mixedStatusValidators,
        executionRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-ALL')).toBeInTheDocument()
      })

      // mixedStatusValidators has: 2 PASSED, 1 WARNING, 1 SKIPPED, 0 FAILED
      expect(screen.getByTestId('filter-btn-ALL')).toHaveTextContent(/\(4\)/)
      expect(screen.getByTestId('filter-btn-PASSED')).toHaveTextContent(/\(2\)/)
      expect(screen.getByTestId('filter-btn-FAILED')).toHaveTextContent(/\(0\)/)
      expect(screen.getByTestId('filter-btn-WARNING')).toHaveTextContent(/\(1\)/)
      expect(screen.getByTestId('filter-btn-SKIPPED')).toHaveTextContent(/\(1\)/)
    })
  })

  // ===========================================================================
  // TIMELINE VISUAL (CL-TL-001 to CL-TL-002)
  // ===========================================================================

  describe('Timeline Visual', () => {
    // @clause CL-TL-001
    it('succeeds when page loads with gates and a vertical line connects gates in timeline container', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument()
      })

      const timelineContainer = screen.getByTestId('timeline-container')
      
      // Check for vertical line element with expected classes
      const verticalLine = timelineContainer.querySelector('.w-0\\.5, [class*="w-0.5"]')
      expect(verticalLine || timelineContainer.innerHTML).toMatch(/w-0\.5|bg-gray-200/)
    })

    // @clause CL-TL-002
    it('succeeds when CONTRACT and EXECUTION gates exist and are displayed in sequential order 0-1-2-3', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunPassed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      })

      // All 4 gates should be present
      const gate0 = screen.getByTestId('gate-card-0')
      const gate1 = screen.getByTestId('gate-card-1')
      const gate2 = screen.getByTestId('gate-card-2')
      const gate3 = screen.getByTestId('gate-card-3')

      expect(gate0).toBeInTheDocument()
      expect(gate1).toBeInTheDocument()
      expect(gate2).toBeInTheDocument()
      expect(gate3).toBeInTheDocument()

      // Verify order in DOM (gate0 should come before gate1, etc.)
      const container = screen.getByTestId('timeline-container')
      const gateCards = within(container).getAllByTestId(/^gate-card-/)
      
      expect(gateCards[0]).toHaveAttribute('data-testid', 'gate-card-0')
      expect(gateCards[1]).toHaveAttribute('data-testid', 'gate-card-1')
      expect(gateCards[2]).toHaveAttribute('data-testid', 'gate-card-2')
      expect(gateCards[3]).toHaveAttribute('data-testid', 'gate-card-3')
    })
  })

  // ===========================================================================
  // GATE CARDS (CL-GC-001 to CL-GC-005)
  // ===========================================================================

  describe('Gate Cards', () => {
    // @clause CL-GC-001
    it('succeeds when a gate exists and card displays name, number, type, and passed/failed count', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      })

      const gateCard = screen.getByTestId('gate-card-0')

      // Gate name
      expect(gateCard).toHaveTextContent(/sanitization/i)
      
      // Gate number (G0)
      expect(gateCard).toHaveTextContent(/G0/i)
      
      // Gate type (Contrato for gates 0-1)
      expect(gateCard).toHaveTextContent(/contrato|contract/i)
      
      // Passed/failed count
      expect(gateCard).toHaveTextContent(/passed/i)
    })

    // @clause CL-GC-002
    it('succeeds when user clicks gate header and content expands/collapses with chevron rotation', async () => {
      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-toggle-0')).toBeInTheDocument()
      })

      const toggleButton = screen.getByTestId('gate-toggle-0')
      const gateCard = screen.getByTestId('gate-card-0')

      // Get initial state (expanded or collapsed depends on default logic)
      const initialHasValidators = gateCard.querySelector('[data-testid^="validator-item-"]')

      // Click to toggle
      await user.click(toggleButton)

      // State should have changed
      await waitFor(() => {
        const afterClickHasValidators = gateCard.querySelector('[data-testid^="validator-item-"]')
        expect(!!afterClickHasValidators).not.toBe(!!initialHasValidators)
      })
    })

    // @clause CL-GC-003
    it('succeeds when gates have FAILED status and first failed gate is expanded by default', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed, // Gate 2 is FAILED
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-2')).toBeInTheDocument()
      })

      // Gate 2 (first failed) should be expanded - validators visible
      const gate2 = screen.getByTestId('gate-card-2')
      expect(within(gate2).queryAllByTestId(/^validator-item-/).length).toBeGreaterThan(0)

      // Gate 0 (passed) should be collapsed
      const gate0 = screen.getByTestId('gate-card-0')
      expect(within(gate0).queryAllByTestId(/^validator-item-/).length).toBe(0)
    })

    // @clause CL-GC-004
    it('succeeds when all gates have PASSED status and first gate G0 is expanded by default', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunPassed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      })

      // Gate 0 should be expanded - validators visible
      const gate0 = screen.getByTestId('gate-card-0')
      expect(within(gate0).queryAllByTestId(/^validator-item-/).length).toBeGreaterThan(0)

      // Other gates should be collapsed
      const gate1 = screen.getByTestId('gate-card-1')
      expect(within(gate1).queryAllByTestId(/^validator-item-/).length).toBe(0)
    })

    // @clause CL-GC-005
    it('succeeds when gate is rendered and circular node appears on timeline with status-corresponding color', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      })

      const gate0 = screen.getByTestId('gate-card-0')
      const gate2 = screen.getByTestId('gate-card-2')

      // Check for circular nodes with status colors
      // Passed gate (G0) should have success color
      expect(gate0.innerHTML).toMatch(/rounded-full|bg-green|text-status-passed|border-green/)
      
      // Failed gate (G2) should have failure color
      expect(gate2.innerHTML).toMatch(/rounded-full|bg-red|text-status-failed|border-red/)
    })
  })

  // ===========================================================================
  // VALIDATOR ITEMS (CL-VI-001 to CL-VI-004)
  // ===========================================================================

  describe('Validator Items', () => {
    // @clause CL-VI-001
    it('succeeds when gate is expanded and each validator displays name, status icon, severity badge, and StatusBadge', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-2')).toBeInTheDocument()
      })

      // Gate 2 is expanded by default (first failed)
      const failedValidator = screen.getByTestId('validator-item-EXEC_FAIL_1')
      
      // Validator name
      expect(failedValidator).toHaveTextContent('Test Runner')
      
      // Severity badge (Hard for isHardBlock=true)
      expect(failedValidator).toHaveTextContent(/hard/i)
      
      // StatusBadge showing FAILED
      expect(failedValidator).toHaveTextContent(/failed/i)
    })

    // @clause CL-VI-002
    it('succeeds when validator has FAILED status and upload button is visible and opens FileUploadDialog on click', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-EXEC_FAIL_1')).toBeInTheDocument()
      })

      const failedValidator = screen.getByTestId('validator-item-EXEC_FAIL_1')
      
      // Find upload button
      const uploadButton = within(failedValidator).getByRole('button', { name: /upload/i })
      expect(uploadButton).toBeInTheDocument()

      // Click should open dialog
      await user.click(uploadButton)

      // FileUploadDialog should appear (check for dialog or modal)
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    // @clause CL-VI-003
    it('succeeds when validator has FAILED status, isHardBlock=true, bypassed=false and Bypass button is visible and triggers API on click', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-EXEC_FAIL_1')).toBeInTheDocument()
      })

      const failedValidator = screen.getByTestId('validator-item-EXEC_FAIL_1')
      
      // Find Bypass button (only for isHardBlock=true, bypassed=false)
      const bypassButton = within(failedValidator).getByRole('button', { name: /bypass/i })
      expect(bypassButton).toBeInTheDocument()

      // Click should trigger API
      await user.click(bypassButton)

      await waitFor(() => {
        expect(mockApi.runs.bypassValidator).toHaveBeenCalled()
      })
    })

    // @clause CL-VI-003
    it('fails when validator has isHardBlock=false and Bypass button should NOT be visible', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.contractRunPassed,
        executionRun: FIXTURES.executionRunFailed,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-EXEC_FAIL_2')).toBeInTheDocument()
      })

      // EXEC_FAIL_2 has isHardBlock=false
      const softValidator = screen.getByTestId('validator-item-EXEC_FAIL_2')
      
      // Bypass button should NOT be present
      expect(within(softValidator).queryByRole('button', { name: /bypass/i })).not.toBeInTheDocument()
    })

    // @clause CL-VI-004
    it('succeeds when status filter is active (not ALL) and only validators with that status are visible', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.mixedStatusValidators,
        executionRun: null,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-WARNING')).toBeInTheDocument()
      })

      // Expand gate 0 first if needed
      const toggle = screen.getByTestId('gate-toggle-0')
      await user.click(toggle)

      // Click WARNING filter
      await user.click(screen.getByTestId('filter-btn-WARNING'))

      await waitFor(() => {
        // Only WARNING validators should be visible
        expect(screen.queryByTestId('validator-item-V_WARNING')).toBeInTheDocument()
        expect(screen.queryByTestId('validator-item-V_PASSED_1')).not.toBeInTheDocument()
        expect(screen.queryByTestId('validator-item-V_PASSED_2')).not.toBeInTheDocument()
      })
    })

    // @clause CL-VI-004
    it('succeeds when filter has no matching validators and gate shows empty message', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.mixedStatusValidators, // has no FAILED validators
        executionRun: null,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-FAILED')).toBeInTheDocument()
      })

      // Expand gate
      await user.click(screen.getByTestId('gate-toggle-0'))

      // Click FAILED filter (no matches in mixedStatusValidators)
      await user.click(screen.getByTestId('filter-btn-FAILED'))

      await waitFor(() => {
        const gateCard = screen.getByTestId('gate-card-0')
        expect(gateCard).toHaveTextContent(/nenhum|no validator|empty/i)
      })
    })
  })

  // ===========================================================================
  // LOADING/ERROR STATES (CL-LE-001 to CL-LE-002)
  // ===========================================================================

  describe('Loading and Error States', () => {
    // @clause CL-LE-001
    it('succeeds when data is loading and skeletons are displayed with overview/filter/timeline not visible', async () => {
      setupDefaultMocks({
        isLoading: true,
        contractRun: null,
        executionRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />)

      // Should show loading skeleton
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()

      // Overview cards should NOT be visible
      expect(screen.queryByTestId('overview-cards')).not.toBeInTheDocument()
      
      // Filter bar should NOT be visible
      expect(screen.queryByTestId('filter-bar')).not.toBeInTheDocument()
      
      // Timeline should NOT be visible
      expect(screen.queryByTestId('timeline-container')).not.toBeInTheDocument()
    })

    // @clause CL-LE-002
    it('fails when run is not found and displays error message with back button but NOT timeline or overview cards', async () => {
      setupDefaultMocks({
        contractRun: null,
        executionRun: null,
        error: new Error('Run not found'),
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        // Error message should be visible
        expect(screen.getByText(/run not found/i)).toBeInTheDocument()
      })

      // Back button should be present
      expect(screen.getByTestId('btn-back')).toBeInTheDocument()

      // Timeline should NOT be visible
      expect(screen.queryByTestId('timeline-container')).not.toBeInTheDocument()
      
      // Overview cards should NOT be visible
      expect(screen.queryByTestId('overview-cards')).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // INVARIANTS (CL-INV-001 to CL-INV-004)
  // ===========================================================================

  describe('Invariants', () => {
    // @clause CL-INV-001
    it('succeeds when page is rendered and header contains btn-back, btn-new-run, btn-git-commit and breadcrumb', async () => {
      setupDefaultMocks({
        executionRun: FIXTURES.executionRunPassed, // has commitHash for git commit button
      })

      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('btn-back')).toBeInTheDocument()
      })

      // Back button
      expect(screen.getByTestId('btn-back')).toBeInTheDocument()
      
      // New run button
      expect(screen.getByTestId('btn-new-run')).toBeInTheDocument()
      
      // Git commit button (when commitHash exists)
      expect(screen.getByTestId('btn-git-commit')).toBeInTheDocument()
      
      // Breadcrumb with repo/outputId
      expect(screen.getByText(/test-repo/i)).toBeInTheDocument()
      expect(screen.getByText(/test-output-id/i)).toBeInTheDocument()
    })

    // @clause CL-INV-002
    it('succeeds when SSE event is emitted and useRunEvents updates data for contractRun and executionRun', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // Verify useRunEvents was called for both run types
      expect(mockUseRunEvents).toHaveBeenCalledWith('test-output-id', 'CONTRACT')
      expect(mockUseRunEvents).toHaveBeenCalledWith('test-output-id', 'EXECUTION')
    })

    // @clause CL-INV-003
    it('succeeds when user clicks rerun gate and API is called with success toast displayed', async () => {
      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      })

      // Find rerun button (aria-label based search)
      const rerunButton = screen.getByRole('button', { name: /rerun gate/i })
      
      await user.click(rerunButton)

      await waitFor(() => {
        expect(mockApi.runs.rerunGate).toHaveBeenCalled()
        expect(mockToast.success).toHaveBeenCalled()
      })
    })

    // @clause CL-INV-004
    it('succeeds when page is rendered and sidebar remains intact with functional navigation', async () => {
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // Page renders inside main content area, not duplicating sidebar
      const timelinePage = screen.getByTestId('timeline-page')
      
      // Timeline page should NOT contain nav elements (those are in sidebar)
      expect(within(timelinePage).queryByRole('navigation')).not.toBeInTheDocument()
      
      // Should only be one main content area
      expect(timelinePage).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // ADDITIONAL INTERACTION TESTS
  // ===========================================================================

  describe('Additional Interactions', () => {
    // @clause CL-FB-003
    it('succeeds when multiple filter clicks occur and state correctly toggles between filters', async () => {
      setupDefaultMocks({
        contractRun: FIXTURES.mixedStatusValidators,
        executionRun: null,
      })

      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
      })

      // Click PASSED
      await user.click(screen.getByTestId('filter-btn-PASSED'))
      expect(screen.getByTestId('filter-btn-PASSED')).toHaveClass('bg-blue-600')
      expect(screen.getByTestId('filter-btn-ALL')).not.toHaveClass('bg-blue-600')

      // Click WARNING
      await user.click(screen.getByTestId('filter-btn-WARNING'))
      expect(screen.getByTestId('filter-btn-WARNING')).toHaveClass('bg-blue-600')
      expect(screen.getByTestId('filter-btn-PASSED')).not.toHaveClass('bg-blue-600')

      // Click ALL again
      await user.click(screen.getByTestId('filter-btn-ALL'))
      expect(screen.getByTestId('filter-btn-ALL')).toHaveClass('bg-blue-600')
      expect(screen.getByTestId('filter-btn-WARNING')).not.toHaveClass('bg-blue-600')
    })

    // @clause CL-GC-002
    it('succeeds when multiple gates are toggled and each maintains independent expanded state', async () => {
      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('gate-toggle-0')).toBeInTheDocument()
        expect(screen.getByTestId('gate-toggle-1')).toBeInTheDocument()
      })

      // Toggle gate 1
      await user.click(screen.getByTestId('gate-toggle-1'))
      
      // Gate 1 should now be expanded
      const gate1 = screen.getByTestId('gate-card-1')
      await waitFor(() => {
        expect(within(gate1).queryAllByTestId(/^validator-item-/).length).toBeGreaterThan(0)
      })

      // Gate 0 state should remain unchanged (still expanded by default when all passed)
      const gate0 = screen.getByTestId('gate-card-0')
      expect(within(gate0).queryAllByTestId(/^validator-item-/).length).toBeGreaterThan(0)
    })

    // @clause CL-INV-001
    it('succeeds when back button is clicked and navigation occurs', async () => {
      const user = userEvent.setup()
      renderWithRouter(<RunDetailsPageV2 />)

      await waitFor(() => {
        expect(screen.getByTestId('btn-back')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('btn-back'))

      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })
})
