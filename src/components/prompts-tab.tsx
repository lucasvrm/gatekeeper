import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PIPELINE_STEPS } from "@/lib/types"
import { PromptFormDialog } from "./prompt-form-dialog"

type MainTab = 'pipeline' | 'custom'

export function PromptsTab() {
  const [activeTab, setActiveTab] = useState<MainTab>('pipeline')
  const [activeStep, setActiveStep] = useState<number>(1)
  const [pipelinePrompts, setPipelinePrompts] = useState<PromptInstruction[]>([])
  const [sessionPrompts, setSessionPrompts] = useState<PromptInstruction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptInstruction | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newPromptStep, setNewPromptStep] = useState<number | null>(null)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    setLoading(true)
    try {
      const [pipeline, session] = await Promise.all([
        api.mcp.prompts.list('pipeline'),
        api.mcp.prompts.list('session'),
      ])
      setPipelinePrompts(pipeline)
      setSessionPrompts(session)
    } catch {
      toast.error("Falha ao carregar prompts")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = (step: number | null = null) => {
    setEditingPrompt(null)
    setNewPromptStep(step)
    setDialogOpen(true)
  }

  const handleEdit = (prompt: PromptInstruction) => {
    setEditingPrompt(prompt)
    setNewPromptStep(prompt.step)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deletar "${name}"?`)) return
    try {
      await api.mcp.prompts.delete(id)
      toast.success("Prompt deletado")
      await loadPrompts()
    } catch {
      toast.error("Falha ao deletar prompt")
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Group pipeline prompts by step
  const promptsByStep = pipelinePrompts.reduce((acc, p) => {
    const step = p.step ?? 0
    if (!acc[step]) acc[step] = []
    acc[step].push(p)
    return acc
  }, {} as Record<number, PromptInstruction[]>)

  // Get prompts for current step
  const currentStepPrompts = promptsByStep[activeStep] || []
  const currentStepInfo = PIPELINE_STEPS[activeStep]

  if (loading) {
    return (
      <div data-testid="prompts-tab">
        <div data-testid="loading-skeleton" className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="prompts-tab" className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Prompts</h2>
        <p className="text-sm text-muted-foreground">
          Prompts de sistema usados pelo agente em cada fase do pipeline.
          Selecione uma etapa para ver e editar seus prompts.
        </p>
      </div>

      {/* Pipeline Tab Content */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Step Toggles + Pipeline/Custom Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {[1, 2, 3, 4].map((step) => {
                const stepCount = (promptsByStep[step] || []).length
                return (
                  <button
                    key={step}
                    onClick={() => setActiveStep(step)}
                    data-testid={`step-toggle-${step}`}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      activeStep === step
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="font-medium">Step {step}</span>
                    <span className="ml-1.5 text-xs opacity-70">({stepCount})</span>
                  </button>
                )
              })}
            </div>

            {/* Pipeline/Custom Toggle aligned right */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setActiveTab('pipeline')}
                data-testid="tab-pipeline"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeTab === 'pipeline'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pipeline ({pipelinePrompts.length})
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                data-testid="tab-session"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeTab === 'custom'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Custom ({sessionPrompts.length})
              </button>
            </div>
          </div>

          {/* Current Step Content */}
          <div className="border rounded-lg overflow-hidden">
            {/* Step Header */}
            <div className="bg-muted/50 px-4 py-3 flex justify-between items-center">
              <div>
                <h3 className="font-semibold">
                  Step {activeStep}: {currentStepInfo?.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {currentStepInfo?.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {currentStepPrompts.length} prompt(s) · {currentStepPrompts.reduce((sum, p) => sum + p.content.length, 0).toLocaleString()} chars
                </span>
                <button
                  onClick={() => handleCreate(activeStep)}
                  data-testid={`add-prompt-step-${activeStep}`}
                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {/* Step Prompts */}
            <div className="divide-y">
              {currentStepPrompts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-3">
                    Nenhum prompt para este step.
                  </p>
                  <button
                    onClick={() => handleCreate(activeStep)}
                    className="text-sm text-primary hover:underline"
                  >
                    Criar primeiro prompt
                  </button>
                </div>
              ) : (
                currentStepPrompts
                  .sort((a, b) => a.order - b.order)
                  .map((prompt) => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      expanded={expandedId === prompt.id}
                      onToggle={() => toggleExpand(prompt.id)}
                      onEdit={() => handleEdit(prompt)}
                      onDelete={() => handleDelete(prompt.id, prompt.name)}
                    />
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Tab Content */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {/* Toggle + New button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Prompts customizados injetados como "Instruções Adicionais" no system prompt.
            </p>

            <div className="flex items-center gap-3">
              {/* Pipeline/Custom Toggle */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setActiveTab('pipeline')}
                  data-testid="tab-pipeline"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    activeTab === 'pipeline'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Pipeline ({pipelinePrompts.length})
                </button>
                <button
                  onClick={() => setActiveTab('custom')}
                  data-testid="tab-session"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    activeTab === 'custom'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Custom ({sessionPrompts.length})
                </button>
              </div>

              <button
                onClick={() => handleCreate(null)}
                data-testid="new-prompt-button"
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 transition-colors"
              >
                + Novo
              </button>
            </div>
          </div>

          <div data-testid="prompts-list" className="border rounded-lg divide-y">
            {sessionPrompts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-3">
                  Nenhum prompt customizado.
                </p>
                <button
                  onClick={() => handleCreate(null)}
                  className="text-sm text-primary hover:underline"
                >
                  Criar primeiro prompt
                </button>
              </div>
            ) : (
              sessionPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  expanded={expandedId === prompt.id}
                  onToggle={() => toggleExpand(prompt.id)}
                  onEdit={() => handleEdit(prompt)}
                  onDelete={() => handleDelete(prompt.id, prompt.name)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {dialogOpen && (
        <PromptFormDialog
          prompt={editingPrompt}
          defaultStep={newPromptStep}
          onClose={() => setDialogOpen(false)}
          onSave={loadPrompts}
        />
      )}
    </div>
  )
}

// ─── Prompt Card Component ──────────────────────────────────────────────────

interface PromptCardProps {
  prompt: PromptInstruction
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function PromptCard({ prompt, expanded, onToggle, onEdit, onDelete }: PromptCardProps) {
  return (
    <div data-testid={`prompt-card-${prompt.id}`}>
      <div className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors">
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-mono">#{prompt.order}</span>
            <h3 className="font-medium">{prompt.name}</h3>
            {prompt.kind && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {prompt.kind}
              </span>
            )}
            {!prompt.isActive && (
              <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded">
                desativado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {prompt.content.length.toLocaleString()} caracteres
          </p>
        </button>
        <div className="flex gap-2 ml-4">
          <button
            onClick={onEdit}
            data-testid={`edit-prompt-${prompt.id}`}
            className="text-blue-600 hover:text-blue-800 px-2 py-1 text-sm"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            data-testid={`delete-prompt-${prompt.id}`}
            className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
          >
            Deletar
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-4">
          <pre
            data-testid={`prompt-content-${prompt.id}`}
            className="text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto"
          >
            {prompt.content}
          </pre>
        </div>
      )}
    </div>
  )
}
