import { useEffect, useRef } from 'react'
import { API_BASE } from '@/lib/api'
import { ResilientEventSource } from '@/lib/ResilientEventSource'

export interface RunEvent {
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  runId: string
  data: Record<string, unknown>
}

export function useRunEvents(
  runId: string | undefined,
  onEvent: (event: RunEvent) => void
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!runId) return

    const url = `${API_BASE}/runs/${runId}/events`
    console.log('[SSE] Connecting to:', url)

    const source = new ResilientEventSource(url, {
      onMessage: (event) => {
        console.log('[SSE] Event received:', event.data)
        try {
          const data = JSON.parse(event.data) as RunEvent
          onEventRef.current(data)
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error)
        }
      },
      onOpen: () => {
        console.log('[SSE] Connection opened for run:', runId)
      },
      onError: (error) => {
        console.error('[SSE] Connection error:', error)
      },
      onStateChange: (state) => {
        console.log('[SSE] State changed:', state)
      },
    })

    source.connect()

    return () => {
      console.log('[SSE] Closing connection for run:', runId)
      source.close()
    }
  }, [runId])
}
