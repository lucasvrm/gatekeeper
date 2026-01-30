import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { GateResult, RunWithResults, ValidatorResult, ValidatorStatus } from "@/lib/types"
import { useRunEvents } from "@/hooks/useRunEvents"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { GitCommitButton } from "@/components/git-commit-button"
import { cn } from "@/lib/utils"
import {
  ArrowClockwise,
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Minus,
  Warning,
  XCircle,
} from "@phosphor-icons/react"

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

const getStatusIcon = (status: ValidatorStatus) => {
  switch (status) {
    case "PASSED":
      return <CheckCircle className="w-4 h-4 text-status-passed" weight="fill" />
    case "FAILED":
      return <XCircle className="w-4 h-4 text-status-failed" weight="fill" />
    case "WARNING":
      return <Warning className="w-4 h-4 text-status-warning" weight="fill" />
    case "SKIPPED":
      return <Minus className="w-4 h-4 text-status-skipped" weight="fill" />
    default:
      return <CheckCircle className="w-4 h-4 text-muted-foreground" weight="regular" />
  }
}

const getGateTypeLabel = (gateNumber: number) => (gateNumber <= 1 ? "Contrato" : "Execução")

const getNodeClass = (status: ValidatorStatus) => {
  if (status === "FAILED") return "border-status-failed bg-status-failed/20"
  if (status === "WARNING") return "border-status-warning bg-status-warning/20"
  if (status === "SKIPPED") return "border-status-skipped bg-status-skipped/20"
  if (status === "RUNNING") return "border-status-running bg-status-running/20"
  if (status === "PENDING") return "border-status-pending bg-status-pending/20"
  return "border-status-passed bg-status-passed/20"
}

