import { useState } from "react"
import { api } from "@/lib/api"
import type { ProviderModel, ModelDiscoveryResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Search, Check } from "lucide-react"

interface ModelDiscoveryTerminalProps {
  existingModels: ProviderModel[]
  onModelAdded: (model: ProviderModel) => void
}

type DiscoverProvider = 'anthropic' | 'openai' | 'mistral'

export function ModelDiscoveryTerminal({ existingModels, onModelAdded }: ModelDiscoveryTerminalProps) {
  const [provider, setProvider] = useState<DiscoverProvider>('openai')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ModelDiscoveryResult | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const handleDiscover = async () => {
    setLoading(true)
    setResult(null)
    try {
      const data = await api.mcp.models.discover(provider)
      setResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed")
    } finally {
      setLoading(false)
    }
  }

  const extractModelIds = (data: unknown): string[] => {
    if (!data || typeof data !== 'object') return []
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data)) {
      return obj.data
        .map((m: unknown) => {
          if (m && typeof m === 'object' && 'id' in m) return String((m as { id: string }).id)
          return null
        })
        .filter((id): id is string => id !== null)
        .sort()
    }
    return []
  }

  const isModelExisting = (modelId: string) => {
    return existingModels.some(m => m.provider === provider && m.modelId === modelId)
  }

  const handleAddModel = async (modelId: string) => {
    setAdding(modelId)
    try {
      const created = await api.mcp.models.create({ provider, modelId })
      onModelAdded(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add model")
    } finally {
      setAdding(null)
    }
  }

  const discoveredModels = result ? extractModelIds(result.data) : []

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header with inline controls */}
      <div className="bg-muted/50 px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Discovery</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as DiscoverProvider)
              setResult(null)
            }}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="mistral">Mistral</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5"
            onClick={handleDiscover}
            disabled={loading}
          >
            {loading ? 'Fetching...' : 'Fetch'}
          </Button>
        </div>
      </div>

      {/* Terminal + Results */}
      {result && (
        <div className="p-3 space-y-3">
          {/* Curl line */}
          <div className="bg-zinc-950 rounded p-2 font-mono text-[11px] leading-relaxed overflow-x-auto">
            <span className="text-green-400">$ </span>
            <span className="text-zinc-400">{result.curl}</span>
            <span className="ml-2">
              {result.status >= 200 && result.status < 300
                ? <span className="text-green-400">{result.status}</span>
                : <span className="text-red-400">{result.status}</span>
              }
            </span>
            {result.error && (
              <div className="text-red-400 mt-0.5">Error: {result.error}</div>
            )}
          </div>

          {/* Discovered models as compact list */}
          {discoveredModels.length > 0 && (
            <div className="max-h-52 overflow-auto border rounded divide-y text-xs">
              {discoveredModels.map(modelId => {
                const exists = isModelExisting(modelId)
                return (
                  <div key={modelId} className="flex items-center justify-between px-2.5 py-1.5">
                    <span className="font-mono truncate mr-2">{modelId}</span>
                    {exists ? (
                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <button
                        onClick={() => handleAddModel(modelId)}
                        disabled={adding === modelId}
                        className="text-[10px] text-primary hover:underline shrink-0"
                      >
                        {adding === modelId ? '...' : '+add'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Raw JSON toggle */}
          <details className="text-[10px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Raw response ({discoveredModels.length} models)
            </summary>
            <pre className="bg-zinc-950 rounded p-2 mt-1 font-mono text-zinc-400 overflow-x-auto max-h-36 text-[10px]">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          Select a provider and click Fetch to discover available models.
        </div>
      )}
    </div>
  )
}
