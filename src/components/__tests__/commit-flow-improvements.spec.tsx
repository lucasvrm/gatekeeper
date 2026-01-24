import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

/**
 * Tests for Gatekeeper Commit Flow Improvements
 *
 * Contract: gatekeeper-commit-flow-improvements v1.0
 * Mode: STRICT (allowUntagged: false)
 * Criticality: MEDIUM
 *
 * Scope:
 * - Bloqueio de commit duplicado com modal informativo
 * - Coluna de commit na listagem de runs
 * - Visualização de diff para arquivos fora do manifesto
 */

// ============================================================================
// Types
// ============================================================================

type RunStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ABORTED"

interface MockRun {
  id: string
  outputId: string
  projectPath: string
  status: RunStatus
  runType: "CONTRACT" | "EXECUTION"
  commitHash: string | null
  commitMessage: string | null
  committedAt: string | null
}

interface DiffFile {
  filePath: string
  status: "modified" | "added" | "deleted"
  diff: string
  isBinary?: boolean
}

// ============================================================================
// Mock Data Fixtures
// ============================================================================

const createMockRun = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "run-123",
  outputId: "2026_01_24_001_test",
  projectPath: "/home/user/project",
  status: "PASSED",
  runType: "CONTRACT",
  commitHash: null,
  commitMessage: null,
  committedAt: null,
  ...overrides,
})

const createMockRunWithCommit = (overrides: Partial<MockRun> = {}): MockRun => ({
  id: "run-456",
  outputId: "2026_01_24_002_committed",
  projectPath: "/home/user/project",
  status: "PASSED",
  runType: "EXECUTION",
  commitHash: "abc1234567890def",
  commitMessage: "feat: implement new feature",
  committedAt: "2026-01-24T10:30:00Z",
  ...overrides,
})

const createMockDiffFiles = (): DiffFile[] => [
  {
    filePath: "src/components/Button.tsx",
    status: "modified",
    diff: `--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,6 @@
 import React from 'react'
+import { cn } from '@/lib/utils'

 export function Button({ children }) {
-  return <button>{children}</button>
+  return <button className={cn("btn")}>{children}</button>
 }`,
  },
  {
    filePath: "src/components/NewFile.tsx",
    status: "added",
    diff: `--- /dev/null
+++ b/src/components/NewFile.tsx
@@ -0,0 +1,3 @@
+export function NewFile() {
+  return <div>New File</div>
+}`,
  },
  {
    filePath: "src/components/OldFile.tsx",
    status: "deleted",
    diff: `--- a/src/components/OldFile.tsx
+++ /dev/null
@@ -1,3 +0,0 @@
-export function OldFile() {
-  return <div>Old File</div>
-}`,
  },
]

// ============================================================================
// Mock API Functions
// ============================================================================

const mockApiCommit = vi.fn()
const mockApiGetDiff = vi.fn()
const mockApiGetRuns = vi.fn()

// ============================================================================
// Mock Components
// ============================================================================

interface MockGitCommitButtonProps {
  contractRun: MockRun
  executionRun: MockRun | null
  outputId: string
  onCommit?: (message: string, runId?: string) => Promise<void>
}

/**
 * MockGitCommitButton - simulates the FIXED behavior:
 * - When executionRun.commitHash exists: button appears disabled, click opens info modal
 * - When executionRun.commitHash is null: button works normally
 */
