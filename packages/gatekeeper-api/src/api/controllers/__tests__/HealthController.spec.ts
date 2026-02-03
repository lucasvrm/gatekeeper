import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HealthController } from '@/api/controllers/HealthController.js'

/**
 * Contract: health-check-endpoint
 * Mode: STRICT
 * 
 * Objetivo: Validar o endpoint GET /api/health que retorna o status de saúde da API.
 * 
 * Este spec define o contrato para:
 * - Endpoint GET /api/health retorna status 200 com campo "status" = "ok"
 * - Endpoint retorna timestamp ISO 8601 válido
 * - Endpoint não requer autenticação
 * - Endpoint não modifica estado da aplicação
 * - Response é JSON válido
 */

// =============================================================================
// INLINE TYPES (evita dependência de @types/express durante validação)
// =============================================================================

interface Request {
  params?: Record<string, string>
  body?: Record<string, unknown>
  query?: Record<string, string | number>
}

interface Response {
  json: (data: unknown) => void
  status: (code: number) => Response
}

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockResponse(): { 
  res: Response
  jsonSpy: ReturnType<typeof vi.fn>
  statusSpy: ReturnType<typeof vi.fn>
} {
  const jsonSpy = vi.fn()
  const statusSpy = vi.fn()
  
  const res: Response = {
    json: jsonSpy,
    status: (code: number) => {
      statusSpy(code)
      return res
    },
  }
  
  return { res, jsonSpy, statusSpy }
}

// =============================================================================
// HEALTH CONTROLLER TESTS
// =============================================================================

