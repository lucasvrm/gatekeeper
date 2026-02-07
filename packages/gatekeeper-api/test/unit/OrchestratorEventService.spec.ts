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

  describe('getEventsFiltered', () => {
    const filterTestOutputId = 'filter-test-001'

    beforeEach(() => {
      OrchestratorEventService.clearBuffer(filterTestOutputId)
    })

    afterEach(() => {
      OrchestratorEventService.clearBuffer(filterTestOutputId)
    })

    it('filters events by level (error)', async () => {
      // Emit eventos com diferentes níveis
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'Something went wrong'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:start',
        provider: 'anthropic'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:failed',
        reason: 'Timeout'
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        level: 'error'
      })

      expect(filtered.length).toBeGreaterThanOrEqual(2) // agent:error e agent:failed
      expect(filtered.every(e => e.type.includes('error') || e.type.includes('failed'))).toBe(true)
    })

    it('filters events by stage (planning)', async () => {
      // Emit eventos com diferentes stages
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:bridge_plan_start',
        step: 1
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:bridge_spec_start',
        step: 2
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:bridge_plan_done',
        step: 1
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        stage: 'planning'
      })

      // Eventos de planning devem estar presentes
      expect(filtered.length).toBeGreaterThanOrEqual(1)
      expect(filtered.some(e => e.type.includes('plan'))).toBe(true)
    })

    it('filters events by type (exact match)', async () => {
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:tool_call',
        tool: 'read_file'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:tool_result',
        tool: 'read_file'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:start'
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        type: 'agent:tool_call'
      })

      expect(filtered).toHaveLength(1)
      expect(filtered[0].type).toBe('agent:tool_call')
    })

    it('filters events by search text (case-insensitive)', async () => {
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'Connection timeout occurred'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'File not found'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:info',
        message: 'Processing complete'
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        search: 'TIMEOUT'
      })

      expect(filtered.length).toBeGreaterThanOrEqual(1)
      // Verifica se o search é case-insensitive
      expect(filtered.some(e =>
        (e.type && e.type.toLowerCase().includes('timeout')) ||
        ('error' in e && typeof e.error === 'string' && e.error.toLowerCase().includes('timeout'))
      )).toBe(true)
    })

    it('combines multiple filters (level + stage)', async () => {
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'Planning failed',
        step: 1
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:warning',
        message: 'High token usage',
        step: 1
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'Execution failed',
        step: 4
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        level: 'error',
        stage: 'planning'
      })

      // Deve retornar apenas erros no stage planning
      expect(filtered.length).toBeGreaterThanOrEqual(1)
      expect(filtered.every(e => e.type.includes('error'))).toBe(true)
    })

    it('returns empty array when no events match filters', async () => {
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:start'
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {
        level: 'error',
        search: 'nonexistent-text-xyz'
      })

      expect(filtered).toEqual([])
    })

    it('returns all events when no filters provided', async () => {
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:start'
      })
      OrchestratorEventService.emitOrchestratorEvent(filterTestOutputId, {
        type: 'agent:error',
        error: 'Test error'
      })

      const filtered = await OrchestratorEventService.getEventsFiltered(filterTestOutputId, {})

      expect(filtered.length).toBeGreaterThanOrEqual(2)
    })

    it('handles unknown outputId gracefully', async () => {
      const filtered = await OrchestratorEventService.getEventsFiltered('nonexistent-output', {
        level: 'error'
      })

      expect(filtered).toEqual([])
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Format Events Tests (MP-EXPORT-03)
  // ───────────────────────────────────────────────────────────────────────────

  describe('formatEventsAsJSON', () => {
    it('should format events as pretty-printed JSON string', () => {
      const events = [
        {
          type: 'agent:start',
          level: 'info',
          timestamp: 1704067200000,
          message: 'Test message',
        },
      ]

      const json = OrchestratorEventService.formatEventsAsJSON(events)

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow()

      // Should be pretty-printed (contains newlines and indentation)
      expect(json).toContain('\n')
      expect(json).toContain('  ') // 2-space indentation

      // Should preserve all fields
      const parsed = JSON.parse(json)
      expect(parsed).toEqual(events)
    })

    it('should handle empty array', () => {
      const json = OrchestratorEventService.formatEventsAsJSON([])
      expect(json).toBe('[]')
    })

    it('should handle events with nested metadata', () => {
      const events = [
        {
          type: 'agent:error',
          metadata: { nested: { key: 'value' } },
          timestamp: 1704067200000,
        },
      ]

      const json = OrchestratorEventService.formatEventsAsJSON(events)
      const parsed = JSON.parse(json)
      expect(parsed[0].metadata.nested.key).toBe('value')
    })
  })

  describe('formatEventsAsCSV', () => {
    it('should format events as CSV with header row', () => {
      const events = [
        {
          type: 'agent:start',
          level: 'info',
          stage: 'planning',
          timestamp: 1704067200000,
          message: 'Starting planning',
          _level: 'info',
          _stage: 'planning',
          _message: 'Starting planning',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Should start with header
      expect(csv.startsWith('timestamp,level,stage,type,message,metadata')).toBe(true)

      // Should have 2 lines (header + 1 data row)
      const lines = csv.split('\n')
      expect(lines.length).toBe(2)
    })

    it('should escape commas in CSV values', () => {
      const events = [
        {
          type: 'agent:test',
          message: 'Message with, comma',
          timestamp: 1704067200000,
          _message: 'Message with, comma',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Comma-containing values should be wrapped in quotes
      expect(csv).toContain('"Message with, comma"')
    })

    it('should escape double quotes in CSV values', () => {
      const events = [
        {
          type: 'agent:test',
          message: 'Message with "quotes"',
          timestamp: 1704067200000,
          _message: 'Message with "quotes"',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Double quotes should be escaped as ""
      expect(csv).toContain('""quotes""')
    })

    it('should escape newlines in CSV values', () => {
      const events = [
        {
          type: 'agent:test',
          message: 'Line1\nLine2',
          timestamp: 1704067200000,
          _message: 'Line1\nLine2',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Newline-containing values should be wrapped in quotes
      expect(csv).toContain('"Line1\nLine2"')
    })

    it('should format timestamp as ISO 8601 string', () => {
      const timestamp = 1704067200000 // 2024-01-01T00:00:00.000Z
      const events = [
        {
          type: 'agent:test',
          timestamp,
          _message: 'Test',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Should contain ISO timestamp
      expect(csv).toContain('2024-01-01T00:00:00.000Z')
    })

    it('should serialize metadata as JSON string', () => {
      const events = [
        {
          type: 'agent:error',
          timestamp: 1704067200000,
          timeout: 30000,
          retryCount: 3,
          _message: 'Error',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)

      // Metadata column should contain JSON (may be escaped with "")
      // Check that metadata is present and contains the expected keys
      expect(csv).toMatch(/timeout.*30000/)
      expect(csv).toMatch(/retryCount.*3/)
    })

    it('should handle empty metadata gracefully', () => {
      const events = [
        {
          type: 'agent:test',
          timestamp: 1704067200000,
          _message: 'Test',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)
      const lines = csv.split('\n')

      // Should have header + 1 data row
      expect(lines.length).toBe(2)

      // Data row should have all 6 columns (some may be empty)
      const dataRow = lines[1]
      const columns = dataRow.split(',')
      expect(columns.length).toBeGreaterThanOrEqual(6)
    })

    it('should handle events without timestamp', () => {
      const events = [
        {
          type: 'agent:test',
          _message: 'Test',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)
      const lines = csv.split('\n')
      const dataRow = lines[1]

      // Timestamp column should be empty
      expect(dataRow.startsWith(',')).toBe(true)
    })

    it('should handle multiple events correctly', () => {
      const events = [
        {
          type: 'agent:start',
          timestamp: 1704067200000,
          _level: 'info',
          _stage: 'planning',
          _message: 'Starting',
        },
        {
          type: 'agent:error',
          timestamp: 1704067201000,
          _level: 'error',
          _stage: 'planning',
          _message: 'Failed',
        },
      ]

      const csv = OrchestratorEventService.formatEventsAsCSV(events)
      const lines = csv.split('\n')

      // Should have header + 2 data rows
      expect(lines.length).toBe(3)
      expect(lines[0]).toContain('timestamp,level,stage,type,message,metadata')
      expect(lines[1]).toContain('agent:start')
      expect(lines[2]).toContain('agent:error')
    })

    it('should return header only for empty array', () => {
      const csv = OrchestratorEventService.formatEventsAsCSV([])
      expect(csv).toBe('timestamp,level,stage,type,message,metadata')
    })
  })

  describe('getMetrics', () => {
    const metricsOutputId = 'test-output-metrics'

    beforeEach(() => {
      OrchestratorEventService.clearBuffer(metricsOutputId)
    })

    afterEach(() => {
      OrchestratorEventService.clearBuffer(metricsOutputId)
    })

    it('should return empty metrics for pipeline without events', async () => {
      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics).toEqual({
        pipelineId: metricsOutputId,
        totalEvents: 0,
        byLevel: {},
        byStage: {},
        byType: {},
        duration: { ms: 0, formatted: '00:00:00' },
        firstEvent: null,
        lastEvent: null,
      })
    })

    it('should aggregate events correctly', async () => {
      // Emit multiple events
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:start',
        _stage: 'planning',
        _level: 'info',
      })
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:error',
        _stage: 'planning',
        _level: 'error',
        error: 'Test error',
      })
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:done',
        _stage: 'execute',
        _level: 'info',
      })

      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics.totalEvents).toBe(3)
      expect(metrics.byType['agent:start']).toBe(1)
      expect(metrics.byType['agent:error']).toBe(1)
      expect(metrics.byType['agent:done']).toBe(1)
      expect(metrics.byStage['planning']).toBe(2)
      expect(metrics.byStage['execute']).toBe(1)
      expect(metrics.byLevel['info']).toBe(2)
      expect(metrics.byLevel['error']).toBe(1)
    })

    it('should calculate duration correctly', async () => {
      // Emit first event
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:start',
        _stage: 'planning',
      })

      // Wait 150ms
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Emit second event
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:done',
        _stage: 'execute',
      })

      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics.duration.ms).toBeGreaterThanOrEqual(100)
      expect(metrics.duration.ms).toBeLessThan(300) // Allow some margin
      expect(metrics.duration.formatted).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should infer level and stage when not provided', async () => {
      // Emit event without _level and _stage
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:error',
        error: 'Test error',
      })
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:bridge_plan_start',
      })

      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics.totalEvents).toBe(2)
      expect(metrics.byLevel['error']).toBe(1) // Inferred from 'agent:error'
      expect(metrics.byLevel['info']).toBe(1) // Inferred from 'agent:bridge_plan_start'
    })

    it('should handle timestamps correctly', async () => {
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:start',
      })

      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics.firstEvent).toBeTruthy()
      expect(metrics.lastEvent).toBeTruthy()
      expect(new Date(metrics.firstEvent!).getTime()).toBeLessThanOrEqual(
        new Date(metrics.lastEvent!).getTime()
      )
    })

    it('should handle single event duration as zero', async () => {
      OrchestratorEventService.emitOrchestratorEvent(metricsOutputId, {
        type: 'agent:start',
      })

      const metrics = await OrchestratorEventService.getMetrics(metricsOutputId)

      expect(metrics.totalEvents).toBe(1)
      expect(metrics.duration.ms).toBe(0)
      expect(metrics.duration.formatted).toBe('00:00:00')
    })
  })
})
