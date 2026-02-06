import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PIPELINE_STEPS, USER_MESSAGE_PLACEHOLDERS, DYNAMIC_INSTRUCTION_KINDS } from "@/lib/types"

interface Props {
  prompt: PromptInstruction | null
  defaultStep?: number | null
  defaultRole?: 'system' | 'user'
  defaultKind?: string | null
  onClose: () => void
  onSave: () => void
}

export function PromptFormDialog({ prompt, defaultStep, defaultRole, defaultKind, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [step, setStep] = useState<number | null>(null)
  const [kind, setKind] = useState<string>("instruction")
  const [role, setRole] = useState<'system' | 'user'>('system')
  const [order, setOrder] = useState<number>(0)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const isEditing = !!prompt

  useEffect(() => {
    if (prompt) {
      setName(prompt.name)
      setContent(prompt.content)
      setStep(prompt.step)
      setKind(prompt.kind || "instruction")
      setRole(prompt.role || 'system')
      setOrder(prompt.order || 0)
      setIsActive(prompt.isActive)
    } else {
      setStep(defaultStep ?? null)
      setRole(defaultRole ?? 'system')
      setKind(defaultKind ?? 'instruction')
    }
  }, [prompt, defaultStep, defaultRole, defaultKind])

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error("Nome e conteúdo são obrigatórios")
      return
    }

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        content: content.trim(),
        step,
        kind: kind || null,
        role,
        order,
        isActive,
      }

      if (isEditing) {
        await api.mcp.prompts.update(prompt.id, data)
        toast.success("Prompt atualizado")
      } else {
        await api.mcp.prompts.create(data)
        toast.success("Prompt criado")
      }
      onSave()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const isPipeline = step !== null
  const isDynamic = !!DYNAMIC_INSTRUCTION_KINDS[kind]
  const showAdvanced = isPipeline || isDynamic

  return (
    <div
      data-testid="prompt-form-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar Prompt" : "Novo Prompt"}
          {isPipeline && step && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              — Step {step}: {PIPELINE_STEPS[step]?.name}
            </span>
          )}
        </h2>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPipeline ? "Ex: specwriter-clause-rules" : "Ex: meu-estilo-codigo"}
              data-testid="prompt-name-input"
              className="border border-input rounded-md px-3 py-2 w-full bg-background"
              autoFocus
            />
          </div>

          {/* Step Selector + Role Toggle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Step (Pipeline)</label>
              <select
                value={step ?? ""}
                onChange={(e) => setStep(e.target.value ? parseInt(e.target.value) : null)}
                data-testid="prompt-step-select"
                className="border border-input rounded-md px-3 py-2 w-full bg-background"
              >
                <option value="">Custom (Sessão)</option>
                <option value="1">Step 1: {PIPELINE_STEPS[1].name}</option>
                <option value="2">Step 2: {PIPELINE_STEPS[2].name}</option>
                <option value="3">Step 3: {PIPELINE_STEPS[3].name}</option>
                <option value="4">Step 4: {PIPELINE_STEPS[4].name}</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {step === null
                  ? "Será injetado como instrução adicional em todos os steps"
                  : `Usado apenas no ${PIPELINE_STEPS[step].name}`}
              </p>
            </div>

            {/* Role (system prompt vs user message template) */}
            {showAdvanced && (
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setRole('system')}
                    data-testid="prompt-role-system"
                    className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                      role === 'system'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ⚙ System
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    data-testid="prompt-role-user"
                    className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
                      role === 'user'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    💬 User
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {role === 'system'
                    ? 'Concatenado no system prompt'
                    : 'Template de user message (Handlebars)'}
                </p>
              </div>
            )}
          </div>

          {/* Kind */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                data-testid="prompt-kind-select"
                className="border border-input rounded-md px-3 py-2 w-full bg-background"
              >
                <optgroup label="Pipeline">
                  <option value="instruction">instruction</option>
                  <option value="doc">doc</option>
                  <option value="prompt">prompt</option>
                  <option value="cli">cli (Claude Code)</option>
                </optgroup>
                <optgroup label="Dinâmicos">
                  {Object.entries(DYNAMIC_INSTRUCTION_KINDS).map(([k, info]) => (
                    <option key={k} value={k}>{info.icon} {info.label}</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {DYNAMIC_INSTRUCTION_KINDS[kind]
                  ? DYNAMIC_INSTRUCTION_KINDS[kind].description
                  : role === 'user'
                    ? 'cli = template específico para Claude Code'
                    : 'instruction = regras, doc = referência'}
              </p>
            </div>
            <div />
          </div>

          {/* Placeholders help (only for user message templates) */}
          {isPipeline && role === 'user' && step && USER_MESSAGE_PLACEHOLDERS[step] && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-green-700 mb-2">
                💬 Placeholders Handlebars disponíveis para Step {step}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {USER_MESSAGE_PLACEHOLDERS[step].map((ph) => (
                  <div key={ph.name} className="text-xs">
                    <code className="bg-green-500/20 px-1 py-0.5 rounded text-green-800 font-mono">
                      {'{{'}
                      {ph.name}
                      {'}}'}
                    </code>
                    <span className="text-muted-foreground ml-1.5">{ph.description}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Use <code className="bg-muted px-1 rounded">{'{{#if var}}...{{/if}}'}</code> para condicionais e{' '}
                <code className="bg-muted px-1 rounded">{'{{#each arr}}...{{/each}}'}</code> para loops.
                Use <code className="bg-muted px-1 rounded">{'{{{var}}}'}</code> (três chaves) para conteúdo HTML/markdown.
              </p>
            </div>
          )}

          {/* Order and Active */}
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ordem</label>
                <input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                  data-testid="prompt-order-input"
                  className="border border-input rounded-md px-3 py-2 w-full bg-background"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Menor número = aparece primeiro no prompt
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    data-testid="prompt-active-checkbox"
                    className="rounded"
                  />
                  <span className="text-sm">Ativo</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Prompts inativos não são incluídos no system prompt
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-1">Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Instruções em linguagem natural para o LLM..."
              data-testid="prompt-content-input"
              className="border border-input rounded-md px-3 py-2 w-full bg-background font-mono text-sm min-h-[350px] resize-y"
              rows={15}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.length.toLocaleString()} caracteres · ~{Math.ceil(content.length / 4).toLocaleString()} tokens
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            data-testid="prompt-cancel-button"
            className="px-4 py-2 rounded-md border border-input hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            data-testid="prompt-save-button"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}
