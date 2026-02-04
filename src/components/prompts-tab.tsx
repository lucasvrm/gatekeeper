import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PIPELINE_STEPS, DYNAMIC_INSTRUCTION_KINDS } from "@/lib/types"
import { PromptFormDialog } from "./prompt-form-dialog"

type MainTab = 'pipeline' | 'dynamic' | 'custom'
type RoleFilter = 'system' | 'user'

// Dynamic instruction kinds (used for filtering)
const DYNAMIC_KINDS = Object.keys(DYNAMIC_INSTRUCTION_KINDS)

export function PromptsTab() {
  const [activeTab, setActiveTab] = useState<MainTab>('pipeline')
  const [activeStep, setActiveStep] = useState<number>(1)
  const [activeRole, setActiveRole] = useState<RoleFilter>('system')
  const [activeKind, setActiveKind] = useState<string>('guidance')
  const [pipelinePrompts, setPipelinePrompts] = useState<PromptInstruction[]>([])
  const [dynamicPrompts, setDynamicPrompts] = useState<PromptInstruction[]>([])
  const [sessionPrompts, setSessionPrompts] = useState<PromptInstruction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptInstruction | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newPromptStep, setNewPromptStep] = useState<number | null>(null)
  const [newPromptRole, setNewPromptRole] = useState<'system' | 'user'>('system')

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    setLoading(true)
    try {
      const [allPipeline, session] = await Promise.all([
        api.mcp.prompts.list('pipeline'),
        api.mcp.prompts.list('session'),
      ])

      // Separate pipeline prompts into base (instruction/doc/prompt) and dynamic (retry/guidance/etc)
      const BASE_KINDS = ['instruction', 'doc', 'prompt', 'cli', null]
      const basePipeline = allPipeline.filter(p => BASE_KINDS.includes(p.kind))
      const dynamic = allPipeline.filter(p => p.kind && !BASE_KINDS.includes(p.kind))

      setPipelinePrompts(basePipeline)
      setDynamicPrompts(dynamic)
      setSessionPrompts(session)
    } catch {
      toast.error("Falha ao carregar prompts")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = (step: number | null = null, role: 'system' | 'user' = 'system') => {
    setEditingPrompt(null)
    setNewPromptStep(step)
    setNewPromptRole(role)
    setDialogOpen(true)
  }

  const handleEdit = (prompt: PromptInstruction) => {
    setEditingPrompt(prompt)
    setNewPromptStep(prompt.step)
    setNewPromptRole(prompt.role || 'system')
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

  // Group pipeline prompts by step and role
  const promptsByStepAndRole = pipelinePrompts.reduce((acc, p) => {
    const step = p.step ?? 0
    const role = p.role || 'system'
    const key = `${step}-${role}`
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {} as Record<string, PromptInstruction[]>)

  // Get prompts for current step and role
  const currentStepPrompts = promptsByStepAndRole[`${activeStep}-${activeRole}`] || []
  const currentStepInfo = PIPELINE_STEPS[activeStep]

  // Count prompts by role for current step
  const systemCount = (promptsByStepAndRole[`${activeStep}-system`] || []).length
  const userCount = (promptsByStepAndRole[`${activeStep}-user`] || []).length

  // Get total count per step (all roles)
  const getStepCount = (step: number) => {
    return (promptsByStepAndRole[`${step}-system`] || []).length +
           (promptsByStepAndRole[`${step}-user`] || []).length
  }

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
          {/* Step Toggles + System/User Toggle + Pipeline/Custom Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Step selector */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {[1, 2, 3, 4].map((step) => {
                  const stepCount = getStepCount(step)
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

              {/* System/User role toggle */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setActiveRole('system')}
                  data-testid="role-toggle-system"
                  className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    activeRole === 'system'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-blue-500">⚙</span>
                  System ({systemCount})
                </button>
                <button
                  onClick={() => setActiveRole('user')}
                  data-testid="role-toggle-user"
                  className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    activeRole === 'user'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-green-500">💬</span>
                  User ({userCount})
                </button>
              </div>
            </div>

            {/* Pipeline/Dynamic/Custom Toggle aligned right */}
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
                onClick={() => setActiveTab('dynamic')}
                data-testid="tab-dynamic"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  activeTab === 'dynamic'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dinâmicos ({dynamicPrompts.length})
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
                <h3 className="font-semibold flex items-center gap-2">
                  Step {activeStep}: {currentStepInfo?.name}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    activeRole === 'system'
                      ? 'bg-blue-500/20 text-blue-600'
                      : 'bg-green-500/20 text-green-600'
                  }`}>
                    {activeRole === 'system' ? '⚙ System Prompt' : '💬 User Message'}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {activeRole === 'system'
                    ? currentStepInfo?.description
                    : 'Template de user message com placeholders Handlebars'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {currentStepPrompts.length} prompt(s) · {currentStepPrompts.reduce((sum, p) => sum + p.content.length, 0).toLocaleString()} chars
                </span>
                <button
                  onClick={() => handleCreate(activeStep, activeRole)}
                  data-testid={`add-prompt-step-${activeStep}-${activeRole}`}
                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                >
                  + Adicionar {activeRole === 'user' ? 'Template' : 'Prompt'}
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

      {/* Dynamic Instructions Tab Content */}
      {activeTab === 'dynamic' && (
        <DynamicInstructionsTab
          prompts={dynamicPrompts}
          activeKind={activeKind}
          onKindChange={setActiveKind}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          onEdit={handleEdit}
          onDelete={(id, name) => handleDelete(id, name)}
          onTabChange={setActiveTab}
          pipelineCount={pipelinePrompts.length}
          dynamicCount={dynamicPrompts.length}
          sessionCount={sessionPrompts.length}
        />
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
              {/* Pipeline/Dynamic/Custom Toggle */}
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
                  onClick={() => setActiveTab('dynamic')}
                  data-testid="tab-dynamic"
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    activeTab === 'dynamic'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dinâmicos ({dynamicPrompts.length})
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
          defaultRole={newPromptRole}
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
  const isUserMessage = prompt.role === 'user'

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
            {isUserMessage && (
              <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">
                💬 template
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
            {isUserMessage && ' · Handlebars template'}
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

// ─── Dynamic Instructions Tab Component ─────────────────────────────────────

interface DynamicInstructionsTabProps {
  prompts: PromptInstruction[]
  activeKind: string
  onKindChange: (kind: string) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (prompt: PromptInstruction) => void
  onDelete: (id: string, name: string) => void
  onTabChange: (tab: MainTab) => void
  pipelineCount: number
  dynamicCount: number
  sessionCount: number
}

function DynamicInstructionsTab({
  prompts,
  activeKind,
  onKindChange,
  expandedId,
  onToggleExpand,
  onEdit,
  onDelete,
  onTabChange,
  pipelineCount,
  dynamicCount,
  sessionCount,
}: DynamicInstructionsTabProps) {
  // Group prompts by kind
  const promptsByKind = prompts.reduce((acc, p) => {
    const kind = p.kind || 'other'
    if (!acc[kind]) acc[kind] = []
    acc[kind].push(p)
    return acc
  }, {} as Record<string, PromptInstruction[]>)

  // Get available kinds sorted by DYNAMIC_INSTRUCTION_KINDS order
  const availableKinds = Object.keys(DYNAMIC_INSTRUCTION_KINDS).filter(k => promptsByKind[k]?.length > 0)
  const otherKinds = Object.keys(promptsByKind).filter(k => !DYNAMIC_INSTRUCTION_KINDS[k])
  const allKinds = [...availableKinds, ...otherKinds]

  // Current kind prompts
  const currentKindPrompts = promptsByKind[activeKind] || []
  const currentKindInfo = DYNAMIC_INSTRUCTION_KINDS[activeKind]

  // If current kind has no prompts, switch to first available
  if (currentKindPrompts.length === 0 && allKinds.length > 0 && !allKinds.includes(activeKind)) {
    onKindChange(allKinds[0])
  }

  return (
    <div className="space-y-4">
      {/* Header row with kind selector and tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Kind selector pills */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg flex-wrap">
            {allKinds.map((kind) => {
              const kindInfo = DYNAMIC_INSTRUCTION_KINDS[kind]
              const count = promptsByKind[kind]?.length || 0
              return (
                <button
                  key={kind}
                  onClick={() => onKindChange(kind)}
                  data-testid={`kind-toggle-${kind}`}
                  className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
                    activeKind === kind
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {kindInfo?.icon && <span>{kindInfo.icon}</span>}
                  <span>{kindInfo?.label || kind}</span>
                  <span className="text-xs opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => onTabChange('pipeline')}
            className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pipeline ({pipelineCount})
          </button>
          <button
            className="px-3 py-1.5 rounded text-sm bg-card text-foreground shadow-sm"
          >
            Dinâmicos ({dynamicCount})
          </button>
          <button
            onClick={() => onTabChange('custom')}
            className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Custom ({sessionCount})
          </button>
        </div>
      </div>

      {/* Current kind content */}
      <div className="border rounded-lg overflow-hidden">
        {/* Kind Header */}
        <div className="bg-muted/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                {currentKindInfo?.icon && <span className="text-lg">{currentKindInfo.icon}</span>}
                {currentKindInfo?.label || activeKind}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {currentKindInfo?.description || 'Templates de instruções dinâmicas'}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentKindPrompts.length} template(s) · {currentKindPrompts.reduce((sum, p) => sum + p.content.length, 0).toLocaleString()} chars
            </span>
          </div>
        </div>

        {/* Kind Prompts */}
        <div className="divide-y">
          {currentKindPrompts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Nenhum template para esta categoria.
              </p>
            </div>
          ) : (
            currentKindPrompts
              .sort((a, b) => (a.step ?? 0) - (b.step ?? 0) || a.order - b.order)
              .map((prompt) => (
                <DynamicPromptCard
                  key={prompt.id}
                  prompt={prompt}
                  expanded={expandedId === prompt.id}
                  onToggle={() => onToggleExpand(prompt.id)}
                  onEdit={() => onEdit(prompt)}
                  onDelete={() => onDelete(prompt.id, prompt.name)}
                />
              ))
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">
          ℹ️ Sobre Instruções Dinâmicas
        </h4>
        <p className="text-xs text-muted-foreground">
          Estes templates são usados automaticamente pelo orquestrador durante o pipeline.
          Cada categoria tem uma função específica:
        </p>
        <ul className="text-xs text-muted-foreground mt-2 space-y-1">
          <li>• <strong>Retry</strong>: Mensagens enviadas quando o LLM não salva artifacts</li>
          <li>• <strong>Guidance</strong>: Orientações específicas para cada validador que falha</li>
          <li>• <strong>CLI Appends</strong>: Texto adicionado ao system prompt no modo Claude Code</li>
          <li>• <strong>Git Strategy</strong>: Instruções de branching por estratégia</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Use Handlebars para placeholders: <code className="bg-muted px-1 rounded">{'{{variavel}}'}</code>
        </p>
      </div>
    </div>
  )
}

// ─── Dynamic Prompt Card Component ──────────────────────────────────────────

interface DynamicPromptCardProps {
  prompt: PromptInstruction
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function DynamicPromptCard({ prompt, expanded, onToggle, onEdit, onDelete }: DynamicPromptCardProps) {
  return (
    <div data-testid={`dynamic-prompt-card-${prompt.id}`}>
      <div className="p-4 flex justify-between items-center hover:bg-muted/30 transition-colors">
        <button
          onClick={onToggle}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium font-mono text-sm">{prompt.name}</h3>
            {prompt.step !== null && (
              <span className="text-xs bg-purple-500/20 text-purple-600 px-1.5 py-0.5 rounded">
                Step {prompt.step}
              </span>
            )}
            {prompt.role === 'user' && (
              <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">
                💬 template
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
            data-testid={`edit-dynamic-${prompt.id}`}
            className="text-blue-600 hover:text-blue-800 px-2 py-1 text-sm"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            data-testid={`delete-dynamic-${prompt.id}`}
            className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
          >
            Deletar
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-4">
          <pre
            data-testid={`dynamic-content-${prompt.id}`}
            className="text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto"
          >
            {prompt.content}
          </pre>
        </div>
      )}
    </div>
  )
}
