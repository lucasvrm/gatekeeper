import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { GateResult, RunWithResults, ValidatorContext, ValidatorResult } from "@/lib/types"
import { useRunEvents } from "@/hooks/useRunEvents"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { GitCommitButton } from "@/components/git-commit-button"
import { cn } from "@/lib/utils"
import { buildValidatorClipboardText, getClipboardWriteText, getDiffScopeViolations } from "@/lib/validator-clipboard"
import {
  ArrowClockwise,
  ArrowLeft,
  Copy,
  Play,
  Trash2,
  Upload,
} from "lucide-react"
import { usePageShell } from "@/hooks/use-page-shell"

type StatusFilter = "ALL" | "PASSED" | "FAILED" | "WARNING" | "SKIPPED"

interface UnifiedGate extends GateResult {
  runType: "CONTRACT" | "EXECUTION"
  runId: string
}

interface UnifiedValidator extends ValidatorResult {
  runType: "CONTRACT" | "EXECUTION"
  runId: string
}

const STATUS_FILTERS: StatusFilter[] = ["ALL", "PASSED", "FAILED", "WARNING", "SKIPPED"]

export function getGateActionRunId(
  gateNumber: number,
  contractRun: RunWithResults | null,
  executionRun: RunWithResults | null
): string | null {
  if (gateNumber <= 1) return contractRun?.id ?? null
  return executionRun?.id ?? null
}

