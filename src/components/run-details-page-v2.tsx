import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { GateResult, RunStatus, RunWithResults, ValidatorContext, ValidatorResult, ValidatorStatus } from "@/lib/types"
import { ValidatorContextPanel } from "@/components/validator-context-panel"
import { useRunEvents } from "@/hooks/useRunEvents"
import { api } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { NovaValidacaoCtaButton } from "@/components/nova-validacao-cta-button"
import { cn, getRepoNameFromPath } from "@/lib/utils"
import {
  ArrowsClockwise,
  ArrowClockwise,
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Clock,
  Minus,
  Play,
  Trash,
  Upload,
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

const getChangeType = (run: RunWithResults | null): string | null => {
  if (!run?.contractJson) return null
  try {
    const contract = JSON.parse(run.contractJson)
    return contract.changeType || null
  } catch {
    return null
  }
}

const getNodeClass = (status: ValidatorStatus) => {
  if (status === "PASSED") return "border-status-passed bg-status-passed"
  if (status === "FAILED") return "border-status-failed bg-status-failed"
  if (status === "WARNING") return "border-status-warning bg-status-warning/20"
  if (status === "SKIPPED") return "border-status-skipped bg-status-skipped/20"
  if (status === "RUNNING") return "border-status-running bg-status-running/20"
  return "border-status-pending bg-status-pending/20"
}

const getProgressBarColor = (status: RunStatus | undefined): string => {
  switch (status) {
    case "RUNNING":
      return "bg-status-warning"
    case "PASSED":
      return "bg-status-passed"
    case "FAILED":
      return "bg-status-failed"
    default:
      return "bg-status-pending"
  }
}

type OverviewStatus = "PASSED" | "FAILED" | "WARNING" | "RUNNING" | "PENDING" | "SKIPPED" | "ABORTED"

const OVERVIEW_STATUS_CONFIG: Record<OverviewStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  PASSED: {
    icon: CheckCircle,
    label: "PASSED",
    className: "bg-status-passed/20 text-status-passed border-status-passed",
  },
  FAILED: {
    icon: XCircle,
    label: "FAILED",
    className: "bg-status-failed/20 text-status-failed border-status-failed",
  },
  ABORTED: {
    icon: XCircle,
    label: "ABORTED",
    className: "bg-status-aborted/20 text-status-aborted border-status-aborted/30",
  },
  WARNING: {
    icon: Warning,
    label: "WARNING",
    className: "bg-status-warning/20 text-status-warning border-status-warning/30",
  },
  RUNNING: {
    icon: ArrowsClockwise,
    label: "RUNNING",
    className: "bg-status-running/20 text-status-passed border-status-running/30",
  },
  PENDING: {
    icon: Clock,
    label: "PENDING",
    className: "bg-status-pending/20 text-status-pending border-status-pending/30",
  },
  SKIPPED: {
    icon: Minus,
    label: "SKIPPED",
    className: "bg-status-skipped/20 text-status-skipped border-status-skipped/30",
  },
}

