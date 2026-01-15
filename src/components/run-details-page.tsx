import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { RunWithResults } from "@/lib/types"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import {
  ArrowLeft,
  Stop,
  Trash,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  Warning,
  Minus,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunWithResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskPromptOpen, setTaskPromptOpen] = useState(false)
  const [expandedGates, setExpandedGates] = useState<Set<number>>(new Set([0]))
  const [showAbortDialog, setShowAbortDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!id) return

    const loadRun = async () => {
      setLoading(true)
      try {
        const data = await api.runs.getWithResults(id)
        setRun(data)
      } catch (error) {
        console.error("Failed to load run:", error)
        toast.error("Failed to load run details")
      } finally {
        setLoading(false)
      }
    }

    loadRun()
  }, [id])

  const handleAbort = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await api.runs.abort(id)
      toast.success("Run aborted successfully")
      const updated = await api.runs.getWithResults(id)
      setRun(updated)
      setShowAbortDialog(false)
    } catch (error) {
      console.error("Failed to abort run:", error)
      toast.error("Failed to abort run")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await api.runs.delete(id)
      toast.success("Run deleted successfully")
      navigate("/runs")
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Failed to delete run")
      setActionLoading(false)
    }
  }

  const toggleGate = (gateNumber: number) => {
    setExpandedGates((prev) => {
      const next = new Set(prev)
      if (next.has(gateNumber)) {
        next.delete(gateNumber)
      } else {
        next.add(gateNumber)
      }
      return next
    })
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

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Run not found</p>
          <Button onClick={() => navigate("/runs")} className="mt-4">
            Back to Runs
          </Button>
        </Card>
      </div>
    )
  }

  const canAbort = run.status === "PENDING" || run.status === "RUNNING"

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/runs")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono">{run.id.substring(0, 8)}</h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground mt-1">{run.projectPath}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAbort && (
            <Button
              variant="outline"
              onClick={() => setShowAbortDialog(true)}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Stop className="w-4 h-4 mr-2" />
              Abort
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {run.taskPrompt && (
        <Card className="p-6 bg-card border-border">
          <Collapsible open={taskPromptOpen} onOpenChange={setTaskPromptOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold">Task Prompt</h2>
              {taskPromptOpen ? (
                <CaretDown className="w-5 h-5" />
              ) : (
                <CaretRight className="w-5 h-5" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-4 rounded-lg">
                {run.taskPrompt}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <Card className="p-6 bg-card border-border">
        <h2 className="text-lg font-semibold mb-6">Gate Progress</h2>
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2, 3].map((gateNum, idx) => {
            const gateResult = run.gateResults.find((g) => g.gateNumber === gateNum)
            const isActive = run.currentGate === gateNum
            const isPast = run.currentGate > gateNum
            const isFailed = run.failedAt === gateNum

            return (
              <div key={gateNum} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 font-semibold transition-colors",
                      isPast && !isFailed
                        ? "bg-status-passed border-status-passed text-background"
                        : isFailed
                        ? "bg-status-failed border-status-failed text-background"
                        : isActive
                        ? "bg-status-running border-status-running text-background"
                        : "bg-muted border-muted-foreground text-muted-foreground"
                    )}
                  >
                    {gateNum}
                  </div>
                  <p className="text-xs mt-2 text-muted-foreground font-medium">
                    {gateResult?.gateName || `Gate ${gateNum}`}
                  </p>
                </div>
                {idx < 3 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isPast && !isFailed
                        ? "bg-status-passed"
                        : "bg-muted"
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-4">
          {run.gateResults.map((gate) => {
            const validators = run.validatorResults.filter(
              (v) => v.gateNumber === gate.gateNumber
            )
            const isExpanded = expandedGates.has(gate.gateNumber)

            return (
              <Card key={gate.gateNumber} className="bg-muted/30 border-border">
                <button
                  onClick={() => toggleGate(gate.gateNumber)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <CaretDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <CaretRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        {gate.gateName}
                        <span className="text-xs font-mono text-muted-foreground">
                          Gate {gate.gateNumber}
                        </span>
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-status-passed">
                          {gate.passedCount} passed
                        </span>
                        <span className="text-status-failed">
                          {gate.failedCount} failed
                        </span>
                        {gate.warningCount > 0 && (
                          <span className="text-status-warning">
                            {gate.warningCount} warnings
                          </span>
                        )}
                        {gate.skippedCount > 0 && (
                          <span className="text-status-skipped">
                            {gate.skippedCount} skipped
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={gate.status} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {validators.map((validator) => (
                      <div
                        key={validator.validatorCode}
                        className="p-4 bg-card rounded-lg border border-border"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(validator.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{validator.validatorName}</h4>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {validator.validatorCode}
                                </span>
                                {validator.isHardBlock && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive font-medium">
                                    Hard Block
                                  </span>
                                )}
                              </div>
                              {validator.message && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {validator.message}
                                </p>
                              )}
                              {validator.details && (
                                <pre className="text-xs text-muted-foreground mt-2 bg-muted p-3 rounded font-mono whitespace-pre-wrap">
                                  {validator.details}
                                </pre>
                              )}
                              {validator.evidence && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                                    Evidence:
                                  </p>
                                  <pre className="text-xs bg-muted p-3 rounded font-mono whitespace-pre-wrap overflow-x-auto">
                                    {validator.evidence}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </Card>

      <AlertDialog open={showAbortDialog} onOpenChange={setShowAbortDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abort Validation Run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the current validation run. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbort}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? "Aborting..." : "Abort Run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? "Deleting..." : "Delete Run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
