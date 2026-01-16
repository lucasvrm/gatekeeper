import { EventEmitter } from 'events'

export interface RunEvent {
  type: 'RUN_STATUS' | 'GATE_COMPLETE' | 'VALIDATOR_COMPLETE'
  runId: string
  data: Record<string, unknown>
}

class RunEventServiceClass extends EventEmitter {
  emitRunStatus(runId: string, status: string, data?: Record<string, unknown>) {
    console.log('[RunEventService] Emitting RUN_STATUS:', status, 'for run:', runId)
    this.emit('run-event', {
      type: 'RUN_STATUS',
      runId,
      data: { status, ...data },
    } as RunEvent)
  }

  emitGateComplete(runId: string, gateNumber: number, passed: boolean, gateName: string) {
    console.log('[RunEventService] Emitting GATE_COMPLETE:', gateName, 'for run:', runId)
    this.emit('run-event', {
      type: 'GATE_COMPLETE',
      runId,
      data: { gateNumber, passed, gateName },
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
    this.emit('run-event', {
      type: 'VALIDATOR_COMPLETE',
      runId,
      data: { gateNumber, validatorCode, status, passed },
    } as RunEvent)
  }
}

export const RunEventService = new RunEventServiceClass()
