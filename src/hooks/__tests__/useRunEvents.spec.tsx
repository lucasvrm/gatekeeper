/**
 * Tests for useRunEvents hook with ResilientEventSource
 *
 * Tests:
 *   - Happy path: connects and receives events
 *   - Exponential backoff on error
 *   - Watchdog detects silent connection death
 *   - Max retries is respected
 *   - Cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ResilientEventSource } from '@/lib/ResilientEventSource'

// ─── Mock EventSource ──────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState = 0 // CONNECTING

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {
    this.readyState = 2 // CLOSED
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1 // OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: string, lastEventId?: string) {
    const event = new MessageEvent('message', {
      data,
      lastEventId,
    })
    this.onmessage?.(event)
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ResilientEventSource', () => {
  let originalEventSource: typeof EventSource

  beforeEach(() => {
    vi.useFakeTimers()
    MockEventSource.instances = []
    originalEventSource = globalThis.EventSource
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.EventSource = originalEventSource
  })

  describe('Happy path', () => {
    it('should connect and receive messages', () => {
      const onMessage = vi.fn()
      const onOpen = vi.fn()

      const source = new ResilientEventSource('http://test/events', {
        onMessage,
        onOpen,
      })

      source.connect()

      expect(MockEventSource.instances).toHaveLength(1)
      expect(source.getState()).toBe('connecting')

      // Simulate connection open
      MockEventSource.instances[0].simulateOpen()
      expect(source.getState()).toBe('open')
      expect(onOpen).toHaveBeenCalled()

      // Simulate message
      MockEventSource.instances[0].simulateMessage('{"test": "data"}', '1')
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: '{"test": "data"}',
        })
      )

      source.close()
    })

    it('should track lastEventId from messages', () => {
      const onMessage = vi.fn()
      const source = new ResilientEventSource('http://test/events', { onMessage })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Send message with lastEventId
      MockEventSource.instances[0].simulateMessage('data', '42')

      expect(source.getLastEventId()).toBe('42')

      source.close()
    })
  })

  describe('Exponential backoff', () => {
    it('should apply exponential backoff on reconnection', () => {
      const onMessage = vi.fn()
      const onError = vi.fn()

      const source = new ResilientEventSource('http://test/events', {
        onMessage,
        onError,
        initialRetryDelay: 1000,
        retryMultiplier: 2,
        maxRetryDelay: 30000,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // First error
      MockEventSource.instances[0].simulateError()
      expect(source.getState()).toBe('reconnecting')
      expect(source.getRetryCount()).toBe(1)

      // Advance 1 second (initial delay)
      vi.advanceTimersByTime(1000)
      expect(MockEventSource.instances).toHaveLength(2)

      // Second error
      MockEventSource.instances[1].simulateError()
      expect(source.getRetryCount()).toBe(2)

      // Advance 2 seconds (1000 * 2)
      vi.advanceTimersByTime(2000)
      expect(MockEventSource.instances).toHaveLength(3)

      // Third error
      MockEventSource.instances[2].simulateError()
      expect(source.getRetryCount()).toBe(3)

      // Next delay would be 4 seconds (2000 * 2)
      vi.advanceTimersByTime(4000)
      expect(MockEventSource.instances).toHaveLength(4)

      source.close()
    })

    it('should cap retry delay at maxRetryDelay', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        initialRetryDelay: 10000,
        retryMultiplier: 10,
        maxRetryDelay: 30000,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Error - delay would be 10000 * 10 = 100000, capped to 30000
      MockEventSource.instances[0].simulateError()

      // Advance 10 seconds (initial delay)
      vi.advanceTimersByTime(10000)
      expect(MockEventSource.instances).toHaveLength(2)

      MockEventSource.instances[1].simulateError()

      // Next delay should be capped at 30000
      vi.advanceTimersByTime(29999)
      expect(MockEventSource.instances).toHaveLength(2) // Not yet

      vi.advanceTimersByTime(1)
      expect(MockEventSource.instances).toHaveLength(3) // Now

      source.close()
    })
  })

  describe('Watchdog', () => {
    it('should reconnect if no data received within watchdog timeout', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        watchdogTimeout: 30000,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      expect(source.getState()).toBe('open')

      // Advance 29 seconds - should still be connected
      vi.advanceTimersByTime(29000)
      expect(MockEventSource.instances).toHaveLength(1)

      // Advance 1 more second - watchdog triggers
      vi.advanceTimersByTime(1000)
      expect(source.getState()).toBe('reconnecting')

      // Wait for retry delay
      vi.advanceTimersByTime(1000)
      expect(MockEventSource.instances).toHaveLength(2)

      source.close()
    })

    it('should reset watchdog on message received', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        watchdogTimeout: 30000,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Advance 25 seconds
      vi.advanceTimersByTime(25000)

      // Receive message - resets watchdog
      MockEventSource.instances[0].simulateMessage('keepalive')

      // Advance another 25 seconds (total 50s from open, but only 25s from last message)
      vi.advanceTimersByTime(25000)
      expect(MockEventSource.instances).toHaveLength(1) // Still connected

      // Advance 5 more seconds (30s from last message)
      vi.advanceTimersByTime(5000)
      expect(source.getState()).toBe('reconnecting')

      source.close()
    })
  })

  describe('Max retries', () => {
    it('should stop retrying after maxRetries', () => {
      const onStateChange = vi.fn()
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        onStateChange,
        maxRetries: 3,
        initialRetryDelay: 100,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Error 1 -> retryCount becomes 1, schedules retry
      MockEventSource.instances[0].simulateError()
      vi.advanceTimersByTime(100)
      expect(source.getRetryCount()).toBe(1)
      expect(MockEventSource.instances).toHaveLength(2)

      // Error 2 -> retryCount becomes 2, schedules retry
      MockEventSource.instances[1].simulateError()
      vi.advanceTimersByTime(200)
      expect(source.getRetryCount()).toBe(2)
      expect(MockEventSource.instances).toHaveLength(3)

      // Error 3 -> retryCount becomes 3, schedules retry (last allowed)
      MockEventSource.instances[2].simulateError()
      vi.advanceTimersByTime(400)
      expect(source.getRetryCount()).toBe(3)
      expect(MockEventSource.instances).toHaveLength(4)

      // Error 4 -> retryCount is 3 which equals maxRetries, should give up
      MockEventSource.instances[3].simulateError()

      // Advance time but no new connection should be created
      vi.advanceTimersByTime(1000)
      expect(MockEventSource.instances).toHaveLength(4)
      expect(source.getState()).toBe('closed')

      source.close()
    })

    it('should retry indefinitely when maxRetries is 0', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        maxRetries: 0,
        initialRetryDelay: 100,
        maxRetryDelay: 100, // Keep it short for test
      })

      source.connect()

      // Create 20 connections (more than default limit)
      for (let i = 0; i < 20; i++) {
        MockEventSource.instances[i].simulateError()
        vi.advanceTimersByTime(100)
      }

      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(20)
      expect(source.getState()).toBe('connecting')

      source.close()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup all timers on close', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        watchdogTimeout: 30000,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Close while watchdog is running
      source.close()

      expect(source.getState()).toBe('closed')

      // Advance past watchdog timeout - should not reconnect
      vi.advanceTimersByTime(60000)
      expect(MockEventSource.instances).toHaveLength(1)
    })

    it('should cleanup retry timer on close', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        initialRetryDelay: 5000,
      })

      source.connect()
      MockEventSource.instances[0].simulateError()

      // Close while waiting to retry
      source.close()

      // Advance past retry delay - should not reconnect
      vi.advanceTimersByTime(10000)
      expect(MockEventSource.instances).toHaveLength(1)
    })

    it('should not connect after close is called', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
      })

      source.close()
      source.connect()

      expect(MockEventSource.instances).toHaveLength(0)
    })
  })

  describe('LastEventId in URL', () => {
    it('should include lastEventId in reconnection URL', () => {
      const source = new ResilientEventSource('http://test/events', {
        onMessage: vi.fn(),
        initialRetryDelay: 100,
      })

      source.connect()
      MockEventSource.instances[0].simulateOpen()

      // Receive message with lastEventId
      MockEventSource.instances[0].simulateMessage('data', '42')

      // Error and reconnect
      MockEventSource.instances[0].simulateError()
      vi.advanceTimersByTime(100)

      // Check reconnection URL includes lastEventId
      expect(MockEventSource.instances[1].url).toContain('lastEventId=42')

      source.close()
    })
  })
})
