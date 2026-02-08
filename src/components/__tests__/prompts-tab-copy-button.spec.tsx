/**
 * @file prompts-tab-copy-button.spec.tsx
 * @description Contract spec for copy button with lucide-react Copy icon in PromptCard and DynamicPromptCard
 * @contract prompts-tab-copy-button v1.0
 * @mode STRICT
 *
 * Regras:
 * - Testa implementação REAL (PromptsTab, PromptCard, DynamicPromptCard) e apenas mocka dependências externas (API, toast, clipboard).
 * - Sem snapshots.
 * - Sem asserts fracos como única verificação.
 * - Happy/Sad path detectados pelo nome do it(): "should [verb] when" / "should fail when".
 * - Cada clause tem pelo menos 3 testes.
 */

import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

import type { PromptInstruction } from "@/lib/types"

// =============================================================================
// HOISTED MOCKS
// =============================================================================

const {
  mockApi,
  mockToast,
} = vi.hoisted(() => ({
  mockApi: {
    mcp: {
      prompts: {
        list: vi.fn(),
        delete: vi.fn(),
      },
    },
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Clipboard spy - will be set in beforeEach
let clipboardWriteTextSpy: ReturnType<typeof vi.spyOn>

// =============================================================================
// MODULE MOCKS
// =============================================================================

vi.mock("@/lib/api", () => ({
  api: mockApi,
}))

vi.mock("sonner", () => ({
  toast: mockToast,
}))

vi.mock("@/components/prompt-form-dialog", () => ({
  PromptFormDialog: () => null,
}))

// Component under test (REAL)
import { PromptsTab } from "@/components/prompts-tab"

// =============================================================================
// FIXTURE BUILDERS
// =============================================================================

function createPromptInstruction(
  overrides: Partial<PromptInstruction> = {}
): PromptInstruction {
  return {
    id: "prompt-1",
    name: "Test Prompt",
    content: "This is a test prompt content with some text to copy.",
    step: 1,
    kind: "instruction",
    role: "system",
    order: 1,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function createPipelinePrompt(
  step: number,
  role: "system" | "user" = "system",
  overrides: Partial<PromptInstruction> = {}
): PromptInstruction {
  return createPromptInstruction({
    id: `pipeline-${step}-${role}`,
    name: `Pipeline Step ${step} ${role}`,
    content: `Content for step ${step} ${role} prompt. This is a longer text to test copy functionality.`,
    step,
    kind: "instruction",
    role,
    order: 1,
    ...overrides,
  })
}

function createDynamicPrompt(
  kind: string,
  overrides: Partial<PromptInstruction> = {}
): PromptInstruction {
  return createPromptInstruction({
    id: `dynamic-${kind}`,
    name: `Dynamic ${kind}`,
    content: `Dynamic instruction content for ${kind}. This should be copyable.`,
    step: null,
    kind,
    role: "system",
    order: 1,
    ...overrides,
  })
}

function createSessionPrompt(
  overrides: Partial<PromptInstruction> = {}
): PromptInstruction {
  return createPromptInstruction({
    id: "session-1",
    name: "Custom Session Prompt",
    content: "Custom session prompt content that should be copyable.",
    step: null,
    kind: null,
    role: "system",
    order: 1,
    ...overrides,
  })
}

async function renderPromptsTab(
  pipelinePrompts: PromptInstruction[] = [],
  sessionPrompts: PromptInstruction[] = []
) {
  // Separate pipeline prompts into base and dynamic
  const BASE_KINDS = ["instruction", "doc", "prompt", "cli", null]
  const basePipeline = pipelinePrompts.filter((p) =>
    BASE_KINDS.includes(p.kind)
  )
  const dynamic = pipelinePrompts.filter(
    (p) => p.kind && !BASE_KINDS.includes(p.kind)
  )

  mockApi.mcp.prompts.list.mockImplementation((type: string) => {
    if (type === "pipeline") {
      return Promise.resolve(pipelinePrompts)
    }
    if (type === "session") {
      return Promise.resolve(sessionPrompts)
    }
    return Promise.resolve([])
  })

  const result = render(
    <MemoryRouter>
      <PromptsTab />
    </MemoryRouter>
  )

  // Wait for loading to complete
  await screen.findByTestId("prompts-tab")

  return result
}

// =============================================================================
// SETUP / TEARDOWN
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks()

  // Setup clipboard mock - ensure navigator.clipboard exists and is mocked
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(), readText: vi.fn() },
      writable: true,
      configurable: true,
    })
  }
  clipboardWriteTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// CL-COPY-BTN-001 — Copy button rendered in PromptCard
// =============================================================================

describe("CL-COPY-BTN-001 — Copy button rendered in PromptCard", () => {
  // @clause CL-COPY-BTN-001
  it("should render copy button for pipeline system prompt", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-COPY-BTN-001
  it("should render copy button for pipeline user prompt", async () => {
    const prompt = createPipelinePrompt(2, "user")
    await renderPromptsTab([prompt], [])

    // Switch to step 2 and user role
    const user = userEvent.setup()
    await user.click(screen.getByTestId("step-toggle-2"))
    await user.click(screen.getByTestId("role-toggle-user"))

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-001
  it("should render copy button for custom session prompt", async () => {
    const prompt = createSessionPrompt()
    await renderPromptsTab([], [prompt])

    // Switch to custom tab
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-session"))

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-001
  it("should render copy button for multiple prompts in same step", async () => {
    const prompt1 = createPipelinePrompt(1, "system", { id: "p1", order: 1 })
    const prompt2 = createPipelinePrompt(1, "system", { id: "p2", order: 2 })
    await renderPromptsTab([prompt1, prompt2], [])

    expect(screen.getByTestId(`copy-prompt-${prompt1.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`copy-prompt-${prompt2.id}`)).toBeInTheDocument()
  })
})

// =============================================================================
// CL-COPY-BTN-002 — Copy button rendered in DynamicPromptCard
// =============================================================================

describe("CL-COPY-BTN-002 — Copy button rendered in DynamicPromptCard", () => {
  // @clause CL-COPY-BTN-002
  it("should render copy button for retry dynamic prompt", async () => {
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    // Switch to dynamic tab
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn.tagName.toLowerCase()).toBe("button")
  })

  // @clause CL-COPY-BTN-002
  it("should render copy button for guidance dynamic prompt", async () => {
    const prompt = createDynamicPrompt("guidance")
    await renderPromptsTab([prompt], [])

    // Switch to dynamic tab and guidance kind
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))
    await user.click(screen.getByTestId("kind-toggle-guidance"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-002
  it("should render copy button for git-strategy dynamic prompt", async () => {
    const prompt = createDynamicPrompt("git-strategy")
    await renderPromptsTab([prompt], [])

    // Switch to dynamic tab and git-strategy kind
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))
    await user.click(screen.getByTestId("kind-toggle-git-strategy"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    expect(copyBtn).toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-002
  it("should render copy button for multiple dynamic prompts of same kind", async () => {
    const prompt1 = createDynamicPrompt("retry", { id: "d1", order: 1 })
    const prompt2 = createDynamicPrompt("retry", { id: "d2", order: 2 })
    await renderPromptsTab([prompt1, prompt2], [])

    // Switch to dynamic tab
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    expect(screen.getByTestId(`copy-dynamic-${prompt1.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`copy-dynamic-${prompt2.id}`)).toBeInTheDocument()
  })
})

// =============================================================================
// CL-COPY-BTN-003 — Copy icon from lucide-react is rendered
// =============================================================================

describe("CL-COPY-BTN-003 — Copy icon from lucide-react is rendered", () => {
  // @clause CL-COPY-BTN-003
  it("should render lucide Copy icon in PromptCard copy button", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    const svg = copyBtn.querySelector("svg")
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass("lucide-copy")
  })

  // @clause CL-COPY-BTN-003
  it("should render lucide Copy icon in DynamicPromptCard copy button", async () => {
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    // Switch to dynamic tab
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    const svg = copyBtn.querySelector("svg")
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass("lucide-copy")
  })

  // @clause CL-COPY-BTN-003
  it("should render Copy icon with correct size classes", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    const svg = copyBtn.querySelector("svg")
    expect(svg).toHaveClass("h-3")
    expect(svg).toHaveClass("w-3")
  })
})

// =============================================================================
// CL-COPY-BTN-004 — Copy button positioned next to character count
// =============================================================================

describe("CL-COPY-BTN-004 — Copy button positioned next to character count", () => {
  // @clause CL-COPY-BTN-004
  it("should position copy button in same line as character count in PromptCard", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const card = screen.getByTestId(`prompt-card-${prompt.id}`)
    const charCountText = within(card).getByText(/caracteres/)
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)

    // Both should be in the same parent container
    expect(charCountText.parentElement).toBe(copyBtn.parentElement)
  })

  // @clause CL-COPY-BTN-004
  it("should position copy button in same line as character count in DynamicPromptCard", async () => {
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    // Switch to dynamic tab
    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const card = screen.getByTestId(`dynamic-prompt-card-${prompt.id}`)
    const charCountText = within(card).getByText(/caracteres/)
    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)

    // Both should be in the same parent container
    expect(charCountText.parentElement).toBe(copyBtn.parentElement)
  })

  // @clause CL-COPY-BTN-004
  it("should render copy button after character count text", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const card = screen.getByTestId(`prompt-card-${prompt.id}`)
    const charCountText = within(card).getByText(/caracteres/)
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)

    // Copy button should follow character count in DOM order
    const position = charCountText.compareDocumentPosition(copyBtn)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// =============================================================================
// CL-COPY-BTN-005 — Click copies prompt content to clipboard
// =============================================================================

describe("CL-COPY-BTN-005 — Click copies prompt content to clipboard", () => {
  // @clause CL-COPY-BTN-005
  it("should copy prompt content when clicking copy button in PromptCard", async () => {
    clipboardWriteTextSpy.mockResolvedValue(undefined)
    const prompt = createPipelinePrompt(1, "system", {
      content: "This is the exact content to copy",
    })
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(clipboardWriteTextSpy).toHaveBeenCalledTimes(1)
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(
        "This is the exact content to copy"
      )
    })
  })

  // @clause CL-COPY-BTN-005
  it("should copy prompt content when clicking copy button in DynamicPromptCard", async () => {
    const prompt = createDynamicPrompt("retry", {
      content: "Dynamic prompt content to copy",
    })
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(clipboardWriteTextSpy).toHaveBeenCalledTimes(1)
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(
        "Dynamic prompt content to copy"
      )
    })
  })

  // @clause CL-COPY-BTN-005
  it("should copy full content including multiline text", async () => {
    const multilineContent = `Line 1 of prompt
Line 2 of prompt
Line 3 with special chars: @#$%`
    const prompt = createPipelinePrompt(1, "system", {
      content: multilineContent,
    })
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(multilineContent)
    })
  })

  // @clause CL-COPY-BTN-005
  it("should copy content for user role prompt with Handlebars template", async () => {
    const templateContent = "Hello {{userName}}, your task is {{taskDescription}}"
    const prompt = createPipelinePrompt(1, "user", {
      content: templateContent,
    })
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("role-toggle-user"))

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(clipboardWriteTextSpy).toHaveBeenCalledWith(templateContent)
    })
  })
})

