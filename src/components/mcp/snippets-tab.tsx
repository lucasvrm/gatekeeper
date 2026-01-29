import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { Snippet } from "@/lib/types"
import { SnippetFormDialog } from "./snippet-form-dialog"

export function SnippetsTab() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)

  useEffect(() => {
    loadSnippets()
  }, [])

  const loadSnippets = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.snippets.list()
      setSnippets(data)
    } catch {
      toast.error("Falha ao carregar snippets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingSnippet(null)
    setDialogOpen(true)
  }

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.snippets.delete(id)
      toast.success("Snippet deletado com sucesso")
      await loadSnippets()
    } catch {
      toast.error("Falha ao deletar snippet")
    }
  }

  if (loading) {
    return (
      <div data-testid="snippets-tab">
        <div data-testid="loading-skeleton" className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="snippets-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Snippets</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-snippet-button"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          New Snippet
        </button>
      </div>

      <div data-testid="snippets-list" className="space-y-2">
        {snippets.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum snippet encontrado. Clique em "New Snippet" para criar um.
          </p>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              data-testid={`snippet-card-${snippet.id}`}
              className="border rounded-lg p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-medium">{snippet.name}</h3>
                <p className="text-sm text-muted-foreground">{snippet.category}</p>
              </div>
              <div className="flex gap-2">
                <button
                  role="button"
                  onClick={() => handleEdit(snippet)}
                  data-testid={`edit-button-${snippet.id}`}
                  className="text-blue-600 hover:text-blue-800 px-2 py-1"
                >
                  Edit
                </button>
                <button
                  role="button"
                  onClick={() => handleDelete(snippet.id)}
                  data-testid={`delete-button-${snippet.id}`}
                  className="text-red-600 hover:text-red-800 px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {dialogOpen && (
        <SnippetFormDialog
          snippet={editingSnippet}
          onClose={() => setDialogOpen(false)}
          onSave={loadSnippets}
        />
      )}
    </div>
  )
}
