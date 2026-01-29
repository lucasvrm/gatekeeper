import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { ContextPack } from "@/lib/types"
import { ContextPackFormDialog } from "./context-pack-form-dialog"

export function ContextPacksTab() {
  const [packs, setPacks] = useState<ContextPack[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPack, setEditingPack] = useState<ContextPack | null>(null)

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.contextPacks.list()
      setPacks(data)
    } catch {
      toast.error("Falha ao carregar context packs")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingPack(null)
    setDialogOpen(true)
  }

  const handleEdit = (pack: ContextPack) => {
    setEditingPack(pack)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.contextPacks.delete(id)
      toast.success("Context pack deletado com sucesso")
      await loadPacks()
    } catch {
      toast.error("Falha ao deletar context pack")
    }
  }

  if (loading) {
    return (
      <div data-testid="context-packs-tab">
        <div data-testid="loading-skeleton" className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-24 bg-muted rounded animate-pulse" />
          <div className="h-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="context-packs-tab" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Context Packs</h2>
        <button
          role="button"
          onClick={handleCreate}
          data-testid="new-context-pack-button"
          className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          New Context Pack
        </button>
      </div>

      <div data-testid="context-packs-list" className="space-y-2">
        {packs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum context pack encontrado. Clique em "New Context Pack" para criar um.
          </p>
        ) : (
          packs.map((pack) => (
            <div
              key={pack.id}
              data-testid={`context-pack-card-${pack.id}`}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{pack.name}</h3>
                  <p className="text-sm text-muted-foreground">{pack.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pack.files.length} arquivo(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    role="button"
                    onClick={() => handleEdit(pack)}
                    data-testid={`edit-button-${pack.id}`}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    role="button"
                    onClick={() => handleDelete(pack.id)}
                    data-testid={`delete-button-${pack.id}`}
                    className="text-red-600 hover:text-red-800 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {dialogOpen && (
        <ContextPackFormDialog
          pack={editingPack}
          onClose={() => setDialogOpen(false)}
          onSave={loadPacks}
        />
      )}
    </div>
  )
}
