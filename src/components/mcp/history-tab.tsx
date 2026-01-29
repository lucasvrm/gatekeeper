import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { SessionHistory } from "@/lib/types"

export function HistoryTab() {
  const [history, setHistory] = useState<SessionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const data = await api.mcp.history.list()
      setHistory(data)
    } catch {
      toast.error("Falha ao carregar histórico")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.mcp.history.delete(id)
      toast.success("Entrada deletada com sucesso")
      await loadHistory()
    } catch {
      toast.error("Falha ao deletar entrada")
    }
  }

  if (loading) {
    return (
      <div data-testid="history-tab">
        <div data-testid="loading-skeleton" className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-1/4" />
          <div className="h-20 bg-muted rounded animate-pulse" />
          <div className="h-20 bg-muted rounded animate-pulse" />
          <div className="h-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div data-testid="history-tab" className="space-y-4">
      <h2 className="text-xl font-bold">Session History</h2>

      <div data-testid="history-list" className="space-y-2">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum histórico de sessão encontrado.
          </p>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              data-testid={`history-item-${item.id}`}
              className="border rounded-lg p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
              <div>
                <h3 className="font-medium capitalize">{item.taskType}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.gitStrategy} - {item.status}
                </p>
                {item.branch && (
                  <p className="text-xs text-muted-foreground">
                    Branch: {item.branch}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                role="button"
                onClick={() => handleDelete(item.id)}
                data-testid={`delete-button-${item.id}`}
                className="text-red-600 hover:text-red-800 px-2 py-1"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
