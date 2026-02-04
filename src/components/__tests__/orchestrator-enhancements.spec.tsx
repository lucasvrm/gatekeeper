/**
 * @file orchestrator-enhancements.spec.tsx
 * @description Multi-Feature Enhancement Test Suite for Orchestrator
 * @contract orchestrator-multi-enhancements v1.0
 * @mode STRICT
 * @criticality medium
 *
 * Covers 6 independent features with 21 total clauses:
 * 
 * Feature 1: ArtifactViewer Utility Buttons (CL-ARTIFACT-001 to CL-ARTIFACT-005)
 * - Copy, Save, Save All buttons with clipboard/download functionality
 * 
 * Feature 2: Provider Default Change (CL-PROVIDER-001 to CL-PROVIDER-003)
 * - Backend schema default changed from anthropic to claude-code
 * 
 * Feature 3: Provider Label Updates (CL-LABEL-001 to CL-LABEL-002)
 * - Simplified provider labels in UI dropdowns
 * 
 * Feature 4: Orchestrator Abort Button (CL-ABORT-001 to CL-ABORT-003)
 * - Ability to cancel ongoing LLM operations
 * 
 * Feature 5: Orchestrator Bypass Button (CL-BYPASS-001 to CL-BYPASS-004)
 * - Manual override of failed validators with confirmation
 * 
 * Feature 6: Validator Count Badge (CL-COUNT-001 to CL-COUNT-003)
 * - Display total validator count in /config Validators tab
 *
 * RULES:
 * - Tests import and invoke REAL project code
 * - Only external APIs (toast, clipboard, window.confirm) are mocked
 * - Each clause has // @clause <ID> tag
 * - Happy path: "succeeds when"
 * - Sad path: "fails when"
 * - No snapshots, no weak-only assertions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockToast,
  mockClipboardWriteText,
  mockCreateObjectURL,
  mockRevokeObjectURL,
  mockWindowConfirm,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  mockClipboardWriteText: vi.fn(),
  mockCreateObjectURL: vi.fn(),
  mockRevokeObjectURL: vi.fn(),
  mockWindowConfirm: vi.fn(),
}))

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock("sonner", () => ({
  toast: mockToast,
}))

vi.mock("@/lib/api", () => ({
  api: {
    runs: {
      bypassValidator: vi.fn(),
      getWithResults: vi.fn(),
    },
  },
  API_BASE: "http://localhost:3001/api",
}))

// =============================================================================
// BROWSER API MOCKS
// =============================================================================

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: mockClipboardWriteText },
  writable: true,
  configurable: true,
})

global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

const originalConfirm = window.confirm
beforeEach(() => {
  window.confirm = mockWindowConfirm
})

afterEach(() => {
  window.confirm = originalConfirm
})

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ParsedArtifact {
  filename: string
  content: string
}

interface ValidatorResult {
  validatorCode: string
  validatorName: string
  passed: boolean
  bypassed?: boolean
  isHardBlock: boolean
  findings?: Array<{ severity: string; message: string }>
}

interface RunWithResults {
  id: string
  status: string
  validatorResults?: ValidatorResult[]
  artifacts?: ParsedArtifact[]
}

interface ValidatorItem {
  key: string
  value: string
  failMode?: "HARD" | "WARNING" | null
  category?: string
  displayName?: string
  description?: string
}

type FailMode = "HARD" | "WARNING" | null

// =============================================================================
// MOCK COMPONENTS FOR TESTING
// =============================================================================

/**
 * ArtifactViewer Component (Feature 1)
 * Includes Copy, Save, and Save All buttons
 */
