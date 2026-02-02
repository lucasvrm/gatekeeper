import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Workspace, Project, Run } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, PencilSimple } from "@phosphor-icons/react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"

export function WorkspaceDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [workspaceData, projectsData, runsData] = await Promise.all([
          api.workspaces.get(id),
          api.projects.list(1, 100, id),
          api.runs.list(1, 100),
        ])
        setWorkspace(workspaceData)
        setProjects(projectsData.data)

        // Filter runs for projects in this workspace
        const projectIds = projectsData.data.map((p) => p.id)
        const workspaceRuns = runsData.data.filter((run) =>
          run.projectId && projectIds.includes(run.projectId)
        )
        setRuns(workspaceRuns)
      } catch (error) {
        console.error("Failed to load workspace:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Workspace não encontrado</p>
          <Button onClick={() => navigate("/workspaces")} className="mt-4">
            Voltar
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/workspaces")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{workspace.name}</h1>
            <Badge variant={workspace.isActive ? "default" : "secondary"}>
              {workspace.isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {workspace.description || "Sem descrição"}
          </p>
        </div>
        <Button onClick={() => navigate(`/workspaces/${id}/edit`)}>
          <PencilSimple className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Root Path</dt>
            <dd className="mt-1 font-mono text-sm">{workspace.rootPath || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Artifacts Dir</dt>
            <dd className="mt-1 font-mono text-sm">{workspace.artifactsDir}</dd>
          </div>
        </dl>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projetos</h2>
        <Button onClick={() => navigate(`/projects/new?workspaceId=${id}`)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Projeto
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Base Ref</TableHead>
              <TableHead>Target Ref</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Runs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum projeto encontrado
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="font-mono text-sm">{project.baseRef}</TableCell>
                  <TableCell className="font-mono text-sm">{project.targetRef}</TableCell>
                  <TableCell>
                    <Badge variant={project.isActive ? "default" : "secondary"}>
                      {project.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {project._count?.validationRuns || 0} run(s)
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Runs</h2>
        <Button onClick={() => navigate("/runs/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Run
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run ID</TableHead>
              <TableHead>Output ID</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gate</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhuma run encontrada
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/runs/${run.id}/v2`)}
                >
                  <TableCell className="font-mono text-sm">
                    {run.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{run.outputId}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {run.project?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    Gate {run.currentGate}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(run.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
