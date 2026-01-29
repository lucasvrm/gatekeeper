import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { SessionPreset, MCPSessionConfig, GitStrategy, TaskType } from "@/lib/types"

interface PresetFormDialogProps {
  preset: SessionPreset | null
  onClose: () => void
  onSave: () => void
}

const defaultConfig: MCPSessionConfig = {
  gitStrategy: "main",
  branch: "",
  taskType: "bugfix",
  projectId: null,
  customInstructions: "",
}

export function PresetFormDialog({ preset, onClose, onSave }: PresetFormDialogProps) {
  const [name, setName] = useState(preset?.name || "")
  const [config, setConfig] = useState<MCPSessionConfig>(preset?.config || defaultConfig)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (preset) {
        await api.mcp.presets.update(preset.id, { name, config })
        toast.success("Preset atualizado com sucesso")
      } else {
        await api.mcp.presets.create({ name, config })
        toast.success("Preset criado com sucesso")
      }
      onSave()
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar preset"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (key: keyof MCPSessionConfig, value: string | null) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div
      role="dialog"
      data-testid="preset-form-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-background border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold">{preset ? "Edit Preset" : "New Preset"}</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Name</label>
          <input
            type="text"
            role="textbox"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="preset-name-input"
            className="border rounded px-3 py-2 w-full bg-background"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Git Strategy</label>
          <select
            value={config.gitStrategy}
            onChange={(e) => updateConfig("gitStrategy", e.target.value as GitStrategy)}
            data-testid="preset-git-strategy-select"
            className="border rounded px-3 py-2 w-full bg-background"
          >
            <option value="main">Main</option>
            <option value="new-branch">New Branch</option>
            <option value="existing-branch">Existing Branch</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Task Type</label>
          <select
            value={config.taskType}
            onChange={(e) => updateConfig("taskType", e.target.value as TaskType)}
            data-testid="preset-task-type-select"
            className="border rounded px-3 py-2 w-full bg-background"
          >
            <option value="bugfix">Bugfix</option>
            <option value="feature">Feature</option>
            <option value="refactor">Refactor</option>
            <option value="test">Test</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Branch Name</label>
          <input
            type="text"
            role="textbox"
            value={config.branch}
            onChange={(e) => updateConfig("branch", e.target.value)}
            data-testid="preset-branch-input"
            className="border rounded px-3 py-2 w-full bg-background"
            placeholder="feature/my-branch"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Custom Instructions</label>
          <textarea
            role="textbox"
            value={config.customInstructions}
            onChange={(e) => updateConfig("customInstructions", e.target.value)}
            data-testid="preset-instructions-textarea"
            className="border rounded px-3 py-2 w-full bg-background"
            rows={3}
          />
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <button
            role="button"
            onClick={onClose}
            data-testid="cancel-button"
            className="px-4 py-2 border rounded hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            role="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-button"
            className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
