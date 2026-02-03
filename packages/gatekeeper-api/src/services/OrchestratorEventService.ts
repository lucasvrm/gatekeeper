import { EventEmitter } from 'events'

/**
 * Orchestrator SSE event types.
 * Defined locally to avoid circular dependency with gatekeeper-orchestrator package.
 */
export interface OrchestratorEventData {
  type: string
  [key: string]: unknown
}

export interface OrchestratorStreamEvent {
  outputId: string
  event: OrchestratorEventData
}

class OrchestratorEventServiceClass extends EventEmitter {
  emit(event: 'orchestrator-event', payload: OrchestratorStreamEvent): boolean
  emit(event: string, payload: OrchestratorStreamEvent): boolean {
    return super.emit(event, payload)
  }

  emitOrchestratorEvent(outputId: string, event: OrchestratorEventData) {
    console.log('[OrchestratorEventService] Emitting:', event.type, 'for:', outputId)
    this.emit('orchestrator-event', { outputId, event })
  }
}

export const OrchestratorEventService = new OrchestratorEventServiceClass()
