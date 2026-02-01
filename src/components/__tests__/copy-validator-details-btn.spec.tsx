/**
 * @file copy-validator-details-btn.spec.tsx
 * @description Contract spec for copy validator details button in RunPanel.
 * @contract copy-validator-details-btn v1.0
 * @mode STRICT
 *
 * Regras:
 * - Testa implementação REAL (RunPanel) e apenas mocka dependências externas (API, router, toast, clipboard).
 * - Sem snapshots.
 * - Sem asserts fracos como única verificação.
 * - Happy/Sad path detectados pelo nome do it(): "succeeds when" / "fails when".
 * - Cada clause tem pelo menos 3 testes com // @clause CL-COPY-XXX.
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

import type {
  GateResult,
  RunWithResults,
  ValidatorResult,
  ValidatorStatus,
} from "@/lib/types"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockApi,
  mockToast,
  mockClipboardWriteText,
  mockUseRunEvents,
} = vi.hoisted(() => ({
  mockApi: {
    runs: {
      getWithResults: vi.fn(),
      rerunGate: vi.fn(),
      bypassValidator: vi.fn(),
      abort: vi.fn(),
      delete: vi.fn(),
    },
    validators: {
      list: vi.fn(),
    },
    config: {
      list: vi.fn(),
    },
    artifacts: {
      upload: vi.fn(),
    },
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  mockClipboardWriteText: vi.fn(),
  mockUseRunEvents: vi.fn(),
}))

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock("@/lib/api", () => ({
  api: mockApi,
}))

vi.mock("sonner", () => ({
  toast: mockToast,
}))

vi.mock("@/hooks/useRunEvents", () => ({
  useRunEvents: (runId: string | undefined, callback: (event: unknown) => void) => {
    mockUseRunEvents(runId, callback)
  },
}))

vi.mock("@/components/file-upload-dialog", () => ({
  FileUploadDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="file-upload-dialog-mock">upload dialog</div> : null,
}))

vi.mock("@/components/diff-viewer-modal", () => ({
  DiffViewerModal: () => null,
  DiffFile: undefined,
}))

// Component under test (REAL)
import { RunPanel } from "@/components/run-panel"

// =============================================================================
// FIXTURE BUILDERS
// =============================================================================

function createValidatorResult(
  overrides: Partial<ValidatorResult> = {}
): ValidatorResult {
  return {
    gateNumber: 1,
    validatorCode: "TEST_VALIDATOR",
    validatorName: "Test Validator",
    status: "PASSED",
    passed: true,
    isHardBlock: false,
    ...overrides,
  }
}

function createGateResult(overrides: Partial<GateResult> = {}): GateResult {
  return {
    gateNumber: 1,
    gateName: "Gate 1",
    status: "PASSED",
    passed: true,
    passedCount: 1,
    failedCount: 0,
    warningCount: 0,
    skippedCount: 0,
    ...overrides,
  }
}

function createRunWithResults(
  validators: ValidatorResult[] = [],
  overrides: Partial<RunWithResults> = {}
): RunWithResults {
  return {
    id: "run-1",
    projectId: "proj-1",
    outputId: "output-1",
    projectPath: "/path/to/project",
    baseRef: "origin/main",
    targetRef: "HEAD",
    manifestJson: "{}",
    testFilePath: "src/test.spec.tsx",
    dangerMode: false,
    runType: "CONTRACT",
    status: "PASSED",
    currentGate: 1,
    createdAt: "2026-01-01T00:00:00Z",
    gateResults: [createGateResult()],
    validatorResults: validators.length > 0 ? validators : [createValidatorResult()],
    ...overrides,
  }
}

/** Full validator with message, context details, and evidence */
function createFullValidator(
  overrides: Partial<ValidatorResult> = {}
): ValidatorResult {
  const context = {
    context: {
      inputs: [{ label: "Manifest files", value: 3 }],
      analyzed: [{ label: "Changed files", items: ["src/a.ts", "src/b.ts"] }],
      findings: [
        { type: "fail", message: "2 files outside scope", location: "src/c.ts" },
      ],
      reasoning: "Found modifications outside declared manifest",
    },
  }
  return createValidatorResult({
    validatorCode: "FULL_CHECK",
    validatorName: "Full Validator Check",
    status: "FAILED",
    passed: false,
    isHardBlock: true,
    message: "Files outside manifest were modified",
    details: JSON.stringify(context),
    evidence: "src/c.ts: +15 -3\nsrc/d.ts: +2 -0",
    ...overrides,
  })
}

