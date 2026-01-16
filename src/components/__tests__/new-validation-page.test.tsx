import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { NewValidationPage } from "../new-validation-page"

const navigateMock = vi.fn()
const createMock = vi.fn()

vi.mock("@/lib/api", () => ({
  api: {
    runs: {
      create: createMock,
    },
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <NewValidationPage />
    </MemoryRouter>
  )

describe("NewValidationPage", () => {
  beforeEach(() => {
    createMock.mockReset()
    navigateMock.mockReset()
  })

  it("disables submit until json and test are provided", async () => {
    const { getByRole } = renderPage()
    const submitButton = getByRole("button", { name: "Iniciar Validacao" })
    expect(submitButton).toBeDisabled()
  })

  it("submits with uploaded test file and redirects", async () => {
    createMock.mockResolvedValue({
      runId: "run-1",
      outputId: "output-1",
      status: "PENDING",
      createdAt: "2025-01-01T00:00:00.000Z",
    })

    const { getByRole, container } = renderPage()

    const plan = {
      outputId: "output-1",
      projectPath: "/repo",
      baseRef: "origin/main",
      targetRef: "HEAD",
      taskPrompt: "Implement auth changes with tests",
      testFilePath: "tests/auth.test.ts",
      dangerMode: false,
      manifest: {
        testFile: "tests/auth.test.ts",
        files: [
          { path: "src/auth.ts", action: "CREATE" },
        ],
      },
    }

    const jsonZone = getByRole("button", { name: "Upload do JSON" })
    const jsonFile = new File([JSON.stringify(plan)], "plan.json", {
      type: "application/json",
    })
    fireEvent.drop(jsonZone, { dataTransfer: { files: [jsonFile] } })

    await waitFor(() => {
      expect(getByRole("button", { name: "Iniciar Validacao" })).toBeDisabled()
    })

    const testZone = getByRole("button", { name: "Upload test file" })
    const testFile = new File(["describe('test', () => {})"], "auth.spec.ts", {
      type: "text/plain",
    })
    fireEvent.drop(testZone, { dataTransfer: { files: [testFile] } })

    const submitButton = getByRole("button", { name: "Iniciar Validacao" })
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled()
    })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        outputId: "output-1",
        projectPath: "/repo",
        baseRef: "origin/main",
        targetRef: "HEAD",
        taskPrompt: "Implement auth changes with tests",
        dangerMode: false,
        manifest: plan.manifest,
        testFilePath: "auth.spec.ts",
        testFileContent: "describe('test', () => {})",
      })
    })

    expect(navigateMock).toHaveBeenCalledWith("/runs/run-1")
  })
})
