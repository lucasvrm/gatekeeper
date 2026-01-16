import { describe, it, expect, vi } from "vitest"
import { render, fireEvent, waitFor } from "@testing-library/react"
import { FileDropZone } from "../file-drop-zone"

describe("FileDropZone", () => {
  it("uploads a file via drop", async () => {
    const onFileContent = vi.fn()
    const onError = vi.fn()

    const { getByRole } = render(
      <FileDropZone
        accept=".json"
        label="Upload JSON"
        placeholder="Drop file"
        onFileContent={onFileContent}
        onError={onError}
      />
    )

    const zone = getByRole("button", { name: "Upload JSON" })
    const file = new File(["{\"ok\":true}"], "plan.json", {
      type: "application/json",
    })

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(onFileContent).toHaveBeenCalledWith("{\"ok\":true}", "plan.json")
    })
  })

  it("uploads a file via click", async () => {
    const onFileContent = vi.fn()
    const onError = vi.fn()

    const { container, getByRole } = render(
      <FileDropZone
        accept=".json"
        label="Upload JSON"
        placeholder="Drop file"
        onFileContent={onFileContent}
        onError={onError}
      />
    )

    const zone = getByRole("button", { name: "Upload JSON" })
    fireEvent.click(zone)

    const input = container.querySelector("input[type=\"file\"]") as HTMLInputElement
    const file = new File(["{\"ok\":true}"], "plan.json", {
      type: "application/json",
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onFileContent).toHaveBeenCalledWith("{\"ok\":true}", "plan.json")
    })
  })

  it("rejects invalid extension", async () => {
    const onFileContent = vi.fn()
    const onError = vi.fn()

    const { getByRole } = render(
      <FileDropZone
        accept=".json"
        label="Upload JSON"
        placeholder="Drop file"
        onFileContent={onFileContent}
        onError={onError}
      />
    )

    const zone = getByRole("button", { name: "Upload JSON" })
    const file = new File(["content"], "plan.txt", { type: "text/plain" })

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})
