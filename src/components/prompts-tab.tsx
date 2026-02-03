import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"
import { PromptFormDialog } from "./prompt-form-dialog"

export function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptInstruction[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptInstruction | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.prompts.list()
      setPrompts(data)
    } catch {
      toast.error("Falha ao carregar prompts")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPrompt(null)
    setDialogOpen(true)
  }

  const handleEdit = (prompt: PromptInstruction) => {
    setEditingPrompt(prompt)
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Prompts</h2>
          <p className="text-sm text-muted-foreground">
            Instruções pré-definidas para o MCP
          </p>
        </div>
        <button
          onClick={handleCreate}
          data-testid="new-prompt-button"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          Novo Prompt
        </button>
      </div>

      <div data-testid="prompts-list" className="space-y-2">
        {prompts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum prompt encontrado. Clique em "Novo Prompt" para criar.
          </p>
        ) : (
          prompts.map((prompt) => (
            <div
              key={prompt.id}
              data-testid={`prompt-card-${prompt.id}`}
              className="border rounded-lg overflow-hidden"
            >
              <div className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors">
                <button
                  onClick={() => toggleExpand(prompt.id)}
                  className="flex-1 text-left"
                >
                  <h3 className="font-medium">{prompt.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {prompt.content.length} caracteres · Atualizado em{" "}
                    {new Date(prompt.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </button>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(prompt)}
                    data-testid={`edit-prompt-${prompt.id}`}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id, prompt.name)}
                    data-testid={`delete-prompt-${prompt.id}`}
                    className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                  >
                    Deletar
                  </button>
                </div>
              </div>

              {expandedId === prompt.id && (
                <div className="border-t bg-muted/30 p-4">
                  <pre
                    data-testid={`prompt-content-${prompt.id}`}
                    className="text-sm font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto"
                  >
                    {prompt.content}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {dialogOpen && (
        <PromptFormDialog
          prompt={editingPrompt}
          onClose={() => setDialogOpen(false)}
          onSave={loadPrompts}
        />
      )}
    </div>
  )
}
