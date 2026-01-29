import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import type { Project, Run } from "@/lib/types"
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

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!id) return

    setLoading(true)
    try {
      const [projectData, runsData] = await Promise.all([
        api.projects.get(id),
        api.runs.list(1, 100),
      ])
      setProject(projectData)

      // Filter runs for this project
      const projectRuns = runsData.data.filter((run) => run.projectId === id)
      setRuns(projectRuns)
    } catch (error) {
      console.error("Failed to load project:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button onClick={() => navigate("/projects")} className="mt-4">
            Voltar
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Badge variant={project.isActive ? "default" : "secondary"}>
              {project.isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {project.description || "Sem descrição"}
          </p>
          {project.workspace && (
            <p className="text-sm text-muted-foreground mt-1">
              Workspace: <span className="font-medium">{project.workspace.name}</span>
            </p>
          )}
        </div>
        <Button onClick={() => navigate(`/projects/${id}/edit`)}>
          <PencilSimple className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Base Ref</dt>
            <dd className="mt-1 font-mono text-sm">{project.baseRef}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Target Ref</dt>
            <dd className="mt-1 font-mono text-sm">{project.targetRef}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Backend Workspace</dt>
            <dd className="mt-1 font-mono text-sm">{project.backendWorkspace || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Total Runs</dt>
            <dd className="mt-1 font-mono text-sm">{runs.length}</dd>
          </div>
        </dl>
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
              <TableHead>Status</TableHead>
              <TableHead>Gate</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma run encontrada
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/runs/${run.id}`)}
                >
                  <TableCell className="font-mono text-sm">
                    {run.id.substring(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{run.outputId}</TableCell>
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
