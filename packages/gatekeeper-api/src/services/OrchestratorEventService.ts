import { EventEmitter } from 'events'
import type { AgentEvent } from '../types/agent.types.js'

/**
 * Orchestrator SSE event types.
 * Defined locally to avoid circular dependency with gatekeeper-orchestrator package.
 */
export interface OrchestratorEventData {
  type: string
  [key: string]: unknown
}

/**
 * Any event that can flow through the SSE channel.
 * AgentEvent (discriminated union) is structurally compatible with
 * OrchestratorEventData but TypeScript can't prove it due to index
 * signature constraints — so we accept both explicitly.
 */
export type EmittableEvent = OrchestratorEventData | AgentEvent

export interface OrchestratorStreamEvent {
  outputId: string
  event: OrchestratorEventData
}

/**
 * Buffered event for replay on late SSE connections.
 */
interface BufferedEvent {
  event: OrchestratorEventData
  timestamp: number
}

const BUFFER_TTL_MS = 30_000 // Keep events for 30 seconds
const MAX_BUFFER_PER_OUTPUT = 50

class OrchestratorEventServiceClass extends EventEmitter {
  /** Recent events per outputId for replay on late SSE connections */
  private eventBuffer = new Map<string, BufferedEvent[]>()

  emit(event: 'orchestrator-event', payload: OrchestratorStreamEvent): boolean
  emit(event: string, payload: OrchestratorStreamEvent): boolean {
    return super.emit(event, payload)
  }

  emitOrchestratorEvent(outputId: string, event: EmittableEvent) {
    // AgentEvent has type: string (literal subtypes) + other fields → structurally satisfies OrchestratorEventData
    const data = event as OrchestratorEventData
    console.log('[OrchestratorEventService] Emitting:', data.type, 'for:', outputId)

    // Buffer the event for late-joining SSE clients
    if (!this.eventBuffer.has(outputId)) {
      this.eventBuffer.set(outputId, [])
    }
    const buffer = this.eventBuffer.get(outputId)!
    buffer.push({ event: data, timestamp: Date.now() })

    // Trim buffer size
    if (buffer.length > MAX_BUFFER_PER_OUTPUT) {
      buffer.splice(0, buffer.length - MAX_BUFFER_PER_OUTPUT)
    }

    this.emit('orchestrator-event', { outputId, event: data })
  }

  /**
   * Get buffered events for an outputId (for replay on SSE connect).
   * Returns events from the last BUFFER_TTL_MS milliseconds.
   */
  getBufferedEvents(outputId: string): OrchestratorEventData[] {
    const buffer = this.eventBuffer.get(outputId)
    if (!buffer) return []

    const cutoff = Date.now() - BUFFER_TTL_MS
    return buffer
      .filter((b) => b.timestamp >= cutoff)
      .map((b) => b.event)
  }

  /**
   * Clean up buffer for a completed outputId.
   */
  clearBuffer(outputId: string) {
    this.eventBuffer.delete(outputId)
  }
}

export const OrchestratorEventService = new OrchestratorEventServiceClass()
