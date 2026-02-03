import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import { useSessionConfig } from "@/hooks/use-session-config"
import { useMCPStatus } from "@/hooks/use-mcp-status"
import type {
  GitStrategy,
  TaskType,
  MCPSessionConfig,
  PromptInstruction,
  SessionHistory,
} from "@/lib/types"

// ─────────────────────────────────────────────────────────────
//  STATUS BAR
// ─────────────────────────────────────────────────────────────

function StatusBar() {
  const { status, loading, reload } = useMCPStatus()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await reload()
    setTimeout(() => setRefreshing(false), 400)
  }

  if (loading) {
    return (
      <div
        data-testid="status-bar"
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-muted/30"
      >
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16" />
      </div>
    )
  }

  if (!status) {
    return (
      <div
        data-testid="status-bar"
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5"
      >
        <span className="text-sm text-destructive">
          Falha ao carregar status do servidor
        </span>
        <button
          onClick={handleRefresh}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const items: {
    label: string
    value: string
    color: "green" | "yellow" | "red"
    testId: string
  }[] = [
    {
      label: "API",
      value: status.gatekeeperApi,
      color: status.gatekeeperApi === "online" ? "green" : "red",
      testId: "status-api-badge",
    },
    {
      label: "DB",
      value: status.database,
      color: status.database === "connected" ? "green" : "red",
      testId: "status-db-badge",
    },
    {
      label: "Docs",
      value:
        status.docsDir === "accessible"
          ? "OK"
          : status.docsDir === "not-found"
            ? "não encontrado"
            : "não configurado",
      color:
        status.docsDir === "accessible"
          ? "green"
          : status.docsDir === "not-found"
            ? "red"
            : "yellow",
      testId: "status-docs-badge",
    },
  ]

  const dotColor = {
    green: "bg-emerald-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
  }

  return (
    <div
      data-testid="status-bar"
      className="flex items-center gap-4 px-4 py-2.5 rounded-lg border border-border bg-muted/30"
    >
      <span className="text-sm font-medium text-muted-foreground mr-1">
        MCP Server
      </span>

      {items.map((item) => (
        <div
          key={item.testId}
          className="flex items-center gap-1.5"
          data-testid={item.testId}
          title={item.value}
        >
          <span
            className={cn("size-2 rounded-full shrink-0", dotColor[item.color])}
          />
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">📌</span>
        <span
          className="text-xs font-mono text-foreground"
          data-testid="status-git-badge"
        >
          {status.git}
        </span>
      </div>

      <button
        onClick={handleRefresh}
        disabled={refreshing}
        data-testid="refresh-status-button"
        className={cn(
          "ml-auto text-muted-foreground hover:text-foreground transition-all",
          refreshing && "animate-spin"
        )}
        title="Atualizar status"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SESSION SECTION
// ─────────────────────────────────────────────────────────────

function SessionSection() {
  const { config, loading, saving, update } = useSessionConfig()
  const { status } = useMCPStatus()

  const [docsDir, setDocsDir] = useState("")
  const [gitStrategy, setGitStrategy] = useState<GitStrategy>("main")
  const [branch, setBranch] = useState("")
  const [taskType, setTaskType] = useState<TaskType>("bugfix")
  const [customInstructions, setCustomInstructions] = useState("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (config) {
      setDocsDir(config.docsDir || "")
      setGitStrategy(config.gitStrategy || "main")
      setBranch(config.branch || "")
      setTaskType(config.taskType || "bugfix")
      setCustomInstructions(config.customInstructions || "")
      setDirty(false)
    }
  }, [config])

  const markDirty = () => setDirty(true)

  const handleSave = async () => {
    const newConfig: MCPSessionConfig = {
      docsDir,
      gitStrategy,
      branch: gitStrategy === "main" ? "main" : branch,
      taskType,
      projectId: null,
      customInstructions,
    }

    try {
      await update(newConfig)
      toast.success("Sessão salva")
      setDirty(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar sessão"
      )
    }
  }

  const docsDirInvalid = status?.docsDir === "not-found"
  const branchDisabled = gitStrategy === "main"

  if (loading) {
    return (
      <section data-testid="session-section" className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Sessão
        </h2>
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </section>
    )
  }

  return (
    <section data-testid="session-section" className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Sessão
      </h2>

      {/* Row 1: TaskType + GitStrategy + Branch — inline */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">
            Task Type
          </label>
          <Select
            value={taskType}
            onValueChange={(v: string) => {
              setTaskType(v as TaskType)
              markDirty()
            }}
          >
            <SelectTrigger data-testid="task-type-select" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bugfix">Bugfix</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="refactor">Refactor</SelectItem>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">
            Git Strategy
          </label>
          <Select
            value={gitStrategy}
            onValueChange={(v: string) => {
              const strategy = v as GitStrategy
              setGitStrategy(strategy)
              if (strategy === "main") setBranch("main")
              markDirty()
            }}
          >
            <SelectTrigger
              data-testid="git-strategy-select"
              className="w-[180px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main (direto)</SelectItem>
              <SelectItem value="new-branch">new branch</SelectItem>
              <SelectItem value="existing-branch">existing branch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">
            Branch
          </label>
          <Input
            value={branchDisabled ? "main" : branch}
            onChange={(e) => {
              setBranch(e.target.value)
              markDirty()
            }}
            disabled={branchDisabled}
            placeholder="feat/minha-feature"
            data-testid="branch-input"
            className={cn(
              "font-mono text-sm",
              branchDisabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>
      </div>

      {/* Docs Directory */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          📁 Docs Directory
        </label>
        <Input
          value={docsDir}
          onChange={(e) => {
            setDocsDir(e.target.value)
            markDirty()
          }}
          placeholder="C:\Coding\gatekeeper\docs"
          data-testid="docs-dir-input"
          className={cn(
            "font-mono text-sm",
            docsDirInvalid &&
              "border-yellow-500 focus-visible:border-yellow-500 focus-visible:ring-yellow-500/30"
          )}
        />
        {docsDirInvalid && (
          <p className="text-xs text-yellow-500">
            Diretório não encontrado no filesystem
          </p>
        )}
      </div>

      {/* Custom Instructions */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Instruções Customizadas
        </label>
        <textarea
          value={customInstructions}
          onChange={(e) => {
            setCustomInstructions(e.target.value)
            markDirty()
          }}
          placeholder="Sempre use português nos commits..."
          data-testid="custom-instructions-textarea"
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 resize-y"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          data-testid="save-config-button"
          size="sm"
        >
          {saving ? "Salvando..." : "Salvar sessão"}
        </Button>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
//  PROMPT INSTRUCTIONS SECTION
// ─────────────────────────────────────────────────────────────

function PromptInstructionsSection() {
  const [prompts, setPrompts] = useState<PromptInstruction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline create state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newContent, setNewContent] = useState("")
  const [savingNew, setSavingNew] = useState(false)

  // Inline edit state
  const [editName, setEditName] = useState("")
  const [editContent, setEditContent] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const editNameRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.mcp.prompts.list()
      setPrompts(data)
    } catch {
      toast.error("Falha ao carregar prompts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Focus name input on create
  useEffect(() => {
    if (creating) nameInputRef.current?.focus()
  }, [creating])

  // Focus name input on edit
  useEffect(() => {
    if (editingId) editNameRef.current?.focus()
  }, [editingId])

  const handleToggle = async (prompt: PromptInstruction) => {
    try {
      await api.mcp.prompts.update(prompt.id, { isActive: !prompt.isActive })
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === prompt.id ? { ...p, isActive: !p.isActive } : p
        )
      )
    } catch {
      toast.error("Falha ao atualizar prompt")
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return
    setSavingNew(true)
    try {
      await api.mcp.prompts.create({
        name: newName.trim(),
        content: newContent.trim(),
      })
      toast.success("Prompt criado")
      setCreating(false)
      setNewName("")
      setNewContent("")
      reload()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao criar prompt"
      )
    } finally {
      setSavingNew(false)
    }
  }

  const startEdit = (prompt: PromptInstruction) => {
    setEditingId(prompt.id)
    setEditName(prompt.name)
    setEditContent(prompt.content)
    setExpandedId(prompt.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
    setEditContent("")
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || !editContent.trim()) return
    setSavingEdit(true)
    try {
      await api.mcp.prompts.update(editingId, {
        name: editName.trim(),
        content: editContent.trim(),
      })
      toast.success("Prompt atualizado")
      cancelEdit()
      reload()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao atualizar prompt"
      )
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.prompts.delete(id)
      toast.success("Prompt removido")
      setDeletingId(null)
      reload()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao remover prompt"
      )
    }
  }

  if (loading) {
    return (
      <section data-testid="prompts-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Prompt Instructions
          </h2>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </section>
    )
  }

  return (
    <section data-testid="prompts-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Prompt Instructions
        </h2>
        {!creating && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            data-testid="add-prompt-button"
          >
            + Nova
          </Button>
        )}
      </div>

      {/* Inline create form */}
      {creating && (
        <div
          className="border border-primary/30 rounded-md p-4 space-y-3 bg-primary/5"
          data-testid="prompt-create-form"
        >
          <Input
            ref={nameInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome (ex: regras-de-estilo)"
            data-testid="prompt-name-input"
            className="text-sm"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Escreva a instrução em linguagem natural..."
            data-testid="prompt-content-textarea"
            rows={4}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none dark:bg-input/30 font-mono resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false)
                setNewName("")
                setNewContent("")
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={savingNew || !newName.trim() || !newContent.trim()}
              data-testid="prompt-save-button"
            >
              {savingNew ? "Salvando..." : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {prompts.length === 0 && !creating && (
        <div className="text-center py-8 border border-dashed border-border rounded-md">
          <p className="text-sm text-muted-foreground mb-2">
            Nenhuma instrução configurada.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Prompts do MCP usarão apenas os docs locais.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
          >
            + Criar primeira
          </Button>
        </div>
      )}

      {/* Prompt list */}
      {prompts.length > 0 && (
        <div className="border border-border rounded-md divide-y divide-border">
          {prompts.map((prompt) => {
            const isEditing = editingId === prompt.id
            const isExpanded = expandedId === prompt.id
            const isDeleting = deletingId === prompt.id

            return (
              <div key={prompt.id} data-testid={`prompt-item-${prompt.id}`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <Switch
                    checked={prompt.isActive}
                    onCheckedChange={() => handleToggle(prompt)}
                    data-testid={`prompt-toggle-${prompt.id}`}
                  />

                  <button
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                    onClick={() => {
                      if (isEditing) return
                      setExpandedId(isExpanded ? null : prompt.id)
                    }}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        !prompt.isActive && "text-muted-foreground"
                      )}
                    >
                      {prompt.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline max-w-[300px]">
                      {prompt.content.slice(0, 60)}
                      {prompt.content.length > 60 ? "…" : ""}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {isDeleting ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(prompt.id)}
                          className="h-7 text-xs"
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(null)}
                          className="h-7 text-xs"
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(prompt)}
                          className="h-7 text-xs px-2"
                          title="Editar"
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(prompt.id)}
                          className="h-7 text-xs px-2 hover:text-destructive"
                          title="Remover"
                        >
                          🗑️
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded content / inline edit */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border pt-3">
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          ref={editNameRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm"
                          data-testid="prompt-edit-name"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={6}
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none dark:bg-input/30 font-mono resize-y"
                          data-testid="prompt-edit-content"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={
                              savingEdit ||
                              !editName.trim() ||
                              !editContent.trim()
                            }
                            data-testid="prompt-edit-save"
                          >
                            {savingEdit ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                        {prompt.content}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
//  HISTORY SECTION (collapsible)
// ─────────────────────────────────────────────────────────────

function HistorySection() {
  const [history, setHistory] = useState<SessionHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)

  const loadHistory = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const data = await api.mcp.history.list()
      setHistory(data)
      setLoaded(true)
    } catch {
      toast.error("Falha ao carregar histórico")
    } finally {
      setLoading(false)
    }
  }, [loaded])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !loaded) loadHistory()
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.history.delete(id)
      setHistory((prev) => prev.filter((h) => h.id !== id))
      toast.success("Entrada removida")
    } catch {
      toast.error("Falha ao deletar entrada")
    }
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        className="flex items-center gap-2 w-full text-left group"
        data-testid="history-trigger"
      >
        <span className="text-xs text-muted-foreground transition-transform group-data-[state=open]:rotate-90">
          ▶
        </span>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico de Sessões
        </h2>
        {loaded && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {history.length}
          </Badge>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent data-testid="history-content">
        <div className="mt-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}

          {loaded && history.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum histórico de sessão encontrado.
            </p>
          )}

          {loaded && history.length > 0 && (
            <div
              className="border border-border rounded-md divide-y divide-border"
              data-testid="history-list"
            >
              {history.map((item) => (
                <div
                  key={item.id}
                  data-testid={`history-item-${item.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {item.taskType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.gitStrategy}
                    </span>
                    {item.branch && (
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                        {item.branch}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="h-6 text-xs px-1.5 hover:text-destructive"
                      data-testid={`delete-button-${item.id}`}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────

export function MCPSessionPage() {
  return (
    <div data-testid="mcp-session-page" className="space-y-8">
      <StatusBar />

      <SessionSection />

      <div className="border-t border-border" />

      <PromptInstructionsSection />

      <div className="border-t border-border" />

      <HistorySection />
    </div>
  )
}