// =============================================================================
// CL-COPY-BTN-006 — Toast success after successful copy
// =============================================================================

describe("CL-COPY-BTN-006 — Toast success after successful copy", () => {
  // @clause CL-COPY-BTN-006
  it("should show success toast after copying from PromptCard", async () => {
    clipboardWriteTextSpy.mockResolvedValueOnce(undefined)
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    // Wait for async operation
    await vi.waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Prompt copiado!")
    })
  })

  // @clause CL-COPY-BTN-006
  it("should show success toast after copying from DynamicPromptCard", async () => {
    clipboardWriteTextSpy.mockResolvedValueOnce(undefined)
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Prompt copiado!")
    })
  })

  // @clause CL-COPY-BTN-006
  it("should call toast.success exactly once per click", async () => {
    clipboardWriteTextSpy.mockResolvedValue(undefined)
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledTimes(1)
    })
    expect(mockToast.error).not.toHaveBeenCalled()
  })
})

// =============================================================================
// CL-COPY-BTN-007 — Toast error when clipboard fails
// =============================================================================

describe("CL-COPY-BTN-007 — Toast error when clipboard fails", () => {
  // @clause CL-COPY-BTN-007
  it("should show error toast when clipboard rejects in PromptCard", async () => {
    clipboardWriteTextSpy.mockRejectedValueOnce(
      new Error("Clipboard denied")
    )
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar prompt")
    })
  })

  // @clause CL-COPY-BTN-007
  it("should show error toast when clipboard rejects in DynamicPromptCard", async () => {
    clipboardWriteTextSpy.mockRejectedValueOnce(
      new Error("Permission denied")
    )
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Falha ao copiar prompt")
    })
  })

  // @clause CL-COPY-BTN-007
  it("should not call toast.success when clipboard fails", async () => {
    clipboardWriteTextSpy.mockRejectedValueOnce(new Error("Failed"))
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledTimes(1)
    })
    expect(mockToast.success).not.toHaveBeenCalled()
  })
})

