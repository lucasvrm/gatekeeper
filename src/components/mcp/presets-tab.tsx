import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { SessionPreset } from "@/lib/types"
import { PresetFormDialog } from "./preset-form-dialog"

export function PresetsTab() {
  const [presets, setPresets] = useState<SessionPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<SessionPreset | null>(null)

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.presets.list()
      setPresets(data)
    } catch {
      toast.error("Falha ao carregar presets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPreset(null)
    setDialogOpen(true)
  }

  const handleEdit = (preset: SessionPreset) => {
    setEditingPreset(preset)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.presets.delete(id)
      toast.success("Preset deletado com sucesso")
      await loadPresets()
    } catch {
      toast.error("Falha ao deletar preset")
    }
  }

  if (loading) {
    return (
      <div data-testid="presets-tab">
        <div data-testid="loading-skeleton" className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="presets-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Presets</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-preset-button"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          New Preset
        </button>
      </div>

      <div data-testid="presets-list" className="space-y-2">
        {presets.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum preset encontrado. Clique em "New Preset" para criar um.
          </p>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              data-testid={`preset-card-${preset.id}`}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{preset.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {preset.config.gitStrategy} / {preset.config.taskType}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    role="button"
                    onClick={() => handleEdit(preset)}
                    data-testid={`edit-button-${preset.id}`}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    role="button"
                    onClick={() => handleDelete(preset.id)}
                    data-testid={`delete-button-${preset.id}`}
                    className="text-red-600 hover:text-red-800 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {dialogOpen && (
        <PresetFormDialog
          preset={editingPreset}
          onClose={() => setDialogOpen(false)}
          onSave={loadPresets}
        />
      )}
    </div>
  )
}
