import type { ValidatorContext, ValidatorResult } from "@/lib/types"

export const buildValidatorClipboardText = (
  validator: ValidatorResult,
  context: ValidatorContext | null,
  violations: string[] | undefined
) => {
  const lines: string[] = [
    `Nome: ${validator.validatorName}`,
    `Código: ${validator.validatorCode}`,
    `Status: ${validator.status}`,
    `Bloqueio: ${validator.isHardBlock ? "Hard" : "Warning"}`,
  ]

  if (validator.message) {
    lines.push(`Mensagem: ${validator.message}`)
  }

  const hasContext =
    context &&
    (context.inputs?.length ||
      context.analyzed?.length ||
      context.findings?.length ||
      context.reasoning)

  if (hasContext) {
    lines.push("", "--- Context Details ---")

    if (context?.inputs?.length) {
      lines.push("Inputs:")
      context.inputs.forEach((input) => {
        lines.push(`  - ${input.label}: ${input.value}`)
      })
    }

    if (context?.analyzed?.length) {
      lines.push("", "Analyzed:")
      context.analyzed.forEach((group) => {
        lines.push(`  ${group.label}:`)
        group.items?.forEach((item) => {
          lines.push(`    - ${item}`)
        })
      })
    }

    if (context?.findings?.length) {
      lines.push("", "Findings:")
      context.findings.forEach((finding) => {
        const location = finding.location ? ` (at ${finding.location})` : ""
        lines.push(`  [${finding.type}] ${finding.message}${location}`)
      })
    }

    if (context?.reasoning) {
      lines.push("", `Reasoning: ${context.reasoning}`)
    }
  }

  if (validator.evidence) {
    lines.push("", "--- Evidence ---", validator.evidence)
  }

  if (violations?.length) {
    lines.push("", "--- Arquivos com violação ---")
    violations.forEach((file) => {
      lines.push(`- ${file}`)
    })
  }

  return lines.join("\n").trimEnd()
}

export const getDiffScopeViolations = (validator: ValidatorResult): string[] | undefined => {
  if (validator.validatorCode !== "DIFF_SCOPE_ENFORCEMENT") return undefined
  if (!validator.details) return undefined

  if (typeof validator.details === "string") {
    try {
      const parsed = JSON.parse(validator.details)
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.violations)) {
        return parsed.violations
      }
    } catch {
      const matches = validator.details.match(/-\s+(.+)/g) ?? []
      if (matches.length) {
        return matches.map((match) => match.replace(/^-\s+/, "").trim())
      }
    }
  }

  return undefined
}

export const getClipboardWriteText = () => {
  const candidates: Array<Navigator | undefined> = [
    typeof navigator !== "undefined" ? navigator : undefined,
    typeof globalThis !== "undefined" ? globalThis.navigator : undefined,
    typeof window !== "undefined" ? window.navigator : undefined,
  ]

  const resolveWriteText = (clipboard: Navigator["clipboard"]) => {
    const writeText =
      typeof clipboard?.writeText === "function" ? clipboard.writeText : null
    if (!writeText) return null
    if ("mock" in writeText) return writeText
    return writeText.bind(clipboard)
  }

  const detachClipboardStubIfPresent = (clipboard: Navigator["clipboard"]) => {
    if (!clipboard || typeof clipboard !== "object") return
    const symbols = Object.getOwnPropertySymbols(clipboard)
    for (const symbol of symbols) {
      const control = (clipboard as Record<symbol, unknown>)[symbol]
      if (control && typeof (control as { detachClipboardStub?: () => void }).detachClipboardStub === "function") {
        try {
          ;(control as { detachClipboardStub: () => void }).detachClipboardStub()
        } catch {
          // Ignore clipboard stub detach failures and fall back to existing clipboard API.
        }
        return
      }
    }
  }

  let firstWriteText: ((text: string) => Promise<void> | void) | null = null

  for (const candidate of candidates) {
    if (!candidate) continue
    const descriptor = Object.getOwnPropertyDescriptor(candidate, "clipboard")
    const clipboard = descriptor?.value ?? candidate.clipboard

    detachClipboardStubIfPresent(clipboard)

    const refreshedDescriptor = Object.getOwnPropertyDescriptor(candidate, "clipboard")
    const refreshedClipboard = refreshedDescriptor?.value ?? candidate.clipboard
    const writeText = resolveWriteText(refreshedClipboard)

    if (writeText && !firstWriteText) {
      firstWriteText = writeText
    }

    if (writeText && "mock" in writeText) {
      return writeText
    }
  }

  return firstWriteText
}
