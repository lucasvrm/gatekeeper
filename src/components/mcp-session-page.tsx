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
  SessionProfile,
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
//  SESSION SECTION (grid row 1) — profile-aware
// ─────────────────────────────────────────────────────────────

function SessionSection({
  profiles,
  activeProfileId,
  onProfileChange,
  onProfilesChange,
}: {
  profiles: SessionProfile[]
  activeProfileId: string | null
  onProfileChange: (id: string | null) => void
  onProfilesChange: () => void
}) {
  const { config, loading, saving, update } = useSessionConfig()
  const { status } = useMCPStatus()

  const [docsDir, setDocsDir] = useState("")
  const [gitStrategy, setGitStrategy] = useState<GitStrategy>("main")
  const [branch, setBranch] = useState("")
  const [taskType, setTaskType] = useState<TaskType>("bugfix")
  const [dirty, setDirty] = useState(false)

  // Creating new profile
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")
  const newProfileRef = useRef<HTMLInputElement>(null)

  // Deleting profile
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null)

  // Load from config on mount
  useEffect(() => {
    if (config) {
      setDocsDir(config.docsDir || "")
      setGitStrategy(config.gitStrategy || "main")
      setBranch(config.branch || "")
      setTaskType(config.taskType || "bugfix")
      setDirty(false)
    }
  }, [config])

  // When profile changes, populate fields from profile
  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return

    setTaskType(profile.taskType as TaskType)
    setGitStrategy(profile.gitStrategy as GitStrategy)
    setBranch(profile.branch || "")
    setDocsDir(profile.docsDir || "")
    onProfileChange(profileId)
    setDirty(true)
  }

  useEffect(() => {
    if (creatingProfile) newProfileRef.current?.focus()
  }, [creatingProfile])

  const markDirty = () => setDirty(true)

  const handleSave = async () => {
    const newConfig: MCPSessionConfig = {
      activeProfileId,
      docsDir,
      gitStrategy,
      branch: gitStrategy === "main" ? "main" : branch,
      taskType,
      projectId: null,
    }

    try {
      // Save session config
      await update(newConfig)

      // If there's an active profile, also update the profile fields
      if (activeProfileId) {
        await api.mcp.profiles.update(activeProfileId, {
          taskType,
          gitStrategy,
          branch: gitStrategy === "main" ? null : branch,
          docsDir: docsDir || null,
        })
        onProfilesChange()
      }

      toast.success("Sessão salva")
      setDirty(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao salvar sessão"
      )
    }
  }

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return
    try {
      const profile = await api.mcp.profiles.create({
        name: newProfileName.trim(),
        taskType,
        gitStrategy,
        branch: gitStrategy === "main" ? undefined : branch,
        docsDir: docsDir || undefined,
      })
      toast.success("Perfil criado")
      setCreatingProfile(false)
      setNewProfileName("")
      onProfilesChange()
      onProfileChange(profile.id)
      setDirty(true)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao criar perfil"
      )
    }
  }

  const handleDeleteProfile = async (id: string) => {
    try {
      await api.mcp.profiles.delete(id)
      toast.success("Perfil removido")
      setDeletingProfileId(null)
      if (activeProfileId === id) onProfileChange(null)
      onProfilesChange()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao remover perfil"
      )
    }
  }

  const docsDirInvalid = status?.docsDir === "not-found"
  const branchDisabled = gitStrategy === "main"

  if (loading) {
    return (
      <section data-testid="session-section" className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
      </section>
    )
  }

  return (
    <section data-testid="session-section">
      <div className="grid grid-cols-2 gap-6">
        {/* Left column: Profile, Task Type, Git Strategy, Branch */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Sessão
          </h2>

          {/* Profile selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Perfil
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={activeProfileId || "__none__"}
                onValueChange={(v) => {
                  if (v === "__none__") {
                    onProfileChange(null)
                    markDirty()
                  } else {
                    handleProfileSelect(v)
                  }
                }}
              >
                <SelectTrigger data-testid="profile-select" className="flex-1">
                  <SelectValue placeholder="Sem perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem perfil</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!creatingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatingProfile(true)}
                  data-testid="create-profile-button"
                  className="shrink-0 h-9 px-2.5"
                  title="Novo perfil"
                >
                  +
                </Button>
              )}

              {activeProfileId && !deletingProfileId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingProfileId(activeProfileId)}
                  className="shrink-0 h-9 px-2.5 hover:text-destructive"
                  title="Remover perfil"
                >
                  🗑️
                </Button>
              )}
            </div>

            {/* Inline create profile */}
            {creatingProfile && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  ref={newProfileRef}
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Nome do perfil"
                  className="text-sm flex-1"
                  data-testid="new-profile-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProfile()
                    if (e.key === "Escape") {
                      setCreatingProfile(false)
                      setNewProfileName("")
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCreateProfile}
                  disabled={!newProfileName.trim()}
                  className="h-9"
                >
                  Criar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreatingProfile(false)
                    setNewProfileName("")
                  }}
                  className="h-9"
                >
                  ✕
                </Button>
              </div>
            )}

            {/* Confirm delete profile */}
            {deletingProfileId && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
                <span className="text-xs text-destructive flex-1">
                  Remover perfil "{profiles.find((p) => p.id === deletingProfileId)?.name}"?
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteProfile(deletingProfileId)}
                  className="h-7 text-xs"
                >
                  Confirmar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingProfileId(null)}
                  className="h-7 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
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
              <SelectTrigger data-testid="task-type-select" className="w-full">
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

          <div className="space-y-1.5">
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
                className="w-full"
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

          <div className="space-y-1.5">
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

        {/* Right column: Docs Directory */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Docs Directory
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              📁 Caminho raiz dos playbooks
            </label>
            <Input
              value={docsDir}
              onChange={(e) => {
                setDocsDir(e.target.value)
                markDirty()
              }}
              placeholder="C:\Coding\gatekeeper-docs"
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

          <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground font-mono space-y-1">
            <p className="font-sans text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">
              Estrutura esperada
            </p>
            <p>
              <span className="text-foreground/70">└─</span> create_plan/
              <span className="font-sans text-muted-foreground/60 ml-2">← planner</span>
            </p>
            <p>
              <span className="text-foreground/70">└─</span> generate_spec/
              <span className="font-sans text-muted-foreground/60 ml-2">← spec writer</span>
            </p>
          </div>
        </div>
      </div>

      {/* Save button spanning full width */}
      <div className="flex justify-end mt-4">
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
//  PROMPT INSTRUCTIONS — profile-aware
// ─────────────────────────────────────────────────────────────

function PromptInstructionsSection({
  activeProfileId,
  profiles,
  onProfilesChange,
}: {
  activeProfileId: string | null
  profiles: SessionProfile[]
  onProfilesChange: () => void
}) {
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

  // Get linked prompt IDs for active profile
  const activeProfile = profiles.find((p) => p.id === activeProfileId)
  const linkedPromptIds = new Set(
    activeProfile?.prompts.map((p) => p.id) ?? []
  )

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.mcp.prompts.list('session')
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

  useEffect(() => {
    if (creating) nameInputRef.current?.focus()
  }, [creating])

  useEffect(() => {
    if (editingId) editNameRef.current?.focus()
  }, [editingId])

  const handleToggleLink = async (promptId: string) => {
    if (!activeProfileId) return

    const newLinked = linkedPromptIds.has(promptId)
      ? [...linkedPromptIds].filter((id) => id !== promptId)
      : [...linkedPromptIds, promptId]

    try {
      await api.mcp.profiles.setPrompts(activeProfileId, newLinked)
      onProfilesChange()
    } catch {
      toast.error("Falha ao atualizar vínculo")
    }
  }

  const handleToggleActive = async (prompt: PromptInstruction) => {
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
      const created = await api.mcp.prompts.create({
        name: newName.trim(),
        content: newContent.trim(),
      })
      toast.success("Prompt criado")

      // Auto-link to active profile
      if (activeProfileId) {
        await api.mcp.profiles.setPrompts(activeProfileId, [
          ...linkedPromptIds,
          created.id,
        ])
        onProfilesChange()
      }

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
      onProfilesChange() // refresh profile links
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

      {activeProfileId ? (
        <p className="text-xs text-muted-foreground">
          Checkboxes vinculam prompts ao perfil <strong>{activeProfile?.name}</strong>. Apenas prompts vinculados e ativos são injetados.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Selecione um perfil para vincular prompts. Sem perfil, todos os prompts ativos são injetados.
        </p>
      )}

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
            const isLinked = linkedPromptIds.has(prompt.id)

            return (
              <div key={prompt.id} data-testid={`prompt-item-${prompt.id}`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {/* Profile link checkbox (only when profile is active) */}
                  {activeProfileId && (
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => handleToggleLink(prompt.id)}
                      className="size-3.5 rounded border-border accent-primary cursor-pointer"
                      data-testid={`prompt-link-${prompt.id}`}
                      title={isLinked ? "Desvincular do perfil" : "Vincular ao perfil"}
                    />
                  )}

                  <Switch
                    checked={prompt.isActive}
                    onCheckedChange={() => handleToggleActive(prompt)}
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
//  HISTORY SECTION
// ─────────────────────────────────────────────────────────────

function HistorySection() {
  const [history, setHistory] = useState<SessionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.history.list()
      setHistory(data)
    } catch {
      toast.error("Falha ao carregar histórico")
    } finally {
      setLoading(false)
    }
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

  if (loading) {
    return (
      <section data-testid="history-section" className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico de Sessões
        </h2>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </section>
    )
  }

  return (
    <section data-testid="history-section" className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Histórico de Sessões
        </h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {history.length}
        </Badge>
      </div>

      {history.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
          Nenhum histórico de sessão encontrado.
        </p>
      )}

      {history.length > 0 && (
        <div
          className="border border-border rounded-md divide-y divide-border"
          data-testid="history-list"
        >
          {history.map((item) => (
            <div
              key={item.id}
              data-testid={`history-item-${item.id}`}
              className="flex items-center justify-between px-3 py-2 text-sm gap-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {item.taskType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {item.gitStrategy}
                </span>
                {item.branch && (
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                    {item.branch}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {item.status}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
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
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────

export function MCPSessionPage() {
  const { config } = useSessionConfig()
  const [profiles, setProfiles] = useState<SessionProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [profilesLoading, setProfilesLoading] = useState(true)

  const loadProfiles = useCallback(async () => {
    try {
      const data = await api.mcp.profiles.list()
      setProfiles(data)
    } catch {
      toast.error("Falha ao carregar perfis")
    } finally {
      setProfilesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  // Sync activeProfileId from session config
  useEffect(() => {
    if (config?.activeProfileId) {
      setActiveProfileId(config.activeProfileId)
    }
  }, [config])

  if (profilesLoading) {
    return (
      <div data-testid="mcp-session-page" className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="mcp-session-page" className="space-y-6">
      {/* Status bar */}
      <StatusBar />

      {/* Row 1: Session config (left) + Docs directory (right) */}
      <SessionSection
        profiles={profiles}
        activeProfileId={activeProfileId}
        onProfileChange={setActiveProfileId}
        onProfilesChange={loadProfiles}
      />

      <div className="border-t border-border" />

      {/* Row 2: Prompt Instructions (left) + History (right) */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <PromptInstructionsSection
          activeProfileId={activeProfileId}
          profiles={profiles}
          onProfilesChange={loadProfiles}
        />
        <HistorySection />
      </div>
    </div>
  )
}
