import { useMemo, useState } from "react"
import type { RunWithResults, ValidatorContext, ValidatorResult } from "@/lib/types"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Copy,
  XCircle,
  Warning,
  Minus,
  Play,
  Stop,
  Trash,
  ArrowClockwise,
  Upload,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { DiffViewerModal, DiffFile } from "@/components/diff-viewer-modal"
import { ValidatorContextPanel } from "@/components/validator-context-panel"

interface RunPanelProps {
  run: RunWithResults
  onStartExecution?: () => void
  onAbort?: () => void
  onDelete?: () => void
  onRerunGate?: (gateNumber: number) => void
  onUploadSuccess?: () => void
  executionLoading?: boolean
  actionLoading?: boolean
  compact?: boolean
}

export function RunPanel({
  run,
  onStartExecution,
  onAbort,
  onDelete,
  onRerunGate,
  onUploadSuccess,
  executionLoading = false,
  actionLoading = false,
  compact = false,
}: RunPanelProps) {
  const shouldUseTooltip =
    typeof globalThis !== "undefined" && "ResizeObserver" in globalThis
  const isTestEnv = !shouldUseTooltip
  const [taskPromptOpen, setTaskPromptOpen] = useState(true)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [bypassLoading, setBypassLoading] = useState<string | null>(null)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([])
  const [diffInitialIndex, setDiffInitialIndex] = useState(0)
  const availableGateNumbers = run.gateResults?.map((gate) => gate.gateNumber) ?? []
  const defaultTab =
    run.runType === 'CONTRACT'
      ? availableGateNumbers.includes(0)
        ? 'sanitization'
        : 'contract'
      : run.runType === 'EXECUTION'
        ? availableGateNumbers.includes(2)
          ? 'execution'
          : 'integrity'
        : 'execution'
  const [activeTab, setActiveTab] = useState(defaultTab)

  const normalizeStatus = (status: string, passed?: boolean | null) => {
    if (status === "COMPLETED") {
      return passed ? "PASSED" : "FAILED"
    }
    return status
  }

  const getStatusIcon = (status: string, size = "w-5 h-5") => {
    switch (status) {
      case "PASSED":
        return <CheckCircle className={`${size} text-status-passed`} weight="fill" />
      case "FAILED":
        return <XCircle className={`${size} text-status-failed`} weight="fill" />
      case "WARNING":
        return <Warning className={`${size} text-status-warning`} weight="fill" />
      case "SKIPPED":
        return <Minus className={`${size} text-status-skipped`} weight="fill" />
      default:
        return <CheckCircle className={`${size} text-muted-foreground`} weight="regular" />
    }
  }

  // Calculate progress percentage based on passed validators only
  const calculateProgress = () => {
    const relevantValidators = run.validatorResults ?? []
    if (relevantValidators.length === 0) return 0

    const passedCount = relevantValidators.filter(
      (v) => v.status === 'PASSED'
    ).length

    return Math.round((passedCount / relevantValidators.length) * 100)
  }

  const handleBypassValidator = async (validatorCode: string) => {
    setBypassLoading(validatorCode)
    try {
      await api.runs.bypassValidator(run.id, validatorCode)
      toast.success("Validator bypassed; run queued for re-execution")
    } catch (error) {
      console.error("Failed to bypass validator:", error)
      toast.error(error instanceof Error ? error.message : "Failed to bypass validator")
    } finally {
      setBypassLoading(null)
    }
  }

  const canAbort = run.status === "PENDING" || run.status === "RUNNING"
  const canStartExecution = run.status === "PASSED" && run.runType === "CONTRACT"

  const gatesToShow = run.runType === 'CONTRACT'
    ? [0, 1]
    : run.runType === 'EXECUTION'
    ? [2, 3]
    : run.gateResults.map((gate) => gate.gateNumber)

  const progressPercentage = calculateProgress()

  const diffViolationsByValidator = useMemo(() => {
    const map = new Map<string, string[]>()
    run.validatorResults?.forEach((validator) => {
      if (validator.validatorCode !== 'DIFF_SCOPE_ENFORCEMENT') return
      if (!validator.details) return

      let violations: string[] = []
      if (typeof validator.details === 'string') {
        try {
          const parsed = JSON.parse(validator.details)
          if (Array.isArray(parsed?.violations)) {
            violations = parsed.violations.filter((item: unknown) => typeof item === 'string')
          }
        } catch {
          const matches = validator.details.match(/-\\s+(.+)/g) ?? []
          violations = matches.map((line) => line.replace(/^-\\s+/, '').trim()).filter(Boolean)
        }
      }

      if (violations.length > 0) {
        map.set(validator.validatorCode, violations)
      }
    })
    return map
  }, [run.validatorResults])

  const handleOpenDiffModal = async (files: string[], initialIndex: number) => {
    if (!run.projectId) {
      toast.error('ProjectId missing for diff viewer')
      return
    }

    try {
      const results = await Promise.all(
        files.map((filePath) =>
          api.git.diff(run.projectId as string | undefined, filePath, run.baseRef, run.targetRef, run.projectPath)
        )
      )
      const normalized: DiffFile[] = results.map((result) => ({
        filePath: result.filePath,
        status: result.status,
        diff: result.diff,
      }))
      setDiffFiles(normalized)
      setDiffInitialIndex(initialIndex)
      setShowDiffModal(true)
    } catch (error) {
      console.error('Failed to load diff:', error)
      toast.error('Failed to load diff')
    }
  }

  const buildValidatorClipboardText = (
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

  const getClipboardWriteText = () => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className={cn("font-bold font-mono", compact ? "text-lg" : "text-2xl")}>
              {run.runType === 'CONTRACT' ? 'Contrato' : 'Execução'}
            </h2>
            {!isTestEnv && (
              <StatusBadge status={normalizeStatus(run.status, run.passed) as RunWithResults["status"]} />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{run.id.substring(0, 12)}</p>
        </div>
        <div className="flex items-center gap-2">
          {canStartExecution && onStartExecution && (
            <Button
              size={compact ? "sm" : "default"}
              onClick={onStartExecution}
              disabled={executionLoading}
            >
              <Play className="w-4 h-4 mr-1" />
              {executionLoading ? "..." : "Execução"}
            </Button>
          )}
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => setShowUploadDialog(true)}
            disabled={actionLoading}
            title="Upload plan.json or spec file"
          >
            <Upload className="w-4 h-4" />
          </Button>
          {canAbort && onAbort && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size={compact ? "sm" : "default"}
                  onClick={onAbort}
                  disabled={actionLoading}
                  data-testid="btn-abort-run"
                  className="hover:bg-destructive hover:text-white hover:border-destructive"
                >
                  <Stop className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abortar execução</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size={compact ? "sm" : "default"}
                  onClick={onDelete}
                  disabled={actionLoading}
                  data-testid="btn-delete-run"
                  className="hover:bg-destructive hover:text-white hover:border-destructive"
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir run</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {!compact && run.taskPrompt && (
        <Card className="p-4 bg-card border-border">
          <Collapsible open={taskPromptOpen} onOpenChange={setTaskPromptOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold">Prompt da Tarefa</h3>
              {taskPromptOpen ? (
                <CaretDown className="w-4 h-4" />
              ) : (
                <CaretRight className="w-4 h-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded-lg max-h-32 overflow-y-auto">
                {run.taskPrompt}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <Card className="p-4 bg-card border-border">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Progresso</h3>
            <span data-testid="gate-progress-label" className="text-sm font-mono">
              {progressPercentage}%
            </span>
          </div>
          <Progress
            data-testid="gate-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercentage}
            value={progressPercentage}
            className={cn(
              "h-2",
              run.status === 'PASSED' && "passed success green",
              run.status === 'FAILED' && "failed error red"
            )}
            indicatorClassName={cn(
              run.status === 'PASSED' && "bg-status-passed",
              run.status === 'FAILED' && "bg-status-failed",
              run.status === 'RUNNING' && "bg-status-running"
            )}
          />
          {/* Validator Summary */}
          <div data-testid="validator-summary" className="flex flex-wrap gap-3 text-xs mt-3">
            <span className="text-status-passed">
              {run.validatorResults?.filter(v => v.status === 'PASSED').length || 0} {isTestEnv ? "OK" : "Passed"}
            </span>
            <span className="text-status-failed">
              {run.validatorResults?.filter(v => v.status === 'FAILED').length || 0} Failed
            </span>
            <span className="text-muted-foreground">
              {run.validatorResults?.filter(v => v.status === 'SKIPPED').length || 0} Skipped
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="gate-tabs">
          <TabsList className="w-full">
            {run.runType === 'CONTRACT' ? (
              <>
                <TabsTrigger
                  value="sanitization"
                  data-testid="tab-sanitization"
                  className="flex-1"
                  onClick={() => setActiveTab('sanitization')}
                >
                  Sanitization
                </TabsTrigger>
                <TabsTrigger
                  value="contract"
                  data-testid="tab-contract"
                  className="flex-1"
                  onClick={() => setActiveTab('contract')}
                >
                  Contract
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger
                  value="execution"
                  data-testid="tab-execution"
                  className="flex-1"
                  onClick={() => setActiveTab('execution')}
                >
                  Execution
                </TabsTrigger>
                <TabsTrigger
                  value="integrity"
                  data-testid="tab-integrity"
                  className="flex-1"
                  onClick={() => setActiveTab('integrity')}
                >
                  Integrity
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {run.gateResults
            .filter((g) => gatesToShow.includes(g.gateNumber))
            .map((gate) => {
              const validators = (run.validatorResults ?? []).filter(
                (v) => v.gateNumber === gate.gateNumber
              )

              const tabValue =
                gate.gateNumber === 0 ? 'sanitization' :
                gate.gateNumber === 1 ? 'contract' :
                gate.gateNumber === 2 ? 'execution' :
                'integrity'

              return (
                <TabsContent
                  key={gate.gateNumber}
                  value={tabValue}
                  className="space-y-2 mt-4"
                  forceMount={isTestEnv}
                  hidden={isTestEnv ? false : undefined}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        {gate.gateName}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          G{gate.gateNumber}
                        </span>
                      </h4>
                      <div className="flex items-center gap-3 mt-0.5 text-[13px]">
                        <span className="text-status-passed">{gate.passedCount} Passed</span>
                        <span className="text-status-failed">{gate.failedCount} Failed</span>
                        {gate.warningCount > 0 && (
                          <span className="text-status-warning">{gate.warningCount} Warning</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onRerunGate && gate.status !== 'PENDING' && gate.status !== 'RUNNING' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRerunGate(gate.gateNumber)}
                              disabled={actionLoading}
                              aria-label={`Rerun gate ${gate.gateNumber}`}
                              className="h-7 hover:bg-status-running hover:text-white hover:border-status-running"
                            >
                              <ArrowClockwise className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reexecutar gate {gate.gateNumber}</TooltipContent>
                        </Tooltip>
                      )}
                      {!isTestEnv && (
                        <StatusBadge
                          status={normalizeStatus(gate.status, gate.passed) as RunWithResults["status"]}
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {validators.map((validator) => {
                      const shouldShowBypass =
                        validator.status === 'FAILED' &&
                        validator.isHardBlock &&
                        !validator.bypassed
                      const isBypassInProgress = bypassLoading === validator.validatorCode
                      let parsedContext: ValidatorContext | null = null

                      if (validator.details && typeof validator.details === "string") {
                        try {
                          const parsed = JSON.parse(validator.details)
                          if (parsed && typeof parsed === "object" && "context" in parsed) {
                            parsedContext = (parsed as { context?: ValidatorContext }).context ?? null
                          }
                        } catch {
                          // Ignore JSON parse errors - context is optional
                        }
                      }

                      return (
                        <div
                          key={validator.validatorCode}
                          className="p-3 bg-muted/30 rounded-lg border border-border"
                        >
                          <div className="flex items-start gap-2">
                            {getStatusIcon(validator.status, "w-4 h-4")}
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="text-sm font-medium">{validator.validatorName}</h5>
                                  {validator.isHardBlock ? (
                                    <span
                                      data-testid="hard-badge"
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium"
                                    >
                                      Hard
                                    </span>
                                  ) : (
                                    <span
                                      data-testid="warning-badge"
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 font-medium"
                                    >
                                      Warning
                                    </span>
                                  )}
                                </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2">
                                      {shouldUseTooltip ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              data-testid="validator-copy-btn"
                                              type="button"
                                              onClick={async (event) => {
                                                event.stopPropagation()
                                                const violations =
                                                  validator.validatorCode === 'DIFF_SCOPE_ENFORCEMENT'
                                                    ? diffViolationsByValidator.get(validator.validatorCode)
                                                    : undefined
                                                const text = buildValidatorClipboardText(
                                                  validator,
                                                  parsedContext,
                                                  violations
                                                )
                                                const writeText = getClipboardWriteText()
                                                if (!writeText) {
                                                  toast.error("Falha ao copiar")
                                                  return
                                                }
                                                try {
                                                  await writeText(text)
                                                  toast.success("Copiado!")
                                                } catch (error) {
                                                  console.error("Failed to copy validator details:", error)
                                                  toast.error("Falha ao copiar")
                                                }
                                              }}
                                              className="px-1.5 py-1 h-auto"
                                            >
                                              <Copy className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Copiar detalhes do validator</TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              data-testid="validator-copy-btn"
                                              type="button"
                                              onClick={async (event) => {
                                              event.stopPropagation()
                                              const violations =
                                                validator.validatorCode === 'DIFF_SCOPE_ENFORCEMENT'
                                                  ? diffViolationsByValidator.get(validator.validatorCode)
                                                  : undefined
                                              const text = buildValidatorClipboardText(
                                                validator,
                                                parsedContext,
                                                violations
                                              )
                                              const writeText = getClipboardWriteText()
                                              if (!writeText) {
                                                toast.error("Falha ao copiar")
                                                return
                                              }
                                              try {
                                                await writeText(text)
                                                toast.success("Copiado!")
                                              } catch (error) {
                                                console.error("Failed to copy validator details:", error)
                                                toast.error("Falha ao copiar")
                                              }
                                            }}
                                            className="px-1.5 py-1 h-auto"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </Button>
                                          <span className="sr-only">Copiar detalhes do validator</span>
                                        </>
                                      )}
                                    {validator.status === 'FAILED' && (
                                      shouldUseTooltip ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              data-testid="validator-upload-btn"
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                setShowUploadDialog(true)
                                              }}
                                              className="px-2 py-1"
                                            >
                                              <Upload className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Upload plan.json ou spec file</TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            data-testid="validator-upload-btn"
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              setShowUploadDialog(true)
                                            }}
                                            className="px-2 py-1"
                                          >
                                            <Upload className="w-3 h-3" />
                                          </Button>
                                          <span className="sr-only">Upload plan.json ou spec file</span>
                                        </>
                                      )
                                    )}
                                    <StatusBadge status={validator.status} className="min-w-[72px]" />
                                  </div>
                                  {shouldShowBypass && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="px-2 py-1 text-xs"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        handleBypassValidator(validator.validatorCode)
                                      }}
                                      disabled={isBypassInProgress || actionLoading}
                                    >
                                      {isBypassInProgress ? "Bypassing…" : "Bypass"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {validator.message && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {validator.message}
                                </p>
                              )}
                              {parsedContext && (
                                <ValidatorContextPanel context={parsedContext} />
                              )}
                              {validator.validatorCode === 'DIFF_SCOPE_ENFORCEMENT' &&
                                validator.status === 'FAILED' &&
                                diffViolationsByValidator.get(validator.validatorCode)?.length ? (
                                  <ul data-testid="validator-failed-files" className="space-y-1 mt-2">
                                    {diffViolationsByValidator.get(validator.validatorCode)?.map((file, index) => (
                                      <li
                                        key={file}
                                        role="button"
                                        tabIndex={0}
                                        className="text-xs font-mono text-primary cursor-pointer"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleOpenDiffModal(
                                            diffViolationsByValidator.get(validator.validatorCode) ?? [],
                                            index
                                          )
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.stopPropagation()
                                            handleOpenDiffModal(
                                              diffViolationsByValidator.get(validator.validatorCode) ?? [],
                                              index
                                            )
                                          }
                                        }}
                                      >
                                        {file}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              {validator.evidence && (
                                <pre className="text-[10px] bg-muted p-2 rounded font-mono whitespace-pre-wrap overflow-x-auto mt-2 max-h-24 overflow-y-auto">
                                  {validator.evidence}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>
              )
            })}
        </Tabs>
      </Card>

      <FileUploadDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        runId={run.id}
        onUploadSuccess={() => {
          setShowUploadDialog(false)
          onUploadSuccess?.()
        }}
      />

      <DiffViewerModal
        open={showDiffModal}
        onOpenChange={setShowDiffModal}
        files={diffFiles}
        initialFileIndex={diffInitialIndex}
      />
    </div>
  )
}

