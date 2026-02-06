import { useEffect, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface OrchestratorEvent {
  type: string
  [key: string]: unknown
}

/**
 * SSE hook for orchestrator and agent pipeline events.
 * Supports deduplication of events already processed via REST backfill.
 *
 * @param id             - The outputId or runId to listen for
 * @param onEvent        - Callback for each event
 * @param basePath       - 'orchestrator' | 'agent'
 * @param processedIds   - Optional Set of SSE frame IDs already processed (for dedup after reconciliation)
 */
export function useOrchestratorEvents(
  id: string | undefined,
  onEvent: (event: OrchestratorEvent) => void,
  basePath: 'orchestrator' | 'agent' = 'orchestrator',
  processedIds?: Set<string>,
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // Track the highest seq seen for external consumers
  const lastSeqRef = useRef(0)

  // Dedup set: seeded from reconciliation's already-processed IDs
  const processedRef = useRef<Set<string>>(processedIds ?? new Set())

  useEffect(() => {
    if (!id) return

    const url = `${API_BASE}/${basePath}/events/${id}`
    console.log(`[SSE:${basePath}] Connecting for:`, id)
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log(`[SSE:${basePath}] Connected for:`, id)
    }

    eventSource.onmessage = (event) => {
      // Deduplication: skip events already processed via REST backfill
      const frameId = event.lastEventId
      if (frameId && processedRef.current.has(frameId)) {
        return
      }

      // Track this frame ID
      if (frameId) {
        processedRef.current.add(frameId)
        const numericSeq = parseInt(frameId, 10)
        if (!isNaN(numericSeq) && numericSeq > lastSeqRef.current) {
          lastSeqRef.current = numericSeq
        }
        // Cap dedup set to prevent unbounded growth
        if (processedRef.current.size > 1000) {
          const entries = Array.from(processedRef.current)
          processedRef.current = new Set(entries.slice(-500))
        }
      }

      try {
        const data = JSON.parse(event.data) as OrchestratorEvent
        onEventRef.current(data)
      } catch (error) {
        console.error(`[SSE:${basePath}] Parse error:`, error)
      }
    }

    eventSource.onerror = (error) => {
      console.error(`[SSE:${basePath}] Error:`, error)
      // On reconnection, browser auto-sends Last-Event-Id header
    }

    return () => {
      console.log(`[SSE:${basePath}] Closing for:`, id)
      eventSource.close()
    }
  }, [id, basePath])

  return { lastSeqRef }
}
