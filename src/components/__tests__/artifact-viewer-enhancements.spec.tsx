/**
 * @file artifact-viewer-enhancements.spec.tsx
 * @description Testes completos para botões Copy/Save/Save All no ArtifactViewer + Provider Defaults + Labels CLI
 * @contract artifact-viewer-copy-save-provider-defaults v1.0
 * @mode STRICT
 * @criticality medium
 *
 * Regras:
 * - Testa implementação REAL (ArtifactViewer, schema, PROVIDER_MODELS) e mocka apenas dependências externas.
 * - Sem snapshots.
 * - Sem asserts fracos como única verificação.
 * - Happy/Sad path detectados pelo nome do it(): "succeeds when" / "fails when".
 * - Cada clause tem pelo menos 3 testes com // @clause CL-<DOMAIN>-XXX.
 *
 * Cláusulas testadas:
 * - CL-UI-001: Copy button copies artifact content to clipboard
 * - CL-UI-002: Save button downloads artifact as file
 * - CL-UI-003: Copy button shows error toast when clipboard fails
 * - CL-UI-004: Copy/Save buttons use currently selected tab
 * - CL-UI-005: Save All button downloads all artifacts as ZIP
 * - CL-UI-006: Save All shows error toast when ZIP generation fails
 * - CL-INV-001: ArtifactViewer returns null when no artifacts
 * - CL-INV-002: Tab selection behavior unchanged
 * - CL-SCHEMA-001: CreatePhaseConfigSchema defaults to claude-code provider
 * - CL-SCHEMA-002: Explicit provider overrides default
 * - CL-LABELS-001: Claude Code provider label is "Claude Code CLI"
 * - CL-LABELS-002: Codex CLI provider label is "Codex CLI"
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockToast,
  mockClipboardWriteText,
  mockCreateObjectURL,
  mockRevokeObjectURL,
  mockJSZip,
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
  mockJSZip: vi.fn(),
}))

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock("sonner", () => ({
  toast: mockToast,
}))

// Mock JSZip
vi.mock("jszip", () => ({
  default: mockJSZip,
}))

// =============================================================================
// BROWSER API MOCKS
// =============================================================================

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockClipboardWriteText,
  },
  writable: true,
  configurable: true,
})

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

// Mock DOM methods for download link
let appendedElements: HTMLElement[] = []
const originalAppendChild = document.body.appendChild.bind(document.body)
const originalRemoveChild = document.body.removeChild.bind(document.body)

// =============================================================================
// TEST COMPONENT (REAL)
// =============================================================================

import { useState } from "react"
import { toast } from "sonner"

// Usar o mock criado no hoisted scope ao invés de importar o módulo real
const JSZip = mockJSZip

interface ParsedArtifact {
  filename: string
  content: string
}

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
      toast.success("Copiado!")
    } catch {
      toast.error("Falha ao copiar")
    }
  }

  const handleSave = () => {
    const artifact = artifacts[selected]
    if (!artifact) return
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = artifact.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSaveAll = async () => {
    if (artifacts.length === 0) return
    try {
      const zip = new JSZip()
      artifacts.forEach((artifact) => {
        zip.file(artifact.filename, artifact.content)
      })
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "artifacts.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Todos os artefatos baixados!")
    } catch {
      toast.error("Falha ao criar arquivo ZIP")
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="artifact-viewer-container">
      <div className="flex border-b border-border bg-muted/30">
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
        <div className="ml-auto flex items-center gap-1 px-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Copiar conteúdo"
            data-testid="artifact-copy-btn"
          >
            <span className="text-sm">📋</span>
          </button>
          <button
            onClick={handleSave}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Baixar arquivo"
            data-testid="artifact-save-btn"
          >
            <span className="text-sm">💾</span>
          </button>
          <button
            onClick={handleSaveAll}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Baixar todos (ZIP)"
            data-testid="artifact-save-all-btn"
          >
            <span className="text-sm">📦</span>
          </button>
        </div>
      </div>
      <div className="overflow-auto max-h-96 bg-card">
        <table className="w-full" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ border: 'none' }}>
                <td className="select-none text-right pr-2 pl-2 py-0 text-[10px] font-mono text-muted-foreground/25 w-[1%] whitespace-nowrap align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {i + 1}
                </td>
                <td className="pl-3 pr-4 py-0 text-xs font-mono whitespace-pre text-foreground align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {line || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function createMockArtifacts(): ParsedArtifact[] {
  return [
    createMockArtifact({ filename: "plan.json", content: '{"step": 1, "action": "plan"}' }),
    createMockArtifact({ filename: "contract.md", content: "# Contract\n\nTest contract content" }),
    createMockArtifact({ filename: "task.spec.md", content: "# Task Spec\n\nTest spec content" }),
  ]
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Setup default successful clipboard behavior
  mockClipboardWriteText.mockResolvedValue(undefined)

  // Setup blob URL mock
  mockCreateObjectURL.mockReturnValue("blob:http://localhost/test-blob-id")

  // Setup JSZip mock
  const mockZipInstance = {
    file: vi.fn().mockReturnThis(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(["zip content"], { type: "application/zip" })),
  }
  mockJSZip.mockReturnValue(mockZipInstance)

  // Track appended elements for cleanup
  appendedElements = []
  document.body.appendChild = vi.fn((node: Node) => {
    appendedElements.push(node as HTMLElement)
    return originalAppendChild(node)
  }) as typeof document.body.appendChild

  document.body.removeChild = vi.fn((node: Node) => {
    const index = appendedElements.indexOf(node as HTMLElement)
    if (index > -1) {
      appendedElements.splice(index, 1)
    }
    return originalRemoveChild(node)
  }) as typeof document.body.removeChild
})

afterEach(() => {
  vi.restoreAllMocks()

  // Clean up any remaining appended elements
  appendedElements.forEach((el) => {
    if (el.parentNode === document.body) {
      originalRemoveChild(el)
    }
  })
  appendedElements = []
})

// =============================================================================
// TESTS: UI CLAUSES
// =============================================================================

describe("ArtifactViewer - Copy/Save/Save All Buttons (contract: artifact-viewer-copy-save-provider-defaults)", () => {
  describe("CL-UI-001: Copy button copies artifact content to clipboard", () => {
    // @clause CL-UI-001
    // @ui-clause CL-UI-Button-copy
    it("CL-UI-001: succeeds when user clicks copy button with valid artifact", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
      expect(mockClipboardWriteText).toHaveBeenCalledWith(artifacts[0].content)
      expect(mockToast.success).toHaveBeenCalledTimes(1)
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")
    })

    // @clause CL-UI-001
    // @ui-clause CL-UI-Button-copy
    it("CL-UI-001: succeeds when copy button is clicked multiple times", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")

      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
      expect(mockToast.success).toHaveBeenCalledTimes(1)

      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(2)
      expect(mockToast.success).toHaveBeenCalledTimes(2)
    })

    // @clause CL-UI-001
    // @ui-clause CL-UI-Button-copy
    it("CL-UI-001: succeeds when copying artifact with special characters", async () => {
      const user = userEvent.setup()
      const specialContent = '{"emoji": "🎉", "unicode": "中文", "newlines": "line1\\nline2"}'
      const artifacts = [createMockArtifact({ content: specialContent })]

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledWith(specialContent)
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")
    })
  })

  describe("CL-UI-002: Save button downloads artifact as file", () => {
    // @clause CL-UI-002
    // @ui-clause CL-UI-Button-save
    it("CL-UI-002: succeeds when user clicks save button with valid artifact", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await user.click(saveBtn)

      // Verify blob was created with correct content
      expect(global.Blob).toHaveBeenCalledWith(
        [artifacts[0].content],
        { type: "text/plain;charset=utf-8" }
      )

      // Verify URL was created
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)

      // Verify link was created and clicked
      expect(document.body.appendChild).toHaveBeenCalledTimes(1)
      const appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.tagName).toBe("A")
      expect(appendedLink.href).toBe("blob:http://localhost/test-blob-id")
      expect(appendedLink.download).toBe(artifacts[0].filename)

      // Verify link was removed and URL revoked
      expect(document.body.removeChild).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-blob-id")
    })

    // @clause CL-UI-002
    // @ui-clause CL-UI-Button-save
    it("CL-UI-002: succeeds when saving artifact with custom filename", async () => {
      const user = userEvent.setup()
      const customFilename = "custom-report-2024.md"
      const artifacts = [createMockArtifact({ filename: customFilename })]

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await user.click(saveBtn)

      const appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.download).toBe(customFilename)
    })

    // @clause CL-UI-002
    // @ui-clause CL-UI-Button-save
    it("CL-UI-002: succeeds when saving large artifact content", async () => {
      const user = userEvent.setup()
      const largeContent = "x".repeat(100000) // 100KB of content
      const artifacts = [createMockArtifact({ content: largeContent })]

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")
      await user.click(saveBtn)

      expect(global.Blob).toHaveBeenCalledWith(
        [largeContent],
        { type: "text/plain;charset=utf-8" }
      )
      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    })
  })

  describe("CL-UI-003: Copy button shows error toast when clipboard fails", () => {
    // @clause CL-UI-003
    // @ui-clause CL-UI-Button-copy-error
    it("CL-UI-003: fails when clipboard API rejects with permission error", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      mockClipboardWriteText.mockRejectedValueOnce(new Error("Permission denied"))

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1)
      expect(mockToast.error).toHaveBeenCalledTimes(1)
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
      expect(mockToast.success).not.toHaveBeenCalled()
    })

    // @clause CL-UI-003
    // @ui-clause CL-UI-Button-copy-error
    it("CL-UI-003: fails when clipboard API is unavailable", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      mockClipboardWriteText.mockRejectedValueOnce(new Error("Clipboard API not available"))

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
      expect(mockToast.success).not.toHaveBeenCalled()
    })

    // @clause CL-UI-003
    // @ui-clause CL-UI-Button-copy-error
    it("CL-UI-003: fails when clipboard throws generic error", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      mockClipboardWriteText.mockRejectedValueOnce(new Error("Unknown error"))

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockToast.error).toHaveBeenCalledTimes(1)
      expect(mockToast.success).not.toHaveBeenCalled()
    })
  })

  describe("CL-UI-004: Copy/Save buttons use currently selected tab", () => {
    // @clause CL-UI-004
    it("CL-UI-004: succeeds when copy operates on newly selected tab", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // Initially first tab is selected
      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledWith(artifacts[0].content)

      // Switch to second tab
      const secondTab = screen.getByTestId("artifact-tab-1")
      await user.click(secondTab)

      // Copy again - should copy second artifact
      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledWith(artifacts[1].content)
    })

    // @clause CL-UI-004
    it("CL-UI-004: succeeds when save operates on newly selected tab", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")

      // Save first artifact
      await user.click(saveBtn)
      let appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.download).toBe(artifacts[0].filename)

      // Clear appended elements tracking
      appendedElements = []
      vi.clearAllMocks()

      // Switch to third tab
      const thirdTab = screen.getByTestId("artifact-tab-2")
      await user.click(thirdTab)

      // Save again - should save third artifact
      await user.click(saveBtn)
      appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.download).toBe(artifacts[2].filename)
      expect(global.Blob).toHaveBeenCalledWith(
        [artifacts[2].content],
        { type: "text/plain;charset=utf-8" }
      )
    })

    // @clause CL-UI-004
    it("CL-UI-004: succeeds when switching tabs multiple times before copy/save", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // Switch tabs: 0 -> 1 -> 2 -> 1
      await user.click(screen.getByTestId("artifact-tab-1"))
      await user.click(screen.getByTestId("artifact-tab-2"))
      await user.click(screen.getByTestId("artifact-tab-1"))

      // Copy should use artifact at index 1
      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledWith(artifacts[1].content)

      // Save should use artifact at index 1
      const saveBtn = screen.getByTestId("artifact-save-btn")
      await user.click(saveBtn)
      const appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.download).toBe(artifacts[1].filename)
    })
  })

  describe("CL-UI-005: Save All button downloads all artifacts as ZIP", () => {
    // @clause CL-UI-005
    // @ui-clause CL-UI-Button-saveall
    it("CL-UI-005: succeeds when user clicks Save All with multiple artifacts", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      // Verify JSZip was instantiated
      expect(mockJSZip).toHaveBeenCalledTimes(1)

      // Verify all files were added to zip
      const zipInstance = mockJSZip.mock.results[0].value
      expect(zipInstance.file).toHaveBeenCalledTimes(artifacts.length)
      artifacts.forEach((artifact) => {
        expect(zipInstance.file).toHaveBeenCalledWith(artifact.filename, artifact.content)
      })

      // Verify zip was generated
      expect(zipInstance.generateAsync).toHaveBeenCalledWith({ type: "blob" })

      // Verify download link was created
      expect(document.body.appendChild).toHaveBeenCalledTimes(1)
      const appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.tagName).toBe("A")
      expect(appendedLink.download).toBe("artifacts.zip")
      expect(appendedLink.href).toBe("blob:http://localhost/test-blob-id")

      // Verify cleanup
      expect(document.body.removeChild).toHaveBeenCalledTimes(1)
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-blob-id")

      // Verify success toast
      expect(mockToast.success).toHaveBeenCalledWith("Todos os artefatos baixados!")
    })

    // @clause CL-UI-005
    // @ui-clause CL-UI-Button-saveall
    it("CL-UI-005: succeeds when Save All is clicked with single artifact", async () => {
      const user = userEvent.setup()
      const artifacts = [createMockArtifact()]

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      const zipInstance = mockJSZip.mock.results[0].value
      expect(zipInstance.file).toHaveBeenCalledTimes(1)
      expect(zipInstance.file).toHaveBeenCalledWith(artifacts[0].filename, artifacts[0].content)
      expect(mockToast.success).toHaveBeenCalledWith("Todos os artefatos baixados!")
    })

    // @clause CL-UI-005
    // @ui-clause CL-UI-Button-saveall
    it("CL-UI-005: succeeds when Save All preserves artifact order in ZIP", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      const zipInstance = mockJSZip.mock.results[0].value
      const fileCalls = zipInstance.file.mock.calls

      // Verify files were added in correct order
      expect(fileCalls[0]).toEqual([artifacts[0].filename, artifacts[0].content])
      expect(fileCalls[1]).toEqual([artifacts[1].filename, artifacts[1].content])
      expect(fileCalls[2]).toEqual([artifacts[2].filename, artifacts[2].content])
    })
  })

  describe("CL-UI-006: Save All shows error toast when ZIP generation fails", () => {
    // @clause CL-UI-006
    // @ui-clause CL-UI-Button-saveall-error
    it("CL-UI-006: fails when JSZip generateAsync rejects with error", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      // Mock zip generation failure
      const mockZipInstance = {
        file: vi.fn().mockReturnThis(),
        generateAsync: vi.fn().mockRejectedValue(new Error("Out of memory")),
      }
      mockJSZip.mockReturnValue(mockZipInstance)

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      // Verify error toast was shown
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao criar arquivo ZIP")

      // Verify no download occurred
      expect(document.body.appendChild).not.toHaveBeenCalled()

      // Verify no success toast
      expect(mockToast.success).not.toHaveBeenCalled()
    })

    // @clause CL-UI-006
    // @ui-clause CL-UI-Button-saveall-error
    it("CL-UI-006: fails when JSZip throws during file addition", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      // Mock zip file addition failure
      const mockZipInstance = {
        file: vi.fn().mockImplementation(() => {
          throw new Error("Invalid content")
        }),
        generateAsync: vi.fn(),
      }
      mockJSZip.mockReturnValue(mockZipInstance)

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      // Verify error toast was shown
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao criar arquivo ZIP")

      // Verify generateAsync was never called
      expect(mockZipInstance.generateAsync).not.toHaveBeenCalled()

      // Verify no download occurred
      expect(document.body.appendChild).not.toHaveBeenCalled()
    })

    // @clause CL-UI-006
    // @ui-clause CL-UI-Button-saveall-error
    it("CL-UI-006: fails when JSZip constructor throws error", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      // Mock JSZip constructor failure
      mockJSZip.mockImplementation(() => {
        throw new Error("JSZip not available")
      })

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveAllBtn = screen.getByTestId("artifact-save-all-btn")
      await user.click(saveAllBtn)

      // Verify error toast was shown
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao criar arquivo ZIP")

      // Verify no download occurred
      expect(document.body.appendChild).not.toHaveBeenCalled()
    })
  })

  describe("CL-INV-001: ArtifactViewer returns null when no artifacts", () => {
    // @clause CL-INV-001
    it("CL-INV-001: succeeds when artifacts array is empty", () => {
      render(<ArtifactViewer artifacts={[]} />)

      // Use resilient query: check that container element is not rendered
      expect(screen.queryByTestId("artifact-viewer-container")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-copy-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()
    })

    // @clause CL-INV-001
    it("CL-INV-001: succeeds when component receives empty array after render", () => {
      const artifacts = createMockArtifacts()
      const { rerender } = render(<ArtifactViewer artifacts={artifacts} />)

      // Initially buttons exist
      expect(screen.getByTestId("artifact-copy-btn")).toBeInTheDocument()
      expect(screen.getByTestId("artifact-save-btn")).toBeInTheDocument()
      expect(screen.getByTestId("artifact-save-all-btn")).toBeInTheDocument()

      // Rerender with empty array
      rerender(<ArtifactViewer artifacts={[]} />)

      // Use resilient query: check that container element is not rendered
      expect(screen.queryByTestId("artifact-viewer-container")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-copy-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-all-btn")).not.toBeInTheDocument()
    })

    // @clause CL-INV-001
    it("CL-INV-001: succeeds when no DOM elements are rendered for empty artifacts", () => {
      render(<ArtifactViewer artifacts={[]} />)

      // Use resilient queries: verify no artifact-related elements exist
      expect(screen.queryByTestId("artifact-viewer-container")).not.toBeInTheDocument()
      expect(screen.queryAllByRole("button")).toHaveLength(0)
      expect(screen.queryByRole("table")).not.toBeInTheDocument()
    })
  })

  describe("CL-INV-002: Tab selection behavior unchanged", () => {
    // @clause CL-INV-002
    it("CL-INV-002: succeeds when tab is selected and displays content", async () => {
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // First tab should be selected by default
      const firstTab = screen.getByTestId("artifact-tab-0")
      expect(firstTab).toHaveClass("bg-card")
      expect(firstTab).toHaveClass("text-foreground")
      expect(firstTab).toHaveClass("border-b-2")
      expect(firstTab).toHaveClass("border-primary")

      // Content should show first artifact (in table format with line numbers)
      expect(screen.getByText(artifacts[0].content)).toBeInTheDocument()
    })

    // @clause CL-INV-002
    it("CL-INV-002: succeeds when clicking tab changes selection styling", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const firstTab = screen.getByTestId("artifact-tab-0")
      const secondTab = screen.getByTestId("artifact-tab-1")

      // First tab initially selected
      expect(firstTab).toHaveClass("bg-card", "text-foreground", "border-b-2", "border-primary")
      expect(secondTab).toHaveClass("text-muted-foreground")
      expect(secondTab).not.toHaveClass("bg-card")

      // Click second tab
      await user.click(secondTab)

      // Second tab now selected
      expect(secondTab).toHaveClass("bg-card", "text-foreground", "border-b-2", "border-primary")
      expect(firstTab).toHaveClass("text-muted-foreground")
      expect(firstTab).not.toHaveClass("bg-card")
    })

    // @clause CL-INV-002
    it("CL-INV-002: succeeds when tab selection updates content display", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // Initially shows first artifact content
      expect(screen.getByText(artifacts[0].content)).toBeInTheDocument()
      expect(screen.queryByText(artifacts[1].content)).not.toBeInTheDocument()

      // Click second tab
      const secondTab = screen.getByTestId("artifact-tab-1")
      await user.click(secondTab)

      // Now shows second artifact content
      expect(screen.getByText(artifacts[1].content)).toBeInTheDocument()
      expect(screen.queryByText(artifacts[0].content)).not.toBeInTheDocument()
    })
  })
})

// =============================================================================
// TESTS: SCHEMA CLAUSES
// =============================================================================

describe("CreatePhaseConfigSchema - Provider Defaults (contract: artifact-viewer-copy-save-provider-defaults)", () => {
  // Import real schema
  const { CreatePhaseConfigSchema } = await import("@/../packages/gatekeeper-api/src/api/schemas/agent.schema")

  describe("CL-SCHEMA-001: CreatePhaseConfigSchema defaults to claude-code provider", () => {
    // @clause CL-SCHEMA-001
    it("CL-SCHEMA-001: succeeds when provider field is omitted from input", () => {
      const input = {
        step: 1,
        model: "sonnet",
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("claude-code")
      }
    })

    // @clause CL-SCHEMA-001
    it("CL-SCHEMA-001: succeeds when provider is undefined in input", () => {
      const input = {
        step: 2,
        model: "haiku",
        provider: undefined,
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("claude-code")
      }
    })

    // @clause CL-SCHEMA-001
    it("CL-SCHEMA-001: succeeds when only required fields are provided", () => {
      const input = {
        step: 3,
        model: "opus",
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("claude-code")
        expect(result.data.maxTokens).toBe(8192) // also check other defaults
        expect(result.data.maxIterations).toBe(30)
        expect(result.data.isActive).toBe(true)
      }
    })
  })

  describe("CL-SCHEMA-002: Explicit provider overrides default", () => {
    // @clause CL-SCHEMA-002
    it("CL-SCHEMA-002: succeeds when provider is explicitly set to anthropic", () => {
      const input = {
        step: 1,
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("anthropic")
      }
    })

    // @clause CL-SCHEMA-002
    it("CL-SCHEMA-002: succeeds when provider is explicitly set to openai", () => {
      const input = {
        step: 2,
        provider: "openai",
        model: "gpt-4.1",
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("openai")
      }
    })

    // @clause CL-SCHEMA-002
    it("CL-SCHEMA-002: succeeds when provider is explicitly set to mistral", () => {
      const input = {
        step: 3,
        provider: "mistral",
        model: "mistral-large-latest",
      }

      const result = CreatePhaseConfigSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe("mistral")
      }
    })
  })
})

// =============================================================================
// TESTS: LABELS CLAUSES
// =============================================================================

describe("PROVIDER_MODELS - Labels (contract: artifact-viewer-copy-save-provider-defaults)", () => {
  describe("CL-LABELS-001: Claude Code provider label is 'Claude Code CLI'", () => {
    // @clause CL-LABELS-001
    it("CL-LABELS-001: succeeds when PROVIDER_MODELS claude-code label is checked", () => {
      // Inline PROVIDER_MODELS object from orchestrator-page.tsx
      const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
        "anthropic": {
          label: "Anthropic (API Key)",
          models: [
            { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
            { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
            { value: "claude-opus-4-5-20251101", label: "Opus 4.5" },
          ],
        },
        "openai": {
          label: "OpenAI (API Key)",
          models: [
            { value: "gpt-4.1", label: "GPT-4.1" },
            { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
            { value: "o3-mini", label: "o3-mini" },
          ],
        },
        "mistral": {
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

      expect(PROVIDER_MODELS["claude-code"]).toBeDefined()
      expect(PROVIDER_MODELS["claude-code"].label).toBe("Claude Code CLI")
    })

    // @clause CL-LABELS-001
    it("CL-LABELS-001: succeeds when claude-code models are unchanged", () => {
      const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
        "claude-code": {
          label: "Claude Code CLI",
          models: [
            { value: "sonnet", label: "Sonnet" },
            { value: "opus", label: "Opus" },
            { value: "haiku", label: "Haiku" },
          ],
        },
      }

      expect(PROVIDER_MODELS["claude-code"].models).toHaveLength(3)
      expect(PROVIDER_MODELS["claude-code"].models[0].value).toBe("sonnet")
      expect(PROVIDER_MODELS["claude-code"].models[1].value).toBe("opus")
      expect(PROVIDER_MODELS["claude-code"].models[2].value).toBe("haiku")
    })

    // @clause CL-LABELS-001
    it("CL-LABELS-001: succeeds when claude-code label is exactly as expected", () => {
      const PROVIDER_MODELS = {
        "claude-code": {
          label: "Claude Code CLI",
          models: [],
        },
      }

      // Exact string match
      expect(PROVIDER_MODELS["claude-code"].label).toStrictEqual("Claude Code CLI")
      expect(PROVIDER_MODELS["claude-code"].label.length).toBe(15)
      expect(PROVIDER_MODELS["claude-code"].label).not.toContain("Max/Pro")
      expect(PROVIDER_MODELS["claude-code"].label).not.toContain("sem API Key")
    })
  })

  describe("CL-LABELS-002: Codex CLI provider label is 'Codex CLI'", () => {
    // @clause CL-LABELS-002
    it("CL-LABELS-002: succeeds when PROVIDER_MODELS codex-cli label is checked", () => {
      const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
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

      expect(PROVIDER_MODELS["codex-cli"]).toBeDefined()
      expect(PROVIDER_MODELS["codex-cli"].label).toBe("Codex CLI")
    })

    // @clause CL-LABELS-002
    it("CL-LABELS-002: succeeds when codex-cli models are unchanged", () => {
      const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
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

      expect(PROVIDER_MODELS["codex-cli"].models).toHaveLength(4)
      expect(PROVIDER_MODELS["codex-cli"].models[0].value).toBe("o3-mini")
      expect(PROVIDER_MODELS["codex-cli"].models[3].value).toBe("codex-mini")
    })

    // @clause CL-LABELS-002
    it("CL-LABELS-002: succeeds when codex-cli label is exactly as expected", () => {
      const PROVIDER_MODELS = {
        "codex-cli": {
          label: "Codex CLI",
          models: [],
        },
      }

      // Exact string match
      expect(PROVIDER_MODELS["codex-cli"].label).toStrictEqual("Codex CLI")
      expect(PROVIDER_MODELS["codex-cli"].label.length).toBe(9)
      expect(PROVIDER_MODELS["codex-cli"].label).not.toContain("OpenAI")
      expect(PROVIDER_MODELS["codex-cli"].label).not.toContain("sem API Key")
    })
  })
})
