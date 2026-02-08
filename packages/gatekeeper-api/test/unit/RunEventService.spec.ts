/**
 * RunEventService — Unit Tests
 *
 * Tests buffer implementation with TTL and sequence tracking:
 *   - Events are buffered with monotonically increasing seq
 *   - Buffer respects MAX_BUFFER_PER_RUN limit (50 events per runId)
 *   - Events expire after BUFFER_TTL_MS (60 seconds)
 *   - getBufferedEventsAfter returns only events with seq > afterSeq
 *   - Buffer is correctly filtered by runId
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RunEventService } from '../../src/services/RunEventService.js'

describe('RunEventService — Buffer Implementation', () => {
  beforeEach(() => {
    // Reset service state between tests
    RunEventService._reset()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  // ── Monotonic Sequence ─────────────────────────────────────────────

  describe('monotonic sequence tracking', () => {
    it('should assign monotonically increasing seq to each buffered event', () => {
      const runId = 'run-001'

      RunEventService.emitRunStatus(runId, 'queued')
      RunEventService.emitRunStatus(runId, 'running')
      RunEventService.emitGateComplete(runId, 0, true, 'Gate 0')

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(3)
      expect(events[0].seq).toBe(0)
      expect(events[1].seq).toBe(1)
      expect(events[2].seq).toBe(2)
    })

    it('should maintain global seq counter across different runIds', () => {
      RunEventService.emitRunStatus('run-001', 'queued')
      RunEventService.emitRunStatus('run-002', 'queued')
      RunEventService.emitRunStatus('run-001', 'running')

      const events1 = RunEventService.getBufferedEventsAfter('run-001', -1)
      const events2 = RunEventService.getBufferedEventsAfter('run-002', -1)

      expect(events1[0].seq).toBe(0)
      expect(events2[0].seq).toBe(1)
      expect(events1[1].seq).toBe(2)
    })
  })

  // ── Buffer Size Limit ──────────────────────────────────────────────

  describe('buffer size limit (MAX_BUFFER_PER_RUN = 50)', () => {
    it('should respect limit of 50 events per runId', () => {
      const runId = 'run-overflow'

      // Emit 60 events to trigger overflow
      for (let i = 0; i < 60; i++) {
        RunEventService.emitRunStatus(runId, `status-${i}`)
      }

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(50)
      // Should keep the most recent 50 events (10-59)
      expect(events[0].data.status).toBe('status-10')
      expect(events[49].data.status).toBe('status-59')
    })

    it('should not affect other runIds when one hits the limit', () => {
      const runId1 = 'run-limit-1'
      const runId2 = 'run-limit-2'

      // Fill runId1 to capacity
      for (let i = 0; i < 50; i++) {
        RunEventService.emitRunStatus(runId1, `status-${i}`)
      }

      // Add a few events to runId2
      RunEventService.emitRunStatus(runId2, 'queued')
      RunEventService.emitRunStatus(runId2, 'running')

      const events1 = RunEventService.getBufferedEventsAfter(runId1, -1)
      const events2 = RunEventService.getBufferedEventsAfter(runId2, -1)

      expect(events1.length).toBe(50)
      expect(events2.length).toBe(2)
    })
  })

  // ── TTL Expiration ─────────────────────────────────────────────────

  describe('TTL expiration (BUFFER_TTL_MS = 60000ms)', () => {
    it('should expire events older than 60 seconds', () => {
      const runId = 'run-ttl'

      RunEventService.emitRunStatus(runId, 'queued')
      RunEventService.emitRunStatus(runId, 'running')

      // Advance time by 59 seconds (within TTL)
      vi.advanceTimersByTime(59_000)
      let events = RunEventService.getBufferedEventsAfter(runId, -1)
      expect(events.length).toBe(2)

      // Advance time by 2 more seconds (61 seconds total, exceeds TTL)
      vi.advanceTimersByTime(2_000)
      events = RunEventService.getBufferedEventsAfter(runId, -1)
      expect(events.length).toBe(0)
    })

    it('should remove only expired events while keeping recent ones', () => {
      const runId = 'run-partial-expire'

      RunEventService.emitRunStatus(runId, 'queued')

      // Advance time by 50 seconds
      vi.advanceTimersByTime(50_000)

      RunEventService.emitRunStatus(runId, 'running')

      // Advance time by 15 more seconds (65 seconds total)
      // First event should expire (65s old), second should remain (15s old)
      vi.advanceTimersByTime(15_000)

      const events = RunEventService.getBufferedEventsAfter(runId, -1)
      expect(events.length).toBe(1)
      expect(events[0].data.status).toBe('running')
    })
  })

  // ── getBufferedEventsAfter ─────────────────────────────────────────

  describe('getBufferedEventsAfter filtering', () => {
    it('should return only events with seq greater than afterSeq', () => {
      const runId = 'run-replay'

      RunEventService.emitRunStatus(runId, 'queued') // seq 0
      RunEventService.emitRunStatus(runId, 'running') // seq 1
      RunEventService.emitGateComplete(runId, 0, true, 'Gate 0') // seq 2
      RunEventService.emitValidatorComplete(runId, 0, 'V001', 'passed', true) // seq 3

      const events = RunEventService.getBufferedEventsAfter(runId, 1)

      expect(events.length).toBe(2)
      expect(events[0].seq).toBe(2)
      expect(events[1].seq).toBe(3)
    })

    it('should return empty array when afterSeq is greater than all events', () => {
      const runId = 'run-empty'

      RunEventService.emitRunStatus(runId, 'queued')
      RunEventService.emitRunStatus(runId, 'running')

      const events = RunEventService.getBufferedEventsAfter(runId, 100)

      expect(events.length).toBe(0)
    })

    it('should return all events when afterSeq is -1', () => {
      const runId = 'run-all'

      RunEventService.emitRunStatus(runId, 'queued')
      RunEventService.emitRunStatus(runId, 'running')
      RunEventService.emitRunStatus(runId, 'completed')

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(3)
    })
  })

  // ── runId Isolation ────────────────────────────────────────────────

  describe('runId isolation', () => {
    it('should isolate buffer by runId', () => {
      const runId1 = 'run-001'
      const runId2 = 'run-002'

      RunEventService.emitRunStatus(runId1, 'queued')
      RunEventService.emitRunStatus(runId2, 'queued')
      RunEventService.emitRunStatus(runId1, 'running')
      RunEventService.emitRunStatus(runId2, 'running')

      const events1 = RunEventService.getBufferedEventsAfter(runId1, -1)
      const events2 = RunEventService.getBufferedEventsAfter(runId2, -1)

      expect(events1.length).toBe(2)
      expect(events2.length).toBe(2)
      expect(events1.every((e) => e.runId === runId1)).toBe(true)
      expect(events2.every((e) => e.runId === runId2)).toBe(true)
    })

    it('should return empty array for unknown runId', () => {
      RunEventService.emitRunStatus('run-001', 'queued')

      const events = RunEventService.getBufferedEventsAfter('run-unknown', -1)

      expect(events.length).toBe(0)
    })
  })

  // ── Event Types ────────────────────────────────────────────────────

  describe('event type buffering', () => {
    it('should buffer RUN_STATUS events correctly', () => {
      const runId = 'run-status'

      RunEventService.emitRunStatus(runId, 'queued', { foo: 'bar' })

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('RUN_STATUS')
      expect(events[0].data.status).toBe('queued')
      expect(events[0].data.foo).toBe('bar')
    })

    it('should buffer GATE_COMPLETE events correctly', () => {
      const runId = 'run-gate'

      RunEventService.emitGateComplete(runId, 0, true, 'Gate 0')

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('GATE_COMPLETE')
      expect(events[0].data.gateNumber).toBe(0)
      expect(events[0].data.passed).toBe(true)
      expect(events[0].data.gateName).toBe('Gate 0')
    })

    it('should buffer VALIDATOR_COMPLETE events correctly', () => {
      const runId = 'run-validator'

      RunEventService.emitValidatorComplete(runId, 0, 'V001', 'passed', true)

      const events = RunEventService.getBufferedEventsAfter(runId, -1)

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('VALIDATOR_COMPLETE')
      expect(events[0].data.gateNumber).toBe(0)
      expect(events[0].data.validatorCode).toBe('V001')
      expect(events[0].data.status).toBe('passed')
      expect(events[0].data.passed).toBe(true)
    })
  })
})
