import { useEffect, useRef } from 'react'
import { API_BASE } from '@/lib/api'

export interface OrchestratorEvent {
  type: string
  [key: string]: unknown
}

export function useOrchestratorEvents(
  outputId: string | undefined,
  onEvent: (event: OrchestratorEvent) => void
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!outputId) return

    console.log('[SSE:Orchestrator] Connecting for:', outputId)
    const eventSource = new EventSource(`${API_BASE}/orchestrator/events/${outputId}`)

    eventSource.onopen = () => {
      console.log('[SSE:Orchestrator] Connected for:', outputId)
    }

    eventSource.onmessage = (event) => {
      console.log('[SSE:Orchestrator] Event:', event.data)
      try {
        const data = JSON.parse(event.data) as OrchestratorEvent
        onEventRef.current(data)
      } catch (error) {
        console.error('[SSE:Orchestrator] Parse error:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('[SSE:Orchestrator] Error:', error)
    }

    return () => {
      console.log('[SSE:Orchestrator] Closing for:', outputId)
      eventSource.close()
    }
  }, [outputId])
}
