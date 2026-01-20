import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Run, RunStatus } from "@/lib/types"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CaretLeft, CaretRight, Plus, FunnelSimple, Stop, Trash } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
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

export function RunsListPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<RunStatus | "ALL">("ALL")
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const limit = 20

  const loadRuns = async () => {
    setLoading(true)
    try {
      const response = await api.runs.list(
        page,
        limit,
        statusFilter === "ALL" ? undefined : statusFilter
      )
      setRuns(response.data)
      setTotalPages(response.pagination.pages)
    } catch (error) {
      console.error("Failed to load runs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter])

  useEffect(() => {
    setSelectedRunIds((prev) => {
      const next = new Set<string>()
      runs.forEach((run) => {
        if (prev.has(run.id)) {
          next.add(run.id)
        }
      })
      return next
    })
  }, [runs])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const toggleSelection = (runId: string, checked: boolean) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(runId)
      } else {
        next.delete(runId)
      }
      return next
    })
  }

  const handleAbort = async (runId: string) => {
    setActionLoading(true)
    try {
      await api.runs.abort(runId)
      toast.success("Run aborted successfully")
      await loadRuns()
    } catch (error) {
      console.error("Failed to abort run:", error)
      toast.error("Failed to abort run")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (runId: string) => {
    setActionLoading(true)
    try {
      await api.runs.delete(runId)
      toast.success("Run deleted successfully")
      await loadRuns()
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Failed to delete run")
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    const runIds = Array.from(selectedRunIds)
    if (runIds.length === 0) return

    setActionLoading(true)
    try {
      await Promise.all(runIds.map((runId) => api.runs.delete(runId)))
      toast.success("Selected runs deleted successfully")
      setSelectedRunIds(new Set())
      setShowBulkDeleteDialog(false)
      await loadRuns()
    } catch (error) {
      console.error("Failed to delete runs:", error)
      toast.error("Failed to delete selected runs")
    } finally {
      setActionLoading(false)
    }
  }

  const selectedCount = selectedRunIds.size

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRunIds(new Set(runs.map((run) => run.id)))
    } else {
      setSelectedRunIds(new Set())
    }
  }

  const allSelected = runs.length > 0 && selectedRunIds.size === runs.length

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Runs de Validação</h1>
          <p className="text-muted-foreground mt-1">
            Ver e gerenciar todas as runs de validação
          </p>
        </div>
        <Button
          onClick={() => navigate("/runs/new")}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" weight="bold" />
          New Validation
        </Button>
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RunStatus | "ALL")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Status</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="RUNNING">Executando</SelectItem>
                <SelectItem value="PASSED">Aprovado</SelectItem>
                <SelectItem value="FAILED">Rejeitado</SelectItem>
                <SelectItem value="ABORTED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={selectedCount === 0 || actionLoading}
          >
            <Trash className="w-4 h-4" />
            Deletar Selecionados ({selectedCount})
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No runs found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all runs"
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Run ID
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Output ID
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Gate
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Rejeitado Por
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Path do Projeto
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Criado Em
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedRunIds.has(run.id)}
                        onCheckedChange={(checked) =>
                          toggleSelection(run.id, checked as boolean)
                        }
                        aria-label={`Select run ${run.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {run.id.substring(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{run.outputId}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">Gate {run.currentGate}</span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {run.failedValidatorCode || "-"}
                    </TableCell>
                    <TableCell className="font-medium">{run.projectPath}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {formatDate(run.createdAt)}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {(run.status === "PENDING" || run.status === "RUNNING") && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleAbort(run.id)}
                            disabled={actionLoading}
                            aria-label={`Abort run ${run.id}`}
                            className="hover:bg-white hover:text-white hover:border-white"
                          >
                            <Stop className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(run.id)}
                          disabled={actionLoading}
                          aria-label={`Delete run ${run.id}`}
                          className="hover:bg-white hover:text-white hover:border-white"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <CaretLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <CaretRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected runs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} validation runs and all their
              results. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Delete Selected"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