export function RunDetailsPageV2() {
  const { id: paramId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const runId = paramId

  const [primaryRun, setPrimaryRun] = useState<RunWithResults | null>(null)
  const [secondaryRun, setSecondaryRun] = useState<RunWithResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadRunId, setUploadRunId] = useState<string | null>(null)
  const [openBypassGate, setOpenBypassGate] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [executionLoading, setExecutionLoading] = useState(false)
  const [selectedValidatorCode, setSelectedValidatorCode] = useState<string | null>(null)
  const contractRun =
    primaryRun?.runType === "CONTRACT" ? primaryRun : secondaryRun?.runType === "CONTRACT" ? secondaryRun : null
  const executionRun =
    primaryRun?.runType === "EXECUTION" ? primaryRun : secondaryRun?.runType === "EXECUTION" ? secondaryRun : null

  const isCommitted = Boolean(
    executionRun?.commitHash || contractRun?.commitHash
  )

  const loadSecondaryRun = useCallback(
    async (nextPrimaryRun: RunWithResults) => {
      let secondaryId: string | undefined
      if (nextPrimaryRun.runType === "EXECUTION") {
        secondaryId = nextPrimaryRun.contractRunId
      } else {
        secondaryId = nextPrimaryRun.executionRuns?.[0]?.id
      }

      if (!secondaryId) {
        setSecondaryRun(null)
        return
      }

      const secondary = await api.runs.getWithResults(secondaryId)
      setSecondaryRun(secondary)
    },
    []
  )

  const loadPrimaryRun = useCallback(async () => {
    if (!runId) return
    setIsLoading(true)
    setError(null)
    setPrimaryRun(null)
    setSecondaryRun(null)

    try {
      const primary = await api.runs.getWithResults(runId)
      setPrimaryRun(primary)
      await loadSecondaryRun(primary)
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error("Falha ao carregar run")
      setError(nextError)
      setPrimaryRun(null)
      setSecondaryRun(null)
      toast.error("Falha ao carregar run")
    } finally {
      setIsLoading(false)
    }
  }, [loadSecondaryRun, runId])

  useEffect(() => {
    void loadPrimaryRun()
  }, [loadPrimaryRun])

  const handlePrimaryEvent = useCallback(async () => {
    if (!runId) return
    try {
      const refreshed = await api.runs.getWithResults(runId)
      setPrimaryRun(refreshed)
      await loadSecondaryRun(refreshed)
    } catch (err) {
      console.error("Failed to refresh primary run:", err)
      toast.error("Falha ao atualizar run")
    }
  }, [loadSecondaryRun, runId])

  const handleSecondaryEvent = useCallback(async () => {
    if (!secondaryRun?.id) return
    try {
      const refreshed = await api.runs.getWithResults(secondaryRun.id)
      setSecondaryRun(refreshed)
    } catch (err) {
      console.error("Failed to refresh secondary run:", err)
      toast.error("Falha ao atualizar run")
    }
  }, [secondaryRun?.id])

  const shouldConnectEvents = !error && !isLoading
  useRunEvents(shouldConnectEvents ? runId : undefined, handlePrimaryEvent)
  useRunEvents(shouldConnectEvents ? secondaryRun?.id : undefined, handleSecondaryEvent)

  const unifiedGates = useMemo<UnifiedGate[]>(() => {
    const gates: UnifiedGate[] = []
    if (contractRun?.gateResults) {
      gates.push(
        ...contractRun.gateResults.map((gate) => ({
          ...gate,
          runType: "CONTRACT" as const,
          runId: contractRun.id,
        }))
      )
    }
    if (executionRun?.gateResults) {
      gates.push(
        ...executionRun.gateResults.map((gate) => ({
          ...gate,
          runType: "EXECUTION" as const,
          runId: executionRun.id,
        }))
      )
    }
    return gates.sort((a, b) => a.gateNumber - b.gateNumber)
  }, [contractRun, executionRun])

  const unifiedValidators = useMemo<UnifiedValidator[]>(() => {
    const validators: UnifiedValidator[] = []
    if (contractRun?.validatorResults) {
      validators.push(
        ...contractRun.validatorResults.map((validator) => ({
          ...validator,
          runType: "CONTRACT" as const,
          runId: contractRun.id,
        }))
      )
    }
    if (executionRun?.validatorResults) {
      validators.push(
        ...executionRun.validatorResults.map((validator) => ({
          ...validator,
          runType: "EXECUTION" as const,
          runId: executionRun.id,
        }))
      )
    }
    return validators
  }, [contractRun, executionRun])

  const validatorsByGate = useMemo(() => {
    const map: Record<number, UnifiedValidator[]> = {}
    unifiedValidators.forEach((validator) => {
      if (!map[validator.gateNumber]) map[validator.gateNumber] = []
      map[validator.gateNumber].push(validator)
    })
    return map
  }, [unifiedValidators])

  const filterCounts = useMemo(() => {
    const counts = {
      ALL: unifiedValidators.length,
      PASSED: unifiedValidators.filter((v) => v.status === "PASSED").length,
      FAILED: unifiedValidators.filter((v) => v.status === "FAILED").length,
      WARNING: unifiedValidators.filter((v) => v.status === "WARNING").length,
      SKIPPED: unifiedValidators.filter((v) => v.status === "SKIPPED").length,
    }
    return counts
  }, [unifiedValidators])

  const hasFailedInGate = useCallback(
    (gateNumber: number) => (validatorsByGate[gateNumber] ?? []).some((validator) => validator.status === "FAILED"),
    [validatorsByGate]
  )

  const getBypassableValidators = useCallback(
    (gateNumber: number) =>
      (validatorsByGate[gateNumber] ?? []).filter(
        (validator) => validator.status === "FAILED" && validator.isHardBlock && !validator.bypassed
      ),
    [validatorsByGate]
  )

  const canStartExecution = useMemo(() => {
    if (!contractRun) return false
    const gate0 = contractRun.gateResults?.find((gate) => gate.gateNumber === 0)
    const gate1 = contractRun.gateResults?.find((gate) => gate.gateNumber === 1)
    return gate0?.status === "PASSED" && gate1?.status === "PASSED" && !executionRun
  }, [contractRun, executionRun])

  const progressPercentage = useMemo(() => {
    if (unifiedValidators.length === 0) return 0
    const passedCount = unifiedValidators.filter((v) => v.status === "PASSED").length
    return Math.round((passedCount / unifiedValidators.length) * 100)
  }, [unifiedValidators])

  const selectedValidator = useMemo(() => {
    if (!selectedValidatorCode) return null
    const v = unifiedValidators.find((v) => v.validatorCode === selectedValidatorCode)
    if (!v) return null
    const gate = unifiedGates.find((g) => g.gateNumber === v.gateNumber)
    let parsedContext: ValidatorContext | null = null
    if (v.details && typeof v.details === "string") {
      try {
        const parsed = JSON.parse(v.details)
        if (parsed && typeof parsed === "object" && "context" in parsed) {
          parsedContext = (parsed as { context?: ValidatorContext }).context ?? null
        }
      } catch { /* context is optional */ }
    }
    return { ...v, gate, parsedContext }
  }, [selectedValidatorCode, unifiedValidators, unifiedGates])

  // Note: Gates start collapsed. User clicks to expand.
  // This was changed from auto-expanding failed gates to match spec expectations.

  const handleGateUpload = (gateNumber: number) => {
    const runIdForAction = getGateActionRunId(gateNumber, contractRun, executionRun)
    if (!runIdForAction) return
    setUploadRunId(runIdForAction)
    setShowUploadDialog(true)
  }

  const handleGateRerun = async (gateNumber: number) => {
    const runIdForAction = getGateActionRunId(gateNumber, contractRun, executionRun)
    if (!runIdForAction) return
    try {
      await api.runs.rerunGate(runIdForAction, gateNumber)
      toast.success("Gate enfileirado para reexecução")
    } catch (error) {
      console.error("Failed to rerun gate:", error)
      toast.error("Falha ao reexecutar gate")
    }
  }

  const handleStartExecution = async () => {
    if (!contractRun) return
    if (!contractRun.projectId) {
      toast.error("O run de contrato não possui projectId. Não é possível iniciar a execução.")
      return
    }
    if (!contractRun.taskPrompt) {
      toast.error("O run de contrato não possui taskPrompt. Não é possível iniciar a execução.")
      return
    }

    setExecutionLoading(true)
    try {
      const manifest = JSON.parse(contractRun.manifestJson)
      const response = await api.runs.create({
        outputId: contractRun.outputId,
        taskPrompt: contractRun.taskPrompt,
        manifest,
        dangerMode: contractRun.dangerMode,
        runType: "EXECUTION",
        contractRunId: contractRun.id,
        projectId: contractRun.projectId,
      })

      toast.success("Run de execução iniciado")
      const executionData = await api.runs.getWithResults(response.runId)
      setSecondaryRun(executionData)
    } catch (error) {
      console.error("Failed to start execution run:", error)
      toast.error("Falha ao iniciar run de execução")
    } finally {
      setExecutionLoading(false)
    }
  }

  const handleDeleteRun = async () => {
    if (!primaryRun) return
    setActionLoading(true)
    try {
      await api.runs.delete(primaryRun.id)
      toast.success("Run excluído com sucesso")
      navigate("/runs")
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Falha ao excluir run")
      setActionLoading(false)
    }
  }

  const handleRerunGate = async (gate: UnifiedGate) => {
    try {
      await api.runs.rerunGate(gate.runId, gate.gateNumber)
      toast.success("Gate enfileirado para reexecução")
    } catch (error) {
      console.error("Failed to rerun gate:", error)
      toast.error("Falha ao reexecutar gate")
    }
  }

  const handleBypassValidator = async (validator: UnifiedValidator) => {
    try {
      await api.runs.bypassValidator(validator.runId, validator.validatorCode)
      setOpenBypassGate(null)
      toast.success("Validator by-passado — run reenfileirado")
      // Refresh data since server resets run to PENDING and re-queues
      await handlePrimaryEvent()
    } catch (error) {
      console.error("Failed to bypass validator:", error)
      toast.error("Falha ao by-passar validator")
    }
  }

  // ── Inject header content into AppShell via portals ──
  // MUST be before any early returns to satisfy Rules of Hooks.
  // Returns portal elements that must be included in the JSX.
  const headerPortals = usePageShell({
    page: "runs",
    headerRight: !isLoading && !error && primaryRun && contractRun && executionRun ? (
      <GitCommitButton
        contractRun={contractRun}
        executionRun={executionRun}
        outputId={primaryRun.outputId || ""}
      />
    ) : undefined,
  })

  if (isLoading) {
    return (
      <div className="page-gap" data-testid="loading-skeleton">
        {headerPortals}
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-gap">
        {headerPortals}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            data-testid="btn-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
        <div className="p-8 text-center border border-border rounded-lg">
          <p className="text-muted-foreground">Run não encontrado</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="kanban-page">
      {headerPortals}

      {/* ── Prompt card ── */}
      <Card className="p-4" data-testid="prompt-card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            PROMPT
          </h3>
          <div className="flex items-center gap-2">
            {primaryRun && (
              <span className="text-xs font-mono text-muted-foreground/60">
                {primaryRun.projectPath
                  ? primaryRun.projectPath.split("/").pop()
                  : "—"}
                {" / "}
                {primaryRun.outputId ?? "—"}
              </span>
            )}
            {primaryRun && (
              <>
                <StatusBadge status={primaryRun.status ?? "PENDING"} />
                {isCommitted && (
                  <Badge
                    variant="outline"
                    data-testid="committed-badge"
                    className="text-xs font-mono bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  >
                    ✓ Commitado {(executionRun?.commitHash || contractRun?.commitHash || "").slice(0, 7)}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowDeleteDialog(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setShowDeleteDialog(true)
                    }
                  }}
                  className="h-7 px-1.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Badge>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-4">
          {primaryRun?.taskPrompt || "—"}
        </p>
      </Card>

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-1.5 py-1" data-testid="filter-bar">
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="ghost"
              data-testid={`filter-btn-${status}`}
              className={cn(
                "h-7 px-3 rounded-full text-xs",
                isActive
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL"
                ? "Todos"
                : status === "PASSED"
                  ? "Aprovados"
                  : status === "FAILED"
                    ? "Reprovados"
                    : status.charAt(0) + status.slice(1).toLowerCase()}{" "}
              ({filterCounts[status]})
            </Button>
          )
        })}

        {/* Start Execution — inline, right-aligned */}
        {!isCommitted && canStartExecution && (
          <>
            <div className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground">Gates 0 e 1 aprovados</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/orchestrator?outputId=${contractRun?.outputId}&step=3`)}
              className="h-7"
            >
              Continuar no Orchestrator →
            </Button>
            <Button
              size="sm"
              onClick={handleStartExecution}
              disabled={executionLoading}
              data-testid="start-execution-banner"
              className="h-7"
            >
              <Play className="w-3 h-3 mr-1.5" />
              {executionLoading ? "Iniciando..." : "Iniciar Execução (Gates 2–3)"}
            </Button>
          </>
        )}
      </div>

      {/* ── Kanban grid ── */}
      <div
        className="pb-4"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${unifiedGates.length || 1}, 1fr)`,
          gap: 12,
          alignItems: "flex-start",
        }}
        data-testid="kanban-grid"
      >
        {unifiedGates.map((gate) => {
          const gateValidators = (validatorsByGate[gate.gateNumber] ?? []).filter(
            (v) => statusFilter === "ALL" || v.status === statusFilter
          )
          const hasFailed = hasFailedInGate(gate.gateNumber)
          const gateStatus = gate.status as string

          return (
            <div
              key={`${gate.runType}-${gate.gateNumber}`}
              className="rounded-xl border border-border bg-card overflow-hidden"
              data-testid={`kanban-col-${gate.gateNumber}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-sm",
                      gateStatus === "PASSED" && "bg-status-passed",
                      gateStatus === "FAILED" && "bg-status-failed",
                      gateStatus === "WARNING" && "bg-status-warning",
                      gateStatus === "RUNNING" && "bg-status-running",
                      (gateStatus === "PENDING" || gateStatus === "SKIPPED") && "bg-muted-foreground/40"
                    )}
                  />
                  <span className="text-sm font-semibold">{gate.gateName}</span>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                    G{gate.gateNumber}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  {gate.passedCount > 0 && (
                    <span className="text-[9px] font-bold text-status-passed">{gate.passedCount}</span>
                  )}
                  {gate.failedCount > 0 && (
                    <span className="text-[9px] font-bold text-status-failed">{gate.failedCount}</span>
                  )}
                  {gate.warningCount > 0 && (
                    <span className="text-[9px] font-bold text-status-warning">{gate.warningCount}</span>
                  )}
                  {gate.skippedCount > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground/60">{gate.skippedCount}</span>
                  )}
                </div>
              </div>

              {/* Validator cards */}
              <div className="p-2 flex flex-col gap-1.5">
                {gateValidators.length > 0 ? (
                  gateValidators.map((v) => (
                    <div
                      key={v.validatorCode}
                      onClick={() =>
                        setSelectedValidatorCode(
                          selectedValidatorCode === v.validatorCode ? null : v.validatorCode
                        )
                      }
                      className={cn(
                        "p-2 rounded-lg bg-background cursor-pointer transition-all",
                        "border-t border-r border-b",
                        selectedValidatorCode === v.validatorCode
                          ? "border-t-current border-r-current border-b-current"
                          : "border-border"
                      )}
                      style={{
                        borderLeftWidth: 3,
                        borderLeftStyle: "solid",
                        borderLeftColor:
                          v.status === "PASSED"
                            ? "var(--success, hsl(142, 76%, 36%))"
                            : v.status === "FAILED"
                              ? "var(--danger, hsl(0, 84%, 60%))"
                              : v.status === "WARNING"
                                ? "var(--warning, hsl(38, 92%, 50%))"
                                : "var(--muted-foreground)",
                      }}
                      data-testid={`validator-card-${v.validatorCode}`}
                    >
                      {/* Row 1: name + copy */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{v.validatorName}</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            let parsedCtx: ValidatorContext | null = null
                            if (v.details && typeof v.details === "string") {
                              try {
                                const parsed = JSON.parse(v.details)
                                if (parsed?.context) parsedCtx = parsed.context
                              } catch { /* optional */ }
                            }
                            const violations = getDiffScopeViolations(v)
                            const text = buildValidatorClipboardText(v, parsedCtx, violations)
                            const writeText = getClipboardWriteText()
                            if (!writeText) { toast.error("Falha ao copiar"); return }
                            try {
                              await writeText(text)
                              toast.success("Copiado!")
                            } catch { toast.error("Falha ao copiar") }
                          }}
                          className="text-muted-foreground/50 hover:text-muted-foreground p-0.5 transition-opacity"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Row 2: code + hard/soft */}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[11px] font-mono text-muted-foreground/60">
                          {v.validatorCode}
                        </span>
                        <span
                          className={cn(
                            "text-[8px] font-bold uppercase tracking-wider",
                            v.isHardBlock ? "text-destructive/70" : "text-muted-foreground/50"
                          )}
                        >
                          {v.isHardBlock ? "HARD" : "SOFT"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">—</p>
                )}

                {/* Gate actions */}
                <div className="flex gap-1 mt-1 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCommitted || !hasFailed}
                    onClick={() => handleGateUpload(gate.gateNumber)}
                    className="flex-1 h-6 text-[10px] justify-center"
                    data-testid={`kanban-upload-g${gate.gateNumber}`}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCommitted || !hasFailed}
                    onClick={() => handleGateRerun(gate.gateNumber)}
                    className="flex-1 h-6 text-[10px] justify-center"
                    data-testid={`kanban-rerun-g${gate.gateNumber}`}
                  >
                    <ArrowClockwise className="w-3 h-3 mr-1" />
                    Rerun
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isCommitted || !hasFailed}
                    onClick={() => setOpenBypassGate((prev) => (prev === gate.gateNumber ? null : gate.gateNumber))}
                    className="flex-1 h-6 text-[10px] justify-center"
                    data-testid={`kanban-bypass-g${gate.gateNumber}`}
                  >
                    Bypass
                  </Button>
                </div>

                {/* Bypass dropdown */}
                {!isCommitted && openBypassGate === gate.gateNumber && getBypassableValidators(gate.gateNumber).length > 0 && (
                  <div className="mt-1 space-y-1">
                    {getBypassableValidators(gate.gateNumber).map((validator) => (
                      <Button
                        key={validator.validatorCode}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-6"
                        onClick={() => handleBypassValidator(validator)}
                      >
                        {validator.validatorCode}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Start execution CTA (only in gate 2 column when no execution run) */}
                {!isCommitted && gate.gateNumber === 2 && canStartExecution && (
                  <div className="flex flex-col gap-1 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/orchestrator?outputId=${contractRun?.outputId}&step=3`)}
                      className="w-full justify-center h-7"
                    >
                      Continuar no Orchestrator →
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleStartExecution}
                      disabled={executionLoading}
                      className="w-full justify-center h-7"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {executionLoading ? "..." : "Iniciar Execução"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Detail Modal ── */}
      {selectedValidator && (
        <>
          <div
            className="fixed inset-0 bg-background/55 backdrop-blur-sm z-50"
            onClick={() => setSelectedValidatorCode(null)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[51] w-[580px] max-h-[80vh] overflow-y-auto bg-card rounded-xl border border-border shadow-2xl p-6"
            data-testid="validator-detail-modal"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{selectedValidator.validatorName}</h3>
                <p className="text-xs font-mono text-muted-foreground/60 mt-1">
                  {selectedValidator.validatorCode}
                </p>
              </div>
              <button
                onClick={() => setSelectedValidatorCode(null)}
                className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status={selectedValidator.status} />
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  selectedValidator.isHardBlock
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {selectedValidator.isHardBlock ? "HARD BLOCK" : "SOFT"}
              </span>
              {selectedValidator.gate && (
                <span className="text-xs text-muted-foreground/60">
                  Gate {selectedValidator.gate.gateNumber} · {selectedValidator.gate.gateName}
                </span>
              )}
            </div>

            {/* Message */}
            <div className="mt-4 px-4 py-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm">{selectedValidator.message || "—"}</p>
            </div>

            {/* Context sections */}
            {selectedValidator.parsedContext && (
              <div className="mt-4 space-y-4">
                {/* Inputs */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    INPUTS
                  </h4>
                  {selectedValidator.parsedContext.inputs.map((inp, i) => (
                    <p key={i} className="text-sm text-muted-foreground mb-0.5">
                      <span className="font-medium text-foreground">{inp.label}:</span>{" "}
                      {typeof inp.value === "object" ? JSON.stringify(inp.value) : String(inp.value)}
                    </p>
                  ))}
                </div>

                {/* Analyzed */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    ANALYZED
                  </h4>
                  {selectedValidator.parsedContext.analyzed.map((grp, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm font-medium">{grp.label}:</p>
                      {grp.items.map((item, j) => (
                        <p key={j} className="text-xs font-mono text-muted-foreground ml-4">
                          • {item}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Findings */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    FINDINGS ({selectedValidator.parsedContext.findings.length})
                  </h4>
                  <div className="space-y-1">
                    {selectedValidator.parsedContext.findings.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50"
                        style={{
                          borderLeftWidth: 2,
                          borderLeftStyle: "solid",
                          borderLeftColor:
                            f.type === "fail"
                              ? "var(--danger, hsl(0, 84%, 60%))"
                              : f.type === "pass"
                                ? "var(--success, hsl(142, 76%, 36%))"
                                : "var(--warning, hsl(38, 92%, 50%))",
                        }}
                      >
                        <div className="flex-1">
                          <span className="text-sm">{f.message}</span>
                          {f.location && (
                            <span className="text-xs font-mono text-muted-foreground/60 ml-2">
                              {f.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reasoning */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    REASONING
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedValidator.parsedContext.reasoning}
                  </p>
                </div>
              </div>
            )}

            {/* Modal actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-border">
              {!isCommitted && selectedValidator.status === "FAILED" && selectedValidator.isHardBlock && (
                <>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      handleGateUpload(selectedValidator.gateNumber)
                      setSelectedValidatorCode(null)
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Fix
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      handleBypassValidator(selectedValidator)
                      setSelectedValidatorCode(null)
                    }}
                  >
                    Bypass
                  </Button>
                </>
              )}
              {!isCommitted && selectedValidator.status === "FAILED" && !selectedValidator.isHardBlock && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    handleGateUpload(selectedValidator.gateNumber)
                    setSelectedValidatorCode(null)
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Fix
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className={selectedValidator.status !== "FAILED" ? "flex-1" : ""}
                onClick={async () => {
                  const violations = getDiffScopeViolations(selectedValidator)
                  const text = buildValidatorClipboardText(
                    selectedValidator,
                    selectedValidator.parsedContext,
                    violations
                  )
                  const writeText = getClipboardWriteText()
                  if (!writeText) { toast.error("Falha ao copiar"); return }
                  try {
                    await writeText(text)
                    toast.success("Copiado!")
                  } catch { toast.error("Falha ao copiar") }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Upload dialog ── */}
      {uploadRunId && (
        <FileUploadDialog
          open={showUploadDialog}
          onClose={() => {
            setShowUploadDialog(false)
            setUploadRunId(null)
          }}
          runId={uploadRunId}
        />
      )}

      {/* ── Delete dialog ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Run de Validação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir permanentemente este run de validação e todos os seus resultados. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleDeleteRun}
                disabled={actionLoading}
              >
                {actionLoading ? "Excluindo..." : "Excluir Run"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
