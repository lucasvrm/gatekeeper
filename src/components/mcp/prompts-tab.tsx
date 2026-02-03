import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { PromptFormDialog } from "@/components/mcp/prompt-form-dialog"
import { api } from "@/lib/api"
import type { PromptInstruction } from "@/lib/types"

export function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptInstruction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PromptInstruction | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.mcp.prompts.list()
      setPrompts(data)
    } catch {
      toast.error("Falha ao carregar prompts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const handleCreate = async (name: string, content: string) => {
    try {
      await api.mcp.prompts.create({ name, content })
      toast.success("Prompt criado")
      setShowForm(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar prompt")
    }
  }

  const handleUpdate = async (name: string, content: string) => {
    if (!editing) return
    try {
      await api.mcp.prompts.update(editing.id, { name, content })
      toast.success("Prompt atualizado")
      setEditing(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar prompt")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.prompts.delete(id)
      toast.success("Prompt removido")
      setDeletingId(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover prompt")
    }
  }

  const handleToggleActive = async (prompt: PromptInstruction) => {
    try {
      await api.mcp.prompts.update(prompt.id, { isActive: !prompt.isActive })
      reload()
    } catch {
      toast.error("Falha ao atualizar prompt")
    }
  }

  if (loading) {
    return (
      <div data-testid="prompts-tab" className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div data-testid="prompts-tab" className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Instruções em linguagem natural injetadas automaticamente nos prompts do MCP.
        </p>
        <button
          onClick={() => setShowForm(true)}
          data-testid="add-prompt-button"
          className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          + Novo Prompt
        </button>
      </div>

      {prompts.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma instrução cadastrada. Clique em &quot;+ Novo Prompt&quot; para começar.
        </div>
      )}

      <div className="space-y-2">
        {prompts.map((prompt) => (
          <div
            key={prompt.id}
            className="border border-border rounded-md"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <button
                className="flex items-center gap-2 text-left flex-1"
                onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
              >
                <span className="text-xs text-muted-foreground">
                  {expandedId === prompt.id ? "▼" : "▶"}
                </span>
                <span className="font-medium text-sm">{prompt.name}</span>
                {!prompt.isActive && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    inativo
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(prompt)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={prompt.isActive ? "Desativar" : "Ativar"}
                >
                  {prompt.isActive ? "🟢" : "⚪"}
                </button>
                <button
                  onClick={() => setEditing(prompt)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Editar
                </button>
                {deletingId === prompt.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="text-xs text-destructive font-medium"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setDeletingId(prompt.id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            {expandedId === prompt.id && (
              <div className="px-4 pb-3 border-t border-border pt-3">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                  {prompt.content}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {(showForm || editing) && (
        <PromptFormDialog
          initial={editing || undefined}
          onSave={editing ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
