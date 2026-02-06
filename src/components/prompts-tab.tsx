import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PIPELINE_STEPS, DYNAMIC_INSTRUCTION_KINDS } from "@/lib/types"
import { PromptFormDialog } from "./prompt-form-dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type MainTab = 'pipeline' | 'dynamic' | 'custom'
type RoleFilter = 'system' | 'user'

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

  const [newPromptKind, setNewPromptKind] = useState<string | null>(null)

  const handleCreate = (step: number | null = null, role: 'system' | 'user' = 'system', kind: string | null = null) => {
    setEditingPrompt(null)
    setNewPromptStep(step)
    setNewPromptRole(role)
    setNewPromptKind(kind)
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
      <div data-testid="prompts-tab" className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div data-testid="prompts-tab" className="space-y-6">
      {/* Pipeline Prompts Section */}
      <Card data-testid="pipeline-prompts-section">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipeline Prompts</CardTitle>
              <CardDescription>
                System prompts e user message templates para cada fase do pipeline.
              </CardDescription>
            </div>
            {/* Tab toggle */}
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
        </CardHeader>
        <CardContent>
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {/* Step + Role selectors */}
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

              {/* Current Step Content */}
              <div className="border rounded-lg overflow-hidden">
                {/* Step Header */}
                <div className="bg-muted/50 px-4 py-3 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Step {activeStep}: {currentStepInfo?.name}
                      <Badge variant={activeRole === 'system' ? 'default' : 'secondary'}>
                        {activeRole === 'system' ? '⚙ System' : '💬 User'}
                      </Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {activeRole === 'system'
                        ? currentStepInfo?.description
                        : 'Template de user message com placeholders Handlebars'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCreate(activeStep, activeRole)}
                    data-testid={`add-prompt-step-${activeStep}-${activeRole}`}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
                  >
                    + Adicionar
                  </button>
                </div>

                {/* Step Prompts */}
                <div className="divide-y">
                  {currentStepPrompts.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">
                        Nenhum prompt para este step.
                      </p>
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

          {activeTab === 'dynamic' && (
            <DynamicInstructionsContent
              prompts={dynamicPrompts}
              activeKind={activeKind}
              onKindChange={setActiveKind}
              expandedId={expandedId}
              onToggleExpand={toggleExpand}
              onEdit={handleEdit}
              onDelete={(id, name) => handleDelete(id, name)}
              onCreate={(kind) => handleCreate(null, 'system', kind)}
            />
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Prompts customizados injetados como "Instruções Adicionais" no system prompt.
                </p>
                <button
                  onClick={() => handleCreate(null)}
                  data-testid="new-prompt-button"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 transition-colors"
                >
                  + Novo
                </button>
              </div>

              <div data-testid="prompts-list" className="border rounded-lg divide-y">
                {sessionPrompts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm">
                      Nenhum prompt customizado.
                    </p>
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
        </CardContent>
      </Card>

      {/* Info box */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm space-y-2">
            <p className="font-medium">Sobre os prompts:</p>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
              <li><strong>Pipeline</strong>: System prompts base para cada step (1-4)</li>
              <li><strong>Dinâmicos</strong>: Templates para retry, guidance, git strategy, etc.</li>
              <li><strong>Custom</strong>: Prompts adicionais injetados no contexto</li>
              <li>Use <code className="bg-muted px-1 rounded">{'{{variavel}}'}</code> para placeholders Handlebars</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {dialogOpen && (
        <PromptFormDialog
          prompt={editingPrompt}
          defaultStep={newPromptStep}
          defaultRole={newPromptRole}
          defaultKind={newPromptKind}
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
              <Badge variant="outline" className="text-xs">
                {prompt.kind}
              </Badge>
            )}
            {isUserMessage && (
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                💬 template
              </Badge>
            )}
            {!prompt.isActive && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-600">
                desativado
              </Badge>
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

// ─── Dynamic Instructions Content Component ─────────────────────────────────

interface DynamicInstructionsContentProps {
  prompts: PromptInstruction[]
  activeKind: string
  onKindChange: (kind: string) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (prompt: PromptInstruction) => void
  onDelete: (id: string, name: string) => void
  onCreate: (kind: string) => void
}

function DynamicInstructionsContent({
  prompts,
  activeKind,
  onKindChange,
  expandedId,
  onToggleExpand,
  onEdit,
  onDelete,
  onCreate,
}: DynamicInstructionsContentProps) {
  // Group prompts by kind
  const promptsByKind = prompts.reduce((acc, p) => {
    const kind = p.kind || 'other'
    if (!acc[kind]) acc[kind] = []
    acc[kind].push(p)
    return acc
  }, {} as Record<string, PromptInstruction[]>)

  // Show ALL defined kinds (even empty ones to allow creation) + any extra kinds from data
  const definedKinds = Object.keys(DYNAMIC_INSTRUCTION_KINDS)
  const otherKinds = Object.keys(promptsByKind).filter(k => !DYNAMIC_INSTRUCTION_KINDS[k])
  const allKinds = [...definedKinds, ...otherKinds]

  // Current kind prompts
  const currentKindPrompts = promptsByKind[activeKind] || []
  const currentKindInfo = DYNAMIC_INSTRUCTION_KINDS[activeKind]

  // If current kind has no prompts, switch to first available
  if (currentKindPrompts.length === 0 && allKinds.length > 0 && !allKinds.includes(activeKind)) {
    onKindChange(allKinds[0])
  }

  return (
    <div className="space-y-4">
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

      {/* Current kind content */}
      <div className="border rounded-lg overflow-hidden">
        {/* Kind Header */}
        <div className="bg-muted/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                {currentKindInfo?.icon && <span className="text-lg">{currentKindInfo.icon}</span>}
                {currentKindInfo?.label || activeKind}
                <span className="text-xs font-normal text-muted-foreground">
                  ({currentKindPrompts.length})
                </span>
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {currentKindInfo?.description || 'Templates de instruções dinâmicas'}
              </p>
            </div>
            <button
              onClick={() => onCreate(activeKind)}
              data-testid={`add-dynamic-${activeKind}`}
              className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {/* Kind Prompts */}
        <div className="divide-y">
          {currentKindPrompts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
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
              <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-600">
                Step {prompt.step}
              </Badge>
            )}
            {prompt.role === 'user' && (
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                💬 template
              </Badge>
            )}
            {!prompt.isActive && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-600">
                desativado
              </Badge>
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
