/**
 * @file run-details-page-v2-sticky-header-and-gate-cards.spec.tsx
 * @description Contract spec for /runs/:id/v2 — sticky header, gate overview cards and conditional actions.
 * @contract runs-id-v2-sticky-header-gate-cards
 * @mode STRICT
 *
 * Regras:
 * - Testa implementação REAL (RunDetailsPageV2) e apenas mocka dependências externas (API, router, toast).
 * - Sem snapshots.
 * - Sem asserts fracos como única verificação.
 * - Happy/Sad path detectados pelo nome do it(): "succeeds when" / "fails when".
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import type { GateResult, Run, RunStatus, RunWithResults, ValidatorResult } from '@/lib/types'

// =============================================================================
// HOISTED MOCKS (must be defined before vi.mock calls due to hoisting)
// =============================================================================

const {
  mockNavigate,
  mockUseRunEvents,
  mockApi,
  mockToast,
  mockGetRepoNameFromPath,
  setLastFileUploadDialogProps,
  getLastFileUploadDialogProps,
  resetLastFileUploadDialogProps,
} = vi.hoisted(() => {
  let lastFileUploadDialogProps: null | { open: boolean; runId: string } = null

  return {
    mockNavigate: vi.fn(),
    mockUseRunEvents: vi.fn(),
    mockApi: {
      runs: {
        getWithResults: vi.fn(),
        rerunGate: vi.fn(),
        bypassValidator: vi.fn(),
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

    setLastFileUploadDialogProps: (props: { open: boolean; runId: string } | null) => {
      lastFileUploadDialogProps = props
    },
    getLastFileUploadDialogProps: () => lastFileUploadDialogProps,
    resetLastFileUploadDialogProps: () => {
      lastFileUploadDialogProps = null
    },
  }
})

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/hooks/useRunEvents', () => ({
  useRunEvents: (runId: string | undefined, callback: (event: unknown) => void) => {
    mockUseRunEvents(runId, callback)
    // Não precisamos simular eventos aqui; os testes focam no render inicial + ações.
  },
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
}))

vi.mock('sonner', () => ({
  toast: mockToast,
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
  return {
    ...actual,
    getRepoNameFromPath: mockGetRepoNameFromPath,
  }
})

vi.mock('@/components/git-commit-button', () => ({
  GitCommitButton: () => <div data-testid="git-commit-button-mock" />,
}))

vi.mock('@/components/file-upload-dialog', () => ({
  FileUploadDialog: ({ open, runId }: { open: boolean; runId: string }) => {
    setLastFileUploadDialogProps(open ? { open, runId } : null)
    return open ? <div data-testid="file-upload-dialog">runId:{runId}</div> : null
  },
}))

// Component under test (REAL)
import { RunDetailsPageV2 } from '@/components/run-details-page-v2'

// =============================================================================
// FIXTURE BUILDERS (typed to real project types)
// =============================================================================

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
  return {
    gateNumber: 0,
    gateName: 'Gate',
    status: 'PASSED',
    passed: true,
    passedCount: 0,
    failedCount: 0,
    warningCount: 0,
    skippedCount: 0,
    ...overrides,
  }
}

function createValidatorResult(overrides: Partial<ValidatorResult> = {}): ValidatorResult {
  return {
    gateNumber: 0,
    validatorCode: 'V_CODE',
    validatorName: 'Validator',
    status: 'PASSED',
    passed: true,
    isHardBlock: false,
    bypassed: false,
    ...overrides,
  }
}

function createRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-id',
    outputId: '2026_01_31_003_runs_id_v2_header_cards',
    projectPath: '/home/user/projects/gatekeeper',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    manifestJson: '{}',
    testFilePath: 'src/components/__tests__/placeholder.spec.tsx',
    dangerMode: false,
    runType: 'CONTRACT',
    status: 'PASSED' as RunStatus,
    currentGate: 0,
    createdAt: '2026-01-31T00:00:00.000Z',
    updatedAt: '2026-01-31T00:00:00.000Z',
    ...overrides,
  }
}

function createRunWithResults(overrides: Partial<RunWithResults> = {}): RunWithResults {
  return {
    ...createRun({ id: 'run-with-results', ...overrides }),
    gateResults: overrides.gateResults ?? [createGateResult({ gateNumber: 0, gateName: 'Sanitization' })],
    validatorResults: overrides.validatorResults ?? [createValidatorResult({ gateNumber: 0, validatorCode: 'SAN_0' })],
    executionRuns: overrides.executionRuns,
  }
}

type Scenario = {
  primary: RunWithResults
  secondary?: RunWithResults
}

function setupApiForScenario({ primary, secondary }: Scenario) {
  mockApi.runs.getWithResults.mockImplementation((runId: string) => {
    if (runId === primary.id) return Promise.resolve(primary)
    if (secondary && runId === secondary.id) return Promise.resolve(secondary)
    return Promise.reject(new Error('Run not found'))
  })
}

function renderAtRunV2(routeRunId: string) {
  return render(
    <MemoryRouter initialEntries={[`/runs/${routeRunId}/v2`]}>
      <Routes>
        <Route path="/runs/:id/v2" element={<RunDetailsPageV2 />} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderScenarioAndWait(scenario: Scenario) {
  setupApiForScenario(scenario)
  renderAtRunV2(scenario.primary.id)

  // Wait for the page to leave loading state and render overview cards container
  await screen.findByTestId('overview-cards')
}

// =============================================================================
// BASE SCENARIOS
// =============================================================================

const BASE_CONTRACT_ID = 'contract-run-1'
const BASE_EXECUTION_ID = 'execution-run-1'

function scenarioAllPassed(): Scenario {
  const execution: RunWithResults = createRunWithResults({
    ...createRun({
      id: BASE_EXECUTION_ID,
      runType: 'EXECUTION',
      status: 'PASSED',
      contractRunId: BASE_CONTRACT_ID,
    }),
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execução', status: 'PASSED', passed: true, passedCount: 2 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', status: 'PASSED', passed: true, passedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({ gateNumber: 2, status: 'PASSED', passed: true, validatorCode: 'EXEC_OK' }),
      createValidatorResult({ gateNumber: 3, status: 'PASSED', passed: true, validatorCode: 'INT_OK' }),
    ],
  })

  const contract: RunWithResults = createRunWithResults({
    ...createRun({
      id: BASE_CONTRACT_ID,
      runType: 'CONTRACT',
      status: 'PASSED',
      taskPrompt: 'Do something important.',
    }),
    executionRuns: [createRun({ id: BASE_EXECUTION_ID, runType: 'EXECUTION', status: 'PASSED' })],
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'PASSED', passed: true, passedCount: 2 }),
      createGateResult({ gateNumber: 1, gateName: 'Contrato', status: 'PASSED', passed: true, passedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({ gateNumber: 0, status: 'PASSED', passed: true, validatorCode: 'SAN_OK' }),
      createValidatorResult({ gateNumber: 1, status: 'PASSED', passed: true, validatorCode: 'CON_OK' }),
    ],
  })

  return { primary: contract, secondary: execution }
}

function scenarioGate0Failed(): Scenario {
  const base = scenarioAllPassed()
  const contract = {
    ...base.primary,
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'FAILED', passed: false, failedCount: 1 }),
      createGateResult({ gateNumber: 1, gateName: 'Contrato', status: 'PASSED', passed: true, passedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({
        gateNumber: 0,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        validatorCode: 'SAN_FAIL_HARD',
        validatorName: 'Sanitization Hard Failure',
      }),
      createValidatorResult({ gateNumber: 1, status: 'PASSED', passed: true, validatorCode: 'CON_OK' }),
    ],
  }
  return { ...base, primary: contract }
}

function scenarioGate1Failed(): Scenario {
  const base = scenarioAllPassed()
  const contract = {
    ...base.primary,
    gateResults: [
      createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'PASSED', passed: true, passedCount: 1 }),
      createGateResult({ gateNumber: 1, gateName: 'Contrato', status: 'FAILED', passed: false, failedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({ gateNumber: 0, status: 'PASSED', passed: true, validatorCode: 'SAN_OK' }),
      createValidatorResult({
        gateNumber: 1,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        validatorCode: 'CON_FAIL_HARD',
        validatorName: 'Contract Hard Failure',
      }),
    ],
  }
  return { ...base, primary: contract }
}

function scenarioGate2Failed(): Scenario {
  const base = scenarioAllPassed()
  const execution = {
    ...base.secondary!,
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execução', status: 'FAILED', passed: false, failedCount: 1 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', status: 'PASSED', passed: true, passedCount: 1 }),
    ],
    validatorResults: [
      createValidatorResult({
        gateNumber: 2,
        status: 'FAILED',
        passed: false,
        isHardBlock: true,
        validatorCode: 'EXEC_FAIL_HARD',
        validatorName: 'Execution Hard Failure',
      }),
      createValidatorResult({ gateNumber: 3, status: 'PASSED', passed: true, validatorCode: 'INT_OK' }),
    ],
  }
  return { primary: base.primary, secondary: execution }
}

function scenarioGate3Running(): Scenario {
  const base = scenarioAllPassed()
  const execution = {
    ...base.secondary!,
    gateResults: [
      createGateResult({ gateNumber: 2, gateName: 'Execução', status: 'PASSED', passed: true, passedCount: 1 }),
      createGateResult({ gateNumber: 3, gateName: 'Integrity', status: 'RUNNING', passed: false, failedCount: 0 }),
    ],
    validatorResults: [
      createValidatorResult({ gateNumber: 2, status: 'PASSED', passed: true, validatorCode: 'EXEC_OK' }),
      createValidatorResult({ gateNumber: 3, status: 'RUNNING', passed: false, validatorCode: 'INT_RUNNING' }),
    ],
  }
  return { primary: base.primary, secondary: execution }
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  resetLastFileUploadDialogProps()
})

describe('Pipeline guards (meta)', () => {
  // @clause CL-UI-V2-010
  it('fails when a new helper method expected by the contract does not exist yet', async () => {
    // This is intentionally a contract guard:
    // The implementation is expected to introduce an exported helper for gate->runId mapping.
    const mod = await import('@/components/run-details-page-v2')
    expect(typeof (mod as any).getGateActionRunId).toBe('function')
  })

  // @clause CL-UI-V2-001
  it('fails when legacy "New Run" label is still present in the V2 header', async () => {
    await renderScenarioAndWait(scenarioAllPassed())
    expect(screen.queryByText('New Run')).not.toBeInTheDocument()
  })
})

describe('/runs/:id/v2 — sticky header + gate overview cards + conditional actions', () => {
  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-001
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-001 — CTA "Nova Validação" no header', () => {
    // @clause CL-UI-V2-001
    it('succeeds when the header renders a CTA labeled "Nova Validação"', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const cta = await screen.findByTestId('btn-new-run')
      expect(cta).toHaveTextContent('Nova Validação')
    })

    // @clause CL-UI-V2-001
    it('succeeds when clicking the CTA navigates to /runs/new', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const cta = await screen.findByTestId('btn-new-run')
      await userEvent.click(cta)

      expect(mockNavigate).toHaveBeenCalledWith('/runs/new')
    })

    // @clause CL-UI-V2-001
    it('fails when the legacy header CTA label is still rendered', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      // Contract requires the legacy label to be removed.
      expect(screen.queryByText('New Run')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-002
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-002 — Header sticky always', () => {
    // @clause CL-UI-V2-002
    it('succeeds when the sticky header wrapper exists with the expected testid', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const sticky = await screen.findByTestId('run-details-v2-sticky-header')
      expect(sticky).toBeInTheDocument()
    })

    // @clause CL-UI-V2-002
    it('succeeds when the sticky header has sticky + top-0 classes (or equivalent)', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const sticky = await screen.findByTestId('run-details-v2-sticky-header')
      expect(sticky.className).toContain('sticky')
      expect(sticky.className).toContain('top-0')
    })

    // @clause CL-UI-V2-002
    it('fails when the sticky header wrapper is missing sticky behavior classes', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const sticky = await screen.findByTestId('run-details-v2-sticky-header')
      expect(sticky).toHaveClass('sticky')
      expect(sticky).toHaveClass('top-0')
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-003
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-003 — Layout 2 linhas e ordem dos overview cards', () => {
    // @clause CL-UI-V2-003
    it('succeeds when "Prompt da Tarefa" card appears before the other overview cards', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const wrapper = await screen.findByTestId('overview-cards')
      const prompt = within(wrapper).getByTestId('overview-task-prompt')
      const progress = within(wrapper).getByTestId('overview-progress')

      // prompt must be above (earlier in DOM) than the row of cards
      const pos = prompt.compareDocumentPosition(progress)
      expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
    })

    // @clause CL-UI-V2-003
    it('succeeds when the second-row cards exist in order: Progresso, Sanitization, Contrato, Execução, Integrity', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const wrapper = await screen.findByTestId('overview-cards')
      const ids = [
        'overview-progress',
        'overview-sanitization',
        'overview-contract',
        'overview-execution',
        'overview-integrity',
      ]

      const nodes = ids.map((id) => within(wrapper).getByTestId(id))
      for (let i = 0; i < nodes.length - 1; i++) {
        const pos = nodes[i].compareDocumentPosition(nodes[i + 1])
        expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
      }
    })

    // @clause CL-UI-V2-003
    it('fails when any of the required overview cards is missing', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      // These MUST exist according to contract.
      expect(screen.getByTestId('overview-sanitization')).toBeInTheDocument()
      expect(screen.getByTestId('overview-integrity')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-004
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-004 — Card Progresso com 3 linhas (passaram/skipped/falharam)', () => {
    // @clause CL-UI-V2-004
    it('succeeds when Progresso shows "X / N passaram"', async () => {
      const base = scenarioAllPassed()

      // Override validator mix to create deterministic counts
      base.primary = {
        ...base.primary,
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: 'PASSED', passed: true, validatorCode: 'P1' }),
          createValidatorResult({ gateNumber: 0, status: 'PASSED', passed: true, validatorCode: 'P2' }),
          createValidatorResult({ gateNumber: 1, status: 'SKIPPED', passed: false, validatorCode: 'S1' }),
        ],
      }
      base.secondary = {
        ...base.secondary!,
        validatorResults: [
          createValidatorResult({ gateNumber: 2, status: 'SKIPPED', passed: false, validatorCode: 'S2' }),
          createValidatorResult({ gateNumber: 2, status: 'FAILED', passed: false, validatorCode: 'F1' }),
          createValidatorResult({ gateNumber: 3, status: 'SKIPPED', passed: false, validatorCode: 'S3' }),
        ],
      }

      await renderScenarioAndWait(base)

      const progress = await screen.findByTestId('overview-progress')
      expect(progress).toHaveTextContent('2 / 6 passaram')
    })

    // @clause CL-UI-V2-004
    it('succeeds when Progresso shows "Y / N skipped"', async () => {
      const base = scenarioAllPassed()
      base.primary = {
        ...base.primary,
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: 'PASSED', passed: true, validatorCode: 'P1' }),
          createValidatorResult({ gateNumber: 1, status: 'SKIPPED', passed: false, validatorCode: 'S1' }),
        ],
      }
      base.secondary = {
        ...base.secondary!,
        validatorResults: [
          createValidatorResult({ gateNumber: 2, status: 'SKIPPED', passed: false, validatorCode: 'S2' }),
          createValidatorResult({ gateNumber: 3, status: 'FAILED', passed: false, validatorCode: 'F1' }),
        ],
      }

      await renderScenarioAndWait(base)

      const progress = await screen.findByTestId('overview-progress')
      expect(progress).toHaveTextContent('2 / 5 skipped')
    })

    // @clause CL-UI-V2-004
    it('succeeds when Progresso shows "Z / N falharam"', async () => {
      const base = scenarioAllPassed()
      base.primary = {
        ...base.primary,
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            status: 'FAILED',
            passed: false,
            validatorCode: 'F1',
            isHardBlock: true,
          }),
          createValidatorResult({ gateNumber: 1, status: 'PASSED', passed: true, validatorCode: 'P1' }),
        ],
      }
      base.secondary = {
        ...base.secondary!,
        validatorResults: [createValidatorResult({ gateNumber: 2, status: 'SKIPPED', passed: false, validatorCode: 'S1' })],
      }

      await renderScenarioAndWait(base)

      const progress = await screen.findByTestId('overview-progress')
      expect(progress).toHaveTextContent('1 / 3 falharam')
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-005
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-005 — Tradução de labels "Passed"/"Failed" para "Passaram"/"Falharam"', () => {
    // @clause CL-UI-V2-005
    it('succeeds when gate summaries render "Passaram" instead of "Passed"', async () => {
      const base = scenarioGate1Failed()
      await renderScenarioAndWait(base)

      expect(screen.getByText(/Passaram/)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-005
    it('succeeds when gate summaries render "Falharam" instead of "Failed"', async () => {
      const base = scenarioGate1Failed()
      await renderScenarioAndWait(base)

      expect(screen.getByText(/Falharam/)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-005
    it('fails when any gate summary still contains the legacy English labels', async () => {
      const base = scenarioGate1Failed()
      await renderScenarioAndWait(base)

      expect(screen.queryByText(/Passed/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-006
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-006 — Card Sanitization (gate 0) status logic', () => {
    // @clause CL-UI-V2-006
    it('succeeds when Sanitization shows FAILED if any validator FAILED in gate 0', async () => {
      await renderScenarioAndWait(scenarioGate0Failed())

      const card = await screen.findByTestId('overview-sanitization')
      expect(within(card).getByText(/Failed/i)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-006
    it('succeeds when Sanitization shows RUNNING if execution is in progress', async () => {
      const base = scenarioAllPassed()
      base.primary = {
        ...base.primary,
        gateResults: [
          createGateResult({ gateNumber: 0, gateName: 'Sanitization', status: 'RUNNING', passed: false }),
          createGateResult({ gateNumber: 1, gateName: 'Contrato', status: 'PASSED', passed: true, passedCount: 1 }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: 'RUNNING', passed: false, validatorCode: 'SAN_RUNNING' }),
          createValidatorResult({ gateNumber: 1, status: 'PASSED', passed: true, validatorCode: 'CON_OK' }),
        ],
      }

      await renderScenarioAndWait(base)

      const card = await screen.findByTestId('overview-sanitization')
      expect(within(card).getByText(/Running/i)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-006
    it('succeeds when Sanitization shows PASSED when there is no FAILED and no running execution', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const card = await screen.findByTestId('overview-sanitization')
      expect(within(card).getByText(/Passed/i)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-007
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-007 — Card Integrity (gate 3) status logic', () => {
    // @clause CL-UI-V2-007
    it('succeeds when Integrity shows RUNNING if gate 3 is in progress', async () => {
      await renderScenarioAndWait(scenarioGate3Running())

      const card = await screen.findByTestId('overview-integrity')
      expect(within(card).getByText(/Running/i)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-007
    it('succeeds when Integrity shows FAILED if any validator FAILED in gate 3', async () => {
      const base = scenarioAllPassed()
      base.secondary = {
        ...base.secondary!,
        gateResults: [
          createGateResult({ gateNumber: 2, gateName: 'Execução', status: 'PASSED', passed: true, passedCount: 1 }),
          createGateResult({ gateNumber: 3, gateName: 'Integrity', status: 'FAILED', passed: false, failedCount: 1 }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 2, status: 'PASSED', passed: true, validatorCode: 'EXEC_OK' }),
          createValidatorResult({
            gateNumber: 3,
            status: 'FAILED',
            passed: false,
            isHardBlock: true,
            validatorCode: 'INT_FAIL_HARD',
          }),
        ],
      }

      await renderScenarioAndWait(base)

      const card = await screen.findByTestId('overview-integrity')
      expect(within(card).getByText(/Failed/i)).toBeInTheDocument()
    })

    // @clause CL-UI-V2-007
    it('succeeds when Integrity shows PASSED when there is no FAILED and no running execution', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const card = await screen.findByTestId('overview-integrity')
      expect(within(card).getByText(/Passed/i)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-008
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-008 — Linha de ações por card (Upload/Rerun/Bypass) + tooltips', () => {
    // @clause CL-UI-V2-008
    it('succeeds when each gate card renders Upload/Rerun/Bypass buttons with stable testids', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const required = [
        'card-actions-upload-g0',
        'card-actions-rerun-g0',
        'card-actions-bypass-g0',
        'card-actions-upload-g1',
        'card-actions-rerun-g1',
        'card-actions-bypass-g1',
        'card-actions-upload-g2',
        'card-actions-rerun-g2',
        'card-actions-bypass-g2',
        'card-actions-upload-g3',
        'card-actions-rerun-g3',
        'card-actions-bypass-g3',
      ]

      for (const tid of required) {
        expect(screen.getByTestId(tid)).toBeInTheDocument()
      }
    })

    // @clause CL-UI-V2-008
    it('succeeds when hovering Upload shows tooltip "Upload de novos artefatos"', async () => {
      await renderScenarioAndWait(scenarioGate0Failed())

      const upload = screen.getByTestId('card-actions-upload-g0')
      await userEvent.hover(upload)

      // Tooltip content must be exact per contract.
      expect(await screen.findByText('Upload de novos artefatos')).toBeInTheDocument()
    })

    // @clause CL-UI-V2-008
    it('succeeds when the action buttons are rendered in the required order: Upload, Rerun, Bypass', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const card = screen.getByTestId('overview-contract')
      const upload = within(card).getByTestId('card-actions-upload-g1')
      const rerun = within(card).getByTestId('card-actions-rerun-g1')
      const bypass = within(card).getByTestId('card-actions-bypass-g1')

      const pos1 = upload.compareDocumentPosition(rerun)
      const pos2 = rerun.compareDocumentPosition(bypass)
      expect(pos1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
      expect(pos2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-009
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-009 — Enable/disable das ações só quando houver FAILED no gate correspondente', () => {
    // @clause CL-UI-V2-009
    it('succeeds when no gate has FAILED and all action buttons are disabled', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const all = [
        'card-actions-upload-g0',
        'card-actions-rerun-g0',
        'card-actions-bypass-g0',
        'card-actions-upload-g1',
        'card-actions-rerun-g1',
        'card-actions-bypass-g1',
        'card-actions-upload-g2',
        'card-actions-rerun-g2',
        'card-actions-bypass-g2',
        'card-actions-upload-g3',
        'card-actions-rerun-g3',
        'card-actions-bypass-g3',
      ]

      for (const tid of all) {
        expect(screen.getByTestId(tid)).toBeDisabled()
      }
    })

    // @clause CL-UI-V2-009
    // @ui-clause CL-UI-RunDetailsPageV2-gate0-enabled
    it('succeeds when gate 0 has FAILED and only gate 0 actions are enabled', async () => {
      await renderScenarioAndWait(scenarioGate0Failed())

      expect(screen.getByTestId('card-actions-upload-g0')).toBeEnabled()
      expect(screen.getByTestId('card-actions-rerun-g0')).toBeEnabled()
      expect(screen.getByTestId('card-actions-bypass-g0')).toBeEnabled()

      expect(screen.getByTestId('card-actions-upload-g1')).toBeDisabled()
      expect(screen.getByTestId('card-actions-upload-g2')).toBeDisabled()
      expect(screen.getByTestId('card-actions-upload-g3')).toBeDisabled()
    })

    // @clause CL-UI-V2-009
    // @ui-clause CL-UI-RunDetailsPageV2-gate2-enabled
    it('succeeds when gate 2 has FAILED and only gate 2 actions are enabled', async () => {
      await renderScenarioAndWait(scenarioGate2Failed())

      expect(screen.getByTestId('card-actions-upload-g2')).toBeEnabled()
      expect(screen.getByTestId('card-actions-rerun-g2')).toBeEnabled()
      expect(screen.getByTestId('card-actions-bypass-g2')).toBeEnabled()

      expect(screen.getByTestId('card-actions-upload-g0')).toBeDisabled()
      expect(screen.getByTestId('card-actions-upload-g1')).toBeDisabled()
      expect(screen.getByTestId('card-actions-upload-g3')).toBeDisabled()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-010
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-010 — Upload abre FileUploadDialog com runId correto', () => {
    // @clause CL-UI-V2-010
    it('succeeds when clicking Upload on gate 0 opens FileUploadDialog with contractRun.id', async () => {
      const scenario = scenarioGate0Failed()
      await renderScenarioAndWait(scenario)

      await userEvent.click(screen.getByTestId('card-actions-upload-g0'))

      // FileUploadDialog is mocked only to capture props; the open/close behavior is from RunDetailsPageV2.
      await waitFor(() => {
        expect(getLastFileUploadDialogProps()?.runId).toBe(scenario.primary.id)
      })
      expect(screen.getByTestId('file-upload-dialog')).toHaveTextContent(`runId:${scenario.primary.id}`)
    })

    // @clause CL-UI-V2-010
    it('succeeds when clicking Upload on gate 2 opens FileUploadDialog with executionRun.id', async () => {
      const scenario = scenarioGate2Failed()
      await renderScenarioAndWait(scenario)

      await userEvent.click(screen.getByTestId('card-actions-upload-g2'))

      await waitFor(() => {
        expect(getLastFileUploadDialogProps()?.runId).toBe(scenario.secondary!.id)
      })
      expect(screen.getByTestId('file-upload-dialog')).toHaveTextContent(`runId:${scenario.secondary!.id}`)
    })

    // @clause CL-UI-V2-010
    it('fails when Upload is disabled and therefore must not open the dialog', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const upload = screen.getByTestId('card-actions-upload-g0')
      expect(upload).toBeDisabled()

      // Clicking disabled buttons should not trigger dialog.
      await userEvent.click(upload)
      expect(getLastFileUploadDialogProps()).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-011
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-011 — Rerun chama api.runs.rerunGate(runId, gateNumber) e exibe toast', () => {
    // @clause CL-UI-V2-011
    it('succeeds when clicking Rerun on gate 1 calls rerunGate(contractRun.id, 1)', async () => {
      const scenario = scenarioGate1Failed()
      await renderScenarioAndWait(scenario)

      mockApi.runs.rerunGate.mockResolvedValueOnce(undefined)

      await userEvent.click(screen.getByTestId('card-actions-rerun-g1'))

      await waitFor(() => {
        expect(mockApi.runs.rerunGate).toHaveBeenCalledWith(scenario.primary.id, 1)
      })
      expect(mockToast.success).toHaveBeenCalled()
    })

    // @clause CL-UI-V2-011
    it('succeeds when clicking Rerun on gate 2 calls rerunGate(executionRun.id, 2)', async () => {
      const scenario = scenarioGate2Failed()
      await renderScenarioAndWait(scenario)

      mockApi.runs.rerunGate.mockResolvedValueOnce(undefined)

      await userEvent.click(screen.getByTestId('card-actions-rerun-g2'))

      await waitFor(() => {
        expect(mockApi.runs.rerunGate).toHaveBeenCalledWith(scenario.secondary!.id, 2)
      })
      expect(mockToast.success).toHaveBeenCalled()
    })

    // @clause CL-UI-V2-011
    it('fails when rerunGate rejects and a toast error is shown', async () => {
      const scenario = scenarioGate2Failed()
      await renderScenarioAndWait(scenario)

      mockApi.runs.rerunGate.mockRejectedValueOnce(new Error('boom'))

      await userEvent.click(screen.getByTestId('card-actions-rerun-g2'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // @clause CL-UI-V2-012
  // ---------------------------------------------------------------------------

  describe('CL-UI-V2-012 — Bypass seleciona validator FAILED bypassable e chama api.runs.bypassValidator', () => {
    // @clause CL-UI-V2-012
    it('succeeds when gate 0 bypass allows selecting a FAILED hard-block validator and calls bypassValidator(contractRun.id, code)', async () => {
      const scenario = scenarioGate0Failed()
      await renderScenarioAndWait(scenario)

      mockApi.runs.bypassValidator.mockResolvedValueOnce(undefined)

      await userEvent.click(screen.getByTestId('card-actions-bypass-g0'))

      // Contract: must allow selecting at least one FAILED bypassable validator.
      // We assert that the failed validator code appears as an option and can be selected.
      const option = await screen.findByText('SAN_FAIL_HARD')
      await userEvent.click(option)

      await waitFor(() => {
        expect(mockApi.runs.bypassValidator).toHaveBeenCalledWith(scenario.primary.id, 'SAN_FAIL_HARD')
      })
      expect(mockToast.success).toHaveBeenCalled()
    })

    // @clause CL-UI-V2-012
    it('succeeds when gate 2 bypass allows selecting a FAILED hard-block validator and calls bypassValidator(executionRun.id, code)', async () => {
      const scenario = scenarioGate2Failed()
      await renderScenarioAndWait(scenario)

      mockApi.runs.bypassValidator.mockResolvedValueOnce(undefined)

      await userEvent.click(screen.getByTestId('card-actions-bypass-g2'))

      const option = await screen.findByText('EXEC_FAIL_HARD')
      await userEvent.click(option)

      await waitFor(() => {
        expect(mockApi.runs.bypassValidator).toHaveBeenCalledWith(scenario.secondary!.id, 'EXEC_FAIL_HARD')
      })
      expect(mockToast.success).toHaveBeenCalled()
    })

    // @clause CL-UI-V2-012
    it('fails when there are no FAILED bypassable validators in the gate and the selection UI must not appear', async () => {
      await renderScenarioAndWait(scenarioAllPassed())

      const btn = screen.getByTestId('card-actions-bypass-g0')
      expect(btn).toBeDisabled()

      await userEvent.click(btn)
      expect(screen.queryByText('SAN_FAIL_HARD')).not.toBeInTheDocument()
      expect(mockApi.runs.bypassValidator).not.toHaveBeenCalled()
    })
  })
})
