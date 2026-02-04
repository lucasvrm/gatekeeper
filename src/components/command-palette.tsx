import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { api } from "@/lib/api"
import type { ConfigItem, Project, Run, Workspace } from "@/lib/types"

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ListResult<T> = { data: T[] }

const ensureResizeObserver = () => {
  if (typeof window === "undefined") return
  if (typeof window.ResizeObserver !== "undefined") return
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

const ensureScrollIntoView = () => {
  if (typeof window === "undefined") return
  if (typeof HTMLElement === "undefined") return
  if (HTMLElement.prototype.scrollIntoView) return
  HTMLElement.prototype.scrollIntoView = () => {}
}

const PAGES = [
  { label: "Dashboard", path: "/", keywords: ["home", "inicio"] },
  { label: "Runs", path: "/runs", keywords: ["validacoes", "execucoes"] },
  { label: "Gates", path: "/gates", keywords: ["portoes", "validators"] },
  { label: "Workspaces", path: "/workspaces", keywords: ["espacos"] },
  { label: "Projects", path: "/projects", keywords: ["projetos"] },
  { label: "MCP", path: "/mcp", keywords: ["session", "claude"] },
  { label: "Config", path: "/config", keywords: ["configuracao", "settings"] },
]

const ACTIONS = [
  { label: "Nova Validação", path: "/runs/new", keywords: ["new run", "criar run"] },
  { label: "Criar Projeto", path: "/projects/new", keywords: ["new project"] },
  { label: "Criar Workspace", path: "/workspaces/new", keywords: ["new workspace"] },
]

const buildValue = (label: string, keywords: string[] = []) => {
  return [label, ...keywords].join(" ")
}

const normalizeList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object" && "data" in (value as ListResult<T>)) {
    const data = (value as ListResult<T>).data
    if (Array.isArray(data)) return data
  }
  return []
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  ensureResizeObserver()
  ensureScrollIntoView()

  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(open)
  const [runs, setRuns] = useState<Run[] | null | undefined>(undefined)
  const [projects, setProjects] = useState<Project[] | null | undefined>(undefined)
  const [workspaces, setWorkspaces] = useState<Workspace[] | null | undefined>(undefined)
  const [validators, setValidators] = useState<ConfigItem[] | null | undefined>(undefined)

  useEffect(() => {
    setInternalOpen(open)
  }, [open])

  useEffect(() => {
    if (!internalOpen) return

    let active = true
    setRuns(undefined)
    setProjects(undefined)
    setWorkspaces(undefined)
    setValidators(undefined)

    const loadRuns = async () => {
      try {
        const response = await api.runs.list(1, 10)
        if (!active) return
        setRuns(normalizeList<Run>(response))
      } catch {
        if (active) setRuns(null)
      }
    }

    const loadProjects = async () => {
      try {
        const response = await api.projects.list(1, 20)
        if (!active) return
        setProjects(normalizeList<Project>(response))
      } catch {
        if (active) setProjects(null)
      }
    }

    const loadWorkspaces = async () => {
      try {
        const response = await api.workspaces.list()
        if (!active) return
        setWorkspaces(normalizeList<Workspace>(response))
      } catch {
        if (active) setWorkspaces(null)
      }
    }

    const loadValidators = async () => {
      try {
        const response = await api.validators.list()
        if (!active) return
        setValidators(normalizeList<ConfigItem>(response))
      } catch {
        if (active) setValidators(null)
      }
    }

    loadRuns()
    loadProjects()
    loadWorkspaces()
    loadValidators()

    return () => {
      active = false
    }
  }, [internalOpen])

  const handleSelect = useCallback(
    (path: string) => {
      navigate(path)
      setInternalOpen(false)
      onOpenChange(false)
    },
    [navigate, onOpenChange]
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setInternalOpen(nextOpen)
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  return (
    <div data-testid="command-palette">
      <CommandDialog open={internalOpen} onOpenChange={handleOpenChange}>
        <CommandInput placeholder="Buscar..." autoFocus />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Pages">
            {PAGES.map((page) => (
              <CommandItem
                key={page.path}
                value={buildValue(page.label, page.keywords)}
                onSelect={() => handleSelect(page.path)}
              >
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Actions">
            {ACTIONS.map((action) => (
              <CommandItem
                key={action.path}
                value={buildValue(action.label, action.keywords)}
                onSelect={() => handleSelect(action.path)}
              >
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {runs && runs.length > 0 ? (
            <CommandGroup heading="Recent Runs">
              {runs.map((run) => (
                <CommandItem
                  key={run.id}
                  value={buildValue(run.outputId, [run.taskPrompt ?? "", run.status])}
                  onSelect={() => handleSelect(`/runs/${run.id}/v2`)}
                >
                  <span>{run.outputId}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{run.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {projects && projects.length > 0 ? (
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={buildValue(project.name, [project.description ?? "", project.workspace?.name ?? ""])}
                  onSelect={() => handleSelect(`/projects/${project.id}`)}
                >
                  <span>{project.name}</span>
                  {project.workspace?.name ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {project.workspace.name}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {workspaces && workspaces.length > 0 ? (
            <CommandGroup heading="Workspaces">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={buildValue(workspace.name, [workspace.description ?? "", workspace.rootPath ?? ""])}
                  onSelect={() => handleSelect(`/workspaces/${workspace.id}`)}
                >
                  <span>{workspace.name}</span>
                  {workspace.rootPath ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {workspace.rootPath}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {validators && validators.length > 0 ? (
            <CommandGroup heading="Validators">
              {validators.map((validator) => (
                <CommandItem
                  key={validator.id}
                  value={buildValue(validator.key, [validator.description ?? "", validator.category ?? ""])}
                  onSelect={() => handleSelect("/gates")}
                >
                  <span>{validator.key}</span>
                  {validator.description ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {validator.description}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </div>
  )
}