describe('HealthController', () => {
  let controller: HealthController
  
  beforeEach(() => {
    controller = new HealthController()
    vi.clearAllMocks()
  })

  describe('GET /api/health - Happy Path', () => {
    // @clause CL-HEALTH-001
    it('succeeds when returning 200 OK with status field equal to ok', async () => {
      const req: Request = {}
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      // Assertions: HTTP status code = 200
      expect(statusSpy).toHaveBeenCalledWith(200)
      
      // Assertions: Response body contains status field
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(response).toBeDefined()
      expect(response.status).toBeDefined()
      
      // Assertions: status field value = "ok"
      expect(response.status).toBe('ok')
    })

    // @clause CL-HEALTH-002
    it('succeeds when returning ISO 8601 timestamp representing request time', async () => {
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      const beforeCall = new Date()
      await controller.getHealth(req, res)
      const afterCall = new Date()
      
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      
      // Assertions: Response body contains timestamp field
      expect(response.timestamp).toBeDefined()
      
      // Assertions: timestamp is a string
      expect(typeof response.timestamp).toBe('string')
      
      // Assertions: timestamp is a valid ISO 8601 date (parseable by new Date())
      const timestampDate = new Date(response.timestamp as string)
      expect(timestampDate.toISOString()).toBe(response.timestamp)
      
      // Verify timestamp is within reasonable range (between before and after call)
      expect(timestampDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(timestampDate.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    // @clause CL-HEALTH-003
    it('succeeds when returning different timestamps on subsequent calls', async () => {
      const req: Request = {}
      
      // First call
      const { res: res1, jsonSpy: jsonSpy1 } = createMockResponse()
      await controller.getHealth(req, res1)
      const response1 = jsonSpy1.mock.calls[0][0] as Record<string, unknown>
      const timestamp1 = response1.timestamp as string
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Second call
      const { res: res2, jsonSpy: jsonSpy2 } = createMockResponse()
      await controller.getHealth(req, res2)
      const response2 = jsonSpy2.mock.calls[0][0] as Record<string, unknown>
      const timestamp2 = response2.timestamp as string
      
      // Assertions: Two sequential calls return different timestamp values
      expect(timestamp1).toBeDefined()
      expect(timestamp2).toBeDefined()
      expect(timestamp1).not.toBe(timestamp2)
      
      // Verify both are valid ISO 8601 dates
      expect(new Date(timestamp1).toISOString()).toBe(timestamp1)
      expect(new Date(timestamp2).toISOString()).toBe(timestamp2)
      
      // Verify second timestamp is after first
      expect(new Date(timestamp2).getTime()).toBeGreaterThan(new Date(timestamp1).getTime())
    })

    // @clause CL-HEALTH-006
    it('succeeds when response format is valid JSON with correct Content-Type', async () => {
      const req: Request = {}
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      // Assertions: Response is called with json method (implies application/json)
      expect(jsonSpy).toHaveBeenCalled()
      expect(statusSpy).toHaveBeenCalledWith(200)
      
      // Assertions: Response body is valid JSON object
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(typeof response).toBe('object')
      expect(response).not.toBeNull()
      expect(Array.isArray(response)).toBe(false)
      
      // Verify JSON structure
      expect(Object.keys(response)).toContain('status')
      expect(Object.keys(response)).toContain('timestamp')
    })
  })

  describe('Invariants', () => {
    // @clause CL-HEALTH-004
    it('succeeds when endpoint does not modify application state', async () => {
      const req: Request = {}
      const { res: res1, jsonSpy: jsonSpy1 } = createMockResponse()
      const { res: res2, jsonSpy: jsonSpy2 } = createMockResponse()
      
      // Call endpoint first time
      await controller.getHealth(req, res1)
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))
      
      // Call endpoint second time
      await controller.getHealth(req, res2)
      
      const response1 = jsonSpy1.mock.calls[0][0] as Record<string, unknown>
      const response2 = jsonSpy2.mock.calls[0][0] as Record<string, unknown>
      
      // Assertions: No database queries executed (endpoint is idempotent)
      // Both calls should succeed with same status value
      expect(response1.status).toBe('ok')
      expect(response2.status).toBe('ok')
      
      // Assertions: Endpoint is idempotent (same structure, different timestamps)
      expect(Object.keys(response1).sort()).toEqual(Object.keys(response2).sort())
      expect(response1.status).toBe(response2.status)
      
      // Only timestamp should differ (proving no state change)
      expect(response1.timestamp).not.toBe(response2.timestamp)
    })

    // @clause CL-HEALTH-005
    it('succeeds when no authentication is required', async () => {
      // Request without any authentication headers or credentials
      const req: Request = {}
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      // Assertions: Request without auth headers succeeds
      expect(statusSpy).toHaveBeenCalledWith(200)
      
      // Assertions: Status code = 200 (not 401 or 403)
      expect(statusSpy).not.toHaveBeenCalledWith(401)
      expect(statusSpy).not.toHaveBeenCalledWith(403)
      
      // Verify response is valid
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(response.status).toBe('ok')
    })
  })

  describe('Response Structure Validation', () => {
    // @clause CL-HEALTH-001
    // @clause CL-HEALTH-002
    it('succeeds when response contains exactly status and timestamp fields', async () => {
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      const keys = Object.keys(response)
      
      // Verify response has exactly 2 fields
      expect(keys).toHaveLength(2)
      
      // Verify field names
      expect(keys).toContain('status')
      expect(keys).toContain('timestamp')
      
      // Verify field types
      expect(typeof response.status).toBe('string')
      expect(typeof response.timestamp).toBe('string')
    })

    // @clause CL-HEALTH-002
    it('succeeds when timestamp format matches ISO 8601 specification', async () => {
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      const timestamp = response.timestamp as string
      
      // ISO 8601 format validation
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      expect(timestamp).toMatch(iso8601Regex)
      
      // Verify it's parseable and round-trips correctly
      const parsed = new Date(timestamp)
      expect(parsed.toISOString()).toBe(timestamp)
      
      // Verify it's a recent timestamp (within last minute)
      const now = new Date()
      const diff = now.getTime() - parsed.getTime()
      expect(diff).toBeGreaterThanOrEqual(0)
      expect(diff).toBeLessThan(60000) // Less than 1 minute
    })
  })

  describe('Multiple Concurrent Calls', () => {
    // @clause CL-HEALTH-003
    // @clause CL-HEALTH-004
    it('succeeds when handling multiple concurrent requests without state interference', async () => {
      const req: Request = {}
      
      // Make 5 concurrent calls
      const promises = Array.from({ length: 5 }, () => {
        const { res, jsonSpy } = createMockResponse()
        return controller.getHealth(req, res).then(() => jsonSpy.mock.calls[0][0])
      })
      
      const responses = await Promise.all(promises)
      
      // All responses should have status "ok"
      responses.forEach(response => {
        const r = response as Record<string, unknown>
        expect(r.status).toBe('ok')
        expect(r.timestamp).toBeDefined()
      })
      
      // All timestamps should be valid ISO 8601
      const timestamps = responses.map(r => (r as Record<string, unknown>).timestamp as string)
      timestamps.forEach(ts => {
        expect(new Date(ts).toISOString()).toBe(ts)
      })
      
      // Timestamps might be the same or different depending on execution speed
      // But all should be valid and within a small time window
      const dates = timestamps.map(ts => new Date(ts).getTime())
      const minTime = Math.min(...dates)
      const maxTime = Math.max(...dates)
      expect(maxTime - minTime).toBeLessThan(1000) // Within 1 second
    })
  })

  describe('Edge Cases', () => {
    // @clause CL-HEALTH-001
    it('succeeds when called with empty request object', async () => {
      const req: Request = {}
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      expect(statusSpy).toHaveBeenCalledWith(200)
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(response.status).toBe('ok')
      expect(response.timestamp).toBeDefined()
    })

    // @clause CL-HEALTH-001
    it('succeeds when called with request containing query parameters', async () => {
      const req: Request = {
        query: { foo: 'bar', baz: 123 }
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      // Query parameters should be ignored
      expect(statusSpy).toHaveBeenCalledWith(200)
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(response.status).toBe('ok')
      expect(response.timestamp).toBeDefined()
    })

    // @clause CL-HEALTH-001
    it('succeeds when called with request containing body', async () => {
      const req: Request = {
        body: { data: 'should be ignored' }
      }
      const { res, jsonSpy, statusSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      // Body should be ignored (GET request)
      expect(statusSpy).toHaveBeenCalledWith(200)
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      expect(response.status).toBe('ok')
      expect(response.timestamp).toBeDefined()
    })
  })

  describe('Timestamp Precision', () => {
    // @clause CL-HEALTH-002
    it('succeeds when timestamp includes milliseconds precision', async () => {
      const req: Request = {}
      const { res, jsonSpy } = createMockResponse()
      
      await controller.getHealth(req, res)
      
      const response = jsonSpy.mock.calls[0][0] as Record<string, unknown>
      const timestamp = response.timestamp as string
      
      // Verify milliseconds are present (format: YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(timestamp).toMatch(/\.\d{3}Z$/)
      
      // Extract milliseconds
      const millisMatch = timestamp.match(/\.(\d{3})Z$/)
      expect(millisMatch).not.toBeNull()
      
      // Milliseconds should be a valid number 000-999
      const millis = parseInt(millisMatch![1], 10)
      expect(millis).toBeGreaterThanOrEqual(0)
      expect(millis).toBeLessThanOrEqual(999)
    })
  })

  describe('Response Consistency', () => {
    // @clause CL-HEALTH-001
    // @clause CL-HEALTH-006
    it('succeeds when response structure is consistent across multiple calls', async () => {
      const req: Request = {}
      const responses: Array<Record<string, unknown>> = []
      
      // Make 3 sequential calls
      for (let i = 0; i < 3; i++) {
        const { res, jsonSpy } = createMockResponse()
        await controller.getHealth(req, res)
        responses.push(jsonSpy.mock.calls[0][0] as Record<string, unknown>)
        
        // Small delay between calls
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
      
      // All responses should have same structure
      responses.forEach(response => {
        expect(Object.keys(response).sort()).toEqual(['status', 'timestamp'])
        expect(response.status).toBe('ok')
        expect(typeof response.timestamp).toBe('string')
      })
      
      // All timestamps should be different
      const timestamps = responses.map(r => r.timestamp as string)
      const uniqueTimestamps = new Set(timestamps)
      expect(uniqueTimestamps.size).toBe(3)
    })
  })
})
