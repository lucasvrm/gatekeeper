/**
 * Integration Tests: Bridge Discovery Events
 *
 * Validates that POST /agent/bridge/discovery returns 202 and emits SSE events
 * during execution. Discovery maps the codebase before planning.
 *
 * BC-01: Async Response Pattern (202 Accepted immediately)
 * BC-02: SSE Event Emission during discovery
 * BC-03: Frontend SSE Processing (agent:bridge_discovery_done)
 * BC-04: Error Handling (agent:error via SSE)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response } from 'express'
import type { AgentEvent } from '../../src/types/agent.types'

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock Prisma client
vi.mock('../../src/db/client', () => ({
  prisma: {
    workspace: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    agentRun: {
      create: vi.fn().mockResolvedValue({ id: 'test-run-id' }),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    agentRunStep: {
      create: vi.fn().mockResolvedValue({ id: 'test-step-id' }),
      update: vi.fn(),
    },
    agentPhaseConfig: {
      findFirst: vi.fn().mockResolvedValue({
        step: 0,
        provider: 'claude-code',
        model: 'sonnet',
        maxIterations: 30,
        maxTokens: 16384,
        temperature: 0.3,
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    pipelineEvent: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    pipelineState: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

// Mock AgentPromptAssembler
vi.mock('../../src/services/AgentPromptAssembler', () => ({
  AgentPromptAssembler: class {
    assembleForSubstep = vi.fn().mockResolvedValue('Discovery system prompt')
  },
}))

// Mock LLM Provider Registry
vi.mock('../../src/services/providers/LLMProviderRegistry', () => ({
  LLMProviderRegistry: class {
    static fromEnv() { return new this() }
    get = vi.fn()
    register = vi.fn()
    has = vi.fn().mockReturnValue(true)
    list = vi.fn().mockReturnValue(['anthropic', 'openai', 'claude-code'])
  },
}))

// Mock AgentRunPersistenceService
vi.mock('../../src/services/AgentRunPersistenceService', () => ({
  AgentRunPersistenceService: class {
    createRun = vi.fn().mockResolvedValue('test-run-id')
    startStep = vi.fn().mockResolvedValue('test-step-id')
    completeStep = vi.fn().mockResolvedValue(undefined)
    updateCheckpoint = vi.fn().mockResolvedValue(undefined)
    completeRun = vi.fn().mockResolvedValue(undefined)
    failRun = vi.fn().mockResolvedValue(undefined)
    resumeRun = vi.fn().mockResolvedValue(undefined)
  },
}))

// ─── Test Imports (after mocks) ─────────────────────────────────────────────

import { BridgeController } from '../../src/api/controllers/BridgeController'
import { OrchestratorEventService } from '../../src/services/OrchestratorEventService'
import { AgentOrchestratorBridge } from '../../src/services/AgentOrchestratorBridge'

// ─── Helpers ───────────────────────────────────────────────────────────────

interface MockRequest {
  body: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string>
}

interface MockResponse {
  statusCode: number
  body: Record<string, unknown>
  headersSent: boolean
  status: (code: number) => MockResponse
  json: (data: Record<string, unknown>) => MockResponse
}

function createMockRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}): MockRequest {
  return { body, params, query: {} }
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: {},
    headersSent: false,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: Record<string, unknown>) {
      this.body = data
      this.headersSent = true
      return this
    },
  }
  return res
}

// ─── Unit Tests: BridgeController.generateDiscovery ────────────────────────

describe('BridgeController.generateDiscovery - Unit Tests', () => {
  let controller: BridgeController
  let emitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    controller = new BridgeController()
    // Spy on OrchestratorEventService.emitOrchestratorEvent
    emitSpy = vi.spyOn(OrchestratorEventService, 'emitOrchestratorEvent').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  /**
   * UT-01: BridgeController.generateDiscovery returns 202
   */
  describe('UT-01: Returns 202 Accepted', () => {
    it('should return 202 status code immediately', async () => {
      const mockGenerateDiscovery = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return {
          outputId: 'test-discovery',
          artifacts: [{ filename: 'discovery_report.md', content: '# Discovery\nCodebase map' }],
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          agentResult: { iterations: 5, model: 'claude-sonnet', text: '' },
        }
      })

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockImplementation(mockGenerateDiscovery)

      const req = createMockRequest({
        taskDescription: 'Explore the authentication system',
        projectPath: '/test/project',
      })
      const res = createMockResponse()
      const startTime = Date.now()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(500)
      expect(res.statusCode).toBe(202)
      expect(res.body).toHaveProperty('outputId')
      expect(res.body).toHaveProperty('eventsUrl')
    })

    it('should include eventsUrl matching /api/orchestrator/events/{outputId}', async () => {
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockResolvedValue({
        outputId: 'discovery-456',
        artifacts: [],
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        agentResult: { iterations: 0, model: 'test', text: '' },
      })

      const req = createMockRequest({
        taskDescription: 'Test task',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      expect(res.body.eventsUrl).toMatch(/^\/api\/orchestrator\/events\//)
    })
  })

  /**
   * UT-02: Passes onEvent callback
   */
  describe('UT-02: Passes onEvent callback', () => {
    it('should call bridge.generateDiscovery with onEvent callback', async () => {
      const mockGenerateDiscovery = vi.fn().mockResolvedValue({
        outputId: 'test-output',
        artifacts: [],
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        agentResult: { iterations: 0, model: 'test', text: '' },
      })
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockImplementation(mockGenerateDiscovery)

      const req = createMockRequest({
        taskDescription: 'Test',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockGenerateDiscovery).toHaveBeenCalled()
      const lastCall = mockGenerateDiscovery.mock.calls[0]
      expect(lastCall[1]).toBeDefined()
      expect(lastCall[1]).toHaveProperty('onEvent')
      expect(typeof lastCall[1].onEvent).toBe('function')
    })

    it('should emit events via OrchestratorEventService when onEvent is called', async () => {
      let capturedOnEvent: ((event: AgentEvent) => void) | null = null

      const mockGenerateDiscovery = vi.fn().mockImplementation(async (input, callbacks) => {
        capturedOnEvent = callbacks?.onEvent
        return {
          outputId: 'emit-test',
          artifacts: [],
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          agentResult: { iterations: 0, model: 'test', text: '' },
        }
      })
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockImplementation(mockGenerateDiscovery)

      const req = createMockRequest({
        taskDescription: 'Test',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 50))

      if (capturedOnEvent) {
        capturedOnEvent({ type: 'agent:iteration', iteration: 1 } as AgentEvent)
      }

      // Check that agent:iteration event was emitted (may be 2nd call after bridge_discovery_done)
      const iterationCall = emitSpy.mock.calls.find(call =>
        call[1] && typeof call[1] === 'object' && call[1].type === 'agent:iteration'
      )
      expect(iterationCall).toBeDefined()
      expect(iterationCall?.[0]).toEqual(expect.any(String))
      expect(iterationCall?.[1]).toMatchObject({ type: 'agent:iteration', iteration: 1 })
    })
  })

  /**
   * UT-03: Emits agent:bridge_discovery_done on success
   */
  describe('UT-03: Emits completion event', () => {
    it('should emit agent:bridge_discovery_done with discovery_report.md artifact', async () => {
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockResolvedValue({
        outputId: 'complete-test',
        artifacts: [
          { filename: 'discovery_report.md', content: '# Discovery Report\n\nFindings here' },
        ],
        tokensUsed: { prompt: 200, completion: 100, total: 300 },
        agentResult: { iterations: 10, model: 'claude-sonnet', text: 'done' },
      })

      const req = createMockRequest({
        taskDescription: 'Explore codebase',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(emitSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'agent:bridge_discovery_done',
          artifacts: expect.arrayContaining([
            expect.objectContaining({ filename: 'discovery_report.md' }),
          ]),
        })
      )
    })
  })

  /**
   * Validation: Returns 400 for missing required fields
   */
  describe('Validation', () => {
    it('should return 400 when taskDescription is missing', async () => {
      const req = createMockRequest({
        projectPath: '/test/project',
        // taskDescription is missing
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toContain('taskDescription')
    })

    it('should return 400 when projectPath is missing', async () => {
      const req = createMockRequest({
        taskDescription: 'Test task',
        // projectPath is missing
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toContain('projectPath')
    })
  })
})

// ─── Integration Tests: SSE Event Emission ─────────────────────────────────

describe('Bridge Discovery Events - Integration Tests', () => {
  let emittedEvents: Array<{ outputId: string; event: Record<string, unknown> }>

  beforeEach(() => {
    emittedEvents = []
    vi.spyOn(OrchestratorEventService, 'emitOrchestratorEvent').mockImplementation(
      (outputId: string, event: Record<string, unknown>) => {
        emittedEvents.push({ outputId, event })
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * IT-01: SSE events emitted during discovery
   */
  describe('IT-01: SSE events emitted during execution', () => {
    it('should emit agent:bridge_discovery_done with artifacts array', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockImplementation(
        async (input, callbacks) => {
          if (callbacks?.onEvent) {
            callbacks.onEvent({ type: 'agent:iteration', iteration: 1 } as AgentEvent)
            callbacks.onEvent({ type: 'agent:tool_call', tool: 'read_file', input: {} } as AgentEvent)
            callbacks.onEvent({ type: 'agent:complete', iterations: 5 } as AgentEvent)
          }
          return {
            outputId: 'it01-test',
            artifacts: [{ filename: 'discovery_report.md', content: '# Report' }],
            tokensUsed: { prompt: 100, completion: 50, total: 150 },
            agentResult: { iterations: 5, model: 'test', text: '' },
          }
        }
      )

      const req = createMockRequest({
        taskDescription: 'Test',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)

      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const eventTypes = emittedEvents.map((e) => e.event.type)
      expect(eventTypes).toContain('agent:iteration')
      expect(eventTypes).toContain('agent:tool_call')
      expect(eventTypes).toContain('agent:complete')
      expect(eventTypes).toContain('agent:bridge_discovery_done')
    })
  })

  /**
   * IT-02: agent:bridge_discovery_done structure
   */
  describe('IT-02: agent:bridge_discovery_done structure', () => {
    it('should include artifacts with discovery_report.md', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockResolvedValue({
        outputId: 'it02-test',
        artifacts: [
          { filename: 'discovery_report.md', content: '# Codebase Map\n\nAnalysis results' },
        ],
        tokensUsed: { prompt: 300, completion: 150, total: 450 },
        agentResult: { iterations: 15, model: 'claude-sonnet', text: '' },
      })

      const req = createMockRequest({
        taskDescription: 'Explore auth',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const discoveryDoneEvent = emittedEvents.find((e) => e.event.type === 'agent:bridge_discovery_done')
      expect(discoveryDoneEvent).toBeDefined()
      expect(discoveryDoneEvent?.event.artifacts).toHaveLength(1)
      expect(discoveryDoneEvent?.event.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filename: 'discovery_report.md', content: expect.any(String) }),
        ])
      )
    })
  })

  /**
   * IT-03: Error handling emits agent:error
   */
  describe('IT-03: Error handling', () => {
    it('should emit agent:error when discovery fails', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockRejectedValue(
        new Error('Failed to read project files')
      )

      const req = createMockRequest({
        taskDescription: 'Test',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const errorEvent = emittedEvents.find((e) => e.event.type === 'agent:error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.event.error).toContain('Failed to read project files')
    })

    it('should NOT emit duplicate agent:error if already emitted by runner', async () => {
      const controller = new BridgeController()

      const errorWithFlag = new Error('Already emitted error')
      ;(errorWithFlag as any)._sseEmitted = true

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateDiscovery').mockRejectedValue(errorWithFlag)

      const req = createMockRequest({
        taskDescription: 'Test',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateDiscovery(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const errorEvents = emittedEvents.filter((e) => e.event.type === 'agent:error')
      expect(errorEvents).toHaveLength(0)
    })
  })
})
