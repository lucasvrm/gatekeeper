/**
 * @file persist-event-and-update-state.spec.ts
 * @description Contract spec — persistEventAndMaybeUpdateState persists individual events and updates PipelineState
 * @contract persist-event-and-update-state
 * @mode STRICT
 *
 * Regras:
 * - Importa e invoca o código REAL (OrchestratorEventService)
 * - Mock apenas de efeitos externos (Prisma)
 * - Sem snapshots
 * - Cada teste tem // @clause <ID> imediatamente acima (STRICT)
 * - Happy/Sad path via nome do it(): "succeeds when" (happy) e "fails when" (sad)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPipelineEventCreate = vi.fn()
  const mockPipelineStateUpsert = vi.fn()

  return {
    mockPrisma: {
      pipelineEvent: {
        create: mockPipelineEventCreate,
      },
      pipelineState: {
        upsert: mockPipelineStateUpsert,
      },
    },
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEvent(type: string, payload: Record<string, unknown> = {}) {
  return { type, ...payload }
}

function resetMocksAndSetupDefaults() {
  vi.clearAllMocks()

  // Default: create returns the event with an ID
  mockPrisma.pipelineEvent.create.mockImplementation(async (args: { data: { eventType: string } }) => ({
    id: 123,
    outputId: 'test-output',
    eventType: args.data.eventType,
    createdAt: new Date(),
  }))

  // Default: upsert succeeds
  mockPrisma.pipelineState.upsert.mockResolvedValue({
    outputId: 'test-output',
    status: 'running',
    stage: 'planning',
    progress: 0,
    lastEventId: 123,
  })
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

// We need to dynamically import after mocking.
// The service is a singleton, so we need to handle the prisma injection carefully.

describe('OrchestratorEventService.persistEventAndMaybeUpdateState', () => {
  const outputId = 'test-output-001'

  beforeEach(() => {
    resetMocksAndSetupDefaults()
  })

  // ===========================================================================
  // CL-FILTER-001 — Eventos voláteis são ignorados (agent:text, agent:thinking)
  // ===========================================================================

  // @clause CL-FILTER-001
  it('succeeds when agent:text event is filtered and returns null without persisting', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:text', { text: 'Hello world' })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).toBeNull()
    expect(mockPrisma.pipelineEvent.create).not.toHaveBeenCalled()
  })

  // @clause CL-FILTER-001
  it('succeeds when agent:thinking event is filtered and returns null without persisting', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:thinking', { thinking: 'Hmm...' })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).toBeNull()
    expect(mockPrisma.pipelineEvent.create).not.toHaveBeenCalled()
  })

  // @clause CL-FILTER-001
  it('fails when agent:text event is incorrectly persisted instead of filtered', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:text', { text: 'Should not persist' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    // This assertion validates the contract - agent:text MUST NOT be persisted
    expect(mockPrisma.pipelineEvent.create).not.toHaveBeenCalled()
  })

  // ===========================================================================
  // CL-FILTER-002 — Eventos relevantes são persistidos
  // ===========================================================================

  // @clause CL-FILTER-002
  it('succeeds when agent:tool_call event is persisted via prisma.pipelineEvent.create', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:tool_call', { tool: 'read_file', input: { path: '/src/index.ts' } })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).not.toBeNull()
    expect(mockPrisma.pipelineEvent.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.pipelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outputId,
          eventType: 'agent:tool_call',
        }),
      }),
    )
  })

  // @clause CL-FILTER-002
  it('succeeds when agent:start event is persisted via prisma.pipelineEvent.create', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:start', { provider: 'anthropic', model: 'claude-sonnet' })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).not.toBeNull()
    expect(mockPrisma.pipelineEvent.create).toHaveBeenCalledTimes(1)
  })

  // @clause CL-FILTER-002
  it('fails when relevant event is not persisted to database', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:tool_result', { tool: 'read_file', output: 'file content' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    // Contract requires relevant events to be persisted
    expect(mockPrisma.pipelineEvent.create).toHaveBeenCalled()
  })

  // ===========================================================================
  // CL-REDACT-001 — Campos sensíveis são mascarados
  // ===========================================================================

  // @clause CL-REDACT-001
  it('succeeds when apiKey field is redacted before persistence', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:config', { apiKey: 'sk-secret-key-12345', model: 'gpt-4' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.apiKey).toBe('[REDACTED]')
    expect(payload.model).toBe('gpt-4')
  })

  // @clause CL-REDACT-001
  it('succeeds when token field is redacted before persistence', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:auth', { token: 'bearer-token-xyz', user: 'john' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.token).toBe('[REDACTED]')
    expect(payload.user).toBe('john')
  })

  // @clause CL-REDACT-001
  it('fails when sensitive password field is not redacted', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:login', { password: 'super-secret', username: 'admin' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    // Contract: password MUST be redacted
    expect(payload.password).toBe('[REDACTED]')
  })

  // ===========================================================================
  // CL-REDACT-002 — Strings longas são truncadas
  // ===========================================================================

  // @clause CL-REDACT-002
  it('succeeds when string larger than 10KB is truncated with suffix', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const largeString = 'x'.repeat(15000) // 15KB
    const event = createEvent('agent:output', { content: largeString })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.content.length).toBeLessThan(15000)
    expect(payload.content).toContain('... [truncated]')
  })

  // @clause CL-REDACT-002
  it('succeeds when string exactly 10KB is not truncated', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const exactString = 'y'.repeat(10240) // Exactly 10KB
    const event = createEvent('agent:output', { content: exactString })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.content).toBe(exactString)
    expect(payload.content).not.toContain('[truncated]')
  })

  // @clause CL-REDACT-002
  it('fails when large string is persisted without truncation', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const hugeString = 'z'.repeat(20000) // 20KB
    const event = createEvent('agent:data', { blob: hugeString })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    // Contract: strings > 10KB MUST be truncated
    expect(payload.blob.length).toBeLessThanOrEqual(10240)
  })

  // ===========================================================================
  // CL-REDACT-003 — tool_result.output é truncado especificamente
  // ===========================================================================

  // @clause CL-REDACT-003
  it('succeeds when tool_result.output larger than 5000 chars is truncated', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const longOutput = 'a'.repeat(6000)
    const event = createEvent('agent:tool_result', { tool_result: { output: longOutput, tool: 'read_file' } })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.tool_result.output.length).toBeLessThanOrEqual(5020) // 5000 + suffix
    expect(payload.tool_result.output).toContain('... [truncado]')
  })

  // @clause CL-REDACT-003
  it('succeeds when tool_result.output exactly 5000 chars is not truncated', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const exactOutput = 'b'.repeat(5000)
    const event = createEvent('agent:tool_result', { tool_result: { output: exactOutput, tool: 'bash' } })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    expect(payload.tool_result.output).toBe(exactOutput)
  })

  // @clause CL-REDACT-003
  it('fails when tool_result.output exceeding 5000 chars is not truncated', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const veryLongOutput = 'c'.repeat(8000)
    const event = createEvent('agent:tool_result', { tool_result: { output: veryLongOutput, tool: 'grep' } })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const createCall = mockPrisma.pipelineEvent.create.mock.calls[0]
    const payload = JSON.parse(createCall[0].data.payload)
    // Contract: tool_result.output > 5000 MUST be truncated
    expect(payload.tool_result.output.length).toBeLessThanOrEqual(5020)
  })

  // ===========================================================================
  // CL-STATE-001 — Eventos de transição disparam upsert
  // ===========================================================================

  // @clause CL-STATE-001
  it('succeeds when agent:bridge_start triggers PipelineState upsert', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_start', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { outputId },
      }),
    )
  })

  // @clause CL-STATE-001
  it('succeeds when agent:complete triggers PipelineState upsert', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:complete', { tokensUsed: { input: 1000, output: 500 } })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledTimes(1)
  })

  // @clause CL-STATE-001
  it('fails when transition event does not trigger PipelineState upsert', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:error', { error: 'Something went wrong' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    // Contract: transition events MUST trigger upsert
    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalled()
  })

  // ===========================================================================
  // CL-STATE-002 — lastEventId é atualizado com ID do evento salvo
  // ===========================================================================

  // @clause CL-STATE-002
  it('succeeds when lastEventId is set to saved event id in upsert', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 456,
      outputId,
      eventType: 'agent:bridge_plan_done',
    })

    const event = createEvent('agent:bridge_plan_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          lastEventId: 456,
        }),
      }),
    )
  })

  // @clause CL-STATE-002
  it('succeeds when lastEventId is included in create data for new PipelineState', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 789,
      outputId,
      eventType: 'agent:bridge_start',
    })

    const event = createEvent('agent:bridge_start', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lastEventId: 789,
        }),
      }),
    )
  })

  // @clause CL-STATE-002
  it('fails when lastEventId is not updated after transition event persistence', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 999,
      outputId,
      eventType: 'agent:bridge_spec_done',
    })

    const event = createEvent('agent:bridge_spec_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    // Contract: lastEventId MUST be updated to the saved event's ID
    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    expect(upsertCall[0].update.lastEventId).toBe(999)
  })

  // ===========================================================================
  // CL-STATE-003 — agent:bridge_plan_done → stage='spec', progress=25
  // ===========================================================================

  // @clause CL-STATE-003
  it('succeeds when agent:bridge_plan_done sets stage to spec', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_plan_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          stage: 'spec',
        }),
      }),
    )
  })

  // @clause CL-STATE-003
  it('succeeds when agent:bridge_plan_done sets progress to 25', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_plan_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          progress: 25,
        }),
      }),
    )
  })

  // @clause CL-STATE-003
  it('fails when agent:bridge_plan_done does not update stage to spec', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_plan_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    // Contract: stage MUST be 'spec' after plan_done
    expect(upsertCall[0].update.stage).toBe('spec')
  })

  // ===========================================================================
  // CL-STATE-004 — agent:bridge_spec_done → stage='fix', progress=50
  // ===========================================================================

  // @clause CL-STATE-004
  it('succeeds when agent:bridge_spec_done sets stage to fix', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_spec_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          stage: 'fix',
        }),
      }),
    )
  })

  // @clause CL-STATE-004
  it('succeeds when agent:bridge_spec_done sets progress to 50', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_spec_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          progress: 50,
        }),
      }),
    )
  })

  // @clause CL-STATE-004
  it('fails when agent:bridge_spec_done does not update progress to 50', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_spec_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    // Contract: progress MUST be 50 after spec_done
    expect(upsertCall[0].update.progress).toBe(50)
  })

  // ===========================================================================
  // CL-STATE-005 — agent:bridge_execute_done → stage='complete', progress=100
  // ===========================================================================

  // @clause CL-STATE-005
  it('succeeds when agent:bridge_execute_done sets stage to complete', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_execute_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          stage: 'complete',
        }),
      }),
    )
  })

  // @clause CL-STATE-005
  it('succeeds when agent:bridge_execute_done sets progress to 100', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_execute_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          progress: 100,
        }),
      }),
    )
  })

  // @clause CL-STATE-005
  it('fails when agent:bridge_execute_done does not set progress to 100', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:bridge_execute_done', {})
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    // Contract: progress MUST be 100 after execute_done
    expect(upsertCall[0].update.progress).toBe(100)
  })

  // ===========================================================================
  // CL-STATE-006 — agent:error → status='failed'
  // ===========================================================================

  // @clause CL-STATE-006
  it('succeeds when agent:error sets status to failed', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:error', { error: 'Rate limit exceeded' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(mockPrisma.pipelineState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: 'failed',
        }),
      }),
    )
  })

  // @clause CL-STATE-006
  it('succeeds when agent:error with details still sets status to failed', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:error', { error: 'API timeout', code: 'TIMEOUT', retryable: true })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    expect(upsertCall[0].update.status).toBe('failed')
  })

  // @clause CL-STATE-006
  it('fails when agent:error does not update status to failed', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const event = createEvent('agent:error', { error: 'Unknown error' })
    await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    const upsertCall = mockPrisma.pipelineState.upsert.mock.calls[0]
    // Contract: status MUST be 'failed' after error
    expect(upsertCall[0].update.status).toBe('failed')
  })

  // ===========================================================================
  // CL-RETURN-001 — Retorna o evento persistido
  // ===========================================================================

  // @clause CL-RETURN-001
  it('succeeds when persisted event is returned with correct id', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 555,
      outputId,
      eventType: 'agent:tool_call',
      createdAt: new Date(),
    })

    const event = createEvent('agent:tool_call', { tool: 'read_file' })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(555)
    expect(result!.eventType).toBe('agent:tool_call')
  })

  // @clause CL-RETURN-001
  it('succeeds when returned event contains outputId', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 666,
      outputId: 'custom-output',
      eventType: 'agent:start',
    })

    const event = createEvent('agent:start', {})
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState('custom-output', event)

    expect(result!.outputId).toBe('custom-output')
  })

  // @clause CL-RETURN-001
  it('fails when function does not return the created PipelineEvent', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.create.mockResolvedValueOnce({
      id: 777,
      outputId,
      eventType: 'agent:complete',
    })

    const event = createEvent('agent:complete', {})
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    // Contract: function MUST return the created event
    expect(result).not.toBeNull()
    expect(result!.id).toBeDefined()
  })

  // ===========================================================================
  // CL-ERROR-001 — Prisma não inicializado retorna null sem exceção
  // ===========================================================================

  // @clause CL-ERROR-001
  it('succeeds when prisma is null and returns null without throwing', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    // Simulate uninitialized prisma
    ;(OrchestratorEventService as any).prisma = null

    const event = createEvent('agent:tool_call', { tool: 'read_file' })
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).toBeNull()
    expect(mockPrisma.pipelineEvent.create).not.toHaveBeenCalled()
  })

  // @clause CL-ERROR-001
  it('succeeds when prisma is undefined and logs warning', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    ;(OrchestratorEventService as any).prisma = undefined

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const event = createEvent('agent:start', {})
    const result = await OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Prisma not initialized'))

    warnSpy.mockRestore()
  })

  // @clause CL-ERROR-001
  it('fails when prisma is not initialized and function throws exception', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    ;(OrchestratorEventService as any).prisma = null

    const event = createEvent('agent:tool_call', {})

    // Contract: function MUST NOT throw when prisma is null
    await expect(
      OrchestratorEventService.persistEventAndMaybeUpdateState(outputId, event),
    ).resolves.toBeNull()
  })
})
