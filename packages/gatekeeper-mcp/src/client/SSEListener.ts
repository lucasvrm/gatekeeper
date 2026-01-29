/**
 * SSE Listener for Gatekeeper run events
 * Provides a wrapper around EventSource for better control
 */

import type { RunEvent } from './types.js'

export interface SSEListenerConfig {
  baseUrl: string
  runId: string
  onEvent: (event: RunEvent) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

export class SSEListener {
  private eventSource: EventSource | null = null
  private config: SSEListenerConfig
  private closed = false

  constructor(config: SSEListenerConfig) {
    this.config = config
  }

  connect(): void {
    if (this.eventSource) {
      this.close()
    }

    const url = `${this.config.baseUrl}/runs/${this.config.runId}/events`
    this.eventSource = new EventSource(url)
    this.closed = false

    this.eventSource.onmessage = (event) => {
      if (this.closed) return
      try {
        const data = JSON.parse(event.data)
        this.config.onEvent({ ...data, runId: this.config.runId })
      } catch (error) {
        this.config.onError?.(error instanceof Error ? error : new Error('Parse error'))
      }
    }

    this.eventSource.onerror = () => {
      if (!this.closed) {
        this.config.onError?.(new Error('SSE connection error'))
        this.close()
      }
    }
  }

  close(): void {
    this.closed = true
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.config.onClose?.()
    }
  }

  get isConnected(): boolean {
    return this.eventSource !== null && !this.closed
  }
}

/**
 * Create a simple subscription to run events
 */
export function subscribeToRunEvents(
  baseUrl: string,
  runId: string,
  callback: (event: RunEvent) => void
): () => void {
  const listener = new SSEListener({
    baseUrl,
    runId,
    onEvent: callback,
  })

  listener.connect()

  return () => listener.close()
}
