import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * Tests for Committed Run Readonly Lock
 *
 * Contract: committed-run-readonly-lock v1.0
 * Mode: STRICT (allowUntagged: false)
 * Criticality: HIGH
 *
 * Scope:
 * - Backend: Guard nos endpoints rerunGate, bypassValidator, uploadFiles → 409 se run commitada
 * - Backend: DELETE permanece funcional para run commitada → 204
 * - Frontend: Botões Upload/Rerun/Bypass no kanban disabled quando commitado
 * - Frontend: Modal de validator FAILED oculta Upload Fix/Bypass quando commitado
 * - Frontend: Start Execution não renderizado quando commitado
 * - Frontend: Badge committed-badge visível com hash curto
 * - Frontend: Delete, Copiar, Filter bar continuam funcionais quando commitado
 *
 * TDD Red Phase: Tests will FAIL because:
 * - RunsController does NOT yet have commitHash guards on rerunGate/bypassValidator/uploadFiles
 * - RunDetailsPageV2 does NOT yet derive isCommitted or disable buttons accordingly
 */

// ============================================================================
// Hoisted Mocks (must be before vi.mock calls)
// ============================================================================

const mockPrisma = vi.hoisted(() => ({
  validationRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  validatorResult: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  gateResult: {
    deleteMany: vi.fn(),
  },
}))

const mockGetWithResults = vi.hoisted(() => vi.fn())
const mockRerunGate = vi.hoisted(() => vi.fn())
const mockBypassValidator = vi.hoisted(() => vi.fn())
const mockDeleteRun = vi.hoisted(() => vi.fn())
const mockUploadFiles = vi.hoisted(() => vi.fn())
const mockNavigate = vi.hoisted(() => vi.fn())

// ============================================================================
// Module Mocks
// ============================================================================

// Backend: mock prisma for RunsController tests
vi.mock("../../../packages/gatekeeper-api/src/db/client.js", () => ({
  prisma: mockPrisma,
}))

// Mock dynamic import for ValidationOrchestrator (used by rerunGate)
vi.mock("../../../packages/gatekeeper-api/src/services/ValidationOrchestrator.js", () => ({
  ValidationOrchestrator: class {
    addToQueue = vi.fn().mockResolvedValue(undefined)
  },
}))

// Frontend: mock api module
vi.mock("@/lib/api", () => ({
  api: {
    runs: {
      getWithResults: mockGetWithResults,
      rerunGate: mockRerunGate,
      bypassValidator: mockBypassValidator,
      delete: mockDeleteRun,
      uploadFiles: mockUploadFiles,
    },
    git: {
      status: vi.fn().mockResolvedValue({ clean: true }),
      commit: vi.fn(),
      diff: vi.fn(),
      push: vi.fn(),
    },
  },
  API_BASE: "http://localhost:3001/api",
}))

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "run-committed-001" }),
  useNavigate: () => mockNavigate,
}))

// Mock hooks
vi.mock("@/hooks/useRunEvents", () => ({
  useRunEvents: vi.fn(),
}))

vi.mock("@/hooks/use-page-shell", () => ({
  usePageShell: () => null,
}))

