import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { ProviderModel, ProviderInfo, Provider } from "@/lib/types"
import { PhaseConfigTab } from "./phase-config-tab"
import { ProviderModelsManager } from "./provider-models-manager"
import { ProviderManager } from "./provider-manager"
import { ModelDiscoveryTerminal } from "./model-discovery-terminal"
import { toast } from "sonner"

export function AgentsTab() {
  const [models, setModels] = useState<ProviderModel[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [allProviders, setAllProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [modelsData, providersData, allProvidersData] = await Promise.all([
        api.mcp.models.list(),
        api.mcp.providers.list(),
        api.mcp.providers.listAll(),
      ])
      setModels(modelsData)
      setProviders(providersData)
      setAllProviders(allProvidersData)
    } catch (err) {
      console.error('Failed to load agents config:', err)
      toast.error("Failed to load agent configuration")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleModelAdded = (model: ProviderModel) => {
    setModels(prev => [...prev, model])
  }

  const handleModelDeleted = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id))
  }

  // Build modelsByProvider for PhaseConfigTab
  const modelsByProvider: Record<string, string[]> = {}
  for (const m of models.filter(m => m.isActive)) {
    if (!modelsByProvider[m.provider]) modelsByProvider[m.provider] = []
    modelsByProvider[m.provider].push(m.modelId)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ── Left Column: Providers + Model Registry + Discovery ── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Providers
          </h3>
          <ProviderManager providers={allProviders} onChanged={loadData} />
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Model Registry
          </h3>
          <ProviderModelsManager
            models={models}
            providers={providers}
            onModelAdded={handleModelAdded}
            onModelDeleted={handleModelDeleted}
          />
        </div>

        <ModelDiscoveryTerminal
          existingModels={models}
          onModelAdded={handleModelAdded}
        />
      </div>

      {/* ── Right Column: Pipeline Phases ── */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Pipeline Phases
        </h3>
        <PhaseConfigTab
          modelsByProvider={modelsByProvider}
          providers={providers.map(p => ({ value: p.name, label: p.label }))}
        />
      </div>
    </div>
  )
}