/** Minimal validator without optional fields */
function createMinimalValidator(
  overrides: Partial<ValidatorResult> = {}
): ValidatorResult {
  return createValidatorResult({
    validatorCode: "TASK_CLARITY",
    validatorName: "Task Clarity Check",
    status: "PASSED",
    passed: true,
    isHardBlock: false,
    message: undefined,
    details: undefined,
    evidence: undefined,
    ...overrides,
  })
}

/** DIFF_SCOPE_ENFORCEMENT validator with violations */
function createDiffScopeValidator(): ValidatorResult {
  return createValidatorResult({
    validatorCode: "DIFF_SCOPE_ENFORCEMENT",
    validatorName: "Diff Scope Check",
    status: "FAILED",
    passed: false,
    isHardBlock: true,
    message: "Files outside manifest were modified",
    details: JSON.stringify({
      context: {
        inputs: [{ label: "Manifest files", value: 3 }],
        analyzed: [{ label: "Changed files", items: ["src/a.ts", "src/b.ts"] }],
        findings: [
          { type: "fail", message: "2 files outside scope", location: "src/c.ts" },
        ],
        reasoning: "Found modifications outside declared manifest",
      },
      violations: ["src/c.ts", "src/d.ts"],
    }),
    evidence: "src/c.ts: +15 -3\nsrc/d.ts: +2 -0",
  })
}

function renderRunPanel(validators: ValidatorResult[], runOverrides: Partial<RunWithResults> = {}) {
  const run = createRunWithResults(validators, runOverrides)
  return render(
    <MemoryRouter>
      <RunPanel run={run} />
    </MemoryRouter>
  )
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Setup clipboard mock
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockClipboardWriteText },
    writable: true,
    configurable: true,
  })
  mockClipboardWriteText.mockResolvedValue(undefined)
})

// =============================================================================
// CL-COPY-001 — Copy button rendered for every validator
// =============================================================================

