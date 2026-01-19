import { useState } from "react"
import type { RunWithResults } from "@/lib/types"
import { api } from "@/lib/api"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { FileUploadDialog } from "@/components/file-upload-dialog"
import { toast } from "sonner"
import {
  CaretDown,
  CaretRight,
  CheckCircle,
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
  const [taskPromptOpen, setTaskPromptOpen] = useState(true)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [bypassLoading, setBypassLoading] = useState<string | null>(null)
  const defaultTab = run.runType === 'CONTRACT' ? 'sanitization' : 'execution'
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

  // Get progress bar color based on run status
  const getProgressBarColor = () => {
    if (run.status === 'PASSED') return 'bg-status-passed'
    if (run.status === 'FAILED') return 'bg-status-failed'
    return 'bg-status-running'
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className={cn("font-bold font-mono", compact ? "text-lg" : "text-2xl")}>
              {run.runType === 'CONTRACT' ? 'Contrato' : 'Execução'}
            </h2>
            <StatusBadge status={normalizeStatus(run.status, run.passed) as RunWithResults["status"]} />
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
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              onClick={onAbort}
              disabled={actionLoading}
              className="hover:bg-white hover:text-white hover:border-white"
            >
              <Stop className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              onClick={onDelete}
              disabled={actionLoading}
              className="hover:bg-white hover:text-white hover:border-white"
            >
              <Trash className="w-4 h-4" />
            </Button>
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
                <TabsContent key={gate.gateNumber} value={tabValue} className="space-y-2 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        {gate.gateName}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          G{gate.gateNumber}
                        </span>
                      </h4>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                        <span className="text-status-passed">{gate.passedCount}P</span>
                        <span className="text-status-failed">{gate.failedCount}F</span>
                        {gate.warningCount > 0 && (
                          <span className="text-status-warning">{gate.warningCount}W</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onRerunGate && gate.status !== 'PENDING' && gate.status !== 'RUNNING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRerunGate(gate.gateNumber)}
                          disabled={actionLoading}
                          aria-label={`Rerun gate ${gate.gateNumber}`}
                          className="h-7 hover:bg-white hover:text-white hover:border-white"
                        >
                          <ArrowClockwise className="w-3 h-3" />
                        </Button>
                      )}
                      <StatusBadge
                        status={normalizeStatus(gate.status, gate.passed) as RunWithResults["status"]}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {validators.map((validator) => {
                      const shouldShowBypass =
                        validator.status === 'FAILED' &&
                        validator.isHardBlock &&
                        !validator.bypassed
                      const isBypassInProgress = bypassLoading === validator.validatorCode

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
                                  {validator.isHardBlock && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium">
                                      Hard
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <StatusBadge status={validator.status} className="min-w-[72px]" />
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
    </div>
  )
}

