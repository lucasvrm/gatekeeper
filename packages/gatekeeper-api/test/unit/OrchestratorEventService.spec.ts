/**
 * OrchestratorEventService — Unit Tests
 *
 * Tests the in-memory SSE event buffering system:
 *   - emitOrchestratorEvent: buffers events and re-emits via EventEmitter
 *   - getBufferedEvents: replays events for late-joining SSE clients
 *   - clearBuffer: cleanup on completion
 *   - TTL/size limits
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// We can't easily test the singleton, so we import the class
// via the module and test the exported singleton behavior
import { OrchestratorEventService } from '../../src/services/OrchestratorEventService.js'

describe('OrchestratorEventService', () => {
  const outputId = 'test-output-001'

  beforeEach(() => {
    OrchestratorEventService.clearBuffer(outputId)
    OrchestratorEventService.removeAllListeners()
  })

  afterEach(() => {
    OrchestratorEventService.clearBuffer(outputId)
    OrchestratorEventService.removeAllListeners()
  })

  describe('emitOrchestratorEvent', () => {
    it('emits events on the orchestrator-event channel', () => {
      const received: any[] = []
      OrchestratorEventService.on('orchestrator-event', (payload) => {
        received.push(payload)
      })

      OrchestratorEventService.emitOrchestratorEvent(outputId, {
        type: 'agent:start',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        step: 1,
      })

      expect(received).toHaveLength(1)
      expect(received[0].outputId).toBe(outputId)
      expect(received[0].event.type).toBe('agent:start')
    })

    it('buffers events for replay', () => {
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'agent:text', text: 'hello' })
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'agent:text', text: 'world' })

      const events = OrchestratorEventService.getBufferedEvents(outputId)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('agent:text')
      expect(events[1].type).toBe('agent:text')
    })
  })

  describe('getBufferedEvents', () => {
    it('returns empty array for unknown outputId', () => {
      const events = OrchestratorEventService.getBufferedEvents('nonexistent')
      expect(events).toEqual([])
    })

    it('filters out events older than 30s', () => {
      // Emit an event
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'old-event' })

      // Manually age the buffer entry by hacking the timestamp
      const buffer = (OrchestratorEventService as any).eventBuffer.get(outputId)
      buffer[0].timestamp = Date.now() - 31_000 // 31 seconds ago

      // Add a fresh event
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'fresh-event' })

      const events = OrchestratorEventService.getBufferedEvents(outputId)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('fresh-event')
    })
  })

  describe('clearBuffer', () => {
    it('removes all events for an outputId', () => {
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'evt1' })
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'evt2' })
      expect(OrchestratorEventService.getBufferedEvents(outputId)).toHaveLength(2)

      OrchestratorEventService.clearBuffer(outputId)
      expect(OrchestratorEventService.getBufferedEvents(outputId)).toEqual([])
    })

    it('does not affect other outputIds', () => {
      const other = 'other-output'
      OrchestratorEventService.emitOrchestratorEvent(outputId, { type: 'a' })
      OrchestratorEventService.emitOrchestratorEvent(other, { type: 'b' })

      OrchestratorEventService.clearBuffer(outputId)
      expect(OrchestratorEventService.getBufferedEvents(outputId)).toEqual([])
      expect(OrchestratorEventService.getBufferedEvents(other)).toHaveLength(1)

      OrchestratorEventService.clearBuffer(other)
    })
  })

  describe('buffer size limits', () => {
    it('trims buffer to MAX_BUFFER_PER_OUTPUT (50)', () => {
      for (let i = 0; i < 60; i++) {
        OrchestratorEventService.emitOrchestratorEvent(outputId, { type: `event-${i}` })
      }
      const events = OrchestratorEventService.getBufferedEvents(outputId)
      expect(events.length).toBeLessThanOrEqual(50)
      // Should have the most recent events
      expect(events[events.length - 1].type).toBe('event-59')
    })
  })
})