describe("CL-COPY-001 — Copy button rendered for every validator", () => {
  // @clause CL-COPY-001
  it("succeeds when copy button is present for a PASSED validator", () => {
    renderRunPanel([createValidatorResult({ status: "PASSED" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-COPY-001
  it("succeeds when copy button is present for a FAILED validator", () => {
    renderRunPanel([createValidatorResult({ status: "FAILED", passed: false })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-COPY-001
  it("succeeds when copy button is present for a WARNING validator", () => {
    renderRunPanel([createValidatorResult({ status: "WARNING" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-001
  it("succeeds when copy button is present for a SKIPPED validator", () => {
    renderRunPanel([createValidatorResult({ status: "SKIPPED" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-001
  it("succeeds when copy button is present for a PENDING validator", () => {
    renderRunPanel([createValidatorResult({ status: "PENDING" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-001
  it("succeeds when multiple validators each have their own copy button", () => {
    renderRunPanel([
      createValidatorResult({ validatorCode: "V1", validatorName: "Val 1", status: "PASSED" }),
      createValidatorResult({ validatorCode: "V2", validatorName: "Val 2", status: "FAILED", passed: false }),
      createValidatorResult({ validatorCode: "V3", validatorName: "Val 3", status: "WARNING" }),
    ])
    const copyBtns = screen.getAllByTestId("validator-copy-btn")
    expect(copyBtns).toHaveLength(3)
  })
})

// =============================================================================
// CL-COPY-002 — Tooltip on copy button
// =============================================================================

describe("CL-COPY-002 — Tooltip on copy button", () => {
  // @clause CL-COPY-002
  it("succeeds when tooltip text is rendered on hover", async () => {
    const user = userEvent.setup()
    renderRunPanel([createValidatorResult()])
    const copyBtn = screen.getByTestId("validator-copy-btn")

    await user.hover(copyBtn)

    await waitFor(() => {
      expect(screen.getByText("Copiar detalhes do validator")).toBeInTheDocument()
    })
  })

  // @clause CL-COPY-002
  it("succeeds when tooltip wraps the copy button with correct content", async () => {
    const user = userEvent.setup()
    renderRunPanel([createValidatorResult({ status: "FAILED", passed: false })])
    const copyBtn = screen.getByTestId("validator-copy-btn")

    await user.hover(copyBtn)

    await waitFor(() => {
      const tooltipContent = screen.getByText("Copiar detalhes do validator")
      expect(tooltipContent).toBeInTheDocument()
      expect(tooltipContent.textContent).toBe("Copiar detalhes do validator")
    })
  })

  // @clause CL-COPY-002
  it("succeeds when tooltip is associated with copy button for PASSED status", async () => {
    const user = userEvent.setup()
    renderRunPanel([createValidatorResult({ status: "PASSED" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")

    await user.hover(copyBtn)

    await waitFor(() => {
      expect(screen.getByText("Copiar detalhes do validator")).toBeInTheDocument()
    })
  })
})

// =============================================================================
// CL-COPY-003 — Copy button styling
// =============================================================================

describe("CL-COPY-003 — Copy button styling", () => {
  // @clause CL-COPY-003
  it("succeeds when copy button has compact classes px-1.5 py-1 h-auto", () => {
    renderRunPanel([createValidatorResult()])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn.className).toContain("px-1.5")
    expect(copyBtn.className).toContain("py-1")
    expect(copyBtn.className).toContain("h-auto")
  })

  // @clause CL-COPY-003
  it("succeeds when copy button has compact classes for FAILED validator", () => {
    renderRunPanel([createValidatorResult({ status: "FAILED", passed: false })])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    expect(copyBtn.className).toContain("px-1.5")
    expect(copyBtn.className).toContain("py-1")
    expect(copyBtn.className).toContain("h-auto")
  })

  // @clause CL-COPY-003
  it("succeeds when copy button retains styling across different statuses", () => {
    renderRunPanel([
      createValidatorResult({ validatorCode: "V1", status: "PASSED" }),
      createValidatorResult({ validatorCode: "V2", status: "WARNING" }),
    ])
    const btns = screen.getAllByTestId("validator-copy-btn")
    for (const btn of btns) {
      expect(btn.className).toContain("px-1.5")
      expect(btn.className).toContain("h-auto")
    }
  })
})

// =============================================================================
// CL-COPY-004 — Click copies full data to clipboard
// =============================================================================

describe("CL-COPY-004 — Click copies full data to clipboard", () => {
  // @clause CL-COPY-004
  it("succeeds when clipboard receives validatorName and validatorCode", async () => {
    const user = userEvent.setup()
    renderRunPanel([createFullValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("Full Validator Check")
    expect(copiedText).toContain("FULL_CHECK")
  })

  // @clause CL-COPY-004
  it("succeeds when clipboard receives status and blockType Hard", async () => {
    const user = userEvent.setup()
    renderRunPanel([createFullValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("FAILED")
    expect(copiedText).toContain("Hard")
  })

  // @clause CL-COPY-004
  it("succeeds when clipboard receives message, context details and evidence", async () => {
    const user = userEvent.setup()
    renderRunPanel([createFullValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("Files outside manifest were modified")
    expect(copiedText).toContain("Manifest files")
    expect(copiedText).toContain("Changed files")
    expect(copiedText).toContain("2 files outside scope")
    expect(copiedText).toContain("Found modifications outside declared manifest")
    expect(copiedText).toContain("src/c.ts: +15 -3")
  })

  // @clause CL-COPY-004
  it("succeeds when clipboard text contains blockType Warning for non-hard validator", async () => {
    const user = userEvent.setup()
    renderRunPanel([
      createFullValidator({ isHardBlock: false, validatorCode: "SOFT_V", validatorName: "Soft Validator" }),
    ])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("Warning")
    expect(copiedText).not.toMatch(/Bloqueio:.*Hard/)
  })
})

// =============================================================================
// CL-COPY-005 — Click copies minimal data (no optionals)
// =============================================================================

describe("CL-COPY-005 — Click copies minimal data (no optionals)", () => {
  // @clause CL-COPY-005
  it("succeeds when clipboard receives only required fields for minimal validator", async () => {
    const user = userEvent.setup()
    renderRunPanel([createMinimalValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("Task Clarity Check")
    expect(copiedText).toContain("TASK_CLARITY")
    expect(copiedText).toContain("PASSED")
    expect(copiedText).toContain("Warning")
  })

  // @clause CL-COPY-005
  it("succeeds when clipboard text does not contain optional labels for minimal validator", async () => {
    const user = userEvent.setup()
    renderRunPanel([createMinimalValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).not.toContain("Mensagem:")
    expect(copiedText).not.toContain("Context Details")
    expect(copiedText).not.toContain("Evidence")
    expect(copiedText).not.toContain("Inputs:")
    expect(copiedText).not.toContain("Analyzed:")
    expect(copiedText).not.toContain("Findings:")
    expect(copiedText).not.toContain("Reasoning:")
  })

  // @clause CL-COPY-005
  it("succeeds when clipboard text does not contain violation section for minimal validator", async () => {
    const user = userEvent.setup()
    renderRunPanel([createMinimalValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).not.toContain("Arquivos com violação")
  })
})

// =============================================================================
// CL-COPY-006 — Toast success after copying
// =============================================================================

describe("CL-COPY-006 — Toast success after copying", () => {
  // @clause CL-COPY-006
  it("succeeds when toast.success is called with Copiado after successful copy", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockResolvedValueOnce(undefined)
    renderRunPanel([createValidatorResult()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")
    })
  })

  // @clause CL-COPY-006
  it("succeeds when toast.success is called exactly once per click", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockResolvedValue(undefined)
    renderRunPanel([createValidatorResult()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledTimes(1)
    })
  })

  // @clause CL-COPY-006
  it("succeeds when toast.success is called for full validator copy", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockResolvedValueOnce(undefined)
    renderRunPanel([createFullValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")
    })
    expect(mockToast.error).not.toHaveBeenCalled()
  })
})

// =============================================================================
// CL-COPY-007 — Toast error when clipboard fails
// =============================================================================

describe("CL-COPY-007 — Toast error when clipboard fails", () => {
  // @clause CL-COPY-007
  it("fails when clipboard rejects and toast.error is called with Falha ao copiar", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockRejectedValueOnce(new Error("Clipboard denied"))
    renderRunPanel([createValidatorResult()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
    })
  })

  // @clause CL-COPY-007
  it("fails when clipboard rejects and toast.success is NOT called", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockRejectedValueOnce(new Error("Permission denied"))
    renderRunPanel([createValidatorResult()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledTimes(1)
    })
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  // @clause CL-COPY-007
  it("fails when clipboard rejects with generic error and toast.error shows correct message", async () => {
    const user = userEvent.setup()
    mockClipboardWriteText.mockRejectedValueOnce(new TypeError("Not allowed"))
    renderRunPanel([createFullValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
    })
  })
})

// =============================================================================
// CL-COPY-008 — stopPropagation on click
// =============================================================================

describe("CL-COPY-008 — stopPropagation on click", () => {
  // @clause CL-COPY-008
  it("succeeds when click on copy button does not propagate to parent", async () => {
    const parentClickHandler = vi.fn()
    const validator = createValidatorResult()
    const run = createRunWithResults([validator])

    const { container } = render(
      <MemoryRouter>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={parentClickHandler}>
          <RunPanel run={run} />
        </div>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId("validator-copy-btn")
    await user.click(copyBtn)

    expect(parentClickHandler).not.toHaveBeenCalled()
  })

  // @clause CL-COPY-008
  it("succeeds when click propagation is stopped for FAILED validator", async () => {
    const parentClickHandler = vi.fn()
    const validator = createValidatorResult({ status: "FAILED", passed: false })
    const run = createRunWithResults([validator])

    render(
      <MemoryRouter>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={parentClickHandler}>
          <RunPanel run={run} />
        </div>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-copy-btn"))

    expect(parentClickHandler).not.toHaveBeenCalled()
  })

  // @clause CL-COPY-008
  it("succeeds when stopPropagation prevents card expansion on copy click", async () => {
    const parentClickHandler = vi.fn()
    const validator = createFullValidator()
    const run = createRunWithResults([validator])

    render(
      <MemoryRouter>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={parentClickHandler}>
          <RunPanel run={run} />
        </div>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId("validator-copy-btn"))

    expect(parentClickHandler).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalled()
    })
  })
})

// =============================================================================
// CL-COPY-009 — Includes violation files for DIFF_SCOPE_ENFORCEMENT
// =============================================================================

describe("CL-COPY-009 — Includes violation files for DIFF_SCOPE_ENFORCEMENT", () => {
  // @clause CL-COPY-009
  it("succeeds when clipboard text contains violation file paths", async () => {
    const user = userEvent.setup()
    renderRunPanel([createDiffScopeValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("src/c.ts")
    expect(copiedText).toContain("src/d.ts")
  })

  // @clause CL-COPY-009
  it("succeeds when violation section header is present in clipboard text", async () => {
    const user = userEvent.setup()
    renderRunPanel([createDiffScopeValidator()])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toMatch(/Arquivos com viola/i)
  })

  // @clause CL-COPY-009
  it("succeeds when all violation paths are listed in clipboard output", async () => {
    const user = userEvent.setup()
    const validator = createValidatorResult({
      validatorCode: "DIFF_SCOPE_ENFORCEMENT",
      validatorName: "Diff Scope Check",
      status: "FAILED",
      passed: false,
      isHardBlock: true,
      details: JSON.stringify({
        context: {
          inputs: [],
          analyzed: [],
          findings: [],
          reasoning: "test",
        },
        violations: ["file1.ts", "file2.ts", "file3.ts"],
      }),
    })
    renderRunPanel([validator])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
    })
    const copiedText = mockClipboardWriteText.mock.calls[0][0] as string
    expect(copiedText).toContain("file1.ts")
    expect(copiedText).toContain("file2.ts")
    expect(copiedText).toContain("file3.ts")
  })
})

// =============================================================================
// CL-COPY-010 — Copy button does not interfere with Upload button
// =============================================================================

describe("CL-COPY-010 — Copy button does not interfere with Upload button", () => {
  // @clause CL-COPY-010
  it("succeeds when both copy and upload buttons are visible for FAILED validator", () => {
    renderRunPanel([
      createValidatorResult({ status: "FAILED", passed: false, isHardBlock: true }),
    ])
    expect(screen.getByTestId("validator-copy-btn")).toBeInTheDocument()
    expect(screen.getByTestId("validator-upload-btn")).toBeInTheDocument()
  })

  // @clause CL-COPY-010
  it("succeeds when copy button is present and upload button is absent for PASSED validator", () => {
    renderRunPanel([createValidatorResult({ status: "PASSED" })])
    expect(screen.getByTestId("validator-copy-btn")).toBeInTheDocument()
    expect(screen.queryByTestId("validator-upload-btn")).not.toBeInTheDocument()
  })

  // @clause CL-COPY-010
  it("succeeds when clicking copy does not affect upload button visibility for FAILED", async () => {
    const user = userEvent.setup()
    renderRunPanel([
      createValidatorResult({ status: "FAILED", passed: false, isHardBlock: true }),
    ])

    await user.click(screen.getByTestId("validator-copy-btn"))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalled()
    })
    expect(screen.getByTestId("validator-upload-btn")).toBeInTheDocument()
    expect(screen.getByTestId("validator-copy-btn")).toBeInTheDocument()
  })
})

// =============================================================================
// CL-COPY-011 — DOM order: copy before upload and StatusBadge
// =============================================================================

describe("CL-COPY-011 — DOM order: copy before upload and StatusBadge", () => {
  // @clause CL-COPY-011
  it("succeeds when copy button precedes upload button in DOM for FAILED validator", () => {
    renderRunPanel([
      createValidatorResult({ status: "FAILED", passed: false }),
    ])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    const uploadBtn = screen.getByTestId("validator-upload-btn")

    // compareDocumentPosition: 4 means the node follows the reference
    const position = copyBtn.compareDocumentPosition(uploadBtn)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // @clause CL-COPY-011
  it("succeeds when copy button appears before StatusBadge in DOM", () => {
    renderRunPanel([createValidatorResult({ status: "PASSED" })])
    const copyBtn = screen.getByTestId("validator-copy-btn")

    // StatusBadge renders text "Passed" — find it
    const statusBadge = screen.getByText("Passed").closest("[data-slot]") || screen.getByText("Passed")
    const position = copyBtn.compareDocumentPosition(statusBadge)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // @clause CL-COPY-011
  it("succeeds when copy precedes both upload and StatusBadge for FAILED hard validator", () => {
    renderRunPanel([
      createValidatorResult({
        status: "FAILED",
        passed: false,
        isHardBlock: true,
      }),
    ])
    const copyBtn = screen.getByTestId("validator-copy-btn")
    const uploadBtn = screen.getByTestId("validator-upload-btn")
    const failedBadge = screen.getByText("Failed")

    const posUpload = copyBtn.compareDocumentPosition(uploadBtn)
    const posStatus = copyBtn.compareDocumentPosition(failedBadge)

    expect(posUpload & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(posStatus & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
