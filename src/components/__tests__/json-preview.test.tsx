import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { JsonPreview } from "../json-preview"
import type { LLMPlanOutput } from "@/lib/types"

const planData: LLMPlanOutput = {
  outputId: "output-1",
  projectPath: "/repo",
  baseRef: "origin/main",
  targetRef: "HEAD",
  taskPrompt: "Implement auth changes with tests",
  testFilePath: "tests/auth.test.ts",
  dangerMode: false,
  manifest: {
    testFile: "tests/auth.test.ts",
    files: Array.from({ length: 7 }).map((_, index) => ({
      path: `src/file-${index}.ts`,
      action: "CREATE",
    })),
  },
}

describe("JsonPreview", () => {
  it("renders empty state", () => {
    const { getByText } = render(<JsonPreview data={null} />)
    expect(getByText("Faca upload do JSON para visualizar")).toBeTruthy()
  })

  it("renders plan data", () => {
    const { getByText } = render(<JsonPreview data={planData} />)
    expect(getByText("output-1")).toBeTruthy()
    expect(getByText("/repo")).toBeTruthy()
    expect(getByText("origin/main")).toBeTruthy()
    expect(getByText("tests/auth.test.ts")).toBeTruthy()
  })

  it("collapses manifest files", () => {
    const { getByText, queryByText } = render(<JsonPreview data={planData} />)
    expect(getByText("src/file-6.ts")).toBeTruthy()
    fireEvent.click(getByText("Ver menos"))
    expect(queryByText("src/file-6.ts")).toBeNull()
  })
})
