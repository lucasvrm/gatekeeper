import { useState } from "react"
import type { PromptInstruction } from "@/lib/types"

interface PromptFormDialogProps {
  initial?: PromptInstruction
  onSave: (name: string, content: string) => Promise<void>
  onClose: () => void
}

export function PromptFormDialog({ initial, onSave, onClose }: PromptFormDialogProps) {
  const [name, setName] = useState(initial?.name || "")
  const [content, setContent] = useState(initial?.content || "")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), content.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      data-testid="prompt-form-dialog"
    >
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-lg mx-4 shadow-lg">
        <h3 className="text-lg font-medium mb-4">
          {initial ? "Editar Prompt" : "Novo Prompt"}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: regras-de-estilo, convenções-projeto"
              data-testid="prompt-name-input"
              className="border border-input rounded-md px-3 py-2 w-full bg-background text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva a instrução em linguagem natural..."
              data-testid="prompt-content-textarea"
              rows={8}
              className="border border-input rounded-md px-3 py-2 w-full bg-background text-sm font-mono min-h-[150px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !content.trim()}
            data-testid="prompt-save-button"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}
