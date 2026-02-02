import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
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
import { Plus, PencilSimple, Trash, FunnelSimple } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { NewValidationCtaButton } from "@/components/new-validation-cta-button"

export function WorkspacesListPage() {
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  const loadWorkspaces = async () => {
    setLoading(true)
    try {
      const response = await api.workspaces.list()
      setWorkspaces(response.data)
    } catch (error) {
      console.error("Failed to load workspaces:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkspaces()
  }, [])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const handleDeleteClick = (workspace: Workspace, event: React.MouseEvent) => {
    event.stopPropagation()
    setWorkspaceToDelete(workspace)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!workspaceToDelete) return

    setDeleting(true)
    try {
      await api.workspaces.delete(workspaceToDelete.id)
      toast.success("Workspace deletado com sucesso")
      await loadWorkspaces()
      setDeleteDialogOpen(false)
      setWorkspaceToDelete(null)
    } catch (error) {
      console.error("Failed to delete workspace:", error)
      toast.error("Falha ao deletar workspace")
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (workspaceId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    navigate(`/workspaces/${workspaceId}/edit`)
  }

  const toggleSelection = (workspaceId: string, checked: boolean) => {
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(workspaceId)
      } else {
        next.delete(workspaceId)
      }
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkspaceIds(new Set(filteredWorkspaces.map((w) => w.id)))
    } else {
      setSelectedWorkspaceIds(new Set())
    }
  }

  const handleBulkDelete = async () => {
    const workspaceIds = Array.from(selectedWorkspaceIds)
    if (workspaceIds.length === 0) return

    setDeleting(true)
    try {
      await Promise.all(workspaceIds.map((id) => api.workspaces.delete(id)))
      toast.success("Workspaces deletados com sucesso")
      setSelectedWorkspaceIds(new Set())
      setShowBulkDeleteDialog(false)
      await loadWorkspaces()
    } catch (error) {
      console.error("Failed to delete workspaces:", error)
      toast.error("Falha ao deletar workspaces")
    } finally {
      setDeleting(false)
    }
  }

  const filteredWorkspaces = workspaces.filter((workspace) => {
    if (statusFilter === "ACTIVE") return workspace.isActive
    if (statusFilter === "INACTIVE") return !workspace.isActive
    return true
  })

  const selectedCount = selectedWorkspaceIds.size
  const allSelected = filteredWorkspaces.length > 0 && selectedWorkspaceIds.size === filteredWorkspaces.length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/workspaces/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Workspace
          </Button>
          <NewValidationCtaButton />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtrar por Status:</span>
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="INACTIVE">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={selectedCount === 0 || deleting}
          >
            <Trash className="w-4 h-4 mr-2" />
            Deletar Selecionados ({selectedCount})
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all workspaces"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Root Path</TableHead>
              <TableHead>Projetos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWorkspaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum workspace encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredWorkspaces.map((workspace) => (
                <TableRow
                  key={workspace.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/workspaces/${workspace.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedWorkspaceIds.has(workspace.id)}
                      onCheckedChange={(checked) => toggleSelection(workspace.id, checked as boolean)}
                      aria-label={`Select workspace ${workspace.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{workspace.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {workspace.rootPath || <span className="italic">Não configurado</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {workspace._count?.projects || 0} projeto(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={workspace.isActive ? "default" : "secondary"}>
                      {workspace.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(workspace.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEditClick(workspace.id, e)}
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(workspace, e)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o workspace "{workspaceToDelete?.name}"?
              Esta ação irá deletar todos os projetos associados e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deletando..." : "Deletar"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar workspaces selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selectedCount} workspace(s)?
              Esta ação irá deletar todos os projetos associados e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                {deleting ? "Deletando..." : "Deletar Selecionados"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
