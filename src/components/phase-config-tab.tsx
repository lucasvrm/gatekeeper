import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { AgentPhaseConfig, ProviderName } from "@/lib/types"
import { STEP_LABELS } from "@/lib/types"

const FALLBACK_PROVIDERS: { value: string; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code CLI' },
  { value: 'codex-cli', label: 'Codex CLI' },
  { value: 'anthropic', label: 'Anthropic (API Key)' },
  { value: 'openai', label: 'OpenAI (API Key)' },
  { value: 'mistral', label: 'Mistral (API Key)' },
]

const FALLBACK_MODELS: Record<string, string[]> = {
  'claude-code': ['sonnet', 'opus', 'haiku'],
  'codex-cli': ['o3-mini', 'gpt-4.1', 'o4-mini'],
  'anthropic': ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  'openai': ['gpt-4.1', 'gpt-4o'],
  'mistral': ['mistral-large-latest'],
}

interface PhaseConfigTabProps {
  modelsByProvider?: Record<string, string[]>
  providers?: { value: string; label: string }[]
}

export function PhaseConfigTab({ modelsByProvider, providers }: PhaseConfigTabProps = {}) {
  const providerList = providers && providers.length > 0 ? providers : FALLBACK_PROVIDERS
  const [phases, setPhases] = useState<AgentPhaseConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [editingPhase, setEditingPhase] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<AgentPhaseConfig>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadPhases() }, [])

  const loadPhases = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.mcp.phases.list()
      setPhases(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      toast.error(`Falha ao carregar: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (phase: AgentPhaseConfig) => {
    setEditingPhase(phase.step)
    setFormData({
      provider: phase.provider,
      model: phase.model,
      maxTokens: phase.maxTokens,
      maxIterations: phase.maxIterations,
      maxInputTokensBudget: phase.maxInputTokensBudget,
      temperature: phase.temperature,
      fallbackProvider: phase.fallbackProvider,
      fallbackModel: phase.fallbackModel,
    })
  }

  const handleCancel = () => {
    setEditingPhase(null)
    setFormData({})
  }

  const handleSave = async (step: number) => {
    setSaving(step)
    try {
      const updated = await api.mcp.phases.update(step, formData)
      setPhases(prev => prev.map(p => p.step === step ? updated : p))
      toast.success(`Step ${step} atualizado`)
      setEditingPhase(null)
      setFormData({})
    } catch {
      toast.error("Falha ao salvar configuração")
    } finally {
      setSaving(null)
    }
  }

  const fmt = (n: number) => n.toLocaleString()

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <p className="text-destructive text-sm font-medium mb-1">Erro ao carregar</p>
          <p className="text-xs text-destructive/80">{error}</p>
          <button
            onClick={loadPhases}
            className="mt-1.5 text-xs px-2.5 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {!error && phases.length === 0 && (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">Nenhuma fase configurada.</p>
          <p className="text-xs text-muted-foreground">
            <code className="bg-muted px-1 rounded">npm run db:seed --workspace=gatekeeper-api</code>
          </p>
        </div>
      )}

      {/* Phase cards - stacked */}
      {phases.sort((a, b) => a.step - b.step).map((phase) => {
        const isEditing = editingPhase === phase.step
        const isSaving = saving === phase.step
        const stepLabel = STEP_LABELS[phase.step] || `Step ${phase.step}`
        const currentProvider = (formData.provider || phase.provider) as ProviderName
        const availableModels = modelsByProvider?.[currentProvider] || FALLBACK_MODELS[currentProvider] || []

        return (
          <div key={phase.step} className="border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="bg-muted/50 px-3 py-2 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {phase.step}
                </span>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm leading-tight">{stepLabel}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {phase.provider} · {phase.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditing ? (
                  <button
                    onClick={() => handleEdit(phase)}
                    className="text-xs px-2.5 py-1 rounded border hover:bg-muted transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSave(phase.step)}
                      disabled={isSaving}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? '...' : 'Salvar'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Provider</label>
                    <select
                      value={formData.provider || phase.provider}
                      onChange={(e) => {
                        const np = e.target.value as ProviderName
                        const nm = modelsByProvider?.[np] || FALLBACK_MODELS[np] || []
                        setFormData(prev => ({ ...prev, provider: np, model: nm[0] || prev.model }))
                      }}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    >
                      {providerList.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Model</label>
                    <select
                      value={formData.model || phase.model}
                      onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    >
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Max Tokens</label>
                    <input
                      type="number"
                      value={formData.maxTokens ?? phase.maxTokens}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))}
                      min={256} max={65536} step={1024}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Max Iterations</label>
                    <input
                      type="number"
                      value={formData.maxIterations ?? phase.maxIterations}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxIterations: parseInt(e.target.value) || 1 }))}
                      min={1} max={100}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Input Budget (0=∞)</label>
                    <input
                      type="number"
                      value={formData.maxInputTokensBudget ?? phase.maxInputTokensBudget}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxInputTokensBudget: parseInt(e.target.value) || 0 }))}
                      min={0} step={10000}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Temperature</label>
                    <input
                      type="number"
                      value={formData.temperature ?? phase.temperature ?? ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        temperature: e.target.value ? parseFloat(e.target.value) : null
                      }))}
                      min={0} max={2} step={0.1} placeholder="default"
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Fallback Provider</label>
                    <select
                      value={formData.fallbackProvider ?? phase.fallbackProvider ?? ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        fallbackProvider: e.target.value as ProviderName || null
                      }))}
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    >
                      <option value="">Nenhum</option>
                      {providerList.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Fallback Model</label>
                    <input
                      type="text"
                      value={formData.fallbackModel ?? phase.fallbackModel ?? ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        fallbackModel: e.target.value || null
                      }))}
                      placeholder="Nenhum"
                      className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Tokens</span>
                    <span className="font-mono">{fmt(phase.maxTokens)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Iterations</span>
                    <span className="font-mono">{phase.maxIterations}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Budget</span>
                    <span className="font-mono">{phase.maxInputTokensBudget === 0 ? '∞' : fmt(phase.maxInputTokensBudget)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Temp</span>
                    <span className="font-mono">{phase.temperature ?? 'def'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Collapsible notes */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
          Parameter notes
        </summary>
        <div className="bg-muted/30 border rounded-lg p-3 mt-1">
          <ul className="text-muted-foreground space-y-0.5 list-disc list-inside text-[11px]">
            <li><strong>Max Tokens</strong>: Output token limit. Step 4 (Coder) needs 32k+.</li>
            <li><strong>Iterations</strong>: Max tool calls per step.</li>
            <li><strong>Budget</strong>: Input token limit (0 = unlimited). Warning at 80%.</li>
            <li><strong>Temp</strong>: 0 = deterministic, 1+ = creative. Null = provider default.</li>
            <li><strong>Fallback</strong>: Alternative provider/model on primary failure.</li>
          </ul>
        </div>
      </details>
    </div>
  )
}
