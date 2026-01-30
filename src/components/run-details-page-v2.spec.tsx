/**
 * @file run-details-page-v2.spec.tsx
 * @description Spec tests for UI polish improvements in RunDetailsPageV2
 * @contract v2-ui-polish
 * @mode STRICT
 *
 * Este spec define o contrato comportamental para o polimento visual da página V2.
 * Todos os testes devem FALHAR antes da implementação e PASSAR após.
 *
 * Cláusulas cobertas:
 * - CL-CTX-001: Parseia context do validator.details
 * - CL-CTX-002: Renderiza ValidatorContextPanel quando parsedContext existe
 * - CL-CTX-003: Não renderiza ValidatorContextPanel quando context é inválido
 * - CL-BDG-001: Badge Hard idêntico à V1 (span com classes específicas)
 * - CL-BDG-002: Badge Warning idêntico à V1 (span com classes específicas)
 * - CL-FLT-001: Hover de botão inativo tem hover:text-white
 * - CL-FLT-002: Botão ativo mantém bg-blue-600 text-white
 * - CL-OVC-001: Grid usa grid-cols-12 com col-span distribution
 * - CL-OVC-002: commitMessage tem truncate class e title attribute
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

interface ValidatorContextInput {
  label: string
  value: string | number | boolean | string[] | Record<string, unknown>
}

interface ValidatorContextAnalyzedGroup {
  label: string
  items: string[]
}

interface ValidatorContextFinding {
  type: 'pass' | 'fail' | 'warning' | 'info'
  message: string
  location?: string
}

interface ValidatorContext {
  inputs: ValidatorContextInput[]
  analyzed: ValidatorContextAnalyzedGroup[]
  findings: ValidatorContextFinding[]
  reasoning: string
}

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

function createValidatorContext(overrides: Partial<ValidatorContext> = {}): ValidatorContext {
  return {
    inputs: [
      { label: 'testFilePath', value: 'src/components/button.spec.tsx' },
      { label: 'clauses', value: ['CL-001', 'CL-002'] },
    ],
    analyzed: [
      { label: 'Files Checked', items: ['button.tsx', 'button.spec.tsx'] },
    ],
    findings: [
      { type: 'pass', message: 'All clauses covered' },
      { type: 'warning', message: 'Missing edge case', location: 'line 42' },
    ],
    reasoning: 'Test file covers all contract clauses with proper assertions.',
    ...overrides,
  }
}

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
  // Run with validator that has valid context in details
  runWithValidContext: createRunWithResults({
    id: 'run-with-context',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', failedCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'CLAUSE_MAPPING',
        validatorName: 'Test Clause Mapping Valid',
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        details: JSON.stringify({ context: createValidatorContext() }),
      }),
    ],
  }),

  // Run with validator that has no details
  runWithNoDetails: createRunWithResults({
    id: 'run-no-details',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', failedCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'NO_DETAILS_VALIDATOR',
        validatorName: 'Validator Without Details',
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        details: undefined,
      }),
    ],
  }),

  // Run with validator that has JSON without context field
  runWithJsonNoContext: createRunWithResults({
    id: 'run-json-no-context',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', failedCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'JSON_NO_CONTEXT',
        validatorName: 'Validator With JSON No Context',
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        details: JSON.stringify({ message: 'Some error', code: 'ERR_001' }),
      }),
    ],
  }),

  // Run with validator that has invalid JSON in details
  runWithInvalidJson: createRunWithResults({
    id: 'run-invalid-json',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', failedCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'INVALID_JSON',
        validatorName: 'Validator With Invalid JSON',
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        details: 'not valid json {{{',
      }),
    ],
  }),

  // Run with hard block validator
  runWithHardBlock: createRunWithResults({
    id: 'run-hard-block',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', failedCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'HARD_BLOCK_VALIDATOR',
        validatorName: 'Hard Block Validator',
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
      }),
    ],
  }),

  // Run with warning (soft) validator
  runWithWarning: createRunWithResults({
    id: 'run-warning',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'WARNING', warningCount: 1, passedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({
        validatorCode: 'WARNING_VALIDATOR',
        validatorName: 'Warning Validator',
        gateNumber: 0,
        status: 'WARNING',
        passed: false,
        isHardBlock: false,
      }),
    ],
  }),

  // Run for testing filter buttons
  runWithMultipleStatuses: createRunWithResults({
    id: 'run-multiple-statuses',
    runType: 'CONTRACT',
    gateResults: [
      createGateResult({
        gateNumber: 0,
        gateName: 'Sanitization',
        status: 'FAILED',
        passedCount: 1,
        failedCount: 1,
        warningCount: 1,
        skippedCount: 1,
      }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'V_PASSED', gateNumber: 0, status: 'PASSED', isHardBlock: false }),
      createValidatorResult({ validatorCode: 'V_FAILED', gateNumber: 0, status: 'FAILED', isHardBlock: true }),
      createValidatorResult({ validatorCode: 'V_WARNING', gateNumber: 0, status: 'WARNING', isHardBlock: false }),
      createValidatorResult({ validatorCode: 'V_SKIPPED', gateNumber: 0, status: 'SKIPPED', isHardBlock: false }),
    ],
  }),

  // Run with execution for commit message tests
  contractWithExecution: createRunWithResults({
    id: 'contract-with-exec',
    runType: 'CONTRACT',
    executionRuns: [{ id: 'exec-run-123', status: 'PASSED' }],
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization' }),
      createGateResult({ gateNumber: 1, gateName: 'Contract Validation' }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'V1', gateNumber: 0 }),
      createValidatorResult({ validatorCode: 'V2', gateNumber: 1 }),
    ],
  }),

  executionWithLongCommit: createRunWithResults({
    id: 'exec-run-123',
    runType: 'EXECUTION',
    contractRunId: 'contract-with-exec',
    commitHash: 'abc1234def5678ghij9012klmn3456',
    commitMessage: 'feat(components): implement very long commit message that should be truncated because it exceeds the normal width of the card and needs to show ellipsis with a tooltip containing the full text',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution' }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity' }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_1', gateNumber: 2 }),
      createValidatorResult({ validatorCode: 'INT_1', gateNumber: 3 }),
    ],
  }),

  executionWithShortCommit: createRunWithResults({
    id: 'exec-short-commit',
    runType: 'EXECUTION',
    contractRunId: 'contract-with-exec',
    commitHash: 'short123',
    commitMessage: 'fix: typo',
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execution' }),
    ],
    validatorResults: [
      createValidatorResult({ validatorCode: 'EXEC_1', gateNumber: 2 }),
    ],
  }),
}

// =============================================================================
// HELPERS
// =============================================================================

interface MockSetupOptions {
  primaryRun?: RunWithResults | null
  secondaryRun?: RunWithResults | null
  primaryError?: Error
  secondaryError?: Error
}

function setupMocks(options: MockSetupOptions) {
  const { primaryRun = null, secondaryRun = null, primaryError, secondaryError } = options

  mockApi.runs.getWithResults.mockImplementation((runId: string) => {
    if (primaryRun && runId === primaryRun.id) {
      if (primaryError) return Promise.reject(primaryError)
      return Promise.resolve(primaryRun)
    }
    if (secondaryRun && runId === secondaryRun.id) {
      if (secondaryError) return Promise.reject(secondaryError)
      return Promise.resolve(secondaryRun)
    }
    return Promise.reject(new Error('Run not found'))
  })
}

function renderWithRouter(
  ui: React.ReactElement,
  { route = '/runs/test-id/v2' }: { route?: string } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/runs/:id/v2" element={ui} />
        <Route path="/runs/:id" element={ui} />
        <Route path="/runs/new" element={<div>New Run Page</div>} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// =============================================================================
// TESTS
// =============================================================================

describe('RunDetailsPageV2 - UI Polish Contract (v2-ui-polish)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRunEventsCallHistory.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===========================================================================
  // VALIDATOR CONTEXT PANEL (CL-CTX-001, CL-CTX-002, CL-CTX-003)
  // ===========================================================================

  describe('ValidatorContextPanel', () => {
    // @clause CL-CTX-001
    it('succeeds when validator.details contains valid JSON with context field and parsedContext is extracted', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithValidContext,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-with-context/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // Expand gate 0 to see validators
      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      // Validator with context should render ValidatorContextPanel
      await waitFor(() => {
        const validatorItem = screen.getByTestId('validator-item-CLAUSE_MAPPING')
        expect(validatorItem).toBeInTheDocument()
      })

      // The ValidatorContextPanel should be present inside the validator item
      await waitFor(() => {
        expect(screen.getByTestId('validator-context-panel')).toBeInTheDocument()
      })
    })

    // @clause CL-CTX-002
    it('succeeds when parsedContext is not null and ValidatorContextPanel is rendered with data-testid visible', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithValidContext,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-with-context/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        const contextPanel = screen.getByTestId('validator-context-panel')
        expect(contextPanel).toBeInTheDocument()
        expect(contextPanel).toBeVisible()
      })

      // The panel should have the "Context Details" button
      expect(screen.getByRole('button', { name: /context details/i })).toBeInTheDocument()
    })

    // @clause CL-CTX-003
    it('fails when validator.details is null and ValidatorContextPanel is not rendered', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithNoDetails,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-no-details/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-NO_DETAILS_VALIDATOR')).toBeInTheDocument()
      })

      // ValidatorContextPanel should NOT be present
      expect(screen.queryByTestId('validator-context-panel')).not.toBeInTheDocument()
    })

    // @clause CL-CTX-003
    it('fails when validator.details is JSON without context field and ValidatorContextPanel is not rendered', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithJsonNoContext,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-json-no-context/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-JSON_NO_CONTEXT')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('validator-context-panel')).not.toBeInTheDocument()
    })

    // @clause CL-CTX-003
    it('fails when validator.details is invalid JSON and ValidatorContextPanel is not rendered', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithInvalidJson,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-invalid-json/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-INVALID_JSON')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('validator-context-panel')).not.toBeInTheDocument()
    })
  })

  // ===========================================================================
  // BADGES HARD/WARNING (CL-BDG-001, CL-BDG-002)
  // ===========================================================================

  describe('Badges Hard/Warning', () => {
    // @clause CL-BDG-001
    it('succeeds when validator.isHardBlock is true and Hard badge is span with V1 classes', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithHardBlock,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-hard-block/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-HARD_BLOCK_VALIDATOR')).toBeInTheDocument()
      })

      const hardBadge = screen.getByTestId('hard-badge')
      expect(hardBadge).toBeInTheDocument()
      expect(hardBadge.tagName.toLowerCase()).toBe('span')
      expect(hardBadge).toHaveTextContent('Hard')
      expect(hardBadge).toHaveClass('text-[10px]')
      expect(hardBadge).toHaveClass('px-1.5')
      expect(hardBadge).toHaveClass('py-0.5')
      expect(hardBadge).toHaveClass('rounded')
      expect(hardBadge).toHaveClass('bg-destructive/20')
      expect(hardBadge).toHaveClass('text-destructive')
      expect(hardBadge).toHaveClass('font-medium')
    })

    // @clause CL-BDG-002
    it('succeeds when validator.isHardBlock is false and Warning badge is span with V1 classes', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithWarning,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-warning/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-WARNING_VALIDATOR')).toBeInTheDocument()
      })

      const warningBadge = screen.getByTestId('warning-badge')
      expect(warningBadge).toBeInTheDocument()
      expect(warningBadge.tagName.toLowerCase()).toBe('span')
      expect(warningBadge).toHaveTextContent('Warning')
      expect(warningBadge).toHaveClass('text-[10px]')
      expect(warningBadge).toHaveClass('px-1.5')
      expect(warningBadge).toHaveClass('py-0.5')
      expect(warningBadge).toHaveClass('rounded')
      expect(warningBadge).toHaveClass('bg-yellow-500/20')
      expect(warningBadge).toHaveClass('text-yellow-600')
      expect(warningBadge).toHaveClass('font-medium')
    })
  })

  // ===========================================================================
  // FILTER BUTTONS HOVER (CL-FLT-001, CL-FLT-002)
  // ===========================================================================

  describe('Filter Buttons Hover', () => {
    // @clause CL-FLT-001
    it('succeeds when filter button is inactive and has hover:text-white class', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithMultipleStatuses,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-multiple-statuses/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // ALL is active by default, so PASSED, FAILED, WARNING, SKIPPED are inactive
      const passedButton = screen.getByTestId('filter-btn-PASSED')
      const failedButton = screen.getByTestId('filter-btn-FAILED')
      const warningButton = screen.getByTestId('filter-btn-WARNING')
      const skippedButton = screen.getByTestId('filter-btn-SKIPPED')

      // All inactive buttons should have hover:text-white
      expect(passedButton).toHaveClass('hover:text-white')
      expect(failedButton).toHaveClass('hover:text-white')
      expect(warningButton).toHaveClass('hover:text-white')
      expect(skippedButton).toHaveClass('hover:text-white')
    })

    // @clause CL-FLT-002
    it('succeeds when filter button is active and maintains bg-blue-600 text-white classes', async () => {
      setupMocks({
        primaryRun: FIXTURES.runWithMultipleStatuses,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/run-multiple-statuses/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // ALL is active by default
      const allButton = screen.getByTestId('filter-btn-ALL')
      expect(allButton).toHaveClass('bg-blue-600')
      expect(allButton).toHaveClass('text-white')

      // Click on FAILED to make it active
      const failedButton = screen.getByTestId('filter-btn-FAILED')
      await userEvent.click(failedButton)

      // FAILED should now have active styles
      expect(failedButton).toHaveClass('bg-blue-600')
      expect(failedButton).toHaveClass('text-white')

      // ALL should now be inactive and have hover:text-white
      expect(allButton).toHaveClass('hover:text-white')
    })
  })

  // ===========================================================================
  // OVERVIEW CARDS LAYOUT (CL-OVC-001, CL-OVC-002)
  // ===========================================================================

  describe('Overview Cards Layout', () => {
    // @clause CL-OVC-001
    it('succeeds when overview cards grid uses grid-cols-12 with col-span distribution', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractWithExecution,
        secondaryRun: FIXTURES.executionWithLongCommit,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-with-exec/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('overview-cards')).toBeInTheDocument()
      })

      const overviewCards = screen.getByTestId('overview-cards')
      expect(overviewCards).toHaveClass('grid-cols-12')

      const progressCard = screen.getByTestId('overview-progress')
      const contractCard = screen.getByTestId('overview-contract')
      const executionCard = screen.getByTestId('overview-execution')
      const commitCard = screen.getByTestId('overview-commit')

      expect(progressCard).toHaveClass('col-span-2')
      expect(contractCard).toHaveClass('col-span-2')
      expect(executionCard).toHaveClass('col-span-2')
      expect(commitCard).toHaveClass('col-span-6')
    })

    // @clause CL-OVC-002
    it('succeeds when commitMessage has truncate class and title attribute with full text', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractWithExecution,
        secondaryRun: FIXTURES.executionWithLongCommit,
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-with-exec/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('overview-commit')).toBeInTheDocument()
      })

      const commitCard = screen.getByTestId('overview-commit')
      const commitMessageElement = commitCard.querySelector('p.truncate')

      expect(commitMessageElement).toBeInTheDocument()
      expect(commitMessageElement).toHaveClass('truncate')
      expect(commitMessageElement).toHaveAttribute(
        'title',
        'feat(components): implement very long commit message that should be truncated because it exceeds the normal width of the card and needs to show ellipsis with a tooltip containing the full text'
      )
    })

    // @clause CL-OVC-002
    it('succeeds when commitMessage is short and still has truncate class and title attribute', async () => {
      setupMocks({
        primaryRun: FIXTURES.contractWithExecution,
        secondaryRun: FIXTURES.executionWithShortCommit,
      })

      // Override the secondary run resolution
      mockApi.runs.getWithResults.mockImplementation((runId: string) => {
        if (runId === 'contract-with-exec') {
          return Promise.resolve(FIXTURES.contractWithExecution)
        }
        if (runId === 'exec-run-123' || runId === 'exec-short-commit') {
          return Promise.resolve(FIXTURES.executionWithShortCommit)
        }
        return Promise.reject(new Error('Run not found'))
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/contract-with-exec/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByTestId('overview-commit')).toBeInTheDocument()
      })

      const commitCard = screen.getByTestId('overview-commit')
      const commitMessageElement = commitCard.querySelector('p.truncate')

      expect(commitMessageElement).toBeInTheDocument()
      expect(commitMessageElement).toHaveClass('truncate')
      expect(commitMessageElement).toHaveAttribute('title', 'fix: typo')
    })
  })

  // ===========================================================================
  // INTEGRATION
  // ===========================================================================

  describe('Integration', () => {
    // @clause CL-CTX-002
    // @clause CL-BDG-001
    // @clause CL-OVC-001
    it('succeeds when all UI polish features work together in a complete run view', async () => {
      // Create a run that exercises multiple features
      const integratedRun = createRunWithResults({
        id: 'integrated-run',
        runType: 'CONTRACT',
        executionRuns: [{ id: 'integrated-exec', status: 'PASSED' }],
        gateResults: [
          createGateResult({
            gateNumber: 0,
            gateName: 'Sanitization',
            status: 'FAILED',
            failedCount: 1,
            passedCount: 1,
          }),
        ],
        validatorResults: [
          createValidatorResult({
            validatorCode: 'HARD_WITH_CONTEXT',
            validatorName: 'Hard Validator With Context',
            gateNumber: 0,
            status: 'FAILED',
            passed: false,
            isHardBlock: true,
            details: JSON.stringify({ context: createValidatorContext() }),
          }),
          createValidatorResult({
            validatorCode: 'SOFT_NO_CONTEXT',
            validatorName: 'Soft Validator No Context',
            gateNumber: 0,
            status: 'PASSED',
            passed: true,
            isHardBlock: false,
          }),
        ],
      })

      const integratedExec = createRunWithResults({
        id: 'integrated-exec',
        runType: 'EXECUTION',
        contractRunId: 'integrated-run',
        commitHash: 'int123456',
        commitMessage: 'feat: integration test with a reasonably long commit message for testing truncation behavior',
        gateResults: [
          createGateResult({ gateNumber: 2, gateName: 'Execution' }),
        ],
        validatorResults: [
          createValidatorResult({ validatorCode: 'EXEC_INT', gateNumber: 2 }),
        ],
      })

      mockApi.runs.getWithResults.mockImplementation((runId: string) => {
        if (runId === 'integrated-run') return Promise.resolve(integratedRun)
        if (runId === 'integrated-exec') return Promise.resolve(integratedExec)
        return Promise.reject(new Error('Run not found'))
      })

      renderWithRouter(<RunDetailsPageV2 />, { route: '/runs/integrated-run/v2' })

      await waitFor(() => {
        expect(screen.getByTestId('timeline-page')).toBeInTheDocument()
      })

      // Check overview cards layout
      await waitFor(() => {
        const overviewCards = screen.getByTestId('overview-cards')
        expect(overviewCards).toHaveClass('grid-cols-12')
      })

      // Check commit message truncation
      const commitCard = screen.getByTestId('overview-commit')
      expect(commitCard).toHaveClass('col-span-6')
      const commitMessageElement = commitCard.querySelector('p.truncate')
      expect(commitMessageElement).toBeInTheDocument()
      expect(commitMessageElement).toHaveAttribute('title')

      // Expand gate and check validators
      const gateToggle = screen.getByTestId('gate-toggle-0')
      await userEvent.click(gateToggle)

      await waitFor(() => {
        expect(screen.getByTestId('validator-item-HARD_WITH_CONTEXT')).toBeInTheDocument()
      })

      // Check hard badge
      const hardBadge = screen.getByTestId('hard-badge')
      expect(hardBadge.tagName.toLowerCase()).toBe('span')
      expect(hardBadge).toHaveClass('bg-destructive/20')

      // Check context panel is present for validator with context
      expect(screen.getByTestId('validator-context-panel')).toBeInTheDocument()

      // Check filter buttons have proper hover classes
      const passedButton = screen.getByTestId('filter-btn-PASSED')
      expect(passedButton).toHaveClass('hover:text-white')
    })
  })
})
