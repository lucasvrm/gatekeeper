import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { RunWithResults } from "@/lib/types"
import { useRunEvents } from "@/hooks/useRunEvents"
import { RunPanel } from "@/components/run-panel"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { ArrowLeft } from "@phosphor-icons/react"
import { toast } from "sonner"

export function RunDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Primary run (from URL)
  const [primaryRun, setPrimaryRun] = useState<RunWithResults | null>(null)
  // Secondary run (execution run when viewing contract, or contract run when viewing execution)
  const [secondaryRun, setSecondaryRun] = useState<RunWithResults | null>(null)

  const [loading, setLoading] = useState(true)
  const [executionLoading, setExecutionLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAbortDialog, setShowAbortDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'primary' | 'secondary'>('primary')

  // Load primary run
  useEffect(() => {
    if (!id) return

    const loadRun = async () => {
      setLoading(true)
      setSecondaryRun(null)
      try {
        const data = await api.runs.getWithResults(id)
        setPrimaryRun(data)

        // If this is an EXECUTION run, load the contract run
        if (data.runType === 'EXECUTION' && data.contractRunId) {
          try {
            const contractData = await api.runs.getWithResults(data.contractRunId)
            setSecondaryRun(contractData)
          } catch (error) {
            console.error("Failed to load contract run:", error)
          }
        }
      } catch (error) {
        console.error("Failed to load run:", error)
        toast.error("Failed to load run details")
      } finally {
        setLoading(false)
      }
    }

    loadRun()
  }, [id])

  // SSE for primary run
  const handlePrimaryEvent = useCallback(async () => {
    if (!id) return
    console.log('[RunDetails] SSE event for primary run, refreshing...')
    try {
      const data = await api.runs.getWithResults(id)
      setPrimaryRun(data)
    } catch (error) {
      console.error("[RunDetails] Failed to refresh primary run:", error)
    }
  }, [id])

  useRunEvents(id, handlePrimaryEvent)

  // SSE for secondary run (execution)
  const handleSecondaryEvent = useCallback(async () => {
    if (!secondaryRun?.id) return
    console.log('[RunDetails] SSE event for secondary run, refreshing...')
    try {
      const data = await api.runs.getWithResults(secondaryRun.id)
      setSecondaryRun(data)
    } catch (error) {
      console.error("[RunDetails] Failed to refresh secondary run:", error)
    }
  }, [secondaryRun?.id])

  useRunEvents(secondaryRun?.id, handleSecondaryEvent)

  const handleStartExecution = async () => {
    if (!primaryRun) return
    setExecutionLoading(true)
    try {
      const manifest = JSON.parse(primaryRun.manifestJson)
      const response = await api.runs.create({
        outputId: primaryRun.outputId,
        baseRef: primaryRun.baseRef,
        targetRef: primaryRun.targetRef,
        taskPrompt: primaryRun.taskPrompt || '',
        manifest,
        dangerMode: primaryRun.dangerMode,
        runType: 'EXECUTION',
        contractRunId: primaryRun.id,
      })

      // CRITICAL: Upload files from the CONTRACT run to trigger execution
      // The backend expects files to be uploaded to queue the run
      try {
        const formData = new FormData()

        // Fetch and upload plan.json from contract run artifacts
        const planJsonPath = `artifacts/${primaryRun.outputId}/plan.json`
        const planJsonResponse = await fetch(`/${planJsonPath}`)
        if (planJsonResponse.ok) {
          const planJsonContent = await planJsonResponse.text()
          const planBlob = new Blob([planJsonContent], { type: 'application/json' })
          formData.append('planJson', planBlob, 'plan.json')
        }

        // Fetch and upload spec file from contract run
        const specFileName = manifest.testFile || 'test.spec.tsx'
        const specPath = `artifacts/${primaryRun.outputId}/${specFileName}`
        const specResponse = await fetch(`/${specPath}`)
        if (specResponse.ok) {
          const specContent = await specResponse.text()
          const specBlob = new Blob([specContent], { type: 'text/plain' })
          formData.append('specFile', specBlob, specFileName)
        }

        // Upload files to trigger execution
        if (formData.has('planJson') || formData.has('specFile')) {
          await api.runs.uploadFiles(response.runId, formData)
        }
      } catch (uploadError) {
        console.error("Failed to upload files from contract run:", uploadError)
        toast.error("Files uploaded from contract run, but execution may not start automatically. Try uploading manually.")
      }

      toast.success("Execution run started")

      // Load the new execution run as secondary
      const executionData = await api.runs.getWithResults(response.runId)
      setSecondaryRun(executionData)
    } catch (error) {
      console.error("Failed to start execution run:", error)
      toast.error("Failed to start execution run")
    } finally {
      setExecutionLoading(false)
    }
  }

  const handleAbort = async (runId: string, isPrimary: boolean) => {
    setActionLoading(true)
    try {
      await api.runs.abort(runId)
      toast.success("Run aborted successfully")
      const updated = await api.runs.getWithResults(runId)
      if (isPrimary) {
        setPrimaryRun(updated)
      } else {
        setSecondaryRun(updated)
      }
      setShowAbortDialog(false)
    } catch (error) {
      console.error("Failed to abort run:", error)
      toast.error("Failed to abort run")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    const targetRun = deleteTarget === 'primary' ? primaryRun : secondaryRun
    if (!targetRun) return

    setActionLoading(true)
    try {
      await api.runs.delete(targetRun.id)
      toast.success("Run deleted successfully")

      if (deleteTarget === 'primary') {
        navigate("/runs")
      } else {
        setSecondaryRun(null)
        setShowDeleteDialog(false)
      }
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Failed to delete run")
      setActionLoading(false)
    }
  }

  const handleRerunGate = async (runId: string, gateNumber: number) => {
    setActionLoading(true)
    try {
      await api.runs.rerunGate(runId, gateNumber)
      toast.success("Gate queued for re-execution")

      // Refresh the run data
      const updated = await api.runs.getWithResults(runId)
      if (runId === primaryRun?.id) {
        setPrimaryRun(updated)
      } else if (runId === secondaryRun?.id) {
        setSecondaryRun(updated)
      }
    } catch (error) {
      console.error("Failed to rerun gate:", error)
      toast.error("Failed to rerun gate")
    } finally {
      setActionLoading(false)
    }
  }

  const handleUploadSuccess = async () => {
    if (!id) return
    try {
      const updated = await api.runs.getWithResults(id)
      setPrimaryRun(updated)
    } catch (error) {
      console.error("Failed to refresh run after upload:", error)
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

  if (!primaryRun) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Run not found</p>
          <Button onClick={() => navigate("/runs")} className="mt-4">
            Voltar para Runs
          </Button>
        </Card>
      </div>
    )
  }

  // Determine which run is contract and which is execution
  const isViewingContract = primaryRun.runType === 'CONTRACT'
  const contractRun = isViewingContract ? primaryRun : secondaryRun
  const executionRun = isViewingContract ? secondaryRun : primaryRun

  const hasSplitView = !!(contractRun && executionRun)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/runs")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">
            {primaryRun.projectPath} <span className="text-primary">/ {primaryRun.outputId}</span>
          </p>
        </div>
      </div>

      <div className={hasSplitView ? "grid grid-cols-2 gap-6" : ""}>
        {/* Contract Run Panel */}
        {contractRun && (
          <RunPanel
            run={contractRun}
            compact={hasSplitView}
            onStartExecution={
              isViewingContract && !executionRun ? handleStartExecution : undefined
            }
            executionLoading={executionLoading}
            onAbort={
              (contractRun.status === 'PENDING' || contractRun.status === 'RUNNING')
                ? () => handleAbort(contractRun.id, isViewingContract)
                : undefined
            }
            onDelete={() => {
              setDeleteTarget(isViewingContract ? 'primary' : 'secondary')
              setShowDeleteDialog(true)
            }}
            onRerunGate={(gateNumber) => handleRerunGate(contractRun.id, gateNumber)}
            onUploadSuccess={handleUploadSuccess}
            actionLoading={actionLoading}
          />
        )}

        {/* Execution Run Panel */}
        {executionRun && (
          <RunPanel
            run={executionRun}
            compact={hasSplitView}
            onAbort={
              (executionRun.status === 'PENDING' || executionRun.status === 'RUNNING')
                ? () => handleAbort(executionRun.id, !isViewingContract)
                : undefined
            }
            onDelete={() => {
              setDeleteTarget(!isViewingContract ? 'primary' : 'secondary')
              setShowDeleteDialog(true)
            }}
            onRerunGate={(gateNumber) => handleRerunGate(executionRun.id, gateNumber)}
            onUploadSuccess={handleUploadSuccess}
            actionLoading={actionLoading}
          />
        )}
      </div>

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
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  const targetRun = deleteTarget === 'primary' ? primaryRun : secondaryRun
                  if (targetRun) handleAbort(targetRun.id, deleteTarget === 'primary')
                }}
                disabled={actionLoading}
              >
                {actionLoading ? "Aborting..." : "Abort Run"}
              </Button>
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
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleDelete}
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
