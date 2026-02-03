import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"

interface Props {
  prompt: PromptInstruction | null
  onClose: () => void
  onSave: () => void
}

export function PromptFormDialog({ prompt, onClose, onSave }: Props) {
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const isEditing = !!prompt

  useEffect(() => {
    if (prompt) {
      setName(prompt.name)
      setContent(prompt.content)
    }
  }, [prompt])

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error("Nome e conteúdo são obrigatórios")
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await api.mcp.prompts.update(prompt.id, { name: name.trim(), content: content.trim() })
        toast.success("Prompt atualizado")
      } else {
        await api.mcp.prompts.create({ name: name.trim(), content: content.trim() })
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

  return (
    <div
      data-testid="prompt-form-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar Prompt" : "Novo Prompt"}
        </h2>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: planner-playbook"
              data-testid="prompt-name-input"
              className="border border-input rounded-md px-3 py-2 w-full bg-background"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Conteúdo</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Instruções em linguagem natural..."
              data-testid="prompt-content-input"
              className="border border-input rounded-md px-3 py-2 w-full bg-background font-mono text-sm min-h-[300px] resize-y"
              rows={12}
            />
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
