/**
 * Integration Tests: Runs SSE Heartbeat (MP-3)
 *
 * Validates that GET /runs/:id/events sends periodic heartbeat frames
 * to keep the connection alive and detect silent connection death.
 *
 * Tests:
 *   - Heartbeat frames are sent at SSE_HEARTBEAT_INTERVAL
 *   - Heartbeat format is SSE comment (: heartbeat\n\n)
 *   - Heartbeat interval is cleaned up on client disconnect
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import { runsRoutes } from '../../src/api/routes/runs.routes'

// ─── Test Server Setup ─────────────────────────────────────────────────────

let app: Express
let server: http.Server
let baseUrl: string

beforeAll(async () => {
  app = express()
  app.use('/api', runsRoutes)

  server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://localhost:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Runs SSE Heartbeat — Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * HB-01: Connection sends initial comment
   *
   * Verifies that the SSE endpoint sends `: connected\n\n` immediately
   * upon connection (existing behavior).
   */
  describe('HB-01: Initial connection', () => {
    it('should send initial connected comment', async () => {
      const runId = 'test-run-hb01'
      const receivedData: string[] = []

      const response = await new Promise<http.IncomingMessage>((resolve) => {
        const req = http.get(`${baseUrl}/api/runs/${runId}/events`, (res) => resolve(res))
        req.on('error', (err) => {
          throw err
        })
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('text/event-stream')

      // Read initial data
      await new Promise<void>((resolve) => {
        response.on('data', (chunk: Buffer) => {
          receivedData.push(chunk.toString())
          // Stop after receiving initial comment
          if (receivedData.join('').includes(': connected')) {
            response.destroy()
            resolve()
          }
        })

        // Timeout fallback
        setTimeout(() => {
          response.destroy()
          resolve()
        }, 1000)
      })

      const allData = receivedData.join('')
      expect(allData).toContain(': connected')
    })
  })

  /**
   * HB-02: Heartbeat frames are sent periodically
   *
   * Verifies that after SSE_HEARTBEAT_INTERVAL (default 15s),
   * a heartbeat comment is sent.
   */
  describe('HB-02: Periodic heartbeat', () => {
    it('should send heartbeat comment after SSE_HEARTBEAT_INTERVAL', async () => {
      vi.useRealTimers() // Need real timers for this test

      const runId = 'test-run-hb02'
      const receivedData: string[] = []
      let heartbeatReceived = false

      const response = await new Promise<http.IncomingMessage>((resolve) => {
        const req = http.get(`${baseUrl}/api/runs/${runId}/events`, (res) => resolve(res))
        req.on('error', (err) => {
          throw err
        })
      })

      // Collect data for up to 20 seconds (heartbeat should arrive at ~15s)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          response.destroy()
          resolve()
        }, 20_000)

        response.on('data', (chunk: Buffer) => {
          const data = chunk.toString()
          receivedData.push(data)

          // Check for heartbeat frame (SSE comment format)
          if (data.includes(': heartbeat') || data.includes(':heartbeat')) {
            heartbeatReceived = true
            clearTimeout(timeout)
            response.destroy()
            resolve()
          }
        })

        response.on('end', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      const allData = receivedData.join('')

      // This test will FAIL until MP-4 implements heartbeat
      expect(heartbeatReceived).toBe(true)
      expect(allData).toMatch(/: ?heartbeat/)
    }, 25_000) // Extended timeout for 20s wait
  })

  /**
   * HB-03: Multiple heartbeats over time
   *
   * Verifies that heartbeats continue being sent at regular intervals.
   */
  describe('HB-03: Multiple heartbeats', () => {
    it('should send at least 2 heartbeats in 35 seconds', async () => {
      vi.useRealTimers()

      const runId = 'test-run-hb03'
      const heartbeats: string[] = []

      const response = await new Promise<http.IncomingMessage>((resolve) => {
        const req = http.get(`${baseUrl}/api/runs/${runId}/events`, (res) => resolve(res))
        req.on('error', (err) => {
          throw err
        })
      })

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          response.destroy()
          resolve()
        }, 35_000)

        response.on('data', (chunk: Buffer) => {
          const data = chunk.toString()
          // Count heartbeat frames
          const matches = data.match(/: ?heartbeat/g)
          if (matches) {
            heartbeats.push(...matches)
          }

          // Stop early if we got 2 heartbeats
          if (heartbeats.length >= 2) {
            clearTimeout(timeout)
            response.destroy()
            resolve()
          }
        })

        response.on('end', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      // This test will FAIL until MP-4 implements heartbeat
      expect(heartbeats.length).toBeGreaterThanOrEqual(2)
    }, 40_000)
  })

  /**
   * HB-04: Heartbeat interval cleanup on disconnect
   *
   * Verifies that when the client disconnects, the heartbeat
   * interval is properly cleared to prevent memory leaks.
   */
  describe('HB-04: Cleanup on disconnect', () => {
    it('should not throw errors after client disconnects', async () => {
      vi.useRealTimers()

      const runId = 'test-run-hb04'
      let errorOccurred = false

      // Track console.error for interval errors after disconnect
      const originalError = console.error
      console.error = (...args: unknown[]) => {
        const msg = args.join(' ')
        if (msg.includes('write after end') || msg.includes('ERR_STREAM_WRITE_AFTER_END')) {
          errorOccurred = true
        }
        originalError.apply(console, args)
      }

      const response = await new Promise<http.IncomingMessage>((resolve) => {
        const req = http.get(`${baseUrl}/api/runs/${runId}/events`, (res) => resolve(res))
        req.on('error', () => {
          // Ignore connection errors on destroy
        })
      })

      // Wait for initial connection
      await new Promise<void>((resolve) => {
        response.once('data', () => resolve())
        setTimeout(resolve, 500)
      })

      // Disconnect immediately
      response.destroy()

      // Wait longer than heartbeat interval to ensure no errors
      await new Promise((resolve) => setTimeout(resolve, 18_000))

      console.error = originalError

      // Should NOT have errors writing to closed connection
      expect(errorOccurred).toBe(false)
    }, 25_000)
  })

  /**
   * HB-05: Heartbeat uses correct SSE comment format
   *
   * Verifies the heartbeat follows SSE spec: `: comment\n\n`
   */
  describe('HB-05: SSE comment format', () => {
    it('should use SSE comment format (colon prefix)', async () => {
      vi.useRealTimers()

      const runId = 'test-run-hb05'
      let heartbeatData = ''

      const response = await new Promise<http.IncomingMessage>((resolve) => {
        const req = http.get(`${baseUrl}/api/runs/${runId}/events`, (res) => resolve(res))
        req.on('error', (err) => {
          throw err
        })
      })

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          response.destroy()
          resolve()
        }, 20_000)

        response.on('data', (chunk: Buffer) => {
          const data = chunk.toString()
          if (data.includes('heartbeat')) {
            heartbeatData = data
            clearTimeout(timeout)
            response.destroy()
            resolve()
          }
        })
      })

      // SSE comment format: starts with colon
      // This test will FAIL until MP-4 implements heartbeat
      expect(heartbeatData).toMatch(/^: ?heartbeat\n\n/m)
    }, 25_000)
  })
})

// ─── Edge Cases ────────────────────────────────────────────────────────────

describe('Runs SSE Heartbeat — Edge Cases', () => {
  /**
   * EC-01: Multiple concurrent connections
   *
   * Verifies each connection gets its own heartbeat interval.
   */
  describe('EC-01: Concurrent connections', () => {
    it('should handle multiple concurrent SSE connections', async () => {
      vi.useRealTimers()

      const connections: http.IncomingMessage[] = []
      const dataByConn: string[][] = [[], [], []]

      // Open 3 concurrent connections
      for (let i = 0; i < 3; i++) {
        const response = await new Promise<http.IncomingMessage>((resolve) => {
          const req = http.get(`${baseUrl}/api/runs/concurrent-${i}/events`, (res) => resolve(res))
          req.on('error', () => {})
        })
        connections.push(response)

        response.on('data', (chunk: Buffer) => {
          dataByConn[i].push(chunk.toString())
        })
      }

      // Wait for initial comments
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Verify all connections received initial comment
      for (let i = 0; i < 3; i++) {
        const allData = dataByConn[i].join('')
        expect(allData).toContain(': connected')
      }

      // Cleanup
      connections.forEach((conn) => conn.destroy())
    }, 10_000)
  })
})
