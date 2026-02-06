import { useState } from "react"
import { api } from "@/lib/api"
import type { ProviderModel, ProviderInfo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { X, Plus } from "lucide-react"

interface ProviderModelsManagerProps {
  models: ProviderModel[]
  providers: ProviderInfo[]
  onModelAdded: (model: ProviderModel) => void
  onModelDeleted: (id: string) => void
}

export function ProviderModelsManager({ models, providers, onModelAdded, onModelDeleted }: ProviderModelsManagerProps) {
  const [newModelInputs, setNewModelInputs] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showAddInput, setShowAddInput] = useState<Record<string, boolean>>({})

  const modelsByProvider = providers.map(p => ({
    ...p,
    dbModels: models.filter(m => m.provider === p.name),
  }))

  const handleAdd = async (provider: string) => {
    const modelId = newModelInputs[provider]?.trim()
    if (!modelId) return

    setAdding(provider)
    try {
      const created = await api.mcp.models.create({ provider, modelId })
      onModelAdded(created)
      setNewModelInputs(prev => ({ ...prev, [provider]: '' }))
      setShowAddInput(prev => ({ ...prev, [provider]: false }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add model")
    } finally {
      setAdding(null)
    }
  }

  const handleDelete = async (model: ProviderModel) => {
    setDeleting(model.id)
    try {
      await api.mcp.models.delete(model.id)
      onModelDeleted(model.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove model")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {modelsByProvider.map(p => (
        <div key={p.name} className="border rounded-lg p-3 space-y-2">
          {/* Provider header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{p.label}</span>
              <span className={`inline-block w-2 h-2 rounded-full ${p.configured ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                title={p.configured ? 'API key configured' : 'Not configured'}
              />
            </div>
            <button
              onClick={() => setShowAddInput(prev => ({ ...prev, [p.name]: !prev[p.name] }))}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Add model"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Model tags */}
          <div className="flex flex-wrap gap-1.5">
            {p.dbModels.map(model => (
              <span
                key={model.id}
                className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded group font-mono"
              >
                {model.modelId}
                <button
                  onClick={() => handleDelete(model)}
                  disabled={deleting === model.id}
                  className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {p.dbModels.length === 0 && (
              <span className="text-xs text-muted-foreground italic">No models</span>
            )}
          </div>

          {/* Inline add input */}
          {showAddInput[p.name] && (
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                value={newModelInputs[p.name] || ''}
                onChange={(e) => setNewModelInputs(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder="model-id"
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd(p.name)
                  if (e.key === 'Escape') setShowAddInput(prev => ({ ...prev, [p.name]: false }))
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={() => handleAdd(p.name)}
                disabled={adding === p.name || !newModelInputs[p.name]?.trim()}
              >
                {adding === p.name ? '...' : 'Add'}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
