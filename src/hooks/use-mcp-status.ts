import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { MCPStatus } from "@/lib/types"

interface UseMCPStatusReturn {
  status: MCPStatus | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useMCPStatus(): UseMCPStatusReturn {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.mcp.status.get()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { status, loading, error, reload }
}
