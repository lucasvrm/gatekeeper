import { useState, useEffect, useCallback, useRef } from "react"
import { api } from "@/lib/api"
import type { LogFilterOptions } from "@/lib/types"
import type { OrchestratorEvent } from "./useOrchestratorEvents"

interface UseLogEventsOptions {
  pipelineId?: string
  filters?: LogFilterOptions
  debounceMs?: number
  enableCache?: boolean
  cacheTTL?: number
}

interface UseLogEventsResult {
  data: OrchestratorEvent[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

// Simple in-memory cache
const cache = new Map<
  string,
  { data: OrchestratorEvent[]; timestamp: number }
>()

function getCacheKey(pipelineId: string, filters: LogFilterOptions): string {
  return `${pipelineId}-${JSON.stringify(filters)}`
}

/**
 * Hook para buscar e filtrar logs de eventos do orquestrador.
 * Suporta debounce, cache in-memory, e auto-refetch quando filtros mudam.
 *
 * @example
 * const { data, loading, error, refetch } = useLogEvents({
 *   pipelineId: "abc123",
 *   filters: { level: "error", search: "timeout" },
 *   debounceMs: 300,
 * })
 */
export function useLogEvents({
  pipelineId,
  filters = {},
  debounceMs = 300,
  enableCache = true,
  cacheTTL = 60000, // 60s
}: UseLogEventsOptions): UseLogEventsResult {
  const [data, setData] = useState<OrchestratorEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = useCallback(async () => {
    if (!pipelineId) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Check cache
    if (enableCache) {
      const cacheKey = getCacheKey(pipelineId, filters)
      const cached = cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        setData(cached.data)
        setLoading(false)
        setError(null)
        return
      }
    }

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await api.orchestrator.getFilteredLogs(pipelineId, filters)

      if (!controller.signal.aborted) {
        const events = response.events as OrchestratorEvent[]
        setData(events)

        // Update cache
        if (enableCache) {
          const cacheKey = getCacheKey(pipelineId, filters)
          cache.set(cacheKey, { data: events, timestamp: Date.now() })

          // Cleanup old cache entries
          if (cache.size > 50) {
            const entries = Array.from(cache.entries())
            const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
            const toDelete = sortedEntries.slice(0, 25)
            toDelete.forEach(([key]) => cache.delete(key))
          }
        }

        setError(null)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const error = err instanceof Error ? err : new Error("Failed to fetch logs")
        setError(error)
        setData([])
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [pipelineId, filters, enableCache, cacheTTL])

  // Debounced fetch effect
  useEffect(() => {
    if (!pipelineId) return

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      fetchLogs()
    }, debounceMs)

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [pipelineId, filters, debounceMs, fetchLogs])

  // Manual refetch (no debounce)
  const refetch = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    await fetchLogs()
  }, [fetchLogs])

  return {
    data,
    loading,
    error,
    refetch,
  }
}
