import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { MCPSessionConfig } from "@/lib/types"

interface UseSessionConfigReturn {
  config: MCPSessionConfig | null
  loading: boolean
  saving: boolean
  error: string | null
  reload: () => Promise<void>
  update: (config: MCPSessionConfig) => Promise<boolean>
}

export function useSessionConfig(): UseSessionConfigReturn {
  const [config, setConfig] = useState<MCPSessionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.mcp.session.get()
      setConfig(data.config)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config")
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(async (newConfig: MCPSessionConfig): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await api.mcp.session.update({ config: newConfig })
      await reload()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config")
      throw err
    } finally {
      setSaving(false)
    }
  }, [reload])

  useEffect(() => {
    reload().catch(() => {})
  }, [reload])

  return { config, loading, saving, error, reload, update }
}
