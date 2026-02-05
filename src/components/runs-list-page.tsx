import { useEffect, useState, type MouseEvent } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Run, RunStatus, Workspace, Project } from "@/lib/types"
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
import { CaretLeft, CaretRight, FunnelSimple, Stop, Trash } from "@phosphor-icons/react"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
// import { NewValidationCtaButton } from "@/components/new-validation-cta-button"

export function RunsListPage() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<RunStatus | "ALL">("ALL")
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("ALL")
  const [projectFilter, setProjectFilter] = useState<string>("ALL")
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [commitModalOpen, setCommitModalOpen] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<Run | null>(null)
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
    const loadWorkspaces = async () => {
      try {
        const response = await api.workspaces.list(1, 100, true)
        setWorkspaces(response.data)
      } catch (error) {
        console.error("Failed to load workspaces:", error)
      }
    }
    loadWorkspaces()
  }, [])

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await api.projects.list(1, 100, undefined, true)
        setProjects(response.data)
      } catch (error) {
        console.error("Failed to load projects:", error)
      }
    }
    loadProjects()
  }, [])

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

  // Projetos disponíveis baseados no workspace selecionado
  const availableProjects = workspaceFilter === "ALL"
    ? projects
    : projects.filter(p => p.workspaceId === workspaceFilter)

  // Resetar filtro de projeto quando workspace mudar e projeto não estiver disponível
  useEffect(() => {
    if (projectFilter !== "ALL" && !availableProjects.some(p => p.id === projectFilter)) {
      setProjectFilter("ALL")
    }
  }, [workspaceFilter, projectFilter, availableProjects])

  const filteredRuns = runs.filter((run) => {
    // Filtro por workspace
    if (workspaceFilter !== "ALL") {
      if (!run.project?.workspace?.id || run.project.workspace.id !== workspaceFilter) {
        return false
      }
    }

    // Filtro por projeto
    if (projectFilter !== "ALL") {
      if (!run.project?.id || run.project.id !== projectFilter) {
        return false
      }
    }

    return true
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const truncateCommitMessage = (message: string | null | undefined, maxLength = 40) => {
    if (!message) return "-"
    if (message.length <= maxLength) return message
    return `${message.slice(0, maxLength)}...`
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
      toast.success("Run abortado com sucesso")
      await loadRuns()
    } catch (error) {
      console.error("Failed to abort run:", error)
      toast.error("Falha ao abortar run")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (runId: string) => {
    setActionLoading(true)
    try {
      await api.runs.delete(runId)
      toast.success("Run excluído com sucesso")
      await loadRuns()
    } catch (error) {
      console.error("Failed to delete run:", error)
      toast.error("Falha ao excluir run")
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
      toast.success("Runs selecionados excluídos com sucesso")
      setSelectedRunIds(new Set())
      setShowBulkDeleteDialog(false)
      await loadRuns()
    } catch (error) {
      console.error("Failed to delete runs:", error)
      toast.error("Falha ao excluir runs selecionados")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCommitClick = (run: Run, event: MouseEvent<HTMLTableCellElement>) => {
    event.stopPropagation()
    if (!run.commitMessage) return
    setSelectedCommit(run)
    setCommitModalOpen(true)
  }

  const handleCommitModalChange = (open: boolean) => {
    setCommitModalOpen(open)
    if (!open) {
      setSelectedCommit(null)
    }
  }

  const selectedCount = selectedRunIds.size

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRunIds(new Set(filteredRuns.map((run) => run.id)))
    } else {
      setSelectedRunIds(new Set())
    }
  }

  const allSelected = filteredRuns.length > 0 && selectedRunIds.size === filteredRuns.length

  return (
    <div className="page-gap">

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Workspaces</SelectItem>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Projetos</SelectItem>
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.workspace?.name} / {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RunStatus | "ALL")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
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
            Excluir Selecionados ({selectedCount})
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma run encontrada</p>
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
                      aria-label="Selecionar todos os runs"
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
                    Projeto / Path
                  </TableHead>
                  <TableHead
                    data-testid="runs-table-commit-column"
                    className="font-semibold text-xs uppercase tracking-wider"
                  >
                    Commit
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
                {filteredRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/runs/${run.id}/v2`)}
                  >
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedRunIds.has(run.id)}
                        onCheckedChange={(checked) =>
                          toggleSelection(run.id, checked as boolean)
                        }
                        aria-label={`Selecionar run ${run.id}`}
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
                    <TableCell>
                      {run.project ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {run.project.workspace?.name} / {run.project.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {run.projectPath}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-muted-foreground">
                          {run.projectPath}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      data-testid={`commit-cell-${run.id}`}
                      onClick={(event) => handleCommitClick(run, event)}
                      className={`font-mono text-xs text-muted-foreground ${
                        run.commitMessage ? "cursor-pointer" : ""
                      }`}
                    >
                      {run.commitMessage && run.commitMessage.length > 40 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="hover:underline">
                                {truncateCommitMessage(run.commitMessage)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{run.commitMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className={run.commitMessage ? "hover:underline" : ""}>
                          {truncateCommitMessage(run.commitMessage)}
                        </span>
                      )}
                    </TableCell>
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
                            aria-label={`Abortar run ${run.id}`}
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
                          aria-label={`Excluir run ${run.id}`}
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
                Página {page} de {totalPages}
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

      <Dialog open={commitModalOpen} onOpenChange={handleCommitModalChange}>
        <DialogContent
          data-testid="commit-info-modal"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Informações do Commit</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Hash</div>
              <div data-testid="commit-info-hash" className="font-mono">
                {selectedCommit?.commitHash ?? "-"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Mensagem</div>
              <div data-testid="commit-info-message">
                {selectedCommit?.commitMessage ?? "-"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Data</div>
              <div data-testid="commit-info-date" className="font-mono">
                {selectedCommit?.committedAt
                  ? new Date(selectedCommit.committedAt).toLocaleString()
                  : "-"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCommitModalChange(false)}
              data-testid="btn-close-modal"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir runs selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir permanentemente {selectedCount} runs de validação e todos os seus
              resultados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Excluindo..." : "Excluir Selecionados"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
