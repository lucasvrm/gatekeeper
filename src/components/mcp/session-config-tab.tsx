import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useSessionConfig } from "@/hooks/use-session-config"
import type { GitStrategy, TaskType, MCPSessionConfig } from "@/lib/types"

export function SessionConfigTab() {
  const { config, loading, saving, update } = useSessionConfig()
  const [gitStrategy, setGitStrategy] = useState<GitStrategy>("main")
  const [branch, setBranch] = useState("")
  const [taskType, setTaskType] = useState<TaskType>("bugfix")
  const [customInstructions, setCustomInstructions] = useState("")
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (config) {
      setGitStrategy(config.gitStrategy)
      setBranch(config.branch)
      setTaskType(config.taskType)
      setCustomInstructions(config.customInstructions)
      setLoadError(false)
    }
  }, [config])

  useEffect(() => {
    if (!loading && !config) {
      setLoadError(true)
      toast.error("Falha ao carregar configuração")
    }
  }, [loading, config])

  const handleSave = async () => {
    const newConfig: MCPSessionConfig = {
      gitStrategy,
      branch,
      taskType,
      projectId: null,
      customInstructions,
    }

    try {
      await update(newConfig)
      toast.success("Configuração salva com sucesso")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao salvar configuração"
      toast.error(errorMessage)
    }
  }

  if (loading) {
    return (
      <div data-testid="session-config-tab">
        <div data-testid="config-skeleton" className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div data-testid="session-config-tab">
        <div className="text-destructive">Erro ao carregar configuração</div>
      </div>
    )
  }

  return (
    <div data-testid="session-config-tab" className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Git Strategy</label>
        <div role="radiogroup" className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="main"
              checked={gitStrategy === "main"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-main"
              aria-label="main"
            />
            <span>main</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="new-branch"
              checked={gitStrategy === "new-branch"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-new-branch"
              aria-label="new branch"
            />
            <span>new branch</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              role="radio"
              name="git-strategy"
              value="existing-branch"
              checked={gitStrategy === "existing-branch"}
              onChange={(e) => setGitStrategy(e.target.value as GitStrategy)}
              data-testid="git-strategy-radio-existing-branch"
              aria-label="existing branch"
            />
            <span>existing branch</span>
          </label>
        </div>
      </div>

      {(gitStrategy === "new-branch" || gitStrategy === "existing-branch") && (
        <div>
          <label className="block text-sm font-medium mb-2">Branch</label>
          <input
            type="text"
            role="textbox"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            data-testid="branch-input"
            className="border border-input rounded-md px-3 py-2 w-full bg-background"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Task Type</label>
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value as TaskType)}
          data-testid="task-type-select"
          className="border border-input rounded-md px-3 py-2 w-full bg-background"
        >
          <option value="bugfix">Bugfix</option>
          <option value="feature">Feature</option>
          <option value="refactor">Refactor</option>
          <option value="test">Test</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Custom Instructions</label>
        <textarea
          role="textbox"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          data-testid="custom-instructions-textarea"
          className="border border-input rounded-md px-3 py-2 w-full bg-background min-h-[100px]"
          rows={4}
        />
      </div>

      <button
        role="button"
        onClick={handleSave}
        disabled={saving}
        data-testid="save-config-button"
        aria-label="Salvar"
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  )
}
