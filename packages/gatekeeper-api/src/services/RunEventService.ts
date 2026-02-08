import { EventEmitter } from 'events'

export interface RunEvent {
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  runId: string
  data: Record<string, unknown>
}

export interface BufferedEvent {
  seq: number
  runId: string
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  data: Record<string, unknown>
  timestamp: number
}

const BUFFER_TTL_MS = 60_000 // 60 seconds
const MAX_BUFFER_PER_RUN = 50

class RunEventServiceClass extends EventEmitter {
  private eventBuffer: Map<string, BufferedEvent[]> = new Map()
  private seqCounter = 0

  private addToBuffer(runId: string, type: RunEvent['type'], data: Record<string, unknown>): number {
    const seq = this.seqCounter++
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
    this.addToBuffer(runId, 'RUN_STATUS', eventData)
    this.emit('run-event', {
      type: 'RUN_STATUS',
      runId,
      data: eventData,
    } as RunEvent)
  }

  emitGateComplete(runId: string, gateNumber: number, passed: boolean, gateName: string) {
    console.log('[RunEventService] Emitting GATE_COMPLETE:', gateName, 'for run:', runId)
    const eventData = { gateNumber, passed, gateName }
    this.addToBuffer(runId, 'GATE_COMPLETE', eventData)
    this.emit('run-event', {
      type: 'GATE_COMPLETE',
      runId,
      data: eventData,
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
    this.addToBuffer(runId, 'VALIDATOR_COMPLETE', eventData)
    this.emit('run-event', {
      type: 'VALIDATOR_COMPLETE',
      runId,
      data: eventData,
    } as RunEvent)
  }
}

export const RunEventService = new RunEventServiceClass()