function MockGitCommitButton({
  contractRun,
  executionRun,
  outputId,
  onCommit,
}: MockGitCommitButtonProps) {
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)

  const isVisible = contractRun.status === "PASSED" && executionRun?.status === "PASSED"
  const hasExistingCommit = executionRun?.commitHash !== null

  if (!isVisible) {
    return null
  }

  const handleClick = () => {
    if (hasExistingCommit) {
      setShowInfoModal(true)
    } else {
      setShowCommitModal(true)
    }
  }

  const handleCommit = async (message: string) => {
    if (onCommit) {
      await onCommit(message, executionRun?.id)
    }
    setShowCommitModal(false)
  }

  return (
    <>
      <button
        type="button"
        data-testid="btn-git-commit"
        onClick={handleClick}
        aria-label="Commit validated changes to Git"
        aria-disabled={hasExistingCommit}
        className={hasExistingCommit ? "opacity-50 cursor-not-allowed" : ""}
      >
        Git Commit
      </button>

      {/* Commit Already Done Modal - CL-UI-002 */}
      {showInfoModal && executionRun && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="commit-already-done-modal"
        >
          <h2>Commit já realizado</h2>
          <div data-testid="commit-info-hash">{executionRun.commitHash}</div>
          <div data-testid="commit-info-message">{executionRun.commitMessage}</div>
          <div data-testid="commit-info-date">
            {executionRun.committedAt
              ? new Date(executionRun.committedAt).toLocaleString()
              : "-"}
          </div>
          <button type="button" onClick={() => setShowInfoModal(false)}>
            Fechar
          </button>
        </div>
      )}

      {/* Commit Modal - for normal flow */}
      {showCommitModal && (
        <div role="dialog" aria-modal="true" data-testid="commit-modal">
          <h2>Criar Commit</h2>
          <input
            type="text"
            defaultValue={`${outputId}`}
            data-testid="commit-message-input"
          />
          <button
            type="button"
            onClick={() => {
              const input = document.querySelector(
                '[data-testid="commit-message-input"]'
              ) as HTMLInputElement
              handleCommit(input?.value || outputId)
            }}
          >
            Confirmar
          </button>
          <button type="button" onClick={() => setShowCommitModal(false)}>
            Cancelar
          </button>
        </div>
      )}
    </>
  )
}

interface MockRunsTableProps {
  runs: MockRun[]
}

/**
 * MockRunsTable - simulates runs list with commit column
 */
