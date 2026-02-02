import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Project } from "@/lib/types"
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

export function ProjectsListPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [workspaceFilter, setWorkspaceFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const [workspaces, setWorkspaces] = useState<{id: string, name: string}[]>([])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const [projectsResponse, workspacesResponse] = await Promise.all([
        api.projects.list(1, 100),
        api.workspaces.list(1, 100),
      ])
      setProjects(projectsResponse.data)
      setWorkspaces(workspacesResponse.data.map((w) => ({ id: w.id, name: w.name })))
    } catch (error) {
      console.error("Failed to load projects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const handleDeleteClick = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation()
    setProjectToDelete(project)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return

    setDeleting(true)
    try {
      await api.projects.delete(projectToDelete.id)
      toast.success("Projeto deletado com sucesso")
      await loadProjects()
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error("Failed to delete project:", error)
      toast.error("Falha ao deletar projeto")
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    navigate(`/projects/${projectId}/edit`)
  }

  const toggleSelection = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(projectId)
      } else {
        next.delete(projectId)
      }
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjectIds(new Set(filteredProjects.map((p) => p.id)))
    } else {
      setSelectedProjectIds(new Set())
    }
  }

  const handleBulkDelete = async () => {
    const projectIds = Array.from(selectedProjectIds)
    if (projectIds.length === 0) return

    setDeleting(true)
    try {
      await Promise.all(projectIds.map((id) => api.projects.delete(id)))
      toast.success("Projetos deletados com sucesso")
      setSelectedProjectIds(new Set())
      setShowBulkDeleteDialog(false)
      await loadProjects()
    } catch (error) {
      console.error("Failed to delete projects:", error)
      toast.error("Falha ao deletar projetos")
    } finally {
      setDeleting(false)
    }
  }

  const filteredProjects = projects.filter((project) => {
    if (workspaceFilter !== "ALL" && project.workspaceId !== workspaceFilter) return false
    if (statusFilter === "ACTIVE" && !project.isActive) return false
    if (statusFilter === "INACTIVE" && project.isActive) return false
    return true
  })

  const selectedCount = selectedProjectIds.size
  const allSelected = filteredProjects.length > 0 && selectedProjectIds.size === filteredProjects.length

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
          <Button onClick={() => navigate("/projects/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
          <NewValidationCtaButton />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos Workspaces" />
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos Status</SelectItem>
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
                  aria-label="Select all projects"
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Base Ref</TableHead>
              <TableHead>Target Ref</TableHead>
              <TableHead>Runs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum projeto encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedProjectIds.has(project.id)}
                      onCheckedChange={(checked) => toggleSelection(project.id, checked as boolean)}
                      aria-label={`Select project ${project.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.workspace?.name || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{project.baseRef}</TableCell>
                  <TableCell className="font-mono text-sm">{project.targetRef}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {project._count?.validationRuns || 0} run(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={project.isActive ? "default" : "secondary"}>
                      {project.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(project.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEditClick(project.id, e)}
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(project, e)}
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
            <AlertDialogTitle>Deletar Projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o projeto "{projectToDelete?.name}"?
              Esta ação irá deletar todas as runs associadas e não pode ser desfeita.
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
            <AlertDialogTitle>Deletar projetos selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selectedCount} projeto(s)?
              Esta ação irá deletar todas as runs associadas e não pode ser desfeita.
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