// =============================================================================
// CL-COPY-BTN-008 — Copy button does not interfere with card toggle
// =============================================================================

describe("CL-COPY-BTN-008 — Copy button does not interfere with card toggle", () => {
  // @clause CL-COPY-BTN-008
  it("should not expand card when clicking copy button in PromptCard", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    // Card content should not be visible
    expect(
      screen.queryByTestId(`prompt-content-${prompt.id}`)
    ).not.toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-008
  it("should not expand card when clicking copy button in DynamicPromptCard", async () => {
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    await user.click(copyBtn)

    // Card content should not be visible
    expect(
      screen.queryByTestId(`dynamic-content-${prompt.id}`)
    ).not.toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-008
  it("should allow card toggle to work independently of copy button", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    const card = screen.getByTestId(`prompt-card-${prompt.id}`)
    const toggleBtn = within(card).getByRole("button", { name: /Pipeline Step 1 system/i })

    // Click toggle to expand
    await user.click(toggleBtn)

    // Card content should be visible
    expect(screen.getByTestId(`prompt-content-${prompt.id}`)).toBeInTheDocument()

    // Now click copy button
    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    await user.click(copyBtn)

    // Card should still be expanded
    expect(screen.getByTestId(`prompt-content-${prompt.id}`)).toBeInTheDocument()
  })
})

// =============================================================================
// CL-COPY-BTN-009 — Copy button works across all prompt types
// =============================================================================

describe("CL-COPY-BTN-009 — Copy button works across all prompt types", () => {
  // @clause CL-COPY-BTN-009
  it("should work for all pipeline steps (1-4)", async () => {
    const prompts = [
      createPipelinePrompt(1, "system", { id: "p1" }),
      createPipelinePrompt(2, "system", { id: "p2" }),
      createPipelinePrompt(3, "system", { id: "p3" }),
      createPipelinePrompt(4, "system", { id: "p4" }),
    ]
    await renderPromptsTab(prompts, [])

    const user = userEvent.setup()

    for (let step = 1; step <= 4; step++) {
      await user.click(screen.getByTestId(`step-toggle-${step}`))
      const copyBtn = screen.getByTestId(`copy-prompt-p${step}`)
      expect(copyBtn).toBeInTheDocument()
    }
  })

  // @clause CL-COPY-BTN-009
  it("should work for both system and user role prompts", async () => {
    const prompts = [
      createPipelinePrompt(1, "system", { id: "sys1" }),
      createPipelinePrompt(1, "user", { id: "usr1" }),
    ]
    await renderPromptsTab(prompts, [])

    const user = userEvent.setup()

    // Check system
    expect(screen.getByTestId("copy-prompt-sys1")).toBeInTheDocument()

    // Switch to user
    await user.click(screen.getByTestId("role-toggle-user"))
    expect(screen.getByTestId("copy-prompt-usr1")).toBeInTheDocument()
  })

  // @clause CL-COPY-BTN-009
  it("should work for all dynamic instruction kinds", async () => {
    const dynamicKinds = [
      "retry",
      "guidance",
      "git-strategy",
      "retry-cli",
      "system-append-cli",
      "cli-replace",
      "custom-instructions",
    ]
    const prompts = dynamicKinds.map((kind) =>
      createDynamicPrompt(kind, { id: `dyn-${kind}` })
    )
    await renderPromptsTab(prompts, [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    for (const kind of dynamicKinds) {
      await user.click(screen.getByTestId(`kind-toggle-${kind}`))
      const copyBtn = screen.getByTestId(`copy-dynamic-dyn-${kind}`)
      expect(copyBtn).toBeInTheDocument()
    }
  })

  // @clause CL-COPY-BTN-009
  it("should work for custom session prompts", async () => {
    const prompts = [
      createSessionPrompt({ id: "s1" }),
      createSessionPrompt({ id: "s2" }),
    ]
    await renderPromptsTab([], prompts)

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-session"))

    expect(screen.getByTestId("copy-prompt-s1")).toBeInTheDocument()
    expect(screen.getByTestId("copy-prompt-s2")).toBeInTheDocument()
  })
})

// =============================================================================
// CL-COPY-BTN-010 — Copy button styling is consistent
// =============================================================================

describe("CL-COPY-BTN-010 — Copy button styling is consistent", () => {
  // @clause CL-COPY-BTN-010
  it("should have consistent styling in PromptCard", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    expect(copyBtn.className).toContain("text-muted-foreground")
    expect(copyBtn.className).toContain("hover:text-foreground")
  })

  // @clause CL-COPY-BTN-010
  it("should have consistent styling in DynamicPromptCard", async () => {
    const prompt = createDynamicPrompt("retry")
    await renderPromptsTab([prompt], [])

    const user = userEvent.setup()
    await user.click(screen.getByTestId("tab-dynamic"))

    const copyBtn = screen.getByTestId(`copy-dynamic-${prompt.id}`)
    expect(copyBtn.className).toContain("text-muted-foreground")
    expect(copyBtn.className).toContain("hover:text-foreground")
  })

  // @clause CL-COPY-BTN-010
  it("should have compact size classes", async () => {
    const prompt = createPipelinePrompt(1, "system")
    await renderPromptsTab([prompt], [])

    const copyBtn = screen.getByTestId(`copy-prompt-${prompt.id}`)
    expect(copyBtn.className).toContain("p-1")
  })
})
