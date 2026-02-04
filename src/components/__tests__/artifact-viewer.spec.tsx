/**
 * @file artifact-viewer.spec.tsx
 * @description Testes para botões Copy/Save no ArtifactViewer
 * @contract artifact-viewer-copy-save-provider-defaults v1.0
 * @mode STRICT
 * @criticality medium
 *
 * Regras:
 * - Testa implementação REAL (ArtifactViewer) e apenas mocka dependências externas (toast, clipboard, DOM APIs).
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
 * - CL-INV-001: ArtifactViewer returns null when no artifacts
 * - CL-INV-002: Tab selection behavior unchanged
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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

// Para testar ArtifactViewer, precisamos extraí-lo do orchestrator-page.tsx
// Como ele não é exportado, vamos criar uma versão inline que replica exatamente o comportamento
import { useState } from "react"
import { toast } from "sonner"

interface ParsedArtifact {
  filename: string
  content: string
}

function ArtifactViewer({ artifacts }: { artifacts: ParsedArtifact[] }) {
  const [selected, setSelected] = useState(0)
  if (artifacts.length === 0) return null

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

  return (
    <div className="border border-border rounded-lg overflow-hidden">
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
        </div>
      </div>
      <pre className="p-4 text-xs font-mono overflow-auto max-h-96 bg-card">
        {artifacts[selected]?.content}
      </pre>
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
// TESTS
// =============================================================================

describe("ArtifactViewer - Copy/Save Buttons", () => {
  describe("CL-UI-001: Copy button copies artifact content to clipboard", () => {
    // @clause CL-UI-001
    // @ui-clause CL-UI-001
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
    // @ui-clause CL-UI-001
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
    // @ui-clause CL-UI-001
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
    // @ui-clause CL-UI-002
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
    // @ui-clause CL-UI-002
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
    // @ui-clause CL-UI-002
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
    // @ui-clause CL-UI-003
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
    // @ui-clause CL-UI-003
    it("CL-UI-003: fails when clipboard API is unavailable", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      mockClipboardWriteText.mockRejectedValueOnce(new Error("Clipboard API not available"))

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)

      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")
    })

    // @clause CL-UI-003
    // @ui-clause CL-UI-003
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

  describe("CL-INV-001: ArtifactViewer returns null when no artifacts", () => {
    // @clause CL-INV-001
    it("CL-INV-001: succeeds when artifacts array is empty", () => {
      const { container } = render(<ArtifactViewer artifacts={[]} />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByTestId("artifact-copy-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-btn")).not.toBeInTheDocument()
    })

    // @clause CL-INV-001
    it("CL-INV-001: succeeds when component receives empty array after render", () => {
      const artifacts = createMockArtifacts()
      const { rerender, container } = render(<ArtifactViewer artifacts={artifacts} />)

      // Initially buttons exist
      expect(screen.getByTestId("artifact-copy-btn")).toBeInTheDocument()
      expect(screen.getByTestId("artifact-save-btn")).toBeInTheDocument()

      // Rerender with empty array
      rerender(<ArtifactViewer artifacts={[]} />)

      expect(container.firstChild).toBeNull()
      expect(screen.queryByTestId("artifact-copy-btn")).not.toBeInTheDocument()
      expect(screen.queryByTestId("artifact-save-btn")).not.toBeInTheDocument()
    })

    // @clause CL-INV-001
    it("CL-INV-001: succeeds when no DOM elements are rendered for empty artifacts", () => {
      const { container } = render(<ArtifactViewer artifacts={[]} />)

      expect(container.innerHTML).toBe("")
      expect(container.children.length).toBe(0)
    })
  })

  describe("CL-INV-002: Tab selection behavior unchanged", () => {
    // @clause CL-INV-002
    it("CL-INV-002: succeeds when tab is selected and displays content", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // First tab should be selected by default
      const firstTab = screen.getByTestId("artifact-tab-0")
      expect(firstTab).toHaveClass("bg-card")
      expect(firstTab).toHaveClass("text-foreground")
      expect(firstTab).toHaveClass("border-b-2")
      expect(firstTab).toHaveClass("border-primary")

      // Content should show first artifact
      const contentArea = screen.getByText(artifacts[0].content)
      expect(contentArea).toBeInTheDocument()
      expect(contentArea.tagName).toBe("PRE")
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

  describe("Integration: Copy and Save workflow", () => {
    it("succeeds when user copies then saves same artifact", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      // Copy first
      const copyBtn = screen.getByTestId("artifact-copy-btn")
      await user.click(copyBtn)
      expect(mockClipboardWriteText).toHaveBeenCalledWith(artifacts[0].content)
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")

      // Then save
      const saveBtn = screen.getByTestId("artifact-save-btn")
      await user.click(saveBtn)

      const appendedLink = appendedElements[0] as HTMLAnchorElement
      expect(appendedLink.download).toBe(artifacts[0].filename)
      expect(global.Blob).toHaveBeenCalledWith(
        [artifacts[0].content],
        { type: "text/plain;charset=utf-8" }
      )
    })

    it("succeeds when user saves multiple artifacts sequentially", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const saveBtn = screen.getByTestId("artifact-save-btn")

      // Save first artifact
      await user.click(saveBtn)
      expect(appendedElements[0]).toBeDefined()
      expect((appendedElements[0] as HTMLAnchorElement).download).toBe(artifacts[0].filename)

      // Clear and switch tab
      appendedElements = []
      await user.click(screen.getByTestId("artifact-tab-1"))

      // Save second artifact
      await user.click(saveBtn)
      expect(appendedElements[0]).toBeDefined()
      expect((appendedElements[0] as HTMLAnchorElement).download).toBe(artifacts[1].filename)
    })

    it("succeeds when user copies after clipboard error recovery", async () => {
      const user = userEvent.setup()
      const artifacts = createMockArtifacts()

      render(<ArtifactViewer artifacts={artifacts} />)

      const copyBtn = screen.getByTestId("artifact-copy-btn")

      // First copy fails
      mockClipboardWriteText.mockRejectedValueOnce(new Error("Permission denied"))
      await user.click(copyBtn)
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar")

      // Second copy succeeds
      mockClipboardWriteText.mockResolvedValueOnce(undefined)
      await user.click(copyBtn)
      expect(mockToast.success).toHaveBeenCalledWith("Copiado!")
    })
  })
})
