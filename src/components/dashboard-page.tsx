import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { ShieldCheck, List, CheckCircle, XCircle, Folders, FolderOpen } from "@phosphor-icons/react"
import { api } from "@/lib/api"
import type { Run, Workspace, Project } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Badge } from "@/components/ui/badge"
import { NewValidationCtaButton } from "@/components/new-validation-cta-button"

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<{
    totalRuns: number
    passed: number
    failed: number
    running: number
  } | null>(null)
  const [recentRuns, setRecentRuns] = useState<Run[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all")
  const [selectedProject, setSelectedProject] = useState<string>("all")

  useEffect(() => {
    const loadData = async () => {
      try {
        const [runsResponse, workspacesResponse, projectsResponse] = await Promise.all([
          api.runs.list(1, 5),
          api.workspaces.list(1, 100),
          api.projects.list(1, 100),
        ])

        setRecentRuns(runsResponse.data)
        setWorkspaces(workspacesResponse.data)
        setAllProjects(projectsResponse.data)
        setProjects(projectsResponse.data)

        const allRuns = await api.runs.list(1, 100)
        const passed = allRuns.data.filter((r) => r.status === "PASSED").length
        const failed = allRuns.data.filter((r) => r.status === "FAILED").length
        const running = allRuns.data.filter((r) => r.status === "RUNNING").length

        setStats({
          totalRuns: allRuns.pagination.total,
          passed,
          failed,
          running,
        })
      } catch (error) {
        console.error("Failed to load dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    // Filter projects when workspace changes
    if (selectedWorkspace === "all") {
      setProjects(allProjects)
      setSelectedProject("all")
    } else {
      const filtered = allProjects.filter((p) => p.workspaceId === selectedWorkspace)
      setProjects(filtered)
      setSelectedProject("all")
    }
  }, [selectedWorkspace, allProjects])

  const displayedProjects = selectedProject === "all"
    ? projects
    : projects.filter((p) => p.id === selectedProject)

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview de workspaces, projetos e validações
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos Workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Workspaces</SelectItem>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48" role="button">
              <SelectValue placeholder="Todos Projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Projetos</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NewValidationCtaButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Folders className="w-6 h-6 text-purple-500" weight="bold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Workspaces
              </p>
              <p className="text-3xl font-bold mt-1">{workspaces.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-blue-500" weight="bold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Projetos
              </p>
              <p className="text-3xl font-bold mt-1">{displayedProjects.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <List className="w-6 h-6 text-primary" weight="bold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Total Runs
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.totalRuns || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-passed/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-status-passed" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Passed
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.passed || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-failed/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-status-failed" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Failed
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.failed || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-status-running/10 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-status-running" weight="fill" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Running
              </p>
              <p className="text-3xl font-bold mt-1">{stats?.running || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Workspaces</h2>
          {workspaces.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum workspace encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Projetos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.slice(0, 5).map((workspace) => (
                  <TableRow
                    key={workspace.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/workspaces/${workspace.id}`)}
                  >
                    <TableCell className="font-medium">{workspace.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {workspace._count?.projects || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={workspace.isActive ? "default" : "secondary"}>
                        {workspace.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Projetos</h2>
          {displayedProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum projeto encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Runs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedProjects.slice(0, 5).map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                  >
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {project.workspace?.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {project._count?.validationRuns || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-semibold mb-4">Recent Runs</h2>
        {recentRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent runs found</p>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/runs/${run.id}/v2`)}
              >
                <div className="flex-1">
                  <p className="font-mono text-sm text-muted-foreground">
                    {run.id.substring(0, 8)}
                  </p>
                  {run.project ? (
                    <p className="font-medium mt-1">
                      {run.project.workspace?.name} / {run.project.name}
                    </p>
                  ) : (
                    <p className="font-medium mt-1 font-mono text-sm">{run.projectPath}</p>
                  )}
                  {run.taskPrompt && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="recent-run-taskPrompt">
                      {run.taskPrompt}
                    </p>
                  )}
                  {(run.commitHash || run.commitMessage) && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="recent-run-commit">
                      {[run.commitHash ? run.commitHash.slice(0, 7) : null, run.commitMessage || null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Gate {run.currentGate}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