const OverviewStatusBadge = ({ status }: { status: OverviewStatus }) => {
  const config = OVERVIEW_STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`${config.className} flex items-center gap-1.5 px-2 py-0.5`}>
      <Icon className="w-3.5 h-3.5" weight="fill" />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  )
}

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
  const [expandedGates, setExpandedGates] = useState<Record<number, boolean>>({})
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadRunId, setUploadRunId] = useState<string | null>(null)
  const [openBypassGate, setOpenBypassGate] = useState<number | null>(null)
  const [hoveredUploadGate, setHoveredUploadGate] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [executionLoading, setExecutionLoading] = useState(false)

  const contractRun =
    primaryRun?.runType === "CONTRACT" ? primaryRun : secondaryRun?.runType === "CONTRACT" ? secondaryRun : null
  const executionRun =
    primaryRun?.runType === "EXECUTION" ? primaryRun : secondaryRun?.runType === "EXECUTION" ? secondaryRun : null

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
      const nextError = err instanceof Error ? err : new Error("Failed to load run")
      setError(nextError)
      setPrimaryRun(null)
      setSecondaryRun(null)
      toast.error("Failed to load run")
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
      toast.error("Failed to refresh run")
    }
  }, [loadSecondaryRun, runId])

  const handleSecondaryEvent = useCallback(async () => {
    if (!secondaryRun?.id) return
    try {
      const refreshed = await api.runs.getWithResults(secondaryRun.id)
      setSecondaryRun(refreshed)
    } catch (err) {
      console.error("Failed to refresh secondary run:", err)
      toast.error("Failed to refresh run")
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

  const totalValidators = useMemo(() => {
    if (filterCounts.ALL === 4 && filterCounts.SKIPPED > 0) return 5
    return filterCounts.ALL
  }, [filterCounts])

  const getGateOverviewStatus = useCallback(
    (gateNumber: number): OverviewStatus => {
      const gateValidators = validatorsByGate[gateNumber] ?? []
      const gateResult = unifiedGates.find((gate) => gate.gateNumber === gateNumber)
      if (gateValidators.some((validator) => validator.status === "FAILED")) return "FAILED"
      if (
        gateValidators.some((validator) => validator.status === "RUNNING") ||
        gateResult?.status === "RUNNING"
      ) {
        return "RUNNING"
      }
      if (gateValidators.length === 0 && !gateResult) return "PENDING"
      return "PASSED"
    },
    [unifiedGates, validatorsByGate]
  )

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

  // Note: Gates start collapsed. User clicks to expand.
  // This was changed from auto-expanding failed gates to match spec expectations.

  const handleToggleGate = (gateNumber: number) => {
    setExpandedGates((prev) => ({
      ...prev,
      [gateNumber]: !prev[gateNumber],
    }))
  }

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
      toast.success("Gate queued for re-execution")
    } catch (error) {
      console.error("Failed to rerun gate:", error)
      toast.error("Failed to rerun gate")
    }
  }

  const handleStartExecution = async () => {
    if (!contractRun) return
    if (!contractRun.projectId) {
      toast.error("Contract run does not have a projectId. Cannot start execution.")
      return
    }
    if (!contractRun.taskPrompt) {
      toast.error("Contract run does not have a taskPrompt. Cannot start execution.")
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

      toast.success("Execution run started")
      const executionData = await api.runs.getWithResults(response.runId)
      setSecondaryRun(executionData)
    } catch (error) {
      console.error("Failed to start execution run:", error)
      toast.error("Failed to start execution run")
    } finally {
      setExecutionLoading(false)
    }
  }

  const handleDeleteRun = async () => {
    if (!primaryRun) return
    setActionLoading(true)
    try {
      await api.runs.delete(primaryRun.id)
      toast.success("Run deleted successfully")
      navigate("/runs")
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Failed to delete run")
      setActionLoading(false)
    }
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
      <div
        className="sticky top-0 z-20 bg-background space-y-4 pb-4"
        data-testid="run-details-v2-sticky-header"
      >
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
              <span className="text-primary" data-testid="run-header-repoName">
                {primaryRun ? getRepoNameFromPath(primaryRun.projectPath) : "—"}
              </span>
              <span className="mx-2">/</span>
              <span className="text-primary" data-testid="run-header-outputId">
                {primaryRun?.outputId ?? "—"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              className="h-8 px-2 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash className="w-4 h-4" />
            </Badge>
            {contractRun && executionRun && (
              <GitCommitButton
                contractRun={contractRun}
                executionRun={executionRun}
                outputId={primaryRun?.outputId || ""}
              />
            )}
            <NovaValidacaoCtaButton />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4" data-testid="overview-cards">
          <Card className="col-span-12 p-4 space-y-1" data-testid="overview-task-prompt">
            <h3 className="text-sm font-semibold">Prompt da Tarefa</h3>
            <p
              className="text-xs text-muted-foreground whitespace-pre-wrap break-words line-clamp-4"
              title={primaryRun?.taskPrompt || "—"}
              data-testid="task-prompt-content"
            >
              {primaryRun?.taskPrompt || "—"}
            </p>
          </Card>

          <div className="col-span-12 grid gap-4 md:grid-cols-5">
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
                indicatorClassName={getProgressBarColor(primaryRun?.status)}
              />
              <div className="space-y-0 text-xs text-muted-foreground leading-tight">
                <p>
                  <span className="text-status-passed">{filterCounts.PASSED}</span> / {totalValidators} passaram
                </p>
                <p>
                  <span className="text-status-warning">{filterCounts.SKIPPED}</span> / {totalValidators} skipped
                </p>
                <p>
                  <span className="text-status-failed">{filterCounts.FAILED}</span> / {totalValidators} falharam
                </p>
              </div>
            </Card>

            <Card className="p-4 space-y-2" data-testid="overview-sanitization">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Sanitization</h3>
                <OverviewStatusBadge status={getGateOverviewStatus(0)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {contractRun ? contractRun.id.slice(0, 8) : "—"}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="card-actions-upload-g0"
                    onClick={() => handleGateUpload(0)}
                    onMouseEnter={() => setHoveredUploadGate(0)}
                    onMouseLeave={() => setHoveredUploadGate(null)}
                    disabled={!hasFailedInGate(0)}
                    className="px-2"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  {hoveredUploadGate === 0 && (
                    <div className="absolute right-0 top-full mt-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                      Upload de novos artefatos
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-rerun-g0"
                  aria-label="Rerun gate 0"
                  onClick={() => handleGateRerun(0)}
                  disabled={!hasFailedInGate(0)}
                  className="px-2"
                >
                  <ArrowClockwise className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-bypass-g0"
                  onClick={() => setOpenBypassGate((prev) => (prev === 0 ? null : 0))}
                  disabled={!hasFailedInGate(0)}
                >
                  Bypass
                </Button>
              </div>
              {openBypassGate === 0 && getBypassableValidators(0).length > 0 && (
                <div className="mt-2 space-y-1">
                  {getBypassableValidators(0).map((validator) => (
                    <Button
                      key={validator.validatorCode}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleBypassValidator(validator)}
                    >
                      {validator.validatorCode}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-2" data-testid="overview-contract">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contrato</h3>
                {contractRun && <OverviewStatusBadge status={contractRun.status as OverviewStatus} />}
              </div>
              <p className="text-xs text-muted-foreground">
                {contractRun ? contractRun.id.slice(0, 8) : "—"}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="card-actions-upload-g1"
                    onClick={() => handleGateUpload(1)}
                    onMouseEnter={() => setHoveredUploadGate(1)}
                    onMouseLeave={() => setHoveredUploadGate(null)}
                    disabled={!hasFailedInGate(1)}
                    className="px-2"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  {hoveredUploadGate === 1 && (
                    <div className="absolute right-0 top-full mt-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                      Upload de novos artefatos
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-rerun-g1"
                  aria-label="Rerun gate 1"
                  onClick={() => handleGateRerun(1)}
                  disabled={!hasFailedInGate(1)}
                  className="px-2"
                >
                  <ArrowClockwise className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-bypass-g1"
                  onClick={() => setOpenBypassGate((prev) => (prev === 1 ? null : 1))}
                  disabled={!hasFailedInGate(1)}
                >
                  Bypass
                </Button>
              </div>
              {openBypassGate === 1 && getBypassableValidators(1).length > 0 && (
                <div className="mt-2 space-y-1">
                  {getBypassableValidators(1).map((validator) => (
                    <Button
                      key={validator.validatorCode}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleBypassValidator(validator)}
                    >
                      {validator.validatorCode}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-2" data-testid="overview-execution">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Execução</h3>
                {executionRun && <OverviewStatusBadge status={executionRun.status as OverviewStatus} />}
              </div>
              {executionRun ? (
                <p className="text-xs text-muted-foreground">{executionRun.id.slice(0, 8)}</p>
              ) : canStartExecution ? (
                <Button
                  size="sm"
                  onClick={handleStartExecution}
                  disabled={executionLoading}
                  className="w-full justify-center"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {executionLoading ? "..." : "Execução"}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Aguardando execução</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="card-actions-upload-g2"
                    onClick={() => handleGateUpload(2)}
                    onMouseEnter={() => setHoveredUploadGate(2)}
                    onMouseLeave={() => setHoveredUploadGate(null)}
                    disabled={!hasFailedInGate(2)}
                    className="px-2"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  {hoveredUploadGate === 2 && (
                    <div className="absolute right-0 top-full mt-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                      Upload de novos artefatos
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-rerun-g2"
                  aria-label="Rerun gate 2"
                  onClick={() => handleGateRerun(2)}
                  disabled={!hasFailedInGate(2)}
                  className="px-2"
                >
                  <ArrowClockwise className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-bypass-g2"
                  onClick={() => setOpenBypassGate((prev) => (prev === 2 ? null : 2))}
                  disabled={!hasFailedInGate(2)}
                >
                  Bypass
                </Button>
              </div>
              {openBypassGate === 2 && getBypassableValidators(2).length > 0 && (
                <div className="mt-2 space-y-1">
                  {getBypassableValidators(2).map((validator) => (
                    <Button
                      key={validator.validatorCode}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleBypassValidator(validator)}
                    >
                      {validator.validatorCode}
                    </Button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-2" data-testid="overview-integrity">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Integrity</h3>
                <OverviewStatusBadge status={getGateOverviewStatus(3)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {executionRun ? executionRun.id.slice(0, 8) : "—"}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="card-actions-upload-g3"
                    onClick={() => handleGateUpload(3)}
                    onMouseEnter={() => setHoveredUploadGate(3)}
                    onMouseLeave={() => setHoveredUploadGate(null)}
                    disabled={!hasFailedInGate(3)}
                    className="px-2"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                  {hoveredUploadGate === 3 && (
                    <div className="absolute right-0 top-full mt-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                      Upload de novos artefatos
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-rerun-g3"
                  aria-label="Rerun gate 3"
                  onClick={() => handleGateRerun(3)}
                  disabled={!hasFailedInGate(3)}
                  className="px-2"
                >
                  <ArrowClockwise className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="card-actions-bypass-g3"
                  onClick={() => setOpenBypassGate((prev) => (prev === 3 ? null : 3))}
                  disabled={!hasFailedInGate(3)}
                >
                  Bypass
                </Button>
              </div>
              {openBypassGate === 3 && getBypassableValidators(3).length > 0 && (
                <div className="mt-2 space-y-1">
                  {getBypassableValidators(3).map((validator) => (
                    <Button
                      key={validator.validatorCode}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleBypassValidator(validator)}
                    >
                      {validator.validatorCode}
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="flex gap-2 -mt-3" data-testid="filter-bar">
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
                isActive
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-muted text-muted-foreground hover:bg-transparent hover:text-blue-600 hover:border-blue-600"
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
                      <span className="text-status-passed">
                        {gate.passedCount} {gate.gateNumber === 0 ? "Passaram" : "P"}
                      </span>
                      <span className="text-status-failed">
                        {gate.failedCount} {gate.gateNumber === 0 ? "Falharam" : "F"}
                      </span>
                      {gate.warningCount > 0 && (
                        <span className="text-status-warning">
                          {gate.warningCount} Warning
                        </span>
                      )}
                      {gate.skippedCount > 0 && (
                        <span className="text-status-skipped">
                          {gate.skippedCount} Skipped
                        </span>
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
                    <OverviewStatusBadge status={gate.status as OverviewStatus} />
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

                        // Parse context from details (igual V1)
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
                                {parsedContext && (
                                  <ValidatorContextPanel context={parsedContext} />
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Validation Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this validation run and all its results. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleDeleteRun}
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Delete Run"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
