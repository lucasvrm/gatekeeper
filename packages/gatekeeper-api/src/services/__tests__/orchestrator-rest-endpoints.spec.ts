/**
 * @file orchestrator-rest-endpoints.spec.ts
 * @description Contract spec — getStatus and getEventsPaginated REST query methods
 * @contract orchestrator-rest-endpoints
 * @mode STRICT
 *
 * Regras:
 * - Importa e invoca o código REAL (OrchestratorEventService)
 * - Mock apenas de efeitos externos (Prisma)
 * - Sem snapshots
 * - Cada teste tem // @clause <ID> imediatamente acima (STRICT)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPipelineStateFindUnique = vi.fn()
  const mockPipelineEventFindMany = vi.fn()

  return {
    mockPrisma: {
      pipelineState: {
        findUnique: mockPipelineStateFindUnique,
      },
      pipelineEvent: {
        findMany: mockPipelineEventFindMany,
      },
    },
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(id: number, outputId: string, eventType: string = 'agent:tool_call') {
  return { id, outputId, eventType, stage: 'planning', createdAt: new Date() }
}

function resetMocksAndSetupDefaults() {
  vi.clearAllMocks()
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

describe('OrchestratorEventService.getStatus', () => {
  const outputId = 'test-output-status'

  beforeEach(() => {
    resetMocksAndSetupDefaults()
  })

  // @clause CL-STATUS-001
  it('succeeds when PipelineState exists and is returned', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const expectedState = {
      outputId,
      status: 'running',
      stage: 'spec',
      progress: 25,
      lastEventId: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.pipelineState.findUnique.mockResolvedValueOnce(expectedState)

    const result = await OrchestratorEventService.getStatus(outputId)

    expect(result).toEqual(expectedState)
    expect(mockPrisma.pipelineState.findUnique).toHaveBeenCalledWith({
      where: { outputId },
    })
  })

  // @clause CL-STATUS-002
  it('succeeds when PipelineState does not exist and returns null', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineState.findUnique.mockResolvedValueOnce(null)

    const result = await OrchestratorEventService.getStatus(outputId)

    expect(result).toBeNull()
  })

  // @clause CL-STATUS-003
  it('succeeds when prisma is null and returns null without throwing', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    ;(OrchestratorEventService as any).prisma = null

    const result = await OrchestratorEventService.getStatus(outputId)

    expect(result).toBeNull()
    expect(mockPrisma.pipelineState.findUnique).not.toHaveBeenCalled()
  })
})

describe('OrchestratorEventService.getEventsPaginated', () => {
  const outputId = 'test-output-events'

  beforeEach(() => {
    resetMocksAndSetupDefaults()
  })

  // @clause CL-EVENTS-001
  it('succeeds when events are returned after sinceId', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const events = [makeEvent(11, outputId), makeEvent(12, outputId)]
    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce(events)

    const result = await OrchestratorEventService.getEventsPaginated(outputId, 10, 50)

    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(false)
    expect(mockPrisma.pipelineEvent.findMany).toHaveBeenCalledWith({
      where: { outputId, id: { gt: 10 } },
      orderBy: { id: 'asc' },
      take: 51, // N+1 pattern
    })
  })

  // @clause CL-EVENTS-002
  it('succeeds when hasMore is true because there are more events than limit', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    // limit=2, so service fetches 3 (N+1). If 3 returned → hasMore=true, pop last
    const events = [makeEvent(1, outputId), makeEvent(2, outputId), makeEvent(3, outputId)]
    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce(events)

    const result = await OrchestratorEventService.getEventsPaginated(outputId, undefined, 2)

    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.events[1].id).toBe(2) // event 3 was popped
  })

  // @clause CL-EVENTS-003
  it('succeeds when hasMore is false because fewer events than limit', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    const events = [makeEvent(1, outputId)]
    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce(events)

    const result = await OrchestratorEventService.getEventsPaginated(outputId, undefined, 50)

    expect(result.events).toHaveLength(1)
    expect(result.hasMore).toBe(false)
  })

  // @clause CL-EVENTS-004
  it('succeeds when outputId has no events and returns empty array', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce([])

    const result = await OrchestratorEventService.getEventsPaginated('nonexistent-output')

    expect(result.events).toEqual([])
    expect(result.hasMore).toBe(false)
  })

  // @clause CL-EVENTS-005
  it('succeeds when limit is capped at 200 even if client requests more', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce([])

    await OrchestratorEventService.getEventsPaginated(outputId, undefined, 500)

    // Should cap at 200, so take = 201 (N+1)
    expect(mockPrisma.pipelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 201,
      }),
    )
  })

  // @clause CL-EVENTS-006
  it('succeeds when sinceId is not provided and queries without id filter', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    OrchestratorEventService.setPrisma(mockPrisma as any)

    mockPrisma.pipelineEvent.findMany.mockResolvedValueOnce([])

    await OrchestratorEventService.getEventsPaginated(outputId)

    expect(mockPrisma.pipelineEvent.findMany).toHaveBeenCalledWith({
      where: { outputId },
      orderBy: { id: 'asc' },
      take: 51, // default limit=50, N+1
    })
  })

  // @clause CL-EVENTS-007
  it('succeeds when prisma is null and returns empty result without throwing', async () => {
    const { OrchestratorEventService } = await import('../OrchestratorEventService.js')
    ;(OrchestratorEventService as any).prisma = null

    const result = await OrchestratorEventService.getEventsPaginated(outputId)

    expect(result.events).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(mockPrisma.pipelineEvent.findMany).not.toHaveBeenCalled()
  })
})