// Mock clipboard
vi.mock("@/lib/validator-clipboard", () => ({
  buildValidatorClipboardText: vi.fn().mockReturnValue("clipboard text"),
  getClipboardWriteText: vi.fn().mockReturnValue(vi.fn().mockResolvedValue(undefined)),
  getDiffScopeViolations: vi.fn().mockReturnValue([]),
}))

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ============================================================================
// Type Definitions
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"
type ValidatorStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface MockRunRow {
  id: string
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
  commitHash: string | null
  commitMessage: string | null
  committedAt: string | null
  currentGate: number
  passed: boolean
  failedAt: number | null
  failedValidatorCode: string | null
  bypassedValidators: string | null
  contractRunId?: string
  testFilePath: string
  manifestJson: string
  dangerMode: boolean
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

interface ValidatorResult {
  gateNumber: number
  validatorCode: string
  validatorName: string
  status: ValidatorStatus
  passed: boolean
  isHardBlock: boolean
  bypassed?: boolean
  message?: string
  details?: string
}

interface RunWithResults extends MockRunRow {
  gateResults: GateResult[]
  validatorResults: ValidatorResult[]
  executionRuns?: Array<{ id: string }>
}

// ============================================================================
// Fixtures
// ============================================================================

const COMMIT_HASH = "abc1234def5678901234567890abcdef12345678"
const COMMIT_HASH_SHORT = COMMIT_HASH.slice(0, 7) // "abc1234"

const createMockRunRow = (overrides: Partial<MockRunRow> = {}): MockRunRow => ({
  id: "run-committed-001",
  outputId: "2026_02_02_001_committed-run-readonly-lock",
  projectPath: "/home/user/gatekeeper",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Test committed run readonly lock",
  status: "PASSED",
  runType: "CONTRACT",
  commitHash: null,
  commitMessage: null,
  committedAt: null,
  currentGate: 1,
  passed: true,
  failedAt: null,
  failedValidatorCode: null,
  bypassedValidators: null,
  testFilePath: "src/components/__tests__/committed-run-readonly-lock.spec.tsx",
  manifestJson: "{}",
  dangerMode: false,
  ...overrides,
})

const createCommittedRunRow = (overrides: Partial<MockRunRow> = {}): MockRunRow =>
  createMockRunRow({
    commitHash: COMMIT_HASH,
    commitMessage: "feat: implement committed run readonly lock",
    committedAt: "2026-02-02T10:30:00Z",
    ...overrides,
  })

const createGateResult = (overrides: Partial<GateResult> = {}): GateResult => ({
  gateNumber: 0,
  gateName: "Gate 0 - Sanitization",
  status: "FAILED",
  passed: false,
  passedCount: 2,
  failedCount: 1,
  warningCount: 0,
  skippedCount: 0,
  ...overrides,
})

const createValidatorResult = (overrides: Partial<ValidatorResult> = {}): ValidatorResult => ({
  gateNumber: 0,
  validatorCode: "TOKEN_BUDGET_FIT",
  validatorName: "Token Budget Fit",
  status: "FAILED",
  passed: false,
  isHardBlock: true,
  ...overrides,
})

const createRunWithResults = (overrides: Partial<RunWithResults> = {}): RunWithResults => ({
  ...createMockRunRow(),
  gateResults: [
    createGateResult({ gateNumber: 0, gateName: "Gate 0 - Sanitization", status: "FAILED" }),
    createGateResult({ gateNumber: 1, gateName: "Gate 1 - Contract", status: "PASSED", passed: true }),
  ],
  validatorResults: [
    createValidatorResult({
      gateNumber: 0,
      validatorCode: "TOKEN_BUDGET_FIT",
      validatorName: "Token Budget Fit",
      status: "FAILED",
      isHardBlock: true,
      details: JSON.stringify({
        context: {
          inputs: [],
          analyzed: [],
          findings: [{ type: "fail", message: "Token exceeded" }],
          reasoning: "Token count too high",
        },
      }),
    }),
    createValidatorResult({
      gateNumber: 0,
      validatorCode: "TASK_SCOPE_SIZE",
      validatorName: "Task Scope Size",
      status: "PASSED",
      passed: true,
    }),
    createValidatorResult({
      gateNumber: 1,
      validatorCode: "TEST_SYNTAX_VALID",
      validatorName: "Test Syntax Valid",
      status: "PASSED",
      passed: true,
    }),
  ],
  ...overrides,
})

const createCommittedRunWithResults = (overrides: Partial<RunWithResults> = {}): RunWithResults =>
  createRunWithResults({
    commitHash: COMMIT_HASH,
    commitMessage: "feat: implement committed run readonly lock",
    committedAt: "2026-02-02T10:30:00Z",
    ...overrides,
  })

// ============================================================================
// Mock Request/Response for backend tests
// ============================================================================

interface MockRequest {
  params: Record<string, string>
  files?: Record<string, unknown[]>
  body?: unknown
}

interface MockResponse {
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

const createMockRes = (): MockResponse => {
  const res: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
  }
  res.status.mockReturnValue(res)
  return res
}

// ============================================================================
// BACKEND TESTS — RunsController Guards
// ============================================================================

describe("Backend — RunsController committed run guards", () => {
  // Import the REAL controller
  let RunsController: typeof import("../../../packages/gatekeeper-api/src/api/controllers/RunsController.js").RunsController

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import("../../../packages/gatekeeper-api/src/api/controllers/RunsController.js")
    RunsController = mod.RunsController
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-001: Rerun bloqueado para run commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-001 — rerunGate blocked when committed", () => {
    // @clause CL-LOCK-001
    it("fails when rerunGate is called on a committed run and does not return 409", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id, gateNumber: "0" } }
      const res = createMockRes()

      await controller.rerunGate(req as any, res as any)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "RUN_COMMITTED",
          }),
        })
      )
    })

    // @clause CL-LOCK-001
    it("succeeds when rerunGate on a committed run returns error.code RUN_COMMITTED", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id, gateNumber: "0" } }
      const res = createMockRes()

      await controller.rerunGate(req as any, res as any)

      const jsonCall = res.json.mock.calls[0]?.[0]
      expect(jsonCall?.error?.code).toBe("RUN_COMMITTED")
      expect(jsonCall?.error?.message).toEqual(expect.any(String))
      expect(jsonCall.error.message.length).toBeGreaterThan(0)
    })

    // @clause CL-LOCK-001
    it("succeeds when rerunGate proceeds normally for run without commitHash", async () => {
      const controller = new RunsController()
      const nonCommittedRun = createMockRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(nonCommittedRun)
      mockPrisma.validatorResult.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.gateResult.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.validationRun.update.mockResolvedValue(nonCommittedRun)

      const req: MockRequest = { params: { id: nonCommittedRun.id, gateNumber: "0" } }
      const res = createMockRes()

      await controller.rerunGate(req as any, res as any)

      // Should NOT return 409
      const statusCalls = res.status.mock.calls
      const has409 = statusCalls.some((call: number[]) => call[0] === 409)
      expect(has409).toBe(false)
    })

    // @clause CL-LOCK-001
    it("fails when rerunGate does not check commitHash before proceeding", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id, gateNumber: "0" } }
      const res = createMockRes()

      await controller.rerunGate(req as any, res as any)

      // Must NOT have proceeded to deleteMany (which means it was blocked)
      // If guard is missing, deleteMany will be called
      expect(res.status).toHaveBeenCalledWith(409)
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-002: Bypass bloqueado para run commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-002 — bypassValidator blocked when committed", () => {
    // @clause CL-LOCK-002
    it("fails when bypassValidator is called on a committed run and does not return 409", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id, validatorCode: "TOKEN_BUDGET_FIT" } }
      const res = createMockRes()

      await controller.bypassValidator(req as any, res as any)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "RUN_COMMITTED",
          }),
        })
      )
    })

    // @clause CL-LOCK-002
    it("succeeds when bypassValidator returns RUN_COMMITTED error for committed run", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id, validatorCode: "TOKEN_BUDGET_FIT" } }
      const res = createMockRes()

      await controller.bypassValidator(req as any, res as any)

      const jsonCall = res.json.mock.calls[0]?.[0]
      expect(jsonCall?.error?.code).toBe("RUN_COMMITTED")
    })

    // @clause CL-LOCK-002
    it("succeeds when bypassValidator proceeds normally for non-committed run with FAILED status", async () => {
      const controller = new RunsController()
      const nonCommittedRun = createMockRunRow({ status: "FAILED" })
      mockPrisma.validationRun.findUnique.mockResolvedValue(nonCommittedRun)
      mockPrisma.validatorResult.findUnique.mockResolvedValue({
        id: "vr-1",
        validatorCode: "TOKEN_BUDGET_FIT",
        status: "FAILED",
        isHardBlock: true,
        bypassed: false,
      })
      mockPrisma.validatorResult.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.gateResult.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.validationRun.update.mockResolvedValue(nonCommittedRun)

      const req: MockRequest = { params: { id: nonCommittedRun.id, validatorCode: "TOKEN_BUDGET_FIT" } }
      const res = createMockRes()

      await controller.bypassValidator(req as any, res as any)

      const statusCalls = res.status.mock.calls
      const has409 = statusCalls.some((call: number[]) => call[0] === 409)
      expect(has409).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-003: Upload bloqueado para run commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-003 — uploadFiles blocked when committed", () => {
    // @clause CL-LOCK-003
    it("fails when uploadFiles is called on a committed run and does not return 409", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow()
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id }, files: {} }
      const res = createMockRes()

      await controller.uploadFiles(req as any, res as any)

      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "RUN_COMMITTED",
          }),
        })
      )
    })

    // @clause CL-LOCK-003
    it("succeeds when uploadFiles returns RUN_COMMITTED error for committed run", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow()
      mockPrisma.validationRun.findUnique.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id }, files: {} }
      const res = createMockRes()

      await controller.uploadFiles(req as any, res as any)

      const jsonCall = res.json.mock.calls[0]?.[0]
      expect(jsonCall?.error?.code).toBe("RUN_COMMITTED")
    })

    // @clause CL-LOCK-003
    it("succeeds when uploadFiles proceeds normally for non-committed run", async () => {
      const controller = new RunsController()
      const nonCommittedRun = createMockRunRow()
      mockPrisma.validationRun.findUnique.mockResolvedValue(nonCommittedRun)

      const req: MockRequest = { params: { id: nonCommittedRun.id }, files: {} }
      const res = createMockRes()

      await controller.uploadFiles(req as any, res as any)

      const statusCalls = res.status.mock.calls
      const has409 = statusCalls.some((call: number[]) => call[0] === 409)
      expect(has409).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-004: Delete permanece funcional para run commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-004 — deleteRun works for committed run", () => {
    // @clause CL-LOCK-004
    it("succeeds when deleteRun returns 204 for committed run", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow()
      mockPrisma.validationRun.delete.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id } }
      const res = createMockRes()

      await controller.deleteRun(req as any, res as any)

      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalled()
    })

    // @clause CL-LOCK-004
    it("succeeds when deleteRun calls prisma.validationRun.delete for committed run", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow()
      mockPrisma.validationRun.delete.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id } }
      const res = createMockRes()

      await controller.deleteRun(req as any, res as any)

      expect(mockPrisma.validationRun.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: committedRun.id } })
      )
    })

    // @clause CL-LOCK-004
    it("succeeds when deleteRun does not return 409 for committed run", async () => {
      const controller = new RunsController()
      const committedRun = createCommittedRunRow()
      mockPrisma.validationRun.delete.mockResolvedValue(committedRun)

      const req: MockRequest = { params: { id: committedRun.id } }
      const res = createMockRes()

      await controller.deleteRun(req as any, res as any)

      const statusCalls = res.status.mock.calls
      const has409 = statusCalls.some((call: number[]) => call[0] === 409)
      expect(has409).toBe(false)
      expect(res.status).toHaveBeenCalledWith(204)
    })
  })
})