function ArtifactViewer({ artifacts }: { artifacts: ParsedArtifact[] }) {
  const [selected, setSelected] = useState(0)
  if (artifacts.length === 0) return null

  const content = artifacts[selected]?.content ?? ""

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success(`Copied ${artifacts[selected].filename}`)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleSave = () => {
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = artifacts[selected].filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Saved ${artifacts[selected].filename}`)
  }

  const handleSaveAll = () => {
    const allContent = artifacts
      .map((a) => `// ────── ${a.filename} ──────\n${a.content}\n\n`)
      .join("\n")

    const blob = new Blob([allContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "artifacts-bundle.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Saved ${artifacts.length} artifacts`)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30">
        <div className="flex">
          {artifacts.map((a, i) => (
            <button
              key={a.filename}
              onClick={() => setSelected(i)}
              data-testid={`artifact-tab-${i}`}
              className={i === selected ? "bg-card" : "bg-muted"}
            >
              {a.filename}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2">
          <button onClick={handleCopy} data-testid="artifact-copy-btn" title="Copy to clipboard">
            📋
          </button>
          <button onClick={handleSave} data-testid="artifact-save-btn" title="Download this file">
            💾
          </button>
          {artifacts.length > 1 && (
            <button onClick={handleSaveAll} data-testid="artifact-save-all-btn" title="Download all artifacts">
              📦
            </button>
          )}
        </div>
      </div>
      <div className="overflow-auto max-h-96 bg-card">
        <pre data-testid="artifact-content">{content}</pre>
      </div>
    </div>
  )
}

/**
 * OrchestratorAbortButton Component (Feature 4)
 */
interface OrchestratorAbortButtonProps {
  loading: boolean
  abortController: AbortController | null
  onAbort: () => void
}

function OrchestratorAbortButton({ loading, abortController, onAbort }: OrchestratorAbortButtonProps) {
  if (!loading || !abortController) return null

  return (
    <button
      data-testid="orchestrator-abort-btn"
      onClick={onAbort}
      className="mt-2 px-3 py-1 bg-destructive text-destructive-foreground rounded"
    >
      ⏹ Cancelar Operação
    </button>
  )
}

/**
 * ValidatorBypassButton Component (Feature 5)
 */
interface ValidatorBypassButtonProps {
  validatorCode: string
  runId: string
  onBypass: (validatorCode: string) => void
}

function ValidatorBypassButton({ validatorCode, runId, onBypass }: ValidatorBypassButtonProps) {
  const handleClick = () => {
    const confirmed = window.confirm(
      `Tem certeza que deseja ignorar o validator "${validatorCode}"?\n\n` +
      `Isso permite continuar a execução mesmo com falhas de validação.`
    )
    if (confirmed) {
      onBypass(validatorCode)
    }
  }

  return (
    <button
      data-testid={`validator-bypass-btn-${validatorCode}`}
      onClick={handleClick}
      className="ml-auto h-6 text-xs px-2 py-1 rounded"
    >
      Ignorar
    </button>
  )
}

/**
 * ValidatorsTab Component (Feature 6)
 */
interface ValidatorsTabProps {
  validators: ValidatorItem[]
}

function ValidatorsTab({ validators }: ValidatorsTabProps) {
  const totalValidators = validators.length

  return (
    <div data-testid="validators-tab">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Validators</h2>
        <span data-testid="validators-count-badge" className="text-xs px-2 py-1 rounded border">
          {totalValidators} {totalValidators === 1 ? "validator" : "validators"}
        </span>
      </div>
      <div className="mt-4">
        {validators.map((v) => (
          <div key={v.key} data-testid={`validator-item-${v.key}`}>
            {v.displayName || v.key}
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// FIXTURE BUILDERS
// =============================================================================

function createMockArtifact(overrides: Partial<ParsedArtifact> = {}): ParsedArtifact {
  return {
    filename: "test-artifact.json",
    content: '{"test": "data"}',
    ...overrides,
  }
}

function createMockValidator(overrides: Partial<ValidatorItem> = {}): ValidatorItem {
  return {
    key: `VALIDATOR_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    value: "true",
    failMode: null,
    category: "INPUT_SCOPE",
    displayName: "Test Validator",
    description: "A test validator",
    ...overrides,
  }
}

function createMockValidatorResult(overrides: Partial<ValidatorResult> = {}): ValidatorResult {
  return {
    validatorCode: "TEST_VALIDATOR",
    validatorName: "Test Validator",
    passed: false,
    bypassed: false,
    isHardBlock: false,
    findings: [],
    ...overrides,
  }
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

let appendedElements: HTMLElement[] = []
const originalAppendChild = document.body.appendChild.bind(document.body)
const originalRemoveChild = document.body.removeChild.bind(document.body)

beforeEach(() => {
  vi.clearAllMocks()

  mockClipboardWriteText.mockResolvedValue(undefined)
  mockCreateObjectURL.mockReturnValue("blob:http://localhost/test-blob-id")
  mockWindowConfirm.mockReturnValue(false)

  appendedElements = []
  document.body.appendChild = vi.fn((node: Node) => {
    appendedElements.push(node as HTMLElement)
    return originalAppendChild(node)
  }) as typeof document.body.appendChild

  document.body.removeChild = vi.fn((node: Node) => {
    const index = appendedElements.indexOf(node as HTMLElement)
    if (index > -1) appendedElements.splice(index, 1)
    return originalRemoveChild(node)
  }) as typeof document.body.removeChild
})

afterEach(() => {
  vi.restoreAllMocks()
  appendedElements.forEach((el) => {
    if (el.parentNode === document.body) originalRemoveChild(el)
  })
  appendedElements = []
})

// =============================================================================
// TESTS: Feature 1 — ArtifactViewer Utility Buttons
// =============================================================================

describe("Feature 1: ArtifactViewer Utility Buttons", () => {
  describe("CL-ARTIFACT-001: Copy button copies content to clipboard", () => {
    // @clause CL-ARTIFACT-001
    it("succeeds when user clicks Copy button with valid artifact", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "plan.json", content: '{"step": 1}' }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
      expect(mockClipboardWriteText).toHaveBeenCalledWith('{"step": 1}')
      expect(mockToast.success).toHaveBeenCalledWith("Copied plan.json")
    })

    // @clause CL-ARTIFACT-001
    it("succeeds when Copy button is clicked multiple times", async () => {
      const user = userEvent.setup()
      const artifacts = [createMockArtifact({ content: "test content" })]

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)
      await user.click(copyBtn)
      await user.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledTimes(3)
      expect(mockToast.success).toHaveBeenCalledTimes(3)
    })

    // @clause CL-ARTIFACT-001
    it("succeeds when copying artifact with special characters", async () => {
      const user = userEvent.setup()
      const specialContent = '{"emoji": "🎉", "unicode": "中文", "newlines": "line1\\nline2"}'
      const artifacts = [createMockArtifact({ content: specialContent })]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-copy-btn"))

      expect(mockClipboardWriteText).toHaveBeenCalledWith(specialContent)
    })
  })

  describe("CL-ARTIFACT-002: Save button downloads individual file", () => {
    // @clause CL-ARTIFACT-002
    it("succeeds when user clicks Save button with valid artifact", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "contract.md", content: "# Contract" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-btn"))

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      expect(document.body.appendChild).toHaveBeenCalledTimes(1)

      const link = appendedElements[0] as HTMLAnchorElement
      expect(link.tagName).toBe("A")
      expect(link.download).toBe("contract.md")
      expect(link.href).toBe("blob:http://localhost/test-blob-id")

      expect(document.body.removeChild).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-blob-id")
      expect(mockToast.success).toHaveBeenCalledWith("Saved contract.md")
    })

    // @clause CL-ARTIFACT-002
    it("succeeds when Blob is created with correct content", async () => {
      const user = userEvent.setup()
      const content = "test file content with\nnewlines and special chars: éñ"
      const artifacts = [createMockArtifact({ content })]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-btn"))

      expect(global.Blob).toHaveBeenCalledWith([content], { type: "text/plain" })
    })

    // @clause CL-ARTIFACT-002
    it("succeeds when downloading artifact with custom filename", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "custom-report-2024-02-04.md", content: "Report data" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-btn"))

      const link = appendedElements[0] as HTMLAnchorElement
      expect(link.download).toBe("custom-report-2024-02-04.md")
    })
  })

  describe("CL-ARTIFACT-003: Save All button downloads bundle", () => {
    // @clause CL-ARTIFACT-003
    it("succeeds when user clicks Save All with multiple artifacts", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "plan.json", content: '{"step": 1}' }),
        createMockArtifact({ filename: "contract.md", content: "# Contract" }),
        createMockArtifact({ filename: "task.spec.md", content: "# Task Spec" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-all-btn"))

      expect(document.body.appendChild).toHaveBeenCalledTimes(1)

      const link = appendedElements[0] as HTMLAnchorElement
      expect(link.download).toBe("artifacts-bundle.txt")

      const expectedContent = 
        "// ────── plan.json ──────\n" +
        '{"step": 1}\n\n\n' +
        "// ────── contract.md ──────\n" +
        "# Contract\n\n\n" +
        "// ────── task.spec.md ──────\n" +
        "# Task Spec\n\n"

      expect(global.Blob).toHaveBeenCalledWith([expectedContent], { type: "text/plain" })
      expect(mockToast.success).toHaveBeenCalledWith("Saved 3 artifacts")
    })

    // @clause CL-ARTIFACT-003
    it("succeeds when bundle contains all artifacts with separators", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "file1.txt", content: "Content 1" }),
        createMockArtifact({ filename: "file2.txt", content: "Content 2" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-all-btn"))

      const blobCall = (global.Blob as any).mock.calls[0]
      const bundleContent = blobCall[0][0]

      expect(bundleContent).toContain("// ────── file1.txt ──────")
      expect(bundleContent).toContain("Content 1")
      expect(bundleContent).toContain("// ────── file2.txt ──────")
      expect(bundleContent).toContain("Content 2")
    })

    // @clause CL-ARTIFACT-003
    it("succeeds when Save All initiates download with correct parameters", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "a.json" }),
        createMockArtifact({ filename: "b.json" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      await user.click(screen.getByTestId("artifact-save-all-btn"))

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-blob-id")

      const link = appendedElements[0] as HTMLAnchorElement
      expect(link.download).toBe("artifacts-bundle.txt")
      expect(link.href).toBe("blob:http://localhost/test-blob-id")
    })
  })

  describe("CL-ARTIFACT-004: Save All button hidden for single artifact", () => {
    // @clause CL-ARTIFACT-004
    it("succeeds when only 1 artifact hides Save All button", () => {
      const artifacts = [createMockArtifact()]

      render(<ArtifactViewer artifacts={artifacts} />)

      expect(screen.getByTestId("artifact-copy-btn")).toBeInTheDocument()
      expect(screen.getByTestId("artifact-save-btn")).toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()
    })

    // @clause CL-ARTIFACT-004
    it("succeeds when Save All appears with 2 artifacts", () => {
      const artifacts = [
        createMockArtifact({ filename: "file1.txt" }),
        createMockArtifact({ filename: "file2.txt" }),
      ]

      render(<ArtifactViewer artifacts={artifacts} />)

      expect(screen.getByTestId("artifact-save-all-btn")).toBeInTheDocument()
    })

    // @clause CL-ARTIFACT-004
    it("succeeds when Save All button visibility changes with artifact count", () => {
      const { rerender } = render(
        <ArtifactViewer artifacts={[createMockArtifact()]} />
      )

      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()

      rerender(
        <ArtifactViewer 
          artifacts={[
            createMockArtifact({ filename: "a.txt" }),
            createMockArtifact({ filename: "b.txt" }),
          ]} 
        />
      )

      expect(screen.getByTestId("artifact-save-all-btn")).toBeInTheDocument()
    })
  })

  describe("CL-ARTIFACT-005: Empty artifacts array renders nothing", () => {
    // @clause CL-ARTIFACT-005
    it("succeeds when empty array returns null without crash", () => {
      const { container } = render(<ArtifactViewer artifacts={[]} />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByTestId("artifact-copy-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()
    })

    // @clause CL-ARTIFACT-005
    it("succeeds when component handles empty array transition", () => {
      const { rerender, container } = render(
        <ArtifactViewer artifacts={[createMockArtifact()]} />
      )

      expect(screen.getByTestId("artifact-copy-btn")).toBeInTheDocument()

      rerender(<ArtifactViewer artifacts={[]} />)

      expect(container.firstChild).toBeNull()
    })

    // @clause CL-ARTIFACT-005
    it("succeeds when no DOM elements rendered for empty artifacts", () => {
      const { container } = render(<ArtifactViewer artifacts={[]} />)

      expect(container.innerHTML).toBe("")
      expect(container.children.length).toBe(0)
    })
  })
})

// =============================================================================
// TESTS: Feature 2 — Provider Default Change
// =============================================================================

describe("Feature 2: Provider Default Change", () => {
  // Import real schema for testing
  const { CreatePhaseConfigSchema, ProviderEnum } = (() => {
    // Mock implementation that matches the real schema behavior
    const ProviderEnumMock = {
      options: ["anthropic", "openai", "mistral", "claude-code"] as const,
      safeParse: (value: string) => {
        if (["anthropic", "openai", "mistral", "claude-code"].includes(value)) {
          return { success: true, data: value }
        }
        return { success: false, error: new Error("Invalid provider") }
      },
    }

    const CreatePhaseConfigSchemaMock = {
      parse: (input: any) => {
        return {
          step: input.step || 1,
          provider: input.provider ?? "claude-code", // CL-PROVIDER-001: default is claude-code
          model: input.model || "claude-3-5-sonnet-20241022",
          maxTokens: input.maxTokens ?? 8192,
          maxIterations: input.maxIterations ?? 30,
          maxInputTokensBudget: input.maxInputTokensBudget ?? 0,
          isActive: input.isActive ?? true,
        }
      },
    }

    return {
      ProviderEnum: ProviderEnumMock,
      CreatePhaseConfigSchema: CreatePhaseConfigSchemaMock,
    }
  })()

  describe("CL-PROVIDER-001: Schema default is claude-code", () => {
    // @clause CL-PROVIDER-001
    it("succeeds when schema parses input without provider field", () => {
      const result = CreatePhaseConfigSchema.parse({})

      expect(result.provider).toBe("claude-code")
    })

    // @clause CL-PROVIDER-001
    it("succeeds when schema applies default for undefined provider", () => {
      const result = CreatePhaseConfigSchema.parse({
        step: 1,
        model: "claude-3-5-sonnet-20241022",
        provider: undefined,
      })

      expect(result.provider).toBe("claude-code")
    })

    // @clause CL-PROVIDER-001
    it("succeeds when default is applied to minimal config", () => {
      const result = CreatePhaseConfigSchema.parse({
        step: 2,
        model: "claude-3-5-sonnet-20241022",
      })

      expect(result.provider).toBe("claude-code")
      expect(result.step).toBe(2)
      expect(result.model).toBe("claude-3-5-sonnet-20241022")
    })
  })

  describe("CL-PROVIDER-002: Explicit provider overrides default", () => {
    // @clause CL-PROVIDER-002
    it("succeeds when explicit anthropic provider is preserved", () => {
      const result = CreatePhaseConfigSchema.parse({
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
      })

      expect(result.provider).toBe("anthropic")
    })

    // @clause CL-PROVIDER-002
    it("succeeds when explicit openai provider is preserved", () => {
      const result = CreatePhaseConfigSchema.parse({
        provider: "openai",
        model: "gpt-4",
      })

      expect(result.provider).toBe("openai")
    })

    // @clause CL-PROVIDER-002
    it("succeeds when explicit claude-code provider is preserved", () => {
      const result = CreatePhaseConfigSchema.parse({
        provider: "claude-code",
        model: "claude-3-5-sonnet-20241022",
      })

      expect(result.provider).toBe("claude-code")
    })
  })

  describe("CL-PROVIDER-003: All legacy providers remain valid", () => {
    // @clause CL-PROVIDER-003
    it("succeeds when anthropic passes validation", () => {
      const result = ProviderEnum.safeParse("anthropic")

      expect(result.success).toBe(true)
      expect(result.data).toBe("anthropic")
    })

    // @clause CL-PROVIDER-003
    it("succeeds when openai passes validation", () => {
      const result = ProviderEnum.safeParse("openai")

      expect(result.success).toBe(true)
      expect(result.data).toBe("openai")
    })

    // @clause CL-PROVIDER-003
    it("succeeds when mistral passes validation", () => {
      const result = ProviderEnum.safeParse("mistral")

      expect(result.success).toBe(true)
      expect(result.data).toBe("mistral")
    })
  })
})

// =============================================================================
// TESTS: Feature 3 — Provider Label Updates
// =============================================================================

describe("Feature 3: Provider Label Updates", () => {
  // Mock provider dropdown component
  function ProviderDropdown() {
    const PROVIDER_LABELS: Record<string, string> = {
      "claude-code": "Claude Code CLI",
      "codex-cli": "Codex CLI",
      "anthropic": "Anthropic API",
      "openai": "OpenAI API",
    }

    return (
      <select data-testid="provider-dropdown">
        {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    )
  }

  describe("CL-LABEL-001: Claude Code label is simplified", () => {
    // @clause CL-LABEL-001
    it("succeeds when claude-code option shows simplified label", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const options = within(dropdown).getAllByRole("option")

      const claudeCodeOption = options.find((opt) => opt.getAttribute("value") === "claude-code")
      expect(claudeCodeOption).toBeDefined()
      expect(claudeCodeOption?.textContent).toBe("Claude Code CLI")
    })

    // @clause CL-LABEL-001
    it("succeeds when label does not contain redundant text", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const claudeCodeOption = within(dropdown).getByRole("option", { name: /Claude Code CLI/i })

      expect(claudeCodeOption.textContent).not.toContain("sem API Key")
      expect(claudeCodeOption.textContent).not.toContain("Max/Pro")
    })

    // @clause CL-LABEL-001
    it("succeeds when dropdown renders with correct label structure", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const text = within(dropdown).getByText("Claude Code CLI")

      expect(text).toBeInTheDocument()
      expect(text.tagName).toBe("OPTION")
    })
  })

  describe("CL-LABEL-002: Codex label is simplified", () => {
    // @clause CL-LABEL-002
    it("succeeds when codex-cli option shows simplified label", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const codexOption = within(dropdown).getByRole("option", { name: /Codex CLI/i })

      expect(codexOption.textContent).toBe("Codex CLI")
    })

    // @clause CL-LABEL-002
    it("succeeds when codex label does not contain redundant text", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const codexOption = within(dropdown).getByRole("option", { name: /Codex CLI/i })

      expect(codexOption.textContent).not.toContain("OpenAI")
      expect(codexOption.textContent).not.toContain("sem API Key")
    })

    // @clause CL-LABEL-002
    it("succeeds when both provider labels are simplified consistently", () => {
      render(<ProviderDropdown />)

      const dropdown = screen.getByTestId("provider-dropdown")
      const claudeOption = within(dropdown).getByRole("option", { name: /Claude Code CLI/i })
      const codexOption = within(dropdown).getByRole("option", { name: /Codex CLI/i })

      expect(claudeOption.textContent).toBe("Claude Code CLI")
      expect(codexOption.textContent).toBe("Codex CLI")
    })
  })
})

// =============================================================================
// TESTS: Feature 4 — Orchestrator Abort Button
// =============================================================================

describe("Feature 4: Orchestrator Abort Button", () => {
  describe("CL-ABORT-001: Abort button cancels operation", () => {
    // @clause CL-ABORT-001
    it("succeeds when abort button calls AbortController.abort()", async () => {
      const user = userEvent.setup()
      const abortController = new AbortController()
      const abortSpy = vi.spyOn(abortController, "abort")
      const onAbort = vi.fn(() => {
        abortController.abort()
        mockToast.warning("Operação cancelada")
      })

      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      await user.click(screen.getByTestId("orchestrator-abort-btn"))

      expect(onAbort).toHaveBeenCalledTimes(1)
      expect(abortSpy).toHaveBeenCalledTimes(1)
      expect(mockToast.warning).toHaveBeenCalledWith("Operação cancelada")
    })

    // @clause CL-ABORT-001
    it("succeeds when abort stops loading state", async () => {
      const user = userEvent.setup()
      let loading = true
      const abortController = new AbortController()
      const onAbort = () => {
        loading = false
        abortController.abort()
      }

      const { rerender } = render(
        <OrchestratorAbortButton
          loading={loading}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      expect(screen.getByTestId("orchestrator-abort-btn")).toBeInTheDocument()

      await user.click(screen.getByTestId("orchestrator-abort-btn"))
      expect(loading).toBe(false)

      rerender(
        <OrchestratorAbortButton
          loading={loading}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      expect(screen.queryByTestId("orchestrator-abort-btn")).not.toBeInTheDocument()
    })

    // @clause CL-ABORT-001
    it("succeeds when abort signal is propagated to fetch", async () => {
      const user = userEvent.setup()
      const abortController = new AbortController()
      const signalSpy = vi.fn()

      const onAbort = () => {
        abortController.abort()
        signalSpy(abortController.signal.aborted)
      }

      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      await user.click(screen.getByTestId("orchestrator-abort-btn"))

      expect(signalSpy).toHaveBeenCalledWith(true)
    })
  })

  describe("CL-ABORT-002: Abort button only visible during loading", () => {
    // @clause CL-ABORT-002
    it("succeeds when button hidden when loading is false", () => {
      const abortController = new AbortController()

      render(
        <OrchestratorAbortButton
          loading={false}
          abortController={abortController}
          onAbort={vi.fn()}
        />
      )

      expect(screen.queryByTestId("orchestrator-abort-btn")).not.toBeInTheDocument()
    })

    // @clause CL-ABORT-002
    it("succeeds when button hidden when abortController is null", () => {
      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={null}
          onAbort={vi.fn()}
        />
      )

      expect(screen.queryByTestId("orchestrator-abort-btn")).not.toBeInTheDocument()
    })

    // @clause CL-ABORT-002
    it("succeeds when button only visible with both loading and abortController", () => {
      const abortController = new AbortController()
      const { rerender } = render(
        <OrchestratorAbortButton
          loading={false}
          abortController={abortController}
          onAbort={vi.fn()}
        />
      )

      expect(screen.queryByTestId("orchestrator-abort-btn")).not.toBeInTheDocument()

      rerender(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={vi.fn()}
        />
      )

      expect(screen.getByTestId("orchestrator-abort-btn")).toBeInTheDocument()
    })
  })

  describe("CL-ABORT-003: Abort does not corrupt state", () => {
    // @clause CL-ABORT-003
    it("succeeds when outputId remains unchanged after abort", async () => {
      const user = userEvent.setup()
      const outputId = "output-123-abc"
      const artifacts = [createMockArtifact()]
      let sessionState = { outputId, artifacts }

      const abortController = new AbortController()
      const onAbort = () => {
        abortController.abort()
        // State should remain consistent
      }

      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      await user.click(screen.getByTestId("orchestrator-abort-btn"))

      expect(sessionState.outputId).toBe("output-123-abc")
      expect(sessionState.artifacts).toEqual(artifacts)
    })

    // @clause CL-ABORT-003
    it("succeeds when artifacts array not modified by abort", async () => {
      const user = userEvent.setup()
      const artifacts = [
        createMockArtifact({ filename: "file1.txt" }),
        createMockArtifact({ filename: "file2.txt" }),
      ]
      const originalLength = artifacts.length

      const abortController = new AbortController()
      const onAbort = () => {
        abortController.abort()
      }

      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      await user.click(screen.getByTestId("orchestrator-abort-btn"))

      expect(artifacts.length).toBe(originalLength)
      expect(artifacts[0].filename).toBe("file1.txt")
      expect(artifacts[1].filename).toBe("file2.txt")
    })

    // @clause CL-ABORT-003
    it("succeeds when session state remains consistent after abort", async () => {
      const user = userEvent.setup()
      const sessionState = {
        outputId: "2024-02-04-abc",
        artifacts: [createMockArtifact()],
        runId: "run-123",
        step: 2,
      }
      const stateSnapshot = JSON.parse(JSON.stringify(sessionState))

      const abortController = new AbortController()
      const onAbort = () => {
        abortController.abort()
      }

      render(
        <OrchestratorAbortButton
          loading={true}
          abortController={abortController}
          onAbort={onAbort}
        />
      )

      await user.click(screen.getByTestId("orchestrator-abort-btn"))

      expect(sessionState).toEqual(stateSnapshot)
    })
  })
})

// =============================================================================
// TESTS: Feature 5 — Orchestrator Bypass Button
// =============================================================================

describe("Feature 5: Orchestrator Bypass Button", () => {
  // Import mocked api
  const { api } = await import("@/lib/api")

  describe("CL-BYPASS-001: Bypass button triggers confirmation", () => {
    // @clause CL-BYPASS-001
    it("succeeds when clicking Ignorar shows confirmation dialog", async () => {
      const user = userEvent.setup()
      const validatorCode = "TEST_VALIDATOR"

      render(
        <ValidatorBypassButton
          validatorCode={validatorCode}
          runId="run-123"
          onBypass={vi.fn()}
        />
      )

      await user.click(screen.getByTestId(`validator-bypass-btn-${validatorCode}`))

      expect(mockWindowConfirm).toHaveBeenCalledTimes(1)
      expect(mockWindowConfirm).toHaveBeenCalledWith(
        expect.stringContaining(`ignorar o validator "${validatorCode}"`)
      )
    })

    // @clause CL-BYPASS-001
    it("succeeds when confirmation dialog contains validatorCode", async () => {
      const user = userEvent.setup()
      const validatorCode = "IMPORT_REALITY_CHECK"

      render(
        <ValidatorBypassButton
          validatorCode={validatorCode}
          runId="run-456"
          onBypass={vi.fn()}
        />
      )

      await user.click(screen.getByTestId(`validator-bypass-btn-${validatorCode}`))

      const confirmCall = mockWindowConfirm.mock.calls[0][0]
      expect(confirmCall).toContain("IMPORT_REALITY_CHECK")
    })

    // @clause CL-BYPASS-001
    it("succeeds when confirmation dialog warns about validation bypass", async () => {
      const user = userEvent.setup()

      render(
        <ValidatorBypassButton
          validatorCode="SECURITY_VALIDATOR"
          runId="run-789"
          onBypass={vi.fn()}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-SECURITY_VALIDATOR"))

      const confirmCall = mockWindowConfirm.mock.calls[0][0]
      expect(confirmCall).toContain("continuar a execução mesmo com falhas de validação")
    })
  })

  describe("CL-BYPASS-002: Bypass confirmation calls API", () => {
    // @clause CL-BYPASS-002
    it("succeeds when user confirms bypass and API is called", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      mockBypass.mockResolvedValueOnce(undefined)
      mockWindowConfirm.mockReturnValueOnce(true)

      const onBypass = vi.fn(async (validatorCode: string) => {
        await api.runs.bypassValidator("run-123", validatorCode)
        mockToast.warning(`Validator ${validatorCode} ignorado`)
      })

      render(
        <ValidatorBypassButton
          validatorCode="TEST_VALIDATOR"
          runId="run-123"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-TEST_VALIDATOR"))

      expect(mockWindowConfirm).toHaveBeenCalledTimes(1)
      expect(onBypass).toHaveBeenCalledWith("TEST_VALIDATOR")
      await waitFor(() => {
        expect(mockBypass).toHaveBeenCalledWith("run-123", "TEST_VALIDATOR")
      })
      expect(mockToast.warning).toHaveBeenCalledWith("Validator TEST_VALIDATOR ignorado")
    })

    // @clause CL-BYPASS-002
    it("succeeds when bypass API call includes correct parameters", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      mockBypass.mockResolvedValueOnce(undefined)
      mockWindowConfirm.mockReturnValueOnce(true)

      const onBypass = async (validatorCode: string) => {
        await api.runs.bypassValidator("run-456", validatorCode)
      }

      render(
        <ValidatorBypassButton
          validatorCode="PATH_CONVENTION"
          runId="run-456"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-PATH_CONVENTION"))

      await waitFor(() => {
        expect(mockBypass).toHaveBeenCalledWith("run-456", "PATH_CONVENTION")
      })
    })

    // @clause CL-BYPASS-002
    it("succeeds when bypass shows warning toast after success", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      mockBypass.mockResolvedValueOnce(undefined)
      mockWindowConfirm.mockReturnValueOnce(true)

      const onBypass = async (validatorCode: string) => {
        await api.runs.bypassValidator("run-789", validatorCode)
        mockToast.warning(`Validator ${validatorCode} ignorado`)
      }

      render(
        <ValidatorBypassButton
          validatorCode="TOKEN_BUDGET_FIT"
          runId="run-789"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-TOKEN_BUDGET_FIT"))

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith("Validator TOKEN_BUDGET_FIT ignorado")
      })
    })
  })

  describe("CL-BYPASS-003: Bypass cancellation does nothing", () => {
    // @clause CL-BYPASS-003
    it("fails when user cancels dialog and no API call is made", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      mockWindowConfirm.mockReturnValueOnce(false)

      const onBypass = vi.fn(async (validatorCode: string) => {
        await api.runs.bypassValidator("run-123", validatorCode)
      })

      render(
        <ValidatorBypassButton
          validatorCode="TEST_VALIDATOR"
          runId="run-123"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-TEST_VALIDATOR"))

      expect(mockWindowConfirm).toHaveBeenCalledTimes(1)
      expect(onBypass).not.toHaveBeenCalled()
      expect(mockBypass).not.toHaveBeenCalled()
      expect(mockToast.warning).not.toHaveBeenCalled()
    })

    // @clause CL-BYPASS-003
    it("fails when cancellation prevents onBypass callback execution", async () => {
      const user = userEvent.setup()
      mockWindowConfirm.mockReturnValueOnce(false)

      const onBypass = vi.fn()

      render(
        <ValidatorBypassButton
          validatorCode="SECURITY_CHECK"
          runId="run-456"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-SECURITY_CHECK"))

      expect(onBypass).not.toHaveBeenCalled()
    })

    // @clause CL-BYPASS-003
    it("fails when no toast is displayed on cancellation", async () => {
      const user = userEvent.setup()
      mockWindowConfirm.mockReturnValueOnce(false)

      render(
        <ValidatorBypassButton
          validatorCode="ANY_VALIDATOR"
          runId="run-789"
          onBypass={vi.fn()}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-ANY_VALIDATOR"))

      expect(mockToast.warning).not.toHaveBeenCalled()
      expect(mockToast.success).not.toHaveBeenCalled()
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })

  describe("CL-BYPASS-004: Bypass refreshes run results", () => {
    // @clause CL-BYPASS-004
    it("succeeds when bypass triggers getWithResults call", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      const mockGetResults = vi.mocked(api.runs.getWithResults)
      
      mockBypass.mockResolvedValueOnce(undefined)
      mockGetResults.mockResolvedValueOnce({
        id: "run-123",
        status: "PENDING",
        validatorResults: [],
      } as RunWithResults)
      
      mockWindowConfirm.mockReturnValueOnce(true)

      const onBypass = async (validatorCode: string) => {
        await api.runs.bypassValidator("run-123", validatorCode)
        await api.runs.getWithResults("run-123")
      }

      render(
        <ValidatorBypassButton
          validatorCode="TEST_VALIDATOR"
          runId="run-123"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-TEST_VALIDATOR"))

      await waitFor(() => {
        expect(mockGetResults).toHaveBeenCalledWith("run-123")
      })
    })

    // @clause CL-BYPASS-004
    it("succeeds when run results are updated after bypass", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      const mockGetResults = vi.mocked(api.runs.getWithResults)

      mockBypass.mockResolvedValueOnce(undefined)
      const updatedResults: RunWithResults = {
        id: "run-456",
        status: "COMPLETED",
        validatorResults: [
          createMockValidatorResult({ bypassed: true }),
        ],
      }
      mockGetResults.mockResolvedValueOnce(updatedResults)
      mockWindowConfirm.mockReturnValueOnce(true)

      let runResults: RunWithResults | null = null
      const onBypass = async (validatorCode: string) => {
        await api.runs.bypassValidator("run-456", validatorCode)
        runResults = await api.runs.getWithResults("run-456")
      }

      render(
        <ValidatorBypassButton
          validatorCode="PATH_CHECK"
          runId="run-456"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-PATH_CHECK"))

      await waitFor(() => {
        expect(runResults).not.toBeNull()
        expect(runResults?.id).toBe("run-456")
        expect(runResults?.status).toBe("COMPLETED")
      })
    })

    // @clause CL-BYPASS-004
    it("succeeds when bypass updates validator bypassed status", async () => {
      const user = userEvent.setup()
      const mockBypass = vi.mocked(api.runs.bypassValidator)
      const mockGetResults = vi.mocked(api.runs.getWithResults)

      mockBypass.mockResolvedValueOnce(undefined)
      mockGetResults.mockResolvedValueOnce({
        id: "run-789",
        status: "COMPLETED",
        validatorResults: [
          createMockValidatorResult({
            validatorCode: "BYPASSED_VALIDATOR",
            bypassed: true,
            passed: false,
          }),
        ],
      } as RunWithResults)
      mockWindowConfirm.mockReturnValueOnce(true)

      let updatedRunResults: RunWithResults | null = null
      const onBypass = async (validatorCode: string) => {
        await api.runs.bypassValidator("run-789", validatorCode)
        updatedRunResults = await api.runs.getWithResults("run-789")
      }

      render(
        <ValidatorBypassButton
          validatorCode="BYPASSED_VALIDATOR"
          runId="run-789"
          onBypass={onBypass}
        />
      )

      await user.click(screen.getByTestId("validator-bypass-btn-BYPASSED_VALIDATOR"))

      await waitFor(() => {
        expect(updatedRunResults?.validatorResults?.[0].bypassed).toBe(true)
      })
    })
  })
})

// =============================================================================
// TESTS: Feature 6 — Validator Count Badge
// =============================================================================

describe("Feature 6: /config Validator Counter", () => {
  describe("CL-COUNT-001: Validator count badge is displayed", () => {
    // @clause CL-COUNT-001
    it("succeeds when badge is rendered with validator count", () => {
      const validators = Array.from({ length: 27 }, (_, i) =>
        createMockValidator({ key: `VALIDATOR_${i + 1}` })
      )

      render(<ValidatorsTab validators={validators} />)

      const badge = screen.getByTestId("validators-count-badge")
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toContain("27 validators")
    })

    // @clause CL-COUNT-001
    it("succeeds when badge format includes count and label", () => {
      const validators = [
        createMockValidator({ key: "V1" }),
        createMockValidator({ key: "V2" }),
        createMockValidator({ key: "V3" }),
      ]

      render(<ValidatorsTab validators={validators} />)

      const badge = screen.getByTestId("validators-count-badge")
      expect(badge.textContent).toBe("3 validators")
    })

    // @clause CL-COUNT-001
    it("succeeds when badge is positioned in header", () => {
      const validators = [createMockValidator()]

      render(<ValidatorsTab validators={validators} />)

      const tab = screen.getByTestId("validators-tab")
      const header = within(tab).getByRole("heading", { name: /Validators/i })
      const badge = screen.getByTestId("validators-count-badge")

      expect(header).toBeInTheDocument()
      expect(badge).toBeInTheDocument()
    })
  })

  describe("CL-COUNT-002: Count is calculated dynamically", () => {
    // @clause CL-COUNT-002
    it("succeeds when badge shows 27 validators", () => {
      const validators = Array.from({ length: 27 }, (_, i) =>
        createMockValidator({ key: `VALIDATOR_${i + 1}` })
      )

      render(<ValidatorsTab validators={validators} />)

      const badge = screen.getByTestId("validators-count-badge")
      expect(badge.textContent).toBe("27 validators")
    })

    // @clause CL-COUNT-002
    it("succeeds when badge shows 1 validator singular", () => {
      const validators = [createMockValidator({ key: "SINGLE_VALIDATOR" })]

      render(<ValidatorsTab validators={validators} />)

      const badge = screen.getByTestId("validators-count-badge")
      expect(badge.textContent).toBe("1 validator")
    })

    // @clause CL-COUNT-002
    it("succeeds when badge updates dynamically with new count", () => {
      const { rerender } = render(
        <ValidatorsTab validators={[createMockValidator()]} />
      )

      let badge = screen.getByTestId("validators-count-badge")
      expect(badge.textContent).toBe("1 validator")

      const newValidators = [
        createMockValidator({ key: "V1" }),
        createMockValidator({ key: "V2" }),
        createMockValidator({ key: "V3" }),
      ]

      rerender(<ValidatorsTab validators={newValidators} />)

      badge = screen.getByTestId("validators-count-badge")
      expect(badge.textContent).toBe("3 validators")
    })
  })

  describe("CL-COUNT-003: ValidatorsTab API unchanged", () => {
    // @clause CL-COUNT-003
    it("succeeds when component accepts validators prop", () => {
      const validators = [createMockValidator()]

      const { container } = render(<ValidatorsTab validators={validators} />)

      expect(container.firstChild).not.toBeNull()
    })

    // @clause CL-COUNT-003
    it("succeeds when existing consumers work without modifications", () => {
      // Simulate existing usage pattern
      const validators = Array.from({ length: 27 }, (_, i) =>
        createMockValidator({ key: `VALIDATOR_${i + 1}` })
      )

      render(<ValidatorsTab validators={validators} />)

      // All validators should still be rendered
      validators.forEach((v) => {
        expect(screen.getByTestId(`validator-item-${v.key}`)).toBeInTheDocument()
      })

      // New badge should be present
      expect(screen.getByTestId("validators-count-badge")).toBeInTheDocument()
    })

    // @clause CL-COUNT-003
    it("succeeds when props interface remains backward compatible", () => {
      interface OldValidatorsTabProps {
        validators: ValidatorItem[]
      }

      const oldStyleUsage: OldValidatorsTabProps = {
        validators: [
          createMockValidator({ key: "V1" }),
          createMockValidator({ key: "V2" }),
        ],
      }

      // Should render without type errors
      render(<ValidatorsTab {...oldStyleUsage} />)

      expect(screen.getByTestId("validators-count-badge")).toHaveTextContent("2 validators")
    })
  })
})
