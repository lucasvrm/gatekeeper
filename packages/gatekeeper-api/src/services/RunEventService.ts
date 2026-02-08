import { EventEmitter } from 'events'

export interface RunEvent {
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  runId: string
  data: Record<string, unknown>
  seq?: number // Sequence number for SSE replay support
}

export interface BufferedEvent {
  seq: number
  runId: string
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  data: Record<string, unknown>
  timestamp: number
}

// Configurable via environment variables
const BUFFER_TTL_MS = parseInt(process.env.RUN_EVENT_BUFFER_TTL || '60000', 10)
const MAX_BUFFER_PER_RUN = parseInt(process.env.RUN_EVENT_MAX_BUFFER_SIZE || '50', 10)
const BUFFER_ENABLED = process.env.RUN_EVENT_BUFFER_ENABLED !== 'false'

class RunEventServiceClass extends EventEmitter {
  private eventBuffer: Map<string, BufferedEvent[]> = new Map()
  private seqCounter = 0

  /** Reset internal state - for testing only */
  _reset(): void {
    this.eventBuffer.clear()
    this.seqCounter = 0
  }

  private addToBuffer(runId: string, type: RunEvent['type'], data: Record<string, unknown>): number {
    const seq = this.seqCounter++

    // Skip buffering if disabled via env
    if (!BUFFER_ENABLED) {
      return seq
    }

    const event: BufferedEvent = {
      seq,
      runId,
      type,
      data,
      timestamp: Date.now(),
    }

    if (!this.eventBuffer.has(runId)) {
      this.eventBuffer.set(runId, [])
    }

    const buffer = this.eventBuffer.get(runId)!
    buffer.push(event)

    // Enforce MAX_BUFFER_PER_RUN limit (keep most recent events)
    if (buffer.length > MAX_BUFFER_PER_RUN) {
      buffer.splice(0, buffer.length - MAX_BUFFER_PER_RUN)
    }

    return seq
  }

  getBufferedEventsAfter(runId: string, afterSeq: number): BufferedEvent[] {
    // Return empty if buffering is disabled
    if (!BUFFER_ENABLED) {
      return []
    }

    const buffer = this.eventBuffer.get(runId)
    if (!buffer) {
      return []
    }

    const now = Date.now()
    const cutoffTime = now - BUFFER_TTL_MS

    // Filter expired events and events with seq <= afterSeq
    return buffer.filter((event) => event.timestamp > cutoffTime && event.seq > afterSeq)
  }

  emitRunStatus(runId: string, status: string, data?: Record<string, unknown>) {
    console.log('[RunEventService] Emitting RUN_STATUS:', status, 'for run:', runId)
    const eventData = { status, ...data }
    const seq = this.addToBuffer(runId, 'RUN_STATUS', eventData)
    this.emit('run-event', {
      type: 'RUN_STATUS',
      runId,
      data: eventData,
      seq,
    } as RunEvent)
  }

  emitGateComplete(runId: string, gateNumber: number, passed: boolean, gateName: string) {
    console.log('[RunEventService] Emitting GATE_COMPLETE:', gateName, 'for run:', runId)
    const eventData = { gateNumber, passed, gateName }
    const seq = this.addToBuffer(runId, 'GATE_COMPLETE', eventData)
    this.emit('run-event', {
      type: 'GATE_COMPLETE',
      runId,
      data: eventData,
      seq,
    } as RunEvent)
  }

  emitValidatorComplete(
    runId: string,
    gateNumber: number,
    validatorCode: string,
    status: string,
    passed: boolean
  ) {
    console.log('[RunEventService] Emitting VALIDATOR_COMPLETE:', validatorCode, 'for run:', runId)
    const eventData = { gateNumber, validatorCode, status, passed }
    const seq = this.addToBuffer(runId, 'VALIDATOR_COMPLETE', eventData)
    this.emit('run-event', {
      type: 'VALIDATOR_COMPLETE',
      runId,
      data: eventData,
      seq,
    } as RunEvent)
  }
}

export const RunEventService = new RunEventServiceClass()
