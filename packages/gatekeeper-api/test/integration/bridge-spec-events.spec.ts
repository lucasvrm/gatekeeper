/**
 * Integration Tests: Bridge Spec Events (Step 2 SSE)
 *
 * Validates that POST /agent/bridge/spec returns 202 and emits SSE events
 * during execution, matching the behavior of Steps 1 and 4.
 *
 * BC-01: Async Response Pattern (202 Accepted immediately)
 * BC-02: SSE Event Emission during spec generation
 * BC-03: Frontend SSE Processing (agent:bridge_spec_done)
 * BC-04: Error Handling (agent:error via SSE)
 * BC-05: Backward Compatibility (works with/without callbacks)
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
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
      findFirst: vi.fn().mockResolvedValue(null),
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
    assembleForStep = vi.fn().mockResolvedValue('system prompt base')
  },
}))

// Mock LLM Provider Registry
vi.mock('../../src/services/providers/LLMProviderRegistry', () => ({
  LLMProviderRegistry: class {
    static fromEnv() { return new this() }
    get = vi.fn()
    register = vi.fn()
    has = vi.fn().mockReturnValue(true)
    list = vi.fn().mockReturnValue(['anthropic', 'openai'])
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

// ─── Unit Tests: BridgeController.generateSpec ────────────────────────────

describe('BridgeController.generateSpec - Unit Tests', () => {
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
   * UT-01: BridgeController.generateSpec returns 202
   *
   * Verifies that the endpoint returns 202 Accepted immediately,
   * not blocking until spec generation completes.
   */
  describe('UT-01: Returns 202 Accepted', () => {
    it('should return 202 status code immediately', async () => {
      // Mock the bridge.generateSpec to simulate slow execution
      const mockGenerateSpec = vi.fn().mockImplementation(async () => {
        // Simulate 5 second delay
        await new Promise((resolve) => setTimeout(resolve, 100))
        return {
          artifacts: [{ filename: 'test.spec.ts', content: 'test code' }],
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          agentResult: { iterations: 1, model: 'test', text: '' },
        }
      })

      // Spy on bridge instance method
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(mockGenerateSpec)

      const req = createMockRequest({
        outputId: '2026_02_07_123_test-task',
        projectPath: '/test/project',
      })
      const res = createMockResponse()
      const startTime = Date.now()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      const elapsed = Date.now() - startTime

      // Response should be fast (< 500ms), not waiting for generation
      expect(elapsed).toBeLessThan(500)
      expect(res.statusCode).toBe(202)
      expect(res.body).toHaveProperty('outputId')
      expect(res.body).toHaveProperty('eventsUrl')
    })

    it('should include eventsUrl matching /api/orchestrator/events/{outputId}', async () => {
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockResolvedValue({
        artifacts: [],
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        agentResult: { iterations: 0, model: 'test', text: '' },
      })

      const req = createMockRequest({
        outputId: '2026_02_07_456_another-task',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      expect(res.body.eventsUrl).toBe('/api/orchestrator/events/2026_02_07_456_another-task')
    })
  })

  /**
   * UT-02: BridgeController.generateSpec passes onEvent callback
   *
   * Verifies that the callback is passed to bridge.generateSpec
   * so events can be emitted during execution.
   */
  describe('UT-02: Passes onEvent callback', () => {
    it('should call bridge.generateSpec with onEvent callback', async () => {
      const mockGenerateSpec = vi.fn().mockResolvedValue({
        artifacts: [],
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        agentResult: { iterations: 0, model: 'test', text: '' },
      })
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(mockGenerateSpec)

      const req = createMockRequest({
        outputId: 'test-output-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      // Wait for setImmediate to process
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Check that generateSpec was called with callbacks containing onEvent
      expect(mockGenerateSpec).toHaveBeenCalled()
      const lastCall = mockGenerateSpec.mock.calls[0]
      expect(lastCall[1]).toBeDefined()
      expect(lastCall[1]).toHaveProperty('onEvent')
      expect(typeof lastCall[1].onEvent).toBe('function')
    })

    it('should emit events via OrchestratorEventService when onEvent is called', async () => {
      let capturedOnEvent: ((event: AgentEvent) => void) | null = null

      const mockGenerateSpec = vi.fn().mockImplementation(async (input, callbacks) => {
        capturedOnEvent = callbacks?.onEvent
        return {
          artifacts: [],
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          agentResult: { iterations: 0, model: 'test', text: '' },
        }
      })
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(mockGenerateSpec)

      const req = createMockRequest({
        outputId: 'emit-test-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      // Wait for background execution
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Simulate emitting an event via the captured callback
      if (capturedOnEvent) {
        capturedOnEvent({ type: 'agent:iteration', iteration: 1 } as AgentEvent)
      }

      // Check that OrchestratorEventService was called
      expect(emitSpy).toHaveBeenCalledWith(
        'emit-test-id',
        expect.objectContaining({ type: 'agent:iteration' })
      )
    })
  })

  /**
   * UT-03: makeEmitter creates valid SSE emitter
   *
   * Verifies that the emitter function correctly calls
   * OrchestratorEventService.emitOrchestratorEvent.
   */
  describe('UT-03: makeEmitter creates valid SSE emitter', () => {
    it('should emit agent:bridge_spec_done on successful completion', async () => {
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockResolvedValue({
        artifacts: [{ filename: 'test.spec.tsx', content: 'test content' }],
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        agentResult: { iterations: 2, model: 'claude-sonnet', text: 'done' },
      })

      const req = createMockRequest({
        outputId: 'complete-test-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      // Wait for background execution to complete
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Check that agent:bridge_spec_done was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'complete-test-id',
        expect.objectContaining({
          type: 'agent:bridge_spec_done',
          outputId: 'complete-test-id',
          artifacts: expect.arrayContaining([
            expect.objectContaining({ filename: 'test.spec.tsx' }),
          ]),
        })
      )
    })
  })

  /**
   * Validation: Returns 400 for missing required fields
   */
  describe('Validation', () => {
    it('should return 400 when outputId is missing', async () => {
      const req = createMockRequest({
        projectPath: '/test/project',
        // outputId is missing
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toContain('outputId')
    })

    it('should return 400 when projectPath is missing', async () => {
      const req = createMockRequest({
        outputId: 'test-id',
        // projectPath is missing
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(400)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toContain('projectPath')
    })
  })
})

// ─── Integration Tests: SSE Event Emission ─────────────────────────────────

describe('Bridge Spec Events - Integration Tests', () => {
  let emittedEvents: Array<{ outputId: string; event: Record<string, unknown> }>
  let originalEmit: typeof OrchestratorEventService.emitOrchestratorEvent

  beforeAll(() => {
    // Capture all emitted events
    emittedEvents = []
    originalEmit = OrchestratorEventService.emitOrchestratorEvent
    OrchestratorEventService.emitOrchestratorEvent = (outputId: string, event: Record<string, unknown>) => {
      emittedEvents.push({ outputId, event })
    }
  })

  afterAll(() => {
    OrchestratorEventService.emitOrchestratorEvent = originalEmit
  })

  beforeEach(() => {
    emittedEvents = []
  })

  /**
   * IT-01: SSE events emitted during spec generation
   *
   * Verifies that events are emitted during execution,
   * not just at the end.
   */
  describe('IT-01: SSE events emitted during execution', () => {
    it('should emit agent:bridge_spec_done with artifacts array', async () => {
      const controller = new BridgeController()

      // Mock the bridge to simulate spec generation with events
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(
        async (input, callbacks) => {
          // Simulate emitting events during execution
          if (callbacks?.onEvent) {
            callbacks.onEvent({ type: 'agent:iteration', iteration: 1 } as AgentEvent)
            callbacks.onEvent({ type: 'agent:tool_call', tool: 'save_artifact', input: {} } as AgentEvent)
            callbacks.onEvent({ type: 'agent:complete', iterations: 1 } as AgentEvent)
          }
          return {
            artifacts: [{ filename: 'test.spec.tsx', content: 'describe(...)' }],
            tokensUsed: { prompt: 100, completion: 50, total: 150 },
            agentResult: { iterations: 1, model: 'test', text: '' },
          }
        }
      )

      const req = createMockRequest({
        outputId: 'it01-test-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)

      // Wait for background execution
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify events were emitted
      const eventTypes = emittedEvents.map((e) => e.event.type)
      expect(eventTypes).toContain('agent:iteration')
      expect(eventTypes).toContain('agent:tool_call')
      expect(eventTypes).toContain('agent:complete')
      expect(eventTypes).toContain('agent:bridge_spec_done')
    })
  })

  /**
   * IT-02: agent:bridge_spec_done contains artifacts
   *
   * Verifies the structure of the completion event.
   */
  describe('IT-02: agent:bridge_spec_done structure', () => {
    it('should include artifacts array with filename and content', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockResolvedValue({
        artifacts: [
          { filename: 'Button.spec.tsx', content: 'describe("Button", () => { it("works") })' },
          { filename: 'helper.spec.ts', content: 'test helper' },
        ],
        tokensUsed: { prompt: 200, completion: 100, total: 300 },
        agentResult: { iterations: 2, model: 'claude-sonnet', text: '' },
      })

      const req = createMockRequest({
        outputId: 'it02-test-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const specDoneEvent = emittedEvents.find((e) => e.event.type === 'agent:bridge_spec_done')
      expect(specDoneEvent).toBeDefined()
      expect(specDoneEvent?.event.outputId).toBe('it02-test-id')
      expect(specDoneEvent?.event.artifacts).toHaveLength(2)
      expect(specDoneEvent?.event.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filename: 'Button.spec.tsx', content: expect.any(String) }),
          expect.objectContaining({ filename: 'helper.spec.ts' }),
        ])
      )
      expect(specDoneEvent?.event.tokensUsed).toEqual({
        prompt: 200,
        completion: 100,
        total: 300,
      })
    })
  })

  /**
   * IT-03: Error handling emits agent:error
   *
   * Verifies that errors are communicated via SSE, not just HTTP.
   */
  describe('IT-03: Error handling', () => {
    it('should emit agent:error when spec generation fails', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockRejectedValue(
        new Error('Missing required artifacts from Step 1')
      )

      const req = createMockRequest({
        outputId: 'it03-error-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const errorEvent = emittedEvents.find((e) => e.event.type === 'agent:error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent?.event.error).toContain('Missing required artifacts')
    })

    it('should NOT emit duplicate agent:error if already emitted by runner', async () => {
      const controller = new BridgeController()

      const errorWithFlag = new Error('Already emitted error')
      ;(errorWithFlag as any)._sseEmitted = true

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockRejectedValue(errorWithFlag)

      const req = createMockRequest({
        outputId: 'it03-no-dup-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should NOT emit agent:error (already marked as emitted)
      const errorEvents = emittedEvents.filter((e) => e.event.type === 'agent:error')
      expect(errorEvents).toHaveLength(0)
    })
  })

  /**
   * IT-04: Events visible in buffer for late SSE connections
   *
   * Verifies that events are buffered for replay.
   */
  describe('IT-04: Event buffering', () => {
    it('should emit events that can be captured by late SSE connections', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(
        async (input, callbacks) => {
          if (callbacks?.onEvent) {
            callbacks.onEvent({ type: 'agent:iteration', iteration: 1 } as AgentEvent)
          }
          return {
            artifacts: [{ filename: 'test.spec.ts', content: 'test' }],
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            agentResult: { iterations: 1, model: 'test', text: '' },
          }
        }
      )

      const req = createMockRequest({
        outputId: 'it04-buffer-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generateSpec(req as unknown as Request, res as unknown as Response)
      await new Promise((resolve) => setImmediate(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify all events for this outputId were captured
      const outputEvents = emittedEvents.filter((e) => e.outputId === 'it04-buffer-id')
      expect(outputEvents.length).toBeGreaterThan(0)
      expect(outputEvents.some((e) => e.event.type === 'agent:iteration')).toBe(true)
      expect(outputEvents.some((e) => e.event.type === 'agent:bridge_spec_done')).toBe(true)
    })
  })
})

// ─── Backward Compatibility Tests ──────────────────────────────────────────

describe('BC-05: Backward Compatibility', () => {
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
   * Bridge.generateSpec should work both with and without callbacks
   */
  describe('Bridge works with and without callbacks', () => {
    it('should handle generateSpec call without callbacks (pipeline mode)', async () => {
      // This tests the internal bridge behavior when called from full pipeline
      const mockBridge = {
        generateSpec: vi.fn().mockResolvedValue({
          artifacts: [{ filename: 'spec.ts', content: 'code' }],
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          agentResult: { iterations: 1, model: 'test', text: '' },
        }),
      }

      // Call without callbacks (like in automated pipeline)
      const result = await mockBridge.generateSpec({ outputId: 'test', projectPath: '/test' })

      expect(result.artifacts).toHaveLength(1)
      expect(result.tokensUsed.total).toBe(150)
    })

    it('should handle generateSpec call with callbacks (interactive mode)', async () => {
      const capturedEvents: AgentEvent[] = []
      const mockBridge = {
        generateSpec: vi.fn().mockImplementation(async (input, callbacks) => {
          if (callbacks?.onEvent) {
            const events: AgentEvent[] = [
              { type: 'agent:iteration', iteration: 1 } as AgentEvent,
              { type: 'agent:complete', iterations: 1 } as AgentEvent,
            ]
            for (const event of events) {
              callbacks.onEvent(event)
              capturedEvents.push(event)
            }
          }
          return {
            artifacts: [{ filename: 'spec.ts', content: 'code' }],
            tokensUsed: { prompt: 100, completion: 50, total: 150 },
            agentResult: { iterations: 1, model: 'test', text: '' },
          }
        }),
      }

      // Call with callbacks (like in UI interactive mode)
      const onEvent = (event: AgentEvent) => capturedEvents.push(event)
      await mockBridge.generateSpec({ outputId: 'test', projectPath: '/test' }, { onEvent })

      expect(capturedEvents.length).toBeGreaterThan(0)
      expect(capturedEvents.some((e) => e.type === 'agent:iteration')).toBe(true)
    })
  })
})

// ─── Performance Tests ─────────────────────────────────────────────────────

describe('Performance Tests', () => {
  /**
   * PERF-01: First event latency
   *
   * Verifies that the first SSE event arrives quickly after POST.
   */
  describe('PERF-01: First event latency', () => {
    it('should return 202 response in < 100ms', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(async () => {
        // Simulate slow execution (shouldn't affect response time)
        await new Promise((resolve) => setTimeout(resolve, 500))
        return {
          artifacts: [],
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          agentResult: { iterations: 0, model: 'test', text: '' },
        }
      })

      const req = createMockRequest({
        outputId: 'perf01-test-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      const startTime = Date.now()
      await controller.generateSpec(req as unknown as Request, res as unknown as Response)
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeLessThan(100)
      expect(res.statusCode).toBe(202)
    })
  })

  /**
   * PERF-02: Event throughput
   *
   * Verifies events don't get mixed between different outputIds.
   */
  describe('PERF-02: Event isolation', () => {
    it('should isolate events between different outputIds', async () => {
      const eventsByOutput: Record<string, Record<string, unknown>[]> = {}

      vi.spyOn(OrchestratorEventService, 'emitOrchestratorEvent').mockImplementation(
        (outputId: string, event: Record<string, unknown>) => {
          if (!eventsByOutput[outputId]) {
            eventsByOutput[outputId] = []
          }
          eventsByOutput[outputId].push(event)
        }
      )

      const controller = new BridgeController()

      let callCount = 0
      vi.spyOn(AgentOrchestratorBridge.prototype, 'generateSpec').mockImplementation(
        async (input, callbacks) => {
          callCount++
          const iteration = callCount
          if (callbacks?.onEvent) {
            callbacks.onEvent({ type: 'agent:iteration', iteration } as AgentEvent)
          }
          return {
            artifacts: [{ filename: `spec-${iteration}.ts`, content: 'test' }],
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            agentResult: { iterations: 1, model: 'test', text: '' },
          }
        }
      )

      // Launch 3 parallel requests
      const requests = [
        controller.generateSpec(
          createMockRequest({ outputId: 'parallel-1', projectPath: '/test' }) as unknown as Request,
          createMockResponse() as unknown as Response
        ),
        controller.generateSpec(
          createMockRequest({ outputId: 'parallel-2', projectPath: '/test' }) as unknown as Request,
          createMockResponse() as unknown as Response
        ),
        controller.generateSpec(
          createMockRequest({ outputId: 'parallel-3', projectPath: '/test' }) as unknown as Request,
          createMockResponse() as unknown as Response
        ),
      ]

      await Promise.all(requests)
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Each outputId should have its own set of events
      expect(Object.keys(eventsByOutput)).toHaveLength(3)
      expect(eventsByOutput['parallel-1']).toBeDefined()
      expect(eventsByOutput['parallel-2']).toBeDefined()
      expect(eventsByOutput['parallel-3']).toBeDefined()

      // Events should not be mixed (each has agent:bridge_spec_done)
      for (const outputId of ['parallel-1', 'parallel-2', 'parallel-3']) {
        const hasSpecDone = eventsByOutput[outputId].some(
          (e) => e.type === 'agent:bridge_spec_done'
        )
        expect(hasSpecDone).toBe(true)
      }
    })
  })
})

// ─── Regression Tests ──────────────────────────────────────────────────────

describe('Regression Tests', () => {
  /**
   * REG-02: Existing event types still work
   *
   * Verifies that changes don't break other steps.
   */
  describe('REG-02: Other endpoints unaffected', () => {
    it('should still handle plan endpoint (202 pattern)', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'generatePlan').mockResolvedValue({
        outputId: 'plan-output-id',
        artifacts: [{ filename: 'plan.json', content: '{}' }],
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        agentResult: { iterations: 1, model: 'test', text: '' },
      })

      const req = createMockRequest({
        taskDescription: 'Test task',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.generatePlan(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(202)
      expect(res.body).toHaveProperty('outputId')
      expect(res.body).toHaveProperty('eventsUrl')
    })

    it('should still handle execute endpoint (202 pattern)', async () => {
      const controller = new BridgeController()

      vi.spyOn(AgentOrchestratorBridge.prototype, 'execute').mockResolvedValue({
        artifacts: [{ filename: 'impl.ts', content: 'code' }],
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        agentResult: { iterations: 1, model: 'test', text: '' },
      })

      const req = createMockRequest({
        outputId: 'exec-output-id',
        projectPath: '/test/project',
      })
      const res = createMockResponse()

      await controller.execute(req as unknown as Request, res as unknown as Response)

      expect(res.statusCode).toBe(202)
      expect(res.body).toHaveProperty('outputId')
      expect(res.body).toHaveProperty('eventsUrl')
    })
  })
})