export function RunDetailsPageV2() {
  const { id: outputId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const contractState = useRunEvents(outputId, "CONTRACT") as {
    data: RunWithResults | null
    isLoading: boolean
    error: Error | null
  }
  const executionState = useRunEvents(outputId, "EXECUTION") as {
    data: RunWithResults | null
    isLoading: boolean
    error: Error | null
  }

  const contractRun = contractState?.data ?? null
  const executionRun = executionState?.data ?? null
  const isLoading = Boolean(contractState?.isLoading || executionState?.isLoading)
  const error = contractState?.error || executionState?.error

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [expandedGates, setExpandedGates] = useState<Record<number, boolean>>({})
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadRunId, setUploadRunId] = useState<string | null>(null)

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

  const progressPercentage = useMemo(() => {
    if (unifiedValidators.length === 0) return 0
    const passedCount = unifiedValidators.filter((v) => v.status === "PASSED").length
    return Math.round((passedCount / unifiedValidators.length) * 100)
  }, [unifiedValidators])

  useEffect(() => {
    if (unifiedGates.length === 0) return

    const hasFailedGate = unifiedGates.some((gate) => gate.status === "FAILED")
    const allRunsPassed =
      (contractRun?.status ? contractRun.status === "PASSED" : true) &&
      (executionRun?.status ? executionRun.status === "PASSED" : true)

    let defaultGate: UnifiedGate | null = null
    if (hasFailedGate) {
      defaultGate = unifiedGates.find((gate) => gate.status === "FAILED") ?? null
    } else if (allRunsPassed) {
      defaultGate = unifiedGates[0]
    }

    const nextExpanded: Record<number, boolean> = {}
    unifiedGates.forEach((gate) => {
      nextExpanded[gate.gateNumber] = defaultGate?.gateNumber === gate.gateNumber
    })
    setExpandedGates(nextExpanded)
  }, [unifiedGates, contractRun?.status, executionRun?.status])

  const handleToggleGate = (gateNumber: number) => {
    setExpandedGates((prev) => ({
      ...prev,
      [gateNumber]: !prev[gateNumber],
    }))
  }

  const handleRerunGate = async (gate: UnifiedGate) => {
    try {
      await api.runs.rerunGate(gate.runId, gate.gateNumber)
      toast.success("Gate queued for re-execution")
    } catch (error) {
      console.error("Failed to rerun gate:", error)
      toast.error("Failed to rerun gate")
    }
  }

  const handleBypassValidator = async (validator: UnifiedValidator) => {
    try {
      await api.runs.bypassValidator(validator.runId, validator.validatorCode)
      toast.success("Validator bypassed")
    } catch (error) {
      console.error("Failed to bypass validator:", error)
      toast.error("Failed to bypass validator")
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6" data-testid="loading-skeleton">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 space-y-6">
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
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Run not found</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6" data-testid="timeline-page">
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
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">{contractRun?.repoSlug || executionRun?.repoSlug}</span>
            <span className="mx-2">/</span>
            <span className="text-primary">{outputId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contractRun && executionRun && (
            <GitCommitButton
              contractRun={contractRun}
              executionRun={executionRun}
              outputId={outputId || ""}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/runs/new")}
            data-testid="btn-new-run"
            className="bg-white border-gray-300 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600"
          >
            New Run
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" data-testid="overview-cards">
        <Card className="p-4 space-y-2" data-testid="overview-progress">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Progresso</h3>
            <span className="text-sm font-mono">{progressPercentage}%</span>
          </div>
          <Progress
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercentage}
            value={progressPercentage}
            className="h-2"
            indicatorClassName={cn(
              progressPercentage === 100 && "bg-status-passed",
              progressPercentage < 100 && progressPercentage > 0 && "bg-status-warning",
              progressPercentage === 0 && "bg-status-pending"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {filterCounts.PASSED} / {filterCounts.ALL} passed
          </p>
        </Card>

        <Card className="p-4 space-y-2" data-testid="overview-contract">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Contrato</h3>
            {contractRun && <StatusBadge status={contractRun.status} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {contractRun ? contractRun.id.slice(0, 8) : "—"}
          </p>
        </Card>

        <Card className="p-4 space-y-2" data-testid="overview-execution">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Execução</h3>
            {executionRun && <StatusBadge status={executionRun.status} />}
          </div>
          {executionRun ? (
            <p className="text-xs text-muted-foreground">{executionRun.id.slice(0, 8)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Aguardando execução</p>
          )}
        </Card>

        <Card className="p-4 space-y-2" data-testid="overview-commit">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Commit</h3>
            {executionRun?.commitHash && (
              <Badge variant="outline" className="font-mono">
                {executionRun.commitHash.slice(0, 7)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {executionRun?.commitMessage || "—"}
          </p>
        </Card>
      </div>

      <div className="flex gap-2" data-testid="filter-bar">
        {STATUS_FILTERS.map((status) => {
          const isActive = statusFilter === status
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              data-testid={`filter-btn-${status}`}
              className={cn(
                "px-3",
                isActive ? "bg-blue-600 text-white hover:bg-blue-600" : "bg-muted text-muted-foreground"
              )}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()} (
              {filterCounts[status]})
            </Button>
          )
        })}
      </div>

      <div className="relative space-y-4" data-testid="timeline-container">
        <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-gray-200" />
        {unifiedGates.map((gate) => {
          const gateValidators = unifiedValidators.filter(
            (validator) =>
              validator.gateNumber === gate.gateNumber &&
              (statusFilter === "ALL" || validator.status === statusFilter)
          )
          const isExpanded = Boolean(expandedGates[gate.gateNumber])

          return (
            <div
              key={`${gate.runType}-${gate.gateNumber}`}
              className="relative ml-12"
              data-testid={`gate-card-${gate.gateNumber}`}
            >
              <div
                className={cn(
                  "absolute -left-6 top-4 w-4 h-4 rounded-full border-2",
                  getNodeClass(gate.status)
                )}
              />
              <Card className="p-4">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center justify-between gap-4"
                  onClick={() => handleToggleGate(gate.gateNumber)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleToggleGate(gate.gateNumber)
                    }
                  }}
                  data-testid={`gate-toggle-${gate.gateNumber}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{gate.gateName}</h4>
                      <Badge variant="outline" className="text-xs font-mono">
                        G{gate.gateNumber}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getGateTypeLabel(gate.gateNumber)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-status-passed">{gate.passedCount} Passed</span>
                      <span className="text-status-failed">{gate.failedCount} Failed</span>
                      {gate.warningCount > 0 && (
                        <span className="text-status-warning">{gate.warningCount} Warning</span>
                      )}
                      {gate.skippedCount > 0 && (
                        <span className="text-status-skipped">{gate.skippedCount} Skipped</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded && gate.status !== "PENDING" && gate.status !== "RUNNING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Rerun gate ${gate.gateNumber}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRerunGate(gate)
                        }}
                        className="h-7"
                      >
                        <ArrowClockwise className="w-3 h-3" />
                      </Button>
                    )}
                    <StatusBadge status={gate.status} />
                    <CaretDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-2">
                    {gateValidators.length > 0 ? (
                      gateValidators.map((validator) => {
                        const shouldShowBypass =
                          validator.status === "FAILED" &&
                          validator.isHardBlock &&
                          !validator.bypassed
                        return (
                          <div
                            key={validator.validatorCode}
                            className="p-3 bg-muted/30 rounded-lg border border-border"
                            data-testid={`validator-item-${validator.validatorCode}`}
                          >
                            <div className="flex items-start gap-2">
                              {getStatusIcon(validator.status)}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="text-sm font-medium">
                                      {validator.validatorName}
                                    </h5>
                                    <Badge
                                      variant={validator.isHardBlock ? "destructive" : "secondary"}
                                      className="text-[10px] px-2 py-0.5"
                                    >
                                      {validator.isHardBlock ? "Hard" : "Warning"}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2">
                                      {validator.status === "FAILED" && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            setUploadRunId(validator.runId)
                                            setShowUploadDialog(true)
                                          }}
                                        >
                                          Upload
                                        </Button>
                                      )}
                                      <StatusBadge status={validator.status} className="min-w-[72px]" />
                                    </div>
                                    {shouldShowBypass && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleBypassValidator(validator)
                                        }}
                                      >
                                        Bypass
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {validator.message && (
                                  <p className="text-xs text-muted-foreground">{validator.message}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum validator corresponde ao filtro atual
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )
        })}
      </div>

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
    </div>
  )
}
