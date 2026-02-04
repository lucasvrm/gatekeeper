import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PIPELINE_STEPS } from "@/lib/types"

interface Props {
  prompt: PromptInstruction | null
  defaultStep?: number | null
  onClose: () => void
  onSave: () => void
}

export function PromptFormDialog({ prompt, defaultStep, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [step, setStep] = useState<number | null>(null)
  const [kind, setKind] = useState<string>("instruction")
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
      setOrder(prompt.order || 0)
      setIsActive(prompt.isActive)
    } else {
      setStep(defaultStep ?? null)
    }
  }, [prompt, defaultStep])

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
        kind: step !== null ? kind : null, // kind only for pipeline prompts
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

          {/* Step Selector (only for new prompts or if editing allows changing) */}
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

            {/* Kind (only for pipeline prompts) */}
            {isPipeline && (
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  data-testid="prompt-kind-select"
                  className="border border-input rounded-md px-3 py-2 w-full bg-background"
                >
                  <option value="instruction">instruction</option>
                  <option value="doc">doc</option>
                  <option value="prompt">prompt</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  instruction = regras, doc = referência, prompt = template
                </p>
              </div>
            )}
          </div>

          {/* Order and Active (for pipeline prompts) */}
          {isPipeline && (
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
