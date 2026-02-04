import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { AgentPhaseConfig, ProviderName } from "@/lib/types"
import { STEP_LABELS } from "@/lib/types"

const PROVIDERS: { value: ProviderName; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code (CLI)' },
  { value: 'anthropic', label: 'Anthropic API' },
  { value: 'openai', label: 'OpenAI API' },
  { value: 'mistral', label: 'Mistral API' },
]

const DEFAULT_MODELS: Record<ProviderName, string[]> = {
  'claude-code': ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  'anthropic': ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-3-5-sonnet-20241022'],
  'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-4'],
  'mistral': ['mistral-large-latest', 'mistral-medium-latest'],
}

export function PhaseConfigTab() {
  const [phases, setPhases] = useState<AgentPhaseConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [editingPhase, setEditingPhase] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<AgentPhaseConfig>>({})

  useEffect(() => {
    loadPhases()
  }, [])

  const [error, setError] = useState<string | null>(null)

  const loadPhases = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('[PhaseConfigTab] Loading phases from:', 'http://localhost:3001/api/agent/phases')
      const data = await api.mcp.phases.list()
      console.log('[PhaseConfigTab] Loaded phases:', data)
      console.log('[PhaseConfigTab] Data type:', typeof data, 'isArray:', Array.isArray(data), 'length:', data?.length)
      setPhases(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[PhaseConfigTab] Error loading phases:', err)
      console.error('[PhaseConfigTab] Error details:', errorMessage)
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

  const formatNumber = (n: number) => n.toLocaleString()

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
          <p className="text-destructive font-medium mb-1">Erro ao carregar configurações</p>
          <p className="text-sm text-destructive/80">{error}</p>
          <button
            onClick={loadPhases}
            className="mt-2 text-xs px-3 py-1.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {!error && phases.length === 0 && (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground mb-3">
              Nenhuma configuração de fase encontrada.
            </p>
            <p className="text-sm text-muted-foreground">
              Execute <code className="bg-muted px-1 rounded">npm run db:seed --workspace=gatekeeper-api</code> para criar as configurações padrão.
            </p>
          </div>
        )}
        {phases.sort((a, b) => a.step - b.step).map((phase) => {
          const isEditing = editingPhase === phase.step
          const isSaving = saving === phase.step
          const stepLabel = STEP_LABELS[phase.step] || `Step ${phase.step}`
          const availableModels = DEFAULT_MODELS[formData.provider as ProviderName] || DEFAULT_MODELS[phase.provider]

          return (
            <div
              key={phase.step}
              className="border rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div className="bg-muted/50 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {phase.step}
                  </span>
                  <div>
                    <h4 className="font-medium">{stepLabel}</h4>
                    <p className="text-xs text-muted-foreground">
                      {phase.provider} · {phase.model}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => handleEdit(phase)}
                      className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors"
                    >
                      Editar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="text-xs px-3 py-1.5 rounded border hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSave(phase.step)}
                        disabled={isSaving}
                        className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-3">
                {isEditing ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Provider */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Provider</label>
                      <select
                        value={formData.provider || phase.provider}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          provider: e.target.value as ProviderName,
                          model: DEFAULT_MODELS[e.target.value as ProviderName]?.[0] || prev.model,
                        }))}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      >
                        {PROVIDERS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Model */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Model</label>
                      <select
                        value={formData.model || phase.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      >
                        {availableModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Max Tokens */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Max Tokens (output)</label>
                      <input
                        type="number"
                        value={formData.maxTokens ?? phase.maxTokens}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 0 }))}
                        min={256}
                        max={65536}
                        step={1024}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      />
                    </div>

                    {/* Max Iterations */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Max Iterations</label>
                      <input
                        type="number"
                        value={formData.maxIterations ?? phase.maxIterations}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxIterations: parseInt(e.target.value) || 1 }))}
                        min={1}
                        max={100}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      />
                    </div>

                    {/* Max Input Tokens Budget */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Input Budget (0=∞)</label>
                      <input
                        type="number"
                        value={formData.maxInputTokensBudget ?? phase.maxInputTokensBudget}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxInputTokensBudget: parseInt(e.target.value) || 0 }))}
                        min={0}
                        step={10000}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Temperature</label>
                      <input
                        type="number"
                        value={formData.temperature ?? phase.temperature ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          temperature: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        min={0}
                        max={2}
                        step={0.1}
                        placeholder="null"
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      />
                    </div>

                    {/* Fallback Provider */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Fallback Provider</label>
                      <select
                        value={formData.fallbackProvider ?? phase.fallbackProvider ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          fallbackProvider: e.target.value as ProviderName || null
                        }))}
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      >
                        <option value="">Nenhum</option>
                        {PROVIDERS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Fallback Model */}
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Fallback Model</label>
                      <input
                        type="text"
                        value={formData.fallbackModel ?? phase.fallbackModel ?? ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          fallbackModel: e.target.value || null
                        }))}
                        placeholder="Nenhum"
                        className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Max Tokens</span>
                      <span className="font-mono">{formatNumber(phase.maxTokens)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Max Iterations</span>
                      <span className="font-mono">{phase.maxIterations}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Input Budget</span>
                      <span className="font-mono">{phase.maxInputTokensBudget === 0 ? '∞' : formatNumber(phase.maxInputTokensBudget)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-xs">Temperature</span>
                      <span className="font-mono">{phase.temperature ?? 'default'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Info box */}
      <div className="bg-muted/30 border rounded-lg p-4 text-sm">
        <p className="font-medium mb-2">Notas sobre os parâmetros:</p>
        <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
          <li><strong>Max Tokens</strong>: Limite de tokens na resposta do LLM. Step 4 (Coder) geralmente precisa de mais (32k+).</li>
          <li><strong>Max Iterations</strong>: Número máximo de tool calls por step.</li>
          <li><strong>Input Budget</strong>: Limite de tokens de entrada (0 = ilimitado). Warning emitido a 80%.</li>
          <li><strong>Temperature</strong>: Criatividade do modelo (0 = determinístico, 1+ = criativo). Null usa default do provider.</li>
          <li><strong>Fallback</strong>: Provider/modelo alternativo se o primário falhar.</li>
        </ul>
      </div>
    </div>
  )
}
