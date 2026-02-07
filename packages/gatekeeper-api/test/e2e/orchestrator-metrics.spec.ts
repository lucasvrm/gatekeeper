/**
 * E2E Tests: Orchestrator Metrics Endpoint
 *
 * Valida que:
 * 1. GET /api/orchestrator/:pipelineId/metrics retorna LogMetrics
 * 2. Métricas são calculadas corretamente a partir de eventos
 * 3. Agregações por level, stage, type funcionam
 * 4. Duração é calculada corretamente
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestServer } from './setup/test-server'
import { TestClient } from './setup/test-client'
import { app } from '@/server'
import { OrchestratorEventService } from '@/services/OrchestratorEventService'

describe('Orchestrator Metrics E2E', () => {
  let server: TestServer
  let client: TestClient

  beforeAll(async () => {
    server = new TestServer(3009, app)
    await server.start()
    client = new TestClient('http://localhost:3009')
  }, 30000)

  afterAll(async () => {
    await server.stop()
  }, 10000)

  it('should return metrics for pipeline with events', async () => {
    const pipelineId = 'test-pipeline-metrics-001'

    // 1. Emit some events to the buffer
    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:start',
      _stage: 'planning',
      _level: 'info',
    })

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 50))

    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:error',
      _stage: 'planning',
      _level: 'error',
      error: 'Test error',
    })

    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:done',
      _stage: 'execute',
      _level: 'info',
    })

    // Wait to ensure duration
    await new Promise((resolve) => setTimeout(resolve, 100))

    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:complete',
      _stage: 'complete',
      _level: 'info',
    })

    // 2. Get metrics
    const metrics = await client.get(`/api/orchestrator/${pipelineId}/metrics`)

    // 3. Assert structure
    expect(metrics).toHaveProperty('pipelineId', pipelineId)
    expect(metrics).toHaveProperty('totalEvents')
    expect(metrics).toHaveProperty('byLevel')
    expect(metrics).toHaveProperty('byStage')
    expect(metrics).toHaveProperty('byType')
    expect(metrics).toHaveProperty('duration')
    expect(metrics.duration).toHaveProperty('ms')
    expect(metrics.duration).toHaveProperty('formatted')
    expect(metrics).toHaveProperty('firstEvent')
    expect(metrics).toHaveProperty('lastEvent')

    // 4. Assert values
    expect(metrics.totalEvents).toBe(4)
    expect(metrics.byLevel.info).toBe(3)
    expect(metrics.byLevel.error).toBe(1)
    expect(metrics.byStage.planning).toBe(2)
    expect(metrics.byStage.execute).toBe(1)
    expect(metrics.byStage.complete).toBe(1)
    expect(metrics.byType['agent:start']).toBe(1)
    expect(metrics.byType['agent:error']).toBe(1)
    expect(metrics.byType['agent:done']).toBe(1)
    expect(metrics.byType['agent:complete']).toBe(1)

    // 5. Assert duration
    expect(metrics.duration.ms).toBeGreaterThan(0)
    expect(metrics.duration.formatted).toMatch(/\d{2}:\d{2}:\d{2}/)

    // 6. Assert timestamps
    expect(metrics.firstEvent).toBeTruthy()
    expect(metrics.lastEvent).toBeTruthy()
    expect(new Date(metrics.firstEvent).getTime()).toBeLessThanOrEqual(
      new Date(metrics.lastEvent).getTime()
    )

    // Cleanup
    OrchestratorEventService.clearBuffer(pipelineId)
  }, 40000)

  it('should return empty metrics for pipeline without events', async () => {
    const pipelineId = 'test-pipeline-empty-001'

    const metrics = await client.get(`/api/orchestrator/${pipelineId}/metrics`)

    expect(metrics).toEqual({
      pipelineId,
      totalEvents: 0,
      byLevel: {},
      byStage: {},
      byType: {},
      duration: { ms: 0, formatted: '00:00:00' },
      firstEvent: null,
      lastEvent: null,
    })
  }, 20000)

  it('should handle metrics with inferred level and stage', async () => {
    const pipelineId = 'test-pipeline-inferred-001'

    // Emit events without explicit _level and _stage
    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:bridge_plan_start',
    })

    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:error',
      error: 'Test error',
    })

    const metrics = await client.get(`/api/orchestrator/${pipelineId}/metrics`)

    expect(metrics.totalEvents).toBe(2)
    expect(metrics.byLevel.info).toBe(1) // Inferred from agent:bridge_plan_start
    expect(metrics.byLevel.error).toBe(1) // Inferred from agent:error
    expect(metrics.byType['agent:bridge_plan_start']).toBe(1)
    expect(metrics.byType['agent:error']).toBe(1)

    // Cleanup
    OrchestratorEventService.clearBuffer(pipelineId)
  }, 20000)

  it('should calculate duration for multiple events', async () => {
    const pipelineId = 'test-pipeline-duration-001'

    // Emit events with delays
    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:start',
      _stage: 'planning',
    })

    await new Promise((resolve) => setTimeout(resolve, 200))

    OrchestratorEventService.emitOrchestratorEvent(pipelineId, {
      type: 'agent:done',
      _stage: 'execute',
    })

    const metrics = await client.get(`/api/orchestrator/${pipelineId}/metrics`)

    // Duration should be at least 200ms (with some tolerance)
    expect(metrics.duration.ms).toBeGreaterThanOrEqual(150)
    expect(metrics.duration.ms).toBeLessThan(400)
    expect(metrics.duration.formatted).toMatch(/00:00:00/)

    // Cleanup
    OrchestratorEventService.clearBuffer(pipelineId)
  }, 20000)

  it('should handle error gracefully for invalid pipelineId', async () => {
    // This should not throw, just return empty metrics
    const metrics = await client.get('/api/orchestrator/nonexistent-pipeline/metrics')

    expect(metrics.totalEvents).toBe(0)
  }, 20000)
})
