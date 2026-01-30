/**
 * @file run-details-page-v2.spec.tsx
 * @description Spec tests for fixing data loading in RunDetailsPageV2
 * @contract fix-v2-data-loading
 * @mode STRICT
 *
 * Este spec define o contrato comportamental para o carregamento de dados correto.
 * Todos os testes devem FALHAR antes da implementação e PASSAR após.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import React from 'react'

// =============================================================================
// HOISTED MOCKS (must be defined before vi.mock calls due to hoisting)
// =============================================================================

const {
  mockNavigate,
  mockUseRunEvents,
  mockApi,
  mockToast,
  mockGetRepoNameFromPath,
  useRunEventsCallHistory,
} = vi.hoisted(() => {
  const history: Array<{ runId: string | undefined; callback: unknown }> = []
  return {
    mockNavigate: vi.fn(),
    mockUseRunEvents: vi.fn(),
    mockApi: {
      runs: {
        getWithResults: vi.fn(),
        rerunGate: vi.fn(),
        bypassValidator: vi.fn(),
        uploadFiles: vi.fn(),
      },
    },
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    mockGetRepoNameFromPath: vi.fn((path: string) => {
      const parts = path.split('/')
      return parts[parts.length - 1] || 'unknown-repo'
    }),
    useRunEventsCallHistory: history,
  }
})

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/useRunEvents', () => ({
  useRunEvents: (runId: string | undefined, callback: (event: unknown) => void) => {
    mockUseRunEvents(runId, callback)
    useRunEventsCallHistory.push({ runId, callback })
  },
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
}))

vi.mock('sonner', () => ({
  toast: mockToast,
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return {
    ...actual,
    getRepoNameFromPath: mockGetRepoNameFromPath,
  }
})

// Component under test
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

interface ExecutionRunRef {
  id: string
  status: RunStatus
}

interface RunWithResults {
  id: string
  outputId: string
  projectPath: string
  status: RunStatus
  runType: RunType
  contractRunId?: string
  executionRuns?: ExecutionRunRef[]
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
    ...overrides,
  }
}

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
  return {
    gateNumber: 0,
    gateName: 'Sanitization',
    status: 'PASSED',
    passed: true,
    passedCount: 2,
    failedCount: 0,
    warningCount: 0,
    skippedCount: 0,
    ...overrides,
  }
}

function createRunWithResults(overrides: Partial<RunWithResults> = {}): RunWithResults {
  return {
    id: 'run-uuid-123',
    outputId: '2026_01_30_001_feature_x',
    projectPath: '/home/user/projects/my-awesome-repo',
    status: 'PASSED',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization' }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation' }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'SANITIZE_1', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'CONTRACT_1', gateNumber: 1 }),
    ],
    createdAt: '2026-01-30T10:00:00Z',
    updatedAt: '2026-01-30T10:05:00Z',
    ...overrides,
  }
}

const FIXTURES = {
  contractRunPrimary: createRunWithResults({
    id: 'contract-uuid-abc',
    runType: 'CONTRACT',
    outputId: '2026_01_30_001_timeline_vertical',
    projectPath: '/home/user/projects/gatekeeper',
    executionRuns: [{ id: 'exec-uuid-xyz', status: 'PASSED' }],
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', passedCount: 3 }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation', passedCount: 5 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'SANITIZE_1', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'SANITIZE_2', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'SANITIZE_3', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'CONTRACT_1', gateNumber: 1 }),
      createValidatorResult({ validatorCode: 'CONTRACT_2', gateNumber: 1 }),
    ],
  }),

  executionRunSecondary: createRunWithResults({
    id: 'exec-uuid-xyz',
    runType: 'EXECUTION',
    outputId: '2026_01_30_001_timeline_vertical',
    projectPath: '/home/user/projects/gatekeeper',
    contractRunId: 'contract-uuid-abc',
    commitHash: 'abc1234def5678',
    commitMessage: 'feat: add timeline',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution', passedCount: 4 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', passedCount: 2 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_1', gateNumber: 2 }),
      createValidatorResult({ validatorCode: 'EXEC_2', gateNumber: 2 }),
      createValidatorResult({ validatorCode: 'INTEGRITY_1', gateNumber: 3 }),
      createValidatorResult({ validatorCode: 'INTEGRITY_2', gateNumber: 3 }),
    ],
  }),

  executionRunPrimary: createRunWithResults({
    id: 'exec-uuid-primary',
    runType: 'EXECUTION',
    outputId: '2026_01_30_002_bugfix',
    projectPath: '/home/user/projects/spark-app',
    contractRunId: 'contract-uuid-secondary',
    commitHash: 'xyz9876',
    commitMessage: 'fix: loading bug',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution', passedCount: 3 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', passedCount: 2 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_A', gateNumber: 2 }),
      createValidatorResult({ validatorCode: 'INTEGRITY_A', gateNumber: 3 }),
    ],
  }),

  contractRunSecondary: createRunWithResults({
    id: 'contract-uuid-secondary',
    runType: 'CONTRACT',
    outputId: '2026_01_30_002_bugfix',
    projectPath: '/home/user/projects/spark-app',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', passedCount: 2 }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation', passedCount: 3 }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'SANITIZE_A', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'CONTRACT_A', gateNumber: 1 }),
    ],
  }),

  contractRunNoSecondary: createRunWithResults({
    id: 'contract-uuid-solo',
    runType: 'CONTRACT',
    outputId: '2026_01_30_003_solo',
    projectPath: '/home/user/projects/solo-project',
    executionRuns: [],
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization' }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation' }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'SOLO_1', gateNumber: 0 }),
    ],
  }),
}

// =============================================================================
// TEST HELPERS
// =============================================================================

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/runs/contract-uuid-abc/v2' }: { route?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/runs/:id/v2" element={ui} />
        <Route path="/runs/:id" element={ui} />
        <Route path="/runs" element={<div>Runs List</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function setupMocks(options: {
  primaryRun?: RunWithResults | null
  secondaryRun?: RunWithResults | null
  primaryError?: Error | null
  secondaryError?: Error | null
} = {}) {
  const {
    primaryRun = FIXTURES.contractRunPrimary,
    secondaryRun = FIXTURES.executionRunSecondary,
    primaryError = null,
    secondaryError = null,
  } = options

  // Clear history
  useRunEventsCallHistory.length = 0

  mockApi.runs.getWithResults.mockImplementation(async (runId: string) => {
    await new Promise(resolve => setTimeout(resolve, 10))

    if (primaryError && runId === primaryRun?.id) {
      throw primaryError
    }
    if (secondaryError && runId === secondaryRun?.id) {
      throw secondaryError
    }

    if (primaryRun && runId === primaryRun.id) {
      return primaryRun
    }
    if (secondaryRun && runId === secondaryRun.id) {
      return secondaryRun
    }
    if (primaryRun?.contractRunId === runId && secondaryRun) {
      return secondaryRun
    }
    if (primaryRun?.executionRuns?.[0]?.id === runId && secondaryRun) {
      return secondaryRun
    }

    throw new Error('Run not found')
  })
}

// =============================================================================
// TESTS
// =============================================================================

describe('RunDetailsPageV2 - Data Loading Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRunEventsCallHistory.length = 0
    setupMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ===========================================================================
  // DATA LOADING (CL-DL-001 to CL-DL-005)
  // ===========================================================================

  describe('Data Loading', () => {
    // @clause CL-DL-001
    it('succeeds when page loads and uses runId from URL params (not outputId)', async () => {
      const runId = 'contract-uuid-abc'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith(runId)
      })

      expect(mockApi.runs.getWithResults).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}_\d{2}_\d{2}/)
      )
    })

    // @clause CL-DL-002
    it('succeeds when page loads and calls api.runs.getWithResults with runId', async () => {
      const runId = 'contract-uuid-abc'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith(runId)
      })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })
    })

    // @clause CL-DL-003
    it('succeeds when primaryRun is EXECUTION with contractRunId and loads CONTRACT as secondaryRun', async () => {
      setupMocks({
        primaryRun: FIXTURES.executionRunPrimary,
        secondaryRun: FIXTURES.contractRunSecondary,
      })

      const runId = 'exec-uuid-primary'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith(runId)
      })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith('contract-uuid-secondary')
      })

      expect(mockApi.runs.getWithResults).toHaveBeenCalledTimes(2)
    })

    // @clause CL-DL-004
    it('succeeds when primaryRun is CONTRACT with executionRuns[0] and loads EXECUTION as secondaryRun', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      const runId = 'contract-uuid-abc'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith(runId)
      })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith('exec-uuid-xyz')
      })

      expect(mockApi.runs.getWithResults).toHaveBeenCalledTimes(2)
    })

    // @clause CL-DL-005
    it('succeeds when data is loaded and derives contractRun/executionRun based on primaryRun.runType=CONTRACT', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-1')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-2')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-3')).toBeInTheDocument()
      })
    })

    // @clause CL-DL-005
    it('succeeds when data is loaded and derives contractRun/executionRun based on primaryRun.runType=EXECUTION', async () => {
      setupMocks({
        primaryRun: FIXTURES.executionRunPrimary,
        secondaryRun: FIXTURES.contractRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/exec-uuid-primary/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-1')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-2')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-3')).toBeInTheDocument()
      })
    })

    // @clause CL-DL-004
    it('succeeds when CONTRACT has no executionRuns and only shows contract gates', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunNoSecondary,
        secondaryRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-solo/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
        expect(screen.getByTestId('gate-card-1')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('gate-card-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('gate-card-3')).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // SSE (CL-SSE-001 to CL-SSE-003)
  // ===========================================================================

  describe('SSE (Server-Sent Events)', () => {
    // @clause CL-SSE-001
    it('succeeds when data is loaded and useRunEvents is called with runId (not outputId)', async () => {
      const runId = 'contract-uuid-abc'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        const callWithRunId = useRunEventsCallHistory.find(call => call.runId === runId)
        expect(callWithRunId).toBeDefined()
      })

      const callWithOutputId = useRunEventsCallHistory.find(
        call => call.runId && /^\d{4}_\d{2}_\d{2}/.test(call.runId)
      )
      expect(callWithOutputId).toBeUndefined()
    })

    // @clause CL-SSE-001
    it('fails when useRunEvents is called with (outputId, runType) pattern instead of (runId, callback)', async () => {
      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        const validCall = useRunEventsCallHistory.find(
          call => typeof call.callback === 'function'
        )
        expect(validCall).toBeDefined()
      })

      const brokenCall = useRunEventsCallHistory.find(
        call => typeof call.callback === 'string'
      )
      expect(brokenCall).toBeUndefined()
    })

    // @clause CL-SSE-002
    it('succeeds when SSE event is received for primaryRun and api.runs.getWithResults is called to refresh', async () => {
      const runId = 'contract-uuid-abc'
      renderWithRouter(<RunDetailsPageV2 />, { route: `/runs/${runId}/v2` })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const primaryCall = useRunEventsCallHistory.find(call => call.runId === runId)
      expect(primaryCall).toBeDefined()
      expect(typeof primaryCall!.callback).toBe('function')

      mockApi.runs.getWithResults.mockClear()

      const callback = primaryCall!.callback as (event: unknown) => void
      callback({ type: 'run_updated', runId })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith(runId)
      })
    })

    // @clause CL-SSE-003
    it('succeeds when secondaryRun exists and useRunEvents is called for it too', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        const secondaryCall = useRunEventsCallHistory.find(
          call => call.runId === 'exec-uuid-xyz'
        )
        expect(secondaryCall).toBeDefined()
      })
    })
  })

  // ===========================================================================
  // HEADER (CL-HD-001 to CL-HD-002)
  // ===========================================================================

  describe('Header', () => {
    // @clause CL-HD-001
    it('succeeds when primaryRun is loaded and header displays repo name from getRepoNameFromPath', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      expect(mockGetRepoNameFromPath).toHaveBeenCalledWith('/home/user/projects/gatekeeper')

      await waitFor(() => {
        expect(screen.getByTestId('run-header-repoName')).toHaveTextContent('gatekeeper')
      })
    })

    // @clause CL-HD-002
    it('succeeds when primaryRun is loaded and header displays outputId', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('run-header-outputId')).toHaveTextContent(
          '2026_01_30_001_timeline_vertical'
        )
      })
    })
  })

  // ===========================================================================
  // STATES (CL-ST-001 to CL-ST-002)
  // ===========================================================================

  describe('Loading and Error States', () => {
    // @clause CL-ST-001
    it('succeeds when data is loading and shows loading state with timeline not visible', async () => {
      mockApi.runs.getWithResults.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(FIXTURES.contractRunPrimary), 500))
      )

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
      expect(screen.queryByTestId('timeline-container')).not.toBeInTheDocument()
      expect(screen.queryByTestId('overview-cards')).not.toBeInTheDocument()
    })

    // @clause CL-ST-002
    it('fails when fetch fails and shows error toast without partial data or SSE connection', async () => {
      const testError = new Error('Network error')
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        primaryError: testError,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })

      expect(screen.queryByTestId('overview-cards')).not.toBeInTheDocument()
      expect(screen.queryByTestId('timeline-container')).not.toBeInTheDocument()
    })

    // @clause CL-ST-002
    it('fails when run is not found and displays error message', async () => {
      mockApi.runs.getWithResults.mockRejectedValue(new Error('Run not found'))

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/invalid-uuid/v2' })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })

      await waitFor(() => {
        const errorText = screen.queryByText(/not found|error/i)
        expect(errorText).toBeInTheDocument()
      })
    })
  })

  // ===========================================================================
  // VISUAL INVARIANTS (CL-VIS-001 to CL-VIS-002)
  // ===========================================================================

  describe('Visual Invariants', () => {
    // @clause CL-VIS-001
    it('succeeds when loaded and unifiedGates contains gates from both contractRun and executionRun ordered by gateNumber', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument()
      })

      const gate0 = screen.getByTestId('gate-card-0')
      const gate1 = screen.getByTestId('gate-card-1')
      const gate2 = screen.getByTestId('gate-card-2')
      const gate3 = screen.getByTestId('gate-card-3')

      expect(gate0).toBeInTheDocument()
      expect(gate1).toBeInTheDocument()
      expect(gate2).toBeInTheDocument()
      expect(gate3).toBeInTheDocument()

      expect(gate0).toHaveTextContent(/sanitization/i)
      expect(gate1).toHaveTextContent(/contract/i)
      expect(gate2).toHaveTextContent(/execution/i)
      expect(gate3).toHaveTextContent(/integrity/i)

      const container = screen.getByTestId('timeline-container')
      const gateCards = container.querySelectorAll('[data-testid^="gate-card-"]')
      expect(gateCards[0]).toHaveAttribute('data-testid', 'gate-card-0')
      expect(gateCards[1]).toHaveAttribute('data-testid', 'gate-card-1')
      expect(gateCards[2]).toHaveAttribute('data-testid', 'gate-card-2')
      expect(gateCards[3]).toHaveAttribute('data-testid', 'gate-card-3')
    })

    // @clause CL-VIS-002
    it('succeeds when loaded and unifiedValidators contains validators from both runs with correct runType', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-ALL')).toHaveTextContent(/\(9\)/)
      })
    })

    // @clause CL-VIS-001
    it('succeeds when only contractRun exists and shows only gates 0 and 1', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunNoSecondary,
        secondaryRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-solo/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument()
      })

      expect(screen.getByTestId('gate-card-0')).toBeInTheDocument()
      expect(screen.getByTestId('gate-card-1')).toBeInTheDocument()
      expect(screen.queryByTestId('gate-card-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('gate-card-3')).not.toBeInTheDocument()
    })

    // @clause CL-VIS-002
    it('succeeds when only contractRun exists and filter counts only contract validators', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunNoSecondary,
        secondaryRun: null,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-solo/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('filter-btn-ALL')).toHaveTextContent(/\(1\)/)
      })
    })
  })

  // ===========================================================================
  // INTEGRATION
  // ===========================================================================

  describe('Integration', () => {
    // @clause CL-DL-001
    // @clause CL-DL-002
    // @clause CL-DL-004
    // @clause CL-SSE-001
    it('succeeds with full flow: load CONTRACT primary, fetch EXECUTION secondary, connect SSE', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractRunPrimary,
        secondaryRun: FIXTURES.executionRunSecondary,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-uuid-abc/v2' })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith('contract-uuid-abc')
      })

      await waitFor(() => {
        expect(mockApi.runs.getWithResults).toHaveBeenCalledWith('exec-uuid-xyz')
      })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
        expect(screen.getByTestId('timeline-container')).toBeInTheDocument()
      })

      await waitFor(() => {
        const validSseCall = useRunEventsCallHistory.find(
          call => call.runId === 'contract-uuid-abc' && typeof call.callback === 'function'
        )
        expect(validSseCall).toBeDefined()
      })

      expect(screen.getByTestId('run-header-repoName')).toHaveTextContent('gatekeeper')
      expect(screen.getByTestId('run-header-outputId')).toHaveTextContent(
        '2026_01_30_001_timeline_vertical'
      )
    })
  })
})
