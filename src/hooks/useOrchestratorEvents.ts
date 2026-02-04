import { useEffect, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface OrchestratorEvent {
  type: string
  [key: string]: unknown
}

/**
 * SSE hook for orchestrator and agent pipeline events.
 *
 * @param id        - The outputId or runId to listen for
 * @param onEvent   - Callback for each event
 * @param basePath  - SSE endpoint base path:
 *                    'orchestrator' → /api/orchestrator/events/${id} (default, for individual steps)
 *                    'agent'        → /api/agent/events/${id} (for full pipeline runs)
 */
export function useOrchestratorEvents(
  id: string | undefined,
  onEvent: (event: OrchestratorEvent) => void,
  basePath: 'orchestrator' | 'agent' = 'orchestrator'
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!id) return

    const url = `${API_BASE}/${basePath}/events/${id}`
    console.log(`[SSE:${basePath}] Connecting for:`, id)
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log(`[SSE:${basePath}] Connected for:`, id)
    }

    eventSource.onmessage = (event) => {
      console.log(`[SSE:${basePath}] Event:`, event.data)
      try {
        const data = JSON.parse(event.data) as OrchestratorEvent
        onEventRef.current(data)
      } catch (error) {
        console.error(`[SSE:${basePath}] Parse error:`, error)
      }
    }

    eventSource.onerror = (error) => {
      console.error(`[SSE:${basePath}] Error:`, error)
    }

    return () => {
      console.log(`[SSE:${basePath}] Closing for:`, id)
      eventSource.close()
    }
  }, [id, basePath])
}
