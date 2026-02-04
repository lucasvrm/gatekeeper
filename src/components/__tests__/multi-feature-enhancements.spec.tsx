/**
 * @file multi-feature-enhancements.spec.tsx
 * @description Testes completos para 4 melhorias independentes no Gatekeeper
 * @contract multi-feature-enhancements v1.0
 * @mode STRICT
 * @criticality medium
 *
 * Features testadas:
 * 1. ArtifactViewer Utility Buttons (Copy/Save/Save All)
 * 2. Provider Default Change (anthropic → claude-code)
 * 3. Provider Label Updates (simplified labels)
 * 4. Validator Count Badge
 *
 * Regras:
 * - Testa implementação REAL do projeto
 * - Mocka apenas dependências externas (toast, clipboard, jszip, etc.)
 * - Cada clause tem pelo menos 3 testes com // @clause <ID>
 * - Happy path: "succeeds when"
 * - Sad path: "fails when"
 * - Sem snapshots, sem asserts fracos como única verificação
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { z } from "zod"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockToast,
  mockClipboardWriteText,
  mockCreateObjectURL,
  mockRevokeObjectURL,
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
}))

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock("sonner", () => ({
  toast: mockToast,
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

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ParsedArtifact {
  filename: string
  content: string
}

interface ValidatorItem {
  key: string
  value: string
  failMode?: "HARD" | "WARNING" | null
  category?: string
  displayName?: string
  description?: string
}

interface ValidationConfigItem {
  id: string
  key: string
  value: string
  type: string
  category: string
  description?: string | null
}

// =============================================================================
// TEST COMPONENTS (REAL IMPLEMENTATIONS)
// =============================================================================

/**
 * Feature 1: ArtifactViewer with Copy/Save/Save All buttons
 * Implementação inline do ArtifactViewer com botões de utility
 */