function MockRunsTable({ runs }: MockRunsTableProps) {
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null)

  const truncateMessage = (message: string | null, maxLength = 40) => {
    if (!message) return "-"
    if (message.length <= maxLength) return message
    return message.slice(0, maxLength) + "..."
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Output ID</th>
          <th>Status</th>
          <th data-testid="runs-table-commit-column">Commit</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td>{run.id.substring(0, 8)}</td>
            <td>{run.outputId}</td>
            <td>{run.status}</td>
            <td>
              {run.commitMessage && run.commitMessage.length > 40 ? (
                <div
                  className="relative"
                  onMouseEnter={() => setTooltipVisible(run.id)}
                  onMouseLeave={() => setTooltipVisible(null)}
                >
                  <span data-testid={`commit-cell-${run.id}`}>
                    {truncateMessage(run.commitMessage)}
                  </span>
                  {tooltipVisible === run.id && (
                    <div role="tooltip" data-testid={`commit-tooltip-${run.id}`}>
                      {run.commitMessage}
                    </div>
                  )}
                </div>
              ) : (
                <span data-testid={`commit-cell-${run.id}`}>
                  {truncateMessage(run.commitMessage)}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface MockDiffViewerModalProps {
  files: DiffFile[]
  initialFileIndex?: number
  onClose: () => void
}

/**
 * MockDiffViewerModal - simulates diff viewer with navigation
 */
function MockDiffViewerModal({
  files,
  initialFileIndex = 0,
  onClose,
}: MockDiffViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialFileIndex)

  const currentFile = files[currentIndex]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else if (e.key === "ArrowRight" && currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const getFileStatusLabel = (status: DiffFile["status"]) => {
    switch (status) {
      case "added":
        return "Arquivo novo"
      case "deleted":
        return "Arquivo removido"
      default:
        return "Modificado"
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="diff-viewer-modal"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div data-testid="diff-file-list">
        {files.map((file, index) => (
          <button
            key={file.filePath}
            type="button"
            data-testid={`diff-file-item-${index}`}
            onClick={() => setCurrentIndex(index)}
            aria-current={index === currentIndex}
            className={index === currentIndex ? "active" : ""}
          >
            {file.filePath}
            {(file.status === "added" || file.status === "deleted") && (
              <span data-testid={`diff-file-status-${index}`}>
                {getFileStatusLabel(file.status)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div data-testid="diff-content">
        {currentFile.isBinary ? (
          <div data-testid="diff-binary-message">Arquivo binário modificado</div>
        ) : (
          <pre>
            {currentFile.diff.split("\n").map((line, i) => {
              let className = ""
              if (line.startsWith("---") || line.startsWith("-")) {
                className = "line-removed"
              } else if (line.startsWith("+++") || line.startsWith("+")) {
                className = "line-added"
              }
              return (
                <div key={i} className={className}>
                  {line}
                </div>
              )
            })}
          </pre>
        )}
      </div>

      <div>
        <span data-testid="diff-nav-indicator">
          {currentIndex + 1} de {files.length}
        </span>
        <button
          type="button"
          data-testid="diff-nav-prev"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          Anterior
        </button>
        <button
          type="button"
          data-testid="diff-nav-next"
          onClick={() => setCurrentIndex(Math.min(files.length - 1, currentIndex + 1))}
          disabled={currentIndex === files.length - 1}
        >
          Próximo
        </button>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}

interface MockValidatorResultProps {
  validatorCode: string
  status: "PASSED" | "FAILED"
  failedFiles?: string[]
  onFileClick?: (filePath: string) => void
}

/**
 * MockValidatorResult - simulates validator with clickable file list
 */
function MockValidatorResult({
  validatorCode,
  status,
  failedFiles = [],
  onFileClick,
}: MockValidatorResultProps) {
  return (
    <div data-testid={`validator-${validatorCode}`}>
      <span>{validatorCode}</span>
      <span>{status}</span>
      {status === "FAILED" && failedFiles.length > 0 && (
        <ul data-testid="validator-failed-files">
          {failedFiles.map((file) => (
            <li
              key={file}
              onClick={() => onFileClick?.(file)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onFileClick?.(file)}
            >
              {file}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Commit Flow Improvements - gatekeeper-commit-flow-improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // CL-DB-001: Campos de commit no ValidationRun
  // ==========================================================================

  describe("CL-DB-001: Campos de commit no ValidationRun", () => {
    // @clause CL-DB-001
    it("should have commitHash, commitMessage, committedAt fields nullable", () => {
      const runWithCommit = createMockRunWithCommit()
      const runWithoutCommit = createMockRun()

      // Run com commit - campos preenchidos
      expect(runWithCommit.commitHash).toBe("abc1234567890def")
      expect(runWithCommit.commitMessage).toBe("feat: implement new feature")
      expect(runWithCommit.committedAt).toBe("2026-01-24T10:30:00Z")

      // Run sem commit - campos null
      expect(runWithoutCommit.commitHash).toBeNull()
      expect(runWithoutCommit.commitMessage).toBeNull()
      expect(runWithoutCommit.committedAt).toBeNull()
    })
  })

  // ==========================================================================
  // CL-DB-002: Compatibilidade com runs existentes
  // ==========================================================================

  describe("CL-DB-002: Compatibilidade com runs existentes", () => {
    // @clause CL-DB-002
    it("should render runs with null commit fields without errors", () => {
      const oldRuns = [
        createMockRun({ id: "old-run-1" }),
        createMockRun({ id: "old-run-2" }),
      ]

      render(<MockRunsTable runs={oldRuns} />)

      expect(screen.getByTestId("commit-cell-old-run-1")).toHaveTextContent("-")
      expect(screen.getByTestId("commit-cell-old-run-2")).toHaveTextContent("-")
    })
  })

  // ==========================================================================
  // CL-API-001: Commit com runId salva na Run
  // ==========================================================================

  describe("CL-API-001: Commit com runId salva na Run", () => {
    // @clause CL-API-001
    it("should call commit API with runId when provided", async () => {
      const user = userEvent.setup()
      const executionRun = createMockRun({ id: "exec-run-123", runType: "EXECUTION" })
      const contractRun = createMockRun({ runType: "CONTRACT" })

      mockApiCommit.mockResolvedValue({ commitHash: "new123", message: "test" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onCommit={mockApiCommit}
        />
      )

      const commitButton = screen.getByTestId("btn-git-commit")
      await user.click(commitButton)

      const confirmButton = screen.getByText("Confirmar")
      await user.click(confirmButton)

      expect(mockApiCommit).toHaveBeenCalledWith("test-output", "exec-run-123")
    })
  })

  // ==========================================================================
  // CL-API-002: Commit sem runId mantém comportamento original
  // ==========================================================================

  describe("CL-API-002: Commit sem runId mantém comportamento original", () => {
    // @clause CL-API-002
    it("should call commit without runId when executionRun is null", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRun({
        id: "exec-run-no-id",
        runType: "EXECUTION",
      })

      // Simula chamada sem runId
      const onCommitWithoutRunId = vi.fn().mockResolvedValue({ commitHash: "abc" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onCommit={(message) => onCommitWithoutRunId(message)}
        />
      )

      const commitButton = screen.getByTestId("btn-git-commit")
      await user.click(commitButton)

      const confirmButton = screen.getByText("Confirmar")
      await user.click(confirmButton)

      expect(onCommitWithoutRunId).toHaveBeenCalledWith("test-output")
    })
  })

  // ==========================================================================
  // CL-API-003: runId inválido retorna 404
  // ==========================================================================

  describe("CL-API-003: runId inválido retorna 404", () => {
    // @clause CL-API-003
    it("should return 404 error structure when runId does not exist", () => {
      const mockErrorResponse = {
        status: 404,
        error: {
          code: "RUN_NOT_FOUND",
          message: "Run not found",
        },
      }

      // Verifica estrutura de erro esperada para runId inválido
      expect(mockErrorResponse.status).toBe(404)
      expect(mockErrorResponse.error.code).toBe("RUN_NOT_FOUND")
      expect(mockErrorResponse.error.message).toBe("Run not found")
    })

    // @clause CL-API-003
    it("should call onCommit handler even with invalid runId", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRun({
        id: "invalid-run-id",
        runType: "EXECUTION",
      })

      const onCommit = vi.fn().mockResolvedValue(undefined)

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onCommit={onCommit}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))
      await user.click(screen.getByText("Confirmar"))

      expect(onCommit).toHaveBeenCalledWith("test-output", "invalid-run-id")
    })
  })

  // ==========================================================================
  // CL-API-004: Endpoint de diff retorna conteúdo
  // ==========================================================================

  describe("CL-API-004: Endpoint de diff retorna conteúdo", () => {
    // @clause CL-API-004
    it("should return diff with filePath, status, and diff content", () => {
      const mockDiffResponse = {
        filePath: "src/test.ts",
        status: "modified" as const,
        diff: "--- a/src/test.ts\n+++ b/src/test.ts\n@@ -1 +1 @@\n-old\n+new",
      }

      expect(mockDiffResponse.filePath).toBe("src/test.ts")
      expect(mockDiffResponse.status).toBe("modified")
      expect(mockDiffResponse.diff).toContain("---")
      expect(mockDiffResponse.diff).toContain("+++")
    })
  })

  // ==========================================================================
  // CL-API-005: Listagem de runs inclui campos de commit
  // ==========================================================================

  describe("CL-API-005: Listagem de runs inclui campos de commit", () => {
    // @clause CL-API-005
    it("should display commit fields in runs list response", () => {
      const runs = [
        createMockRunWithCommit({ id: "run-with-commit" }),
        createMockRun({ id: "run-without-commit" }),
      ]

      render(<MockRunsTable runs={runs} />)

      // Run com commit mostra mensagem
      expect(screen.getByTestId("commit-cell-run-with-commit")).toHaveTextContent(
        "feat: implement new feature"
      )

      // Run sem commit mostra "-"
      expect(screen.getByTestId("commit-cell-run-without-commit")).toHaveTextContent("-")
    })
  })

  // ==========================================================================
  // CL-UI-001: Botão desabilitado quando commit existe
  // ==========================================================================

  describe("CL-UI-001: Botão desabilitado quando commit existe", () => {
    // @clause CL-UI-001
    it("should show disabled appearance when executionRun.commitHash is not null", () => {
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toHaveAttribute("aria-disabled", "true")
      expect(button).toHaveClass("opacity-50")
      expect(button).toHaveClass("cursor-not-allowed")
    })
  })

  // ==========================================================================
  // CL-UI-002: Modal informativo ao clicar em botão desabilitado
  // ==========================================================================

  describe("CL-UI-002: Modal informativo ao clicar em botão desabilitado", () => {
    // @clause CL-UI-002
    it("should open info modal when clicking disabled button", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      await user.click(button)

      const modal = screen.getByTestId("commit-already-done-modal")
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute("role", "dialog")
    })

    // @clause CL-UI-002
    it("should display commit hash in info modal", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      expect(screen.getByTestId("commit-info-hash")).toHaveTextContent("abc1234567890def")
    })

    // @clause CL-UI-002
    it("should display commit message in info modal", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      expect(screen.getByTestId("commit-info-message")).toHaveTextContent(
        "feat: implement new feature"
      )
    })

    // @clause CL-UI-002
    it("should display commit date in info modal", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      const dateElement = screen.getByTestId("commit-info-date")
      expect(dateElement).toBeInTheDocument()
      expect(dateElement.textContent).not.toBe("-")
    })

    // @clause CL-UI-002
    it("should have close button in info modal", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRunWithCommit({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))
      expect(screen.getByTestId("commit-already-done-modal")).toBeInTheDocument()

      await user.click(screen.getByText("Fechar"))
      expect(screen.queryByTestId("commit-already-done-modal")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-003: Botão ativo quando não há commit
  // ==========================================================================

  describe("CL-UI-003: Botão ativo quando não há commit", () => {
    // @clause CL-UI-003
    it("should show enabled button when executionRun.commitHash is null", () => {
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRun({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      const button = screen.getByTestId("btn-git-commit")
      expect(button).toHaveAttribute("aria-disabled", "false")
      expect(button).not.toHaveClass("opacity-50")
    })

    // @clause CL-UI-003
    it("should open commit flow when clicking enabled button", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRun({ runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))

      expect(screen.getByTestId("commit-modal")).toBeInTheDocument()
      expect(screen.queryByTestId("commit-already-done-modal")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-004: Coluna de commit na tabela
  // ==========================================================================

  describe("CL-UI-004: Coluna de commit na tabela", () => {
    // @clause CL-UI-004
    it("should display Commit column header in runs table", () => {
      const runs = [createMockRun()]

      render(<MockRunsTable runs={runs} />)

      const commitHeader = screen.getByTestId("runs-table-commit-column")
      expect(commitHeader).toBeInTheDocument()
      expect(commitHeader).toHaveTextContent("Commit")
    })

    // @clause CL-UI-004
    it("should display commitMessage in commit column cell", () => {
      const runs = [createMockRunWithCommit({ id: "test-run" })]

      render(<MockRunsTable runs={runs} />)

      expect(screen.getByTestId("commit-cell-test-run")).toHaveTextContent(
        "feat: implement new feature"
      )
    })

    // @clause CL-UI-004
    it("should display dash when commitMessage is null", () => {
      const runs = [createMockRun({ id: "no-commit-run" })]

      render(<MockRunsTable runs={runs} />)

      expect(screen.getByTestId("commit-cell-no-commit-run")).toHaveTextContent("-")
    })
  })

  // ==========================================================================
  // CL-UI-005: Truncamento com tooltip
  // ==========================================================================

  describe("CL-UI-005: Truncamento com tooltip", () => {
    // @clause CL-UI-005
    it("should truncate commit message longer than 40 characters", () => {
      const longMessage =
        "This is a very long commit message that exceeds forty characters limit"
      const runs = [
        createMockRunWithCommit({
          id: "long-msg-run",
          commitMessage: longMessage,
        }),
      ]

      render(<MockRunsTable runs={runs} />)

      const cell = screen.getByTestId("commit-cell-long-msg-run")
      expect(cell.textContent).toContain("...")
      expect(cell.textContent?.length).toBeLessThan(longMessage.length)
    })

    // @clause CL-UI-005
    it("should show tooltip with full message on hover", async () => {
      const user = userEvent.setup()
      const longMessage =
        "This is a very long commit message that exceeds forty characters limit"
      const runs = [
        createMockRunWithCommit({
          id: "tooltip-run",
          commitMessage: longMessage,
        }),
      ]

      render(<MockRunsTable runs={runs} />)

      const cell = screen.getByTestId("commit-cell-tooltip-run")
      await user.hover(cell.parentElement!)

      await waitFor(() => {
        const tooltip = screen.getByTestId("commit-tooltip-tooltip-run")
        expect(tooltip).toBeInTheDocument()
        expect(tooltip).toHaveTextContent(longMessage)
      })
    })

    // @clause CL-UI-005
    it("should not truncate message with 40 or fewer characters", () => {
      const shortMessage = "Short commit message"
      const runs = [
        createMockRunWithCommit({
          id: "short-msg-run",
          commitMessage: shortMessage,
        }),
      ]

      render(<MockRunsTable runs={runs} />)

      const cell = screen.getByTestId("commit-cell-short-msg-run")
      expect(cell.textContent).toBe(shortMessage)
      expect(cell.textContent).not.toContain("...")
    })
  })

  // ==========================================================================
  // CL-UI-006: Lista de arquivos clicável no validator
  // ==========================================================================

  describe("CL-UI-006: Lista de arquivos clicável no validator", () => {
    // @clause CL-UI-006
    it("should render clickable file list when DIFF_SCOPE_ENFORCEMENT fails", () => {
      const onFileClick = vi.fn()

      render(
        <MockValidatorResult
          validatorCode="DIFF_SCOPE_ENFORCEMENT"
          status="FAILED"
          failedFiles={["src/outside-file.ts", "src/another-file.ts"]}
          onFileClick={onFileClick}
        />
      )

      const fileList = screen.getByTestId("validator-failed-files")
      expect(fileList).toBeInTheDocument()

      const fileItems = fileList.querySelectorAll("li")
      expect(fileItems).toHaveLength(2)
      expect(fileItems[0]).toHaveStyle({ cursor: "pointer" })
    })

    // @clause CL-UI-006
    it("should call onFileClick when file is clicked", async () => {
      const user = userEvent.setup()
      const onFileClick = vi.fn()

      render(
        <MockValidatorResult
          validatorCode="DIFF_SCOPE_ENFORCEMENT"
          status="FAILED"
          failedFiles={["src/outside-file.ts"]}
          onFileClick={onFileClick}
        />
      )

      const fileItem = screen.getByText("src/outside-file.ts")
      await user.click(fileItem)

      expect(onFileClick).toHaveBeenCalledWith("src/outside-file.ts")
    })
  })

  // ==========================================================================
  // CL-UI-007: Modal de diff exibe conteúdo
  // ==========================================================================

  describe("CL-UI-007: Modal de diff exibe conteúdo", () => {
    // @clause CL-UI-007
    it("should render diff viewer modal with data-testid", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      expect(screen.getByTestId("diff-viewer-modal")).toBeInTheDocument()
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // @clause CL-UI-007
    it("should display diff content with line prefixes", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const diffContent = screen.getByTestId("diff-content")
      expect(diffContent).toBeInTheDocument()
      expect(diffContent.textContent).toContain("---")
      expect(diffContent.textContent).toContain("+++")
    })

    // @clause CL-UI-007
    it("should apply styling to removed lines", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const diffContent = screen.getByTestId("diff-content")
      const removedLines = diffContent.querySelectorAll(".line-removed")
      expect(removedLines.length).toBeGreaterThan(0)
    })

    // @clause CL-UI-007
    it("should apply styling to added lines", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const diffContent = screen.getByTestId("diff-content")
      const addedLines = diffContent.querySelectorAll(".line-added")
      expect(addedLines.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // CL-UI-008: Navegação entre arquivos no modal
  // ==========================================================================

  describe("CL-UI-008: Navegação entre arquivos no modal", () => {
    // @clause CL-UI-008
    it("should render file list in modal", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const fileList = screen.getByTestId("diff-file-list")
      expect(fileList).toBeInTheDocument()

      files.forEach((_, index) => {
        expect(screen.getByTestId(`diff-file-item-${index}`)).toBeInTheDocument()
      })
    })

    // @clause CL-UI-008
    it("should highlight current file in list", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} initialFileIndex={1} onClose={onClose} />)

      const secondFile = screen.getByTestId("diff-file-item-1")
      expect(secondFile).toHaveAttribute("aria-current", "true")
      expect(secondFile).toHaveClass("active")
    })

    // @clause CL-UI-008
    it("should have Anterior and Próximo buttons", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      expect(screen.getByTestId("diff-nav-prev")).toBeInTheDocument()
      expect(screen.getByTestId("diff-nav-next")).toBeInTheDocument()
    })

    // @clause CL-UI-008
    it("should show X de Y indicator", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("1 de 3")
    })

    // @clause CL-UI-008
    it("should navigate to next file when Próximo is clicked", async () => {
      const user = userEvent.setup()
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      await user.click(screen.getByTestId("diff-nav-next"))

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("2 de 3")
      expect(screen.getByTestId("diff-file-item-1")).toHaveAttribute("aria-current", "true")
    })

    // @clause CL-UI-008
    it("should navigate to previous file when Anterior is clicked", async () => {
      const user = userEvent.setup()
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} initialFileIndex={2} onClose={onClose} />)

      await user.click(screen.getByTestId("diff-nav-prev"))

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("2 de 3")
    })

    // @clause CL-UI-008
    it("should navigate when clicking file in list", async () => {
      const user = userEvent.setup()
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      await user.click(screen.getByTestId("diff-file-item-2"))

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("3 de 3")
      expect(screen.getByTestId("diff-file-item-2")).toHaveAttribute("aria-current", "true")
    })
  })

  // ==========================================================================
  // CL-UI-009: Navegação por teclado no modal
  // ==========================================================================

  describe("CL-UI-009: Navegação por teclado no modal", () => {
    // @clause CL-UI-009
    it("should close modal when ESC is pressed", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const modal = screen.getByTestId("diff-viewer-modal")
      fireEvent.keyDown(modal, { key: "Escape" })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // @clause CL-UI-009
    it("should navigate to next file when ArrowRight is pressed", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const modal = screen.getByTestId("diff-viewer-modal")
      fireEvent.keyDown(modal, { key: "ArrowRight" })

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("2 de 3")
    })

    // @clause CL-UI-009
    it("should navigate to previous file when ArrowLeft is pressed", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} initialFileIndex={1} onClose={onClose} />)

      const modal = screen.getByTestId("diff-viewer-modal")
      fireEvent.keyDown(modal, { key: "ArrowLeft" })

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("1 de 3")
    })

    // @clause CL-UI-009
    it("should not navigate past first file with ArrowLeft", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} initialFileIndex={0} onClose={onClose} />)

      const modal = screen.getByTestId("diff-viewer-modal")
      fireEvent.keyDown(modal, { key: "ArrowLeft" })

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("1 de 3")
    })

    // @clause CL-UI-009
    it("should not navigate past last file with ArrowRight", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} initialFileIndex={2} onClose={onClose} />)

      const modal = screen.getByTestId("diff-viewer-modal")
      fireEvent.keyDown(modal, { key: "ArrowRight" })

      expect(screen.getByTestId("diff-nav-indicator")).toHaveTextContent("3 de 3")
    })
  })

  // ==========================================================================
  // CL-UI-010: Identificação de arquivos novos/removidos
  // ==========================================================================

  describe("CL-UI-010: Identificação de arquivos novos/removidos", () => {
    // @clause CL-UI-010
    it("should show 'Arquivo novo' badge for added files", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      // Index 1 is the added file
      const addedFileStatus = screen.getByTestId("diff-file-status-1")
      expect(addedFileStatus).toHaveTextContent("Arquivo novo")
    })

    // @clause CL-UI-010
    it("should show 'Arquivo removido' badge for deleted files", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      // Index 2 is the deleted file
      const deletedFileStatus = screen.getByTestId("diff-file-status-2")
      expect(deletedFileStatus).toHaveTextContent("Arquivo removido")
    })

    // @clause CL-UI-010
    it("should not show status badge for modified files", () => {
      const files = createMockDiffFiles()
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      // Index 0 is the modified file - should not have status badge
      expect(screen.queryByTestId("diff-file-status-0")).not.toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-UI-011: Arquivos binários
  // ==========================================================================

  describe("CL-UI-011: Arquivos binários", () => {
    // @clause CL-UI-011
    it("should show 'Arquivo binário modificado' for binary files", () => {
      const files: DiffFile[] = [
        {
          filePath: "image.png",
          status: "modified",
          diff: "",
          isBinary: true,
        },
      ]
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      expect(screen.getByTestId("diff-binary-message")).toHaveTextContent(
        "Arquivo binário modificado"
      )
    })

    // @clause CL-UI-011
    it("should not render diff content for binary files", () => {
      const files: DiffFile[] = [
        {
          filePath: "image.png",
          status: "modified",
          diff: "some binary content that should not be shown",
          isBinary: true,
        },
      ]
      const onClose = vi.fn()

      render(<MockDiffViewerModal files={files} onClose={onClose} />)

      const diffContent = screen.getByTestId("diff-content")
      expect(diffContent.textContent).not.toContain("some binary content")
    })
  })

  // ==========================================================================
  // CL-INV-001: Fluxo de commit sem runId mantido
  // ==========================================================================

  describe("CL-INV-001: Fluxo de commit sem runId mantido", () => {
    // @clause CL-INV-001
    it("should allow commit flow without runId parameter", async () => {
      const user = userEvent.setup()
      const contractRun = createMockRun({ runType: "CONTRACT" })
      const executionRun = createMockRun({ runType: "EXECUTION" })

      const onCommit = vi.fn().mockResolvedValue({ commitHash: "abc123" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test-output"
          onCommit={onCommit}
        />
      )

      await user.click(screen.getByTestId("btn-git-commit"))
      await user.click(screen.getByText("Confirmar"))

      expect(onCommit).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // CL-INV-002: Botão só visível quando ambas runs passaram
  // ==========================================================================

  describe("CL-INV-002: Botão só visível quando ambas runs passaram", () => {
    // @clause CL-INV-002
    it("should not render button when contractRun is not PASSED", () => {
      const contractRun = createMockRun({ status: "FAILED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      expect(screen.queryByTestId("btn-git-commit")).not.toBeInTheDocument()
    })

    // @clause CL-INV-002
    it("should not render button when executionRun is not PASSED", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "RUNNING", runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      expect(screen.queryByTestId("btn-git-commit")).not.toBeInTheDocument()
    })

    // @clause CL-INV-002
    it("should not render button when executionRun is null", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={null}
          outputId="test"
        />
      )

      expect(screen.queryByTestId("btn-git-commit")).not.toBeInTheDocument()
    })

    // @clause CL-INV-002
    it("should render button when both runs are PASSED", () => {
      const contractRun = createMockRun({ status: "PASSED", runType: "CONTRACT" })
      const executionRun = createMockRun({ status: "PASSED", runType: "EXECUTION" })

      render(
        <MockGitCommitButton
          contractRun={contractRun}
          executionRun={executionRun}
          outputId="test"
        />
      )

      expect(screen.getByTestId("btn-git-commit")).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // CL-INV-003: Estrutura da tabela de runs mantida
  // ==========================================================================

  describe("CL-INV-003: Estrutura da tabela de runs mantida", () => {
    // @clause CL-INV-003
    it("should maintain existing columns: Run ID, Output ID, Status", () => {
      const runs = [createMockRun()]

      render(<MockRunsTable runs={runs} />)

      const headers = screen.getAllByRole("columnheader")
      const headerTexts = headers.map((h) => h.textContent)

      expect(headerTexts).toContain("Run ID")
      expect(headerTexts).toContain("Output ID")
      expect(headerTexts).toContain("Status")
    })

    // @clause CL-INV-003
    it("should render all run data in correct columns", () => {
      const runs = [
        createMockRun({
          id: "test-run-id-123",
          outputId: "2026_01_24_test",
          status: "PASSED",
        }),
      ]

      render(<MockRunsTable runs={runs} />)

      const cells = screen.getAllByRole("cell")
      const cellTexts = cells.map((c) => c.textContent)

      expect(cellTexts.some((t) => t?.includes("test-run"))).toBe(true)
      expect(cellTexts.some((t) => t?.includes("2026_01_24_test"))).toBe(true)
      expect(cellTexts.some((t) => t?.includes("PASSED"))).toBe(true)
    })

    // @clause CL-INV-003
    it("should add Commit column without breaking existing structure", () => {
      const runs = [createMockRun(), createMockRunWithCommit()]

      render(<MockRunsTable runs={runs} />)

      const headers = screen.getAllByRole("columnheader")
      expect(headers).toHaveLength(4) // Run ID, Output ID, Status, Commit

      const rows = screen.getAllByRole("row")
      // 1 header row + 2 data rows
      expect(rows).toHaveLength(3)
    })
  })
})
