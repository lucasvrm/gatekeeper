import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, fireEvent, waitFor } from "@testing-library/react"
import { TestFileInput } from "../test-file-input"

describe("TestFileInput", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("toggles between modes", () => {
    const onFileContent = vi.fn()
    const onPathManual = vi.fn()
    const onError = vi.fn()

    const { getByText, queryByPlaceholderText } = render(
      <TestFileInput
        onFileContent={onFileContent}
        onPathManual={onPathManual}
        onError={onError}
      />
    )

    expect(queryByPlaceholderText("src/components/Button.spec.tsx")).toBeNull()
    fireEvent.click(getByText("Path Manual"))
    expect(queryByPlaceholderText("src/components/Button.spec.tsx")).toBeTruthy()
  })

  it("uploads a file", async () => {
    const onFileContent = vi.fn()
    const onPathManual = vi.fn()
    const onError = vi.fn()

    const { container, getByText } = render(
      <TestFileInput
        onFileContent={onFileContent}
        onPathManual={onPathManual}
        onError={onError}
      />
    )

    fireEvent.click(getByText("Upload"))
    const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement
    const file = new File(["describe('test', () => {})"], "sample.spec.ts", {
      type: "text/plain",
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onFileContent).toHaveBeenCalledWith(
        "describe('test', () => {})",
        "sample.spec.ts"
      )
    })
  })

  it("accepts manual path input", async () => {
    const onFileContent = vi.fn()
    const onPathManual = vi.fn()
    const onError = vi.fn()

    const { getByText, getByPlaceholderText } = render(
      <TestFileInput
        onFileContent={onFileContent}
        onPathManual={onPathManual}
        onError={onError}
      />
    )

    fireEvent.click(getByText("Path Manual"))
    const input = getByPlaceholderText("src/components/Button.spec.tsx")
    fireEvent.change(input, { target: { value: "src/app.test.tsx" } })

    vi.advanceTimersByTime(350)

    await waitFor(() => {
      expect(onPathManual).toHaveBeenCalledWith("src/app.test.tsx")
    })
  })
})