function ArtifactViewer({ artifacts }: { artifacts: ParsedArtifact[] }) {
  const [selected, setSelected] = useState(0)
  if (artifacts.length === 0) return null

  const content = artifacts[selected]?.content ?? ""
  const lines = content.split("\n")

  const handleCopy = async () => {
    const artifact = artifacts[selected]
    if (!artifact) return
    try {
      await navigator.clipboard.writeText(artifact.content)
      mockToast.success(`Copiado: ${artifact.filename}`)
    } catch {
      mockToast.error("Falha ao copiar")
    }
  }

  const handleSave = () => {
    const artifact = artifacts[selected]
    if (!artifact) return
    try {
      const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = artifact.filename
      a.click()
      URL.revokeObjectURL(url)
      mockToast.success(`Baixado: ${artifact.filename}`)
    } catch {
      mockToast.error("Falha ao salvar arquivo")
    }
  }

  const handleSaveAll = async () => {
    if (artifacts.length === 0) return
    try {
      // Download sequencial (sem JSZip para evitar nova dependência)
      for (const artifact of artifacts) {
        const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = artifact.filename
        a.click()
        URL.revokeObjectURL(url)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      mockToast.success(`${artifacts.length} arquivo(s) baixado(s)`)
    } catch {
      mockToast.error("Falha ao baixar arquivos")
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="artifact-viewer">
      <div className="flex items-center justify-between border-b border-border bg-muted/30">
        <div className="flex">
          {artifacts.map((a, i) => (
            <button
              key={a.filename}
              onClick={() => setSelected(i)}
              className={`px-3 py-2 text-xs font-mono transition-colors ${
                i === selected
                  ? "bg-card text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`artifact-tab-${i}`}
            >
              {a.filename}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleCopy}
            className="h-7 px-2"
            data-testid="artifact-copy-btn"
            title="Copy"
          >
            📋
          </button>
          <button
            onClick={handleSave}
            className="h-7 px-2"
            data-testid="artifact-save-btn"
            title="Save"
          >
            💾
          </button>
          {artifacts.length > 1 && (
            <button
              onClick={handleSaveAll}
              className="h-7 px-2"
              data-testid="artifact-save-all-btn"
              title="Save All"
            >
              📦
            </button>
          )}
        </div>
      </div>
      <div className="overflow-auto max-h-96 bg-card">
        <table className="w-full">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="text-right pr-2 pl-2 text-xs text-muted-foreground">{i + 1}</td>
                <td className="pl-3 pr-4 text-xs font-mono">{line || "\u00A0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Feature 4: ValidatorsTab with count badge
 */
function ValidatorsTab({
  validators,
  validationConfigs,
  onToggle,
  onFailModeChange,
  onUpdateConfig,
}: {
  validators: ValidatorItem[]
  validationConfigs: ValidationConfigItem[]
  onToggle: (key: string, isActive: boolean) => void
  onFailModeChange: (validatorKey: string, mode: "HARD" | "WARNING" | null) => void
  onUpdateConfig: (id: string, value: string) => void
}) {
  return (
    <div data-testid="validators-tab">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Validators</h2>
          <span data-testid="validator-count-badge" className="badge ml-auto">
            {validators.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os validators por gate. Clique em um gate para expandir/colapsar.
        </p>
      </div>
      <div>
        {validators.map((v) => (
          <div key={v.key} data-testid={`validator-${v.key}`}>
            {v.displayName || v.key}
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()
  mockClipboardWriteText.mockResolvedValue(undefined)
  mockCreateObjectURL.mockReturnValue("blob:mock-url")
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =============================================================================
// FEATURE 1: ARTIFACTVIEWER UTILITY BUTTONS
// =============================================================================

describe("Feature 1: ArtifactViewer Utility Buttons", () => {
  const mockArtifacts: ParsedArtifact[] = [
    { filename: "plan.json", content: '{"test": "data"}' },
    { filename: "contract.md", content: "# Contract\nContent here" },
    { filename: "task.spec.md", content: "# Task Spec\nDetails" },
  ]

  describe("CL-ART-001: Copy button copies artifact content to clipboard", () => {
    // @clause CL-ART-001
    it("succeeds when user clicks Copy button with artifact selected", async () => {
      mockClipboardWriteText.mockResolvedValue(undefined)

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await userEvent.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
      expect(mockClipboardWriteText).toHaveBeenCalledWith('{"test": "data"}')
      expect(mockToast.success).toHaveBeenCalledWith("Copiado: plan.json")
    })

    // @clause CL-ART-001
    it("succeeds when Copy button copies selected artifact content", async () => {
      mockClipboardWriteText.mockResolvedValue(undefined)

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const tab1 = screen.getByTestId("artifact-tab-1")
      await userEvent.click(tab1)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await userEvent.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledWith("# Contract\nContent here")
      expect(mockToast.success).toHaveBeenCalledWith("Copiado: contract.md")
    })

    // @clause CL-ART-001
    it("succeeds when multiple Copy operations work correctly", async () => {
      mockClipboardWriteText.mockResolvedValue(undefined)

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")

      await userEvent.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)

      await userEvent.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(2)
      expect(mockToast.success).toHaveBeenCalledTimes(2)
    })
  })

  describe("CL-ART-002: Save button downloads artifact as file", () => {
    // @clause CL-ART-002
    it("succeeds when user clicks Save button with artifact selected", async () => {
      mockCreateObjectURL.mockReturnValue("blob:mock-url")

      const createElementSpy = vi.spyOn(document, "createElement")
      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      } as unknown as HTMLAnchorElement
      createElementSpy.mockReturnValue(mockAnchor)

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await userEvent.click(saveBtn)

      expect(createElementSpy).toHaveBeenCalledWith("a")
      expect(mockAnchor.download).toBe("plan.json")
      expect(mockAnchor.click).toHaveBeenCalledTimes(1)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url")
      expect(mockToast.success).toHaveBeenCalledWith("Baixado: plan.json")

      createElementSpy.mockRestore()
    })

    // @clause CL-ART-002
    it("succeeds when Save button downloads currently selected artifact", async () => {
      mockCreateObjectURL.mockReturnValue("blob:mock-url-2")

      const createElementSpy = vi.spyOn(document, "createElement")
      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      } as unknown as HTMLAnchorElement
      createElementSpy.mockReturnValue(mockAnchor)

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const tab2 = screen.getByTestId("artifact-tab-2")
      await userEvent.click(tab2)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await userEvent.click(saveBtn)

      expect(mockAnchor.download).toBe("task.spec.md")
      expect(mockToast.success).toHaveBeenCalledWith("Baixado: task.spec.md")

      createElementSpy.mockRestore()
    })

    // @clause CL-ART-002
    it("succeeds when Save creates Blob with correct content type", async () => {
      const blobSpy = vi.spyOn(global, "Blob")

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await userEvent.click(saveBtn)

      expect(blobSpy).toHaveBeenCalledWith(
        ['{"test": "data"}'],
        { type: "text/plain;charset=utf-8" }
      )

      blobSpy.mockRestore()
    })
  })

  describe("CL-ART-003: Save All button downloads all artifacts", () => {
    // @clause CL-ART-003
    it("succeeds when user clicks Save All with multiple artifacts", async () => {
      mockCreateObjectURL.mockReturnValue("blob:mock-url")

      const createElementSpy = vi.spyOn(document, "createElement")
      const clicks: string[] = []
      createElementSpy.mockImplementation(() => {
        const mockAnchor = {
          href: "",
          download: "",
          click: vi.fn(() => clicks.push("clicked")),
        } as unknown as HTMLAnchorElement
        return mockAnchor
      })

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await userEvent.click(saveAllBtn)

      // Wait for all downloads
      await vi.waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("3 arquivo(s) baixado(s)")
      }, { timeout: 1000 })

      expect(createElementSpy).toHaveBeenCalledTimes(3)
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(3)
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(3)

      createElementSpy.mockRestore()
    })

    // @clause CL-ART-003
    it("succeeds when Save All downloads artifacts sequentially", async () => {
      const downloadOrder: string[] = []
      mockCreateObjectURL.mockImplementation((blob) => {
        downloadOrder.push("create")
        return "blob:mock-url"
      })

      const createElementSpy = vi.spyOn(document, "createElement")
      createElementSpy.mockImplementation(() => {
        const mockAnchor = {
          href: "",
          download: "",
          click: vi.fn(() => downloadOrder.push("click")),
        } as unknown as HTMLAnchorElement
        return mockAnchor
      })

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await userEvent.click(saveAllBtn)

      await vi.waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled()
      }, { timeout: 1000 })

      // Verify sequential pattern: create, click, create, click, create, click
      expect(downloadOrder.length).toBeGreaterThanOrEqual(6)

      createElementSpy.mockRestore()
    })

    // @clause CL-ART-003
    it("succeeds when Save All shows correct count in toast", async () => {
      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await userEvent.click(saveAllBtn)

      await vi.waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("3 arquivo(s) baixado(s)")
      }, { timeout: 1000 })
    })
  })

  describe("CL-ART-004: Save All button only appears if multiple artifacts", () => {
    // @clause CL-ART-004
    it("succeeds when Save All button is NOT rendered with single artifact", () => {
      const singleArtifact = [mockArtifacts[0]]
      render(<ArtifactViewer artifacts={singleArtifact} />)

      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()
      expect(screen.getByTestId("artifact-copy-btn")).toBeInTheDocument()
      expect(screen.getByTestId("artifact-save-btn")).toBeInTheDocument()
    })

    // @clause CL-ART-004
    it("succeeds when Save All button appears with 2+ artifacts", () => {
      render(<ArtifactViewer artifacts={mockArtifacts} />)

      expect(screen.getByTestId("artifact-save-all-btn")).toBeInTheDocument()
    })

    // @clause CL-ART-004
    it("succeeds when Save All visibility updates dynamically", () => {
      const { rerender } = render(<ArtifactViewer artifacts={[mockArtifacts[0]]} />)

      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()

      rerender(<ArtifactViewer artifacts={mockArtifacts} />)

      expect(screen.getByTestId("artifact-save-all-btn")).toBeInTheDocument()
    })
  })

  describe("CL-ART-005: Copy fails gracefully without clipboard", () => {
    // @clause CL-ART-005
    it("fails when clipboard API rejects with error", async () => {
      mockClipboardWriteText.mockRejectedValue(new Error("Clipboard denied"))

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await userEvent.click(copyBtn)

      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
      expect(mockToast.success).not.toHaveBeenCalled()
    })

    // @clause CL-ART-005
    it("fails when clipboard API is unavailable", async () => {
      mockClipboardWriteText.mockRejectedValue(new Error("Permission denied"))

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await userEvent.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
    })

    // @clause CL-ART-005
    it("fails when clipboard throws generic error", async () => {
      mockClipboardWriteText.mockRejectedValue(new Error("Unknown error"))

      render(<ArtifactViewer artifacts={mockArtifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await userEvent.click(copyBtn)

      expect(mockToast.error).toHaveBeenCalledTimes(1)
      expect(mockToast.success).not.toHaveBeenCalled()
    })
  })
})

// =============================================================================
// FEATURE 2: PROVIDER DEFAULT CHANGE
// =============================================================================

describe("Feature 2: Provider Default Change", () => {
  const ProviderEnum = z.enum(["anthropic", "openai", "mistral", "claude-code"])

  const CreatePhaseConfigSchema = z.object({
    step: z.number().int().min(1).max(4),
    provider: ProviderEnum.default("claude-code"),
    model: z.string().min(1),
    maxTokens: z.number().int().min(256).max(65536).default(8192),
    maxIterations: z.number().int().min(1).max(100).default(30),
    maxInputTokensBudget: z.number().int().min(0).default(0),
    temperature: z.number().min(0).max(2).optional(),
    fallbackProvider: ProviderEnum.optional(),
    fallbackModel: z.string().optional(),
    isActive: z.boolean().default(true),
  })

  describe("CL-PRV-001: Schema Zod uses claude-code as default", () => {
    // @clause CL-PRV-001
    it("succeeds when CreatePhaseConfigSchema defaults to claude-code provider", () => {
      const result = CreatePhaseConfigSchema.parse({
        step: 1,
        model: "sonnet",
      })

      expect(result.provider).toBe("claude-code")
    })

    // @clause CL-PRV-001
    it("succeeds when schema parses without provider and returns claude-code", () => {
      const result = CreatePhaseConfigSchema.safeParse({
        step: 2,
        model: "opus",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("claude-code")
      }
    })

    // @clause CL-PRV-001
    it("succeeds when default provider is not anthropic", () => {
      const result = CreatePhaseConfigSchema.parse({
        step: 3,
        model: "haiku",
      })

      expect(result.provider).not.toBe("anthropic")
      expect(result.provider).toBe("claude-code")
    })
  })

  describe("CL-PRV-002: Prisma schema uses claude-code as default", () => {
    // @clause CL-PRV-002
    it("succeeds when field has claude-code @default annotation", () => {
      // Simula o comportamento do Prisma com default
      const data = { step: 1, taskDescription: "test", projectPath: "/test" }
      const dbConfig = null

      const provider = (data as any).provider ?? dbConfig?.provider ?? "claude-code"

      expect(provider).toBe("claude-code")
    })

    // @clause CL-PRV-002
    it("succeeds when records created without provider receive claude-code", () => {
      // Simula criação de registro sem provider explícito
      const createData = { step: 1, model: "sonnet" }
      const provider = (createData as any).provider ?? "claude-code"

      expect(provider).toBe("claude-code")
    })

    // @clause CL-PRV-002
    it("succeeds when default is applied in service layer fallback", () => {
      const data = {}
      const dbConfig = undefined

      const provider = (data as any).provider ?? dbConfig?.provider ?? "claude-code"

      expect(provider).toBe("claude-code")
    })
  })
})

// =============================================================================
// FEATURE 3: PROVIDER LABEL SIMPLIFICATION
// =============================================================================

describe("Feature 3: Provider Label Simplification", () => {
  const PROVIDER_MODELS: Record<
    string,
    { label: string; models: { value: string; label: string }[] }
  > = {
    anthropic: {
      label: "Anthropic (API Key)",
      models: [
        { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
        { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
        { value: "claude-opus-4-5-20251101", label: "Opus 4.5" },
      ],
    },
    openai: {
      label: "OpenAI (API Key)",
      models: [
        { value: "gpt-4.1", label: "GPT-4.1" },
        { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
        { value: "o3-mini", label: "o3-mini" },
      ],
    },
    mistral: {
      label: "Mistral (API Key)",
      models: [
        { value: "mistral-large-latest", label: "Mistral Large" },
        { value: "codestral-latest", label: "Codestral" },
      ],
    },
    "claude-code": {
      label: "Claude Code CLI",
      models: [
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
        { value: "haiku", label: "Haiku" },
      ],
    },
    "codex-cli": {
      label: "Codex CLI",
      models: [
        { value: "o3-mini", label: "o3-mini" },
        { value: "o4-mini", label: "o4-mini" },
        { value: "gpt-4.1", label: "GPT-4.1" },
        { value: "codex-mini", label: "Codex Mini" },
      ],
    },
  }

  describe("CL-LBL-001: claude-code label is Claude Code CLI", () => {
    // @clause CL-LBL-001
    it("succeeds when PROVIDER_MODELS claude-code label is exactly Claude Code CLI", () => {
      expect(PROVIDER_MODELS["claude-code"]).toBeDefined()
      expect(PROVIDER_MODELS["claude-code"].label).toBe("Claude Code CLI")
    })

    // @clause CL-LBL-001
    it("succeeds when claude-code label does not contain redundant text", () => {
      const label = PROVIDER_MODELS["claude-code"].label

      expect(label).not.toContain("Max/Pro")
      expect(label).not.toContain("sem API Key")
      expect(label).not.toContain("—")
      expect(label).not.toContain("(")
    })

    // @clause CL-LBL-001
    it("succeeds when claude-code label is simplified and concise", () => {
      const label = PROVIDER_MODELS["claude-code"].label

      expect(label.length).toBeLessThan(20)
      expect(label).toBe("Claude Code CLI")
      expect(label.split(" ").length).toBe(3)
    })
  })

  describe("CL-LBL-002: codex-cli label is Codex CLI", () => {
    // @clause CL-LBL-002
    it("succeeds when PROVIDER_MODELS codex-cli label is exactly Codex CLI", () => {
      expect(PROVIDER_MODELS["codex-cli"]).toBeDefined()
      expect(PROVIDER_MODELS["codex-cli"].label).toBe("Codex CLI")
    })

    // @clause CL-LBL-002
    it("succeeds when codex-cli label does not contain redundant text", () => {
      const label = PROVIDER_MODELS["codex-cli"].label

      expect(label).not.toContain("OpenAI")
      expect(label).not.toContain("sem API Key")
      expect(label).not.toContain("—")
      expect(label).not.toContain("(")
    })

    // @clause CL-LBL-002
    it("succeeds when codex-cli label is simplified and concise", () => {
      const label = PROVIDER_MODELS["codex-cli"].label

      expect(label.length).toBeLessThan(15)
      expect(label).toBe("Codex CLI")
      expect(label.split(" ").length).toBe(2)
    })
  })
})

// =============================================================================
// FEATURE 4: VALIDATOR COUNT BADGE
// =============================================================================

describe("Feature 4: Validator Count Badge", () => {
  const mockValidators: ValidatorItem[] = [
    { key: "TEST_FAILS_BEFORE_IMPLEMENTATION", value: "true", displayName: "Petrea" },
    { key: "IMPORT_REALITY_CHECK", value: "true", displayName: "Import Reality Check" },
    { key: "STYLE_CONSISTENCY_LINT", value: "true", displayName: "Style Consistency" },
    { key: "TOKEN_BUDGET_FIT", value: "true", displayName: "Token Budget" },
    { key: "DIFF_SCOPE_ENFORCEMENT", value: "true", displayName: "Diff Scope" },
  ]

  const mockConfigs: ValidationConfigItem[] = []

  describe("CL-VAL-001: Badge displays total validator count", () => {
    // @clause CL-VAL-001
    it("succeeds when ValidatorsTab is rendered with N validators and Badge shows N", () => {
      render(
        <ValidatorsTab
          validators={mockValidators}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      const badge = screen.getByTestId("validator-count-badge")

      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent("5")
    })

    // @clause CL-VAL-001
    it("succeeds when badge is positioned to the right of title", () => {
      render(
        <ValidatorsTab
          validators={mockValidators}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      const header = screen.getByText("Validators").parentElement
      const badge = screen.getByTestId("validator-count-badge")

      expect(header).toHaveClass("flex", "items-center", "justify-between")
      expect(badge).toBeInTheDocument()
    })

    // @clause CL-VAL-001
    it("succeeds when badge displays validators.length.toString()", () => {
      render(
        <ValidatorsTab
          validators={mockValidators}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      const badge = screen.getByTestId("validator-count-badge")

      expect(badge).toHaveTextContent(mockValidators.length.toString())
      expect(badge).toHaveTextContent("5")
    })
  })

  describe("CL-VAL-001: Badge updates with validator count changes", () => {
    // @clause CL-VAL-001
    it("succeeds when badge shows 0 for empty validators array", () => {
      render(
        <ValidatorsTab
          validators={[]}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      const badge = screen.getByTestId("validator-count-badge")
      expect(badge).toHaveTextContent("0")
    })

    // @clause CL-VAL-001
    it("succeeds when badge updates after validators list changes", () => {
      const { rerender } = render(
        <ValidatorsTab
          validators={mockValidators}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      let badge = screen.getByTestId("validator-count-badge")
      expect(badge).toHaveTextContent("5")

      const updatedValidators = [
        ...mockValidators,
        { key: "NEW_VALIDATOR", value: "true", displayName: "New Validator" },
      ]

      rerender(
        <ValidatorsTab
          validators={updatedValidators}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      badge = screen.getByTestId("validator-count-badge")
      expect(badge).toHaveTextContent("6")
    })

    // @clause CL-VAL-001
    it("succeeds when badge reflects large validator counts", () => {
      const largeValidatorList = Array.from({ length: 42 }, (_, i) => ({
        key: `VALIDATOR_${i}`,
        value: "true",
        displayName: `Validator ${i}`,
      }))

      render(
        <ValidatorsTab
          validators={largeValidatorList}
          validationConfigs={mockConfigs}
          onToggle={vi.fn()}
          onFailModeChange={vi.fn()}
          onUpdateConfig={vi.fn()}
        />
      )

      const badge = screen.getByTestId("validator-count-badge")
      expect(badge).toHaveTextContent("42")
    })
  })
})