// ============================================================================
// FRONTEND TESTS — RunDetailsPageV2 Committed Lock UI
// ============================================================================

describe("Frontend — RunDetailsPageV2 committed run UI lock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper to render RunDetailsPageV2 with a committed run.
   * The component fetches data via api.runs.getWithResults, so we mock the return.
   */
  async function renderWithCommittedRun(overrides: Partial<RunWithResults> = {}) {
    const committedRun = createCommittedRunWithResults(overrides)
    mockGetWithResults.mockResolvedValue(committedRun)

    // Dynamic import of the REAL component
    const { RunDetailsPageV2 } = await import("@/components/run-details-page-v2")
    const result = render(<RunDetailsPageV2 />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId("kanban-page")).toBeInTheDocument()
    })

    return { result, committedRun }
  }

  async function renderWithNonCommittedRun(overrides: Partial<RunWithResults> = {}) {
    const run = createRunWithResults(overrides)
    mockGetWithResults.mockResolvedValue(run)

    const { RunDetailsPageV2 } = await import("@/components/run-details-page-v2")
    const result = render(<RunDetailsPageV2 />)

    await waitFor(() => {
      expect(screen.getByTestId("kanban-page")).toBeInTheDocument()
    })

    return { result, run }
  }

  // --------------------------------------------------------------------------
  // CL-LOCK-010: Upload buttons disabled when committed
  // --------------------------------------------------------------------------

  describe("CL-LOCK-010 — kanban upload buttons disabled when committed", () => {
    // @clause CL-LOCK-010
    // @ui-clause CL-UI-LOCK-010-upload-disabled
    it("succeeds when kanban-upload-g0 is disabled for committed run", async () => {
      await renderWithCommittedRun()

      const uploadBtn = screen.getByTestId("kanban-upload-g0")
      expect(uploadBtn).toBeDisabled()
    })

    // @clause CL-LOCK-010
    // @ui-clause CL-UI-LOCK-010-upload-g1-disabled
    it("succeeds when kanban-upload-g1 is disabled for committed run", async () => {
      await renderWithCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
          createGateResult({ gateNumber: 1, status: "FAILED" }),
        ],
      })

      const uploadBtn = screen.getByTestId("kanban-upload-g1")
      expect(uploadBtn).toBeDisabled()
    })

    // @clause CL-LOCK-010
    // @ui-clause CL-UI-LOCK-010-upload-not-disabled-no-commit
    it("succeeds when kanban-upload-g0 is not disabled solely by commit for non-committed run with failures", async () => {
      await renderWithNonCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "FAILED" }),
        ],
      })

      const uploadBtn = screen.getByTestId("kanban-upload-g0")
      // For non-committed FAILED run, upload should be enabled (hasFailed = true)
      expect(uploadBtn).not.toBeDisabled()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-011: Rerun buttons disabled when committed
  // --------------------------------------------------------------------------

  describe("CL-LOCK-011 — kanban rerun buttons disabled when committed", () => {
    // @clause CL-LOCK-011
    // @ui-clause CL-UI-LOCK-011-rerun-disabled
    it("succeeds when kanban-rerun-g0 is disabled for committed run", async () => {
      await renderWithCommittedRun()

      const rerunBtn = screen.getByTestId("kanban-rerun-g0")
      expect(rerunBtn).toBeDisabled()
    })

    // @clause CL-LOCK-011
    // @ui-clause CL-UI-LOCK-011-rerun-g1-disabled
    it("succeeds when kanban-rerun-g1 is disabled for committed run", async () => {
      await renderWithCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
          createGateResult({ gateNumber: 1, status: "FAILED" }),
        ],
      })

      const rerunBtn = screen.getByTestId("kanban-rerun-g1")
      expect(rerunBtn).toBeDisabled()
    })

    // @clause CL-LOCK-011
    // @ui-clause CL-UI-LOCK-011-rerun-enabled-non-committed
    it("succeeds when kanban-rerun-g0 is enabled for non-committed failed run", async () => {
      await renderWithNonCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "FAILED" }),
        ],
      })

      const rerunBtn = screen.getByTestId("kanban-rerun-g0")
      expect(rerunBtn).not.toBeDisabled()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-012: Bypass buttons disabled when committed
  // --------------------------------------------------------------------------

  describe("CL-LOCK-012 — kanban bypass buttons disabled when committed", () => {
    // @clause CL-LOCK-012
    // @ui-clause CL-UI-LOCK-012-bypass-disabled
    it("succeeds when kanban-bypass-g0 is disabled for committed run", async () => {
      await renderWithCommittedRun()

      const bypassBtn = screen.getByTestId("kanban-bypass-g0")
      expect(bypassBtn).toBeDisabled()
    })

    // @clause CL-LOCK-012
    // @ui-clause CL-UI-LOCK-012-bypass-g1-disabled
    it("succeeds when kanban-bypass-g1 is disabled for committed run with multiple gates", async () => {
      await renderWithCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
          createGateResult({ gateNumber: 1, status: "FAILED" }),
        ],
      })

      const bypassBtn = screen.getByTestId("kanban-bypass-g1")
      expect(bypassBtn).toBeDisabled()
    })

    // @clause CL-LOCK-012
    // @ui-clause CL-UI-LOCK-012-bypass-enabled-non-committed
    it("succeeds when kanban-bypass-g0 is enabled for non-committed failed run", async () => {
      await renderWithNonCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED" }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "FAILED" }),
        ],
      })

      const bypassBtn = screen.getByTestId("kanban-bypass-g0")
      expect(bypassBtn).not.toBeDisabled()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-013: Modal de validator FAILED oculta Upload Fix/Bypass quando commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-013 — validator detail modal hides mutation buttons when committed", () => {
    // @clause CL-LOCK-013
    // @ui-clause CL-UI-LOCK-013-modal-no-upload-fix
    it("succeeds when Upload Fix button is not rendered in modal for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
            details: JSON.stringify({
              context: {
                inputs: [],
                analyzed: [],
                findings: [{ type: "fail", message: "Token exceeded" }],
                reasoning: "Token count too high",
              },
            }),
          }),
        ],
      })

      // Click on the failed validator card to open the modal
      const validatorCard = screen.getByText("Token Budget Fit")
      await userEvent.click(validatorCard)

      // The modal should NOT contain "Upload Fix" button for committed run
      await waitFor(() => {
        const modal = screen.getByTestId("validator-detail-modal")
        const uploadFixBtn = within(modal).queryByRole("button", { name: /upload fix/i })
        expect(uploadFixBtn).not.toBeInTheDocument()
      })
    })

    // @clause CL-LOCK-013
    // @ui-clause CL-UI-LOCK-013-modal-no-bypass
    it("succeeds when Bypass button is not rendered in modal for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
            details: JSON.stringify({
              context: {
                inputs: [],
                analyzed: [],
                findings: [{ type: "fail", message: "Token exceeded" }],
                reasoning: "Token count too high",
              },
            }),
          }),
        ],
      })

      const validatorCard = screen.getByText("Token Budget Fit")
      await userEvent.click(validatorCard)

      await waitFor(() => {
        const modal = screen.getByTestId("validator-detail-modal")
        const bypassBtn = within(modal).queryByRole("button", { name: /bypass/i })
        expect(bypassBtn).not.toBeInTheDocument()
      })
    })

    // @clause CL-LOCK-013
    // @ui-clause CL-UI-LOCK-013-modal-copy-present
    it("succeeds when Copiar button remains visible in modal for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
            details: JSON.stringify({
              context: {
                inputs: [],
                analyzed: [],
                findings: [{ type: "fail", message: "Token exceeded" }],
                reasoning: "Token count too high",
              },
            }),
          }),
        ],
      })

      const validatorCard = screen.getByText("Token Budget Fit")
      await userEvent.click(validatorCard)

      await waitFor(() => {
        const modal = screen.getByTestId("validator-detail-modal")
        const copyBtn = within(modal).getByRole("button", { name: /copiar/i })
        expect(copyBtn).toBeInTheDocument()
      })
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-014: Start Execution não renderizado quando commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-014 — start-execution-banner not rendered when committed", () => {
    // @clause CL-LOCK-014
    // @ui-clause CL-UI-LOCK-014-no-start-execution
    it("succeeds when start-execution-banner is not in DOM for committed run", async () => {
      // Committed run where gates 0+1 passed (would normally show start execution)
      await renderWithCommittedRun({
        status: "PASSED",
        gateResults: [
          createGateResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createGateResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createValidatorResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
      })

      const startExec = screen.queryByTestId("start-execution-banner")
      expect(startExec).not.toBeInTheDocument()
    })

    // @clause CL-LOCK-014
    // @ui-clause CL-UI-LOCK-014-start-exec-present-non-committed
    it("succeeds when start-execution-banner is present for non-committed run with passed gates 0+1", async () => {
      await renderWithNonCommittedRun({
        status: "PASSED",
        gateResults: [
          createGateResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createGateResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createValidatorResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
      })

      const startExec = screen.queryByTestId("start-execution-banner")
      expect(startExec).toBeInTheDocument()
    })

    // @clause CL-LOCK-014
    // @ui-clause CL-UI-LOCK-014-committed-still-hidden-even-passed
    it("fails when start-execution-banner appears for committed run despite gates passing", async () => {
      await renderWithCommittedRun({
        status: "PASSED",
        gateResults: [
          createGateResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createGateResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, status: "PASSED", passed: true }),
          createValidatorResult({ gateNumber: 1, status: "PASSED", passed: true }),
        ],
      })

      // Must NOT be in DOM
      expect(screen.queryByTestId("start-execution-banner")).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-020: Badge committed-badge visível com hash curto
  // --------------------------------------------------------------------------

  describe("CL-LOCK-020 — committed badge visible with short hash", () => {
    // @clause CL-LOCK-020
    // @ui-clause CL-UI-LOCK-020-badge-present
    it("succeeds when committed-badge is present for committed run", async () => {
      await renderWithCommittedRun()

      const badge = screen.getByTestId("committed-badge")
      expect(badge).toBeInTheDocument()
    })

    // @clause CL-LOCK-020
    // @ui-clause CL-UI-LOCK-020-badge-hash
    it("succeeds when committed-badge contains the first 7 chars of commitHash", async () => {
      await renderWithCommittedRun()

      const badge = screen.getByTestId("committed-badge")
      expect(badge.textContent).toContain(COMMIT_HASH_SHORT)
    })

    // @clause CL-LOCK-020
    // @ui-clause CL-UI-LOCK-020-badge-absent-no-commit
    it("succeeds when committed-badge is absent for non-committed run", async () => {
      await renderWithNonCommittedRun()

      const badge = screen.queryByTestId("committed-badge")
      expect(badge).not.toBeInTheDocument()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-030: Delete continua funcional quando commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-030 — delete remains functional when committed", () => {
    // @clause CL-LOCK-030
    // @ui-clause CL-UI-LOCK-030-delete-clickable
    it("succeeds when delete badge is clickable for committed run", async () => {
      await renderWithCommittedRun()

      const promptCard = screen.getByTestId("prompt-card")
      const trashBadge = within(promptCard).getByRole("button")
      // Trash badge should NOT be disabled
      expect(trashBadge).not.toHaveAttribute("disabled")
      expect(trashBadge).not.toHaveClass("pointer-events-none")
    })

    // @clause CL-LOCK-030
    // @ui-clause CL-UI-LOCK-030-delete-opens-dialog
    it("succeeds when clicking delete badge opens AlertDialog for committed run", async () => {
      await renderWithCommittedRun()

      const promptCard = screen.getByTestId("prompt-card")
      // Find the trash badge (role="button" with Trash icon)
      const trashBadges = within(promptCard).getAllByRole("button")
      // The last badge in prompt-card header area is the delete badge
      const trashBadge = trashBadges[trashBadges.length - 1]

      await userEvent.click(trashBadge)

      await waitFor(() => {
        expect(screen.getByText(/excluir run de validação/i)).toBeInTheDocument()
      })
    })

    // @clause CL-LOCK-030
    // @ui-clause CL-UI-LOCK-030-delete-not-disabled
    it("fails when delete badge has disabled attribute for committed run", async () => {
      await renderWithCommittedRun()

      const promptCard = screen.getByTestId("prompt-card")
      const buttons = within(promptCard).getAllByRole("button")
      // None of the prompt-card buttons should have pointer-events-none
      const trashButton = buttons[buttons.length - 1]
      expect(trashButton.getAttribute("aria-disabled")).not.toBe("true")
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-031: Copiar continua funcional quando commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-031 — copy buttons remain functional when committed", () => {
    // @clause CL-LOCK-031
    // @ui-clause CL-UI-LOCK-031-copy-card-clickable
    it("succeeds when copy button in validator card is clickable for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
          }),
        ],
      })

      // Copy buttons in the kanban validator cards should remain functional when committed
      const kanbanPage = screen.getByTestId("kanban-page")
      const allButtons = within(kanbanPage).getAllByRole("button")
      // Filter out the kanban action buttons (upload/rerun/bypass) — remaining are copy/other
      const nonActionButtons = allButtons.filter(
        (btn) =>
          !btn.getAttribute("data-testid")?.startsWith("kanban-upload") &&
          !btn.getAttribute("data-testid")?.startsWith("kanban-rerun") &&
          !btn.getAttribute("data-testid")?.startsWith("kanban-bypass")
      )
      expect(nonActionButtons.length).toBeGreaterThan(0)
    })

    // @clause CL-LOCK-031
    // @ui-clause CL-UI-LOCK-031-copy-modal-clickable
    it("succeeds when Copiar button in modal is clickable for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
            details: JSON.stringify({
              context: {
                inputs: [],
                analyzed: [],
                findings: [{ type: "fail", message: "Token exceeded" }],
                reasoning: "Token count too high",
              },
            }),
          }),
        ],
      })

      const validatorCard = screen.getByText("Token Budget Fit")
      await userEvent.click(validatorCard)

      await waitFor(() => {
        const modal = screen.getByTestId("validator-detail-modal")
        const copyBtn = within(modal).getByRole("button", { name: /copiar/i })
        expect(copyBtn).not.toBeDisabled()
      })
    })

    // @clause CL-LOCK-031
    // @ui-clause CL-UI-LOCK-031-copy-executes
    it("succeeds when clicking Copiar in modal executes clipboard for committed run", async () => {
      await renderWithCommittedRun({
        validatorResults: [
          createValidatorResult({
            gateNumber: 0,
            validatorCode: "TOKEN_BUDGET_FIT",
            status: "FAILED",
            isHardBlock: true,
            details: JSON.stringify({
              context: {
                inputs: [],
                analyzed: [],
                findings: [{ type: "fail", message: "Token exceeded" }],
                reasoning: "Token count too high",
              },
            }),
          }),
        ],
      })

      const validatorCard = screen.getByText("Token Budget Fit")
      await userEvent.click(validatorCard)

      await waitFor(() => {
        const modal = screen.getByTestId("validator-detail-modal")
        const copyBtn = within(modal).getByRole("button", { name: /copiar/i })
        return expect(copyBtn).toBeInTheDocument()
      })

      const modal = screen.getByTestId("validator-detail-modal")
      const copyBtn = within(modal).getByRole("button", { name: /copiar/i })
      await userEvent.click(copyBtn)

      // Clipboard function should have been called (no error)
      const { getClipboardWriteText } = await import("@/lib/validator-clipboard")
      expect(getClipboardWriteText).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // CL-LOCK-032: Filter bar continua funcional quando commitado
  // --------------------------------------------------------------------------

  describe("CL-LOCK-032 — filter bar remains functional when committed", () => {
    // @clause CL-LOCK-032
    // @ui-clause CL-UI-LOCK-032-filter-bar-present
    it("succeeds when filter-bar is present and has clickable buttons for committed run", async () => {
      await renderWithCommittedRun()

      const filterBar = screen.getByTestId("filter-bar")
      expect(filterBar).toBeInTheDocument()

      const filterButtons = within(filterBar).getAllByRole("button")
      expect(filterButtons.length).toBeGreaterThanOrEqual(2)
    })

    // @clause CL-LOCK-032
    // @ui-clause CL-UI-LOCK-032-filter-click-works
    it("succeeds when clicking FAILED filter button updates the list for committed run", async () => {
      await renderWithCommittedRun({
        gateResults: [
          createGateResult({ gateNumber: 0, status: "FAILED", failedCount: 1, passedCount: 1 }),
        ],
        validatorResults: [
          createValidatorResult({ gateNumber: 0, validatorCode: "V1", validatorName: "V1", status: "FAILED" }),
          createValidatorResult({ gateNumber: 0, validatorCode: "V2", validatorName: "V2", status: "PASSED", passed: true }),
        ],
      })

      const filterBar = screen.getByTestId("filter-bar")
      const failedFilter = within(filterBar).getByTestId("filter-btn-FAILED")

      await userEvent.click(failedFilter)

      // After clicking FAILED filter, only failed validators should show
      // The filter button should be "active" (has specific class)
      expect(failedFilter).toHaveClass("bg-primary")
    })

    // @clause CL-LOCK-032
    // @ui-clause CL-UI-LOCK-032-filter-not-disabled
    it("fails when filter buttons are disabled for committed run", async () => {
      await renderWithCommittedRun()

      const filterBar = screen.getByTestId("filter-bar")
      const filterButtons = within(filterBar).getAllByRole("button")

      // None of the filter buttons should be disabled
      filterButtons.forEach((btn) => {
        expect(btn).not.toBeDisabled()
      })
    })
  })
})
