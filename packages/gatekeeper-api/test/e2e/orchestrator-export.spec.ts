/**
 * @file orchestrator-export.spec.ts
 * @description E2E tests for log export endpoints (MP-EXPORT-03)
 *
 * Coverage:
 * - Export as JSON
 * - Export as CSV
 * - Content-Type and Content-Disposition headers
 * - CSV format validation (parse with csv-parse)
 * - Export with filters
 * - Error handling (404 for non-existent pipeline)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/server.js'
import { OrchestratorEventService } from '../../src/services/OrchestratorEventService.js'
import { nanoid } from 'nanoid'
import { parse } from 'csv-parse/sync'
import { TestServer } from './setup/test-server.js'
import type { PrismaClient } from '@prisma/client'

// ─── Setup ────────────────────────────────────────────────────────────────────

let server: TestServer
let prisma: PrismaClient
let testPipelineId: string
let testProjectId: string
let testWorkspaceId: string

beforeAll(async () => {
  // Initialize test server
  server = new TestServer(3010, app)
  await server.start()
  prisma = server.getPrisma()
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Create test workspace
  testWorkspaceId = nanoid()
  await prisma.workspace.create({
    data: {
      id: testWorkspaceId,
      name: 'Test Workspace',
      rootPath: '/test',
      artifactsDir: '/test/artifacts',
    },
  })

  // Create test project
  testProjectId = nanoid()
  await prisma.project.create({
    data: {
      id: testProjectId,
      workspaceId: testWorkspaceId,
      name: 'Test Project',
      baseRef: 'main',
      targetRef: 'feature/test',
    },
  })
})

afterAll(async () => {
  // Cleanup
  if (testWorkspaceId) {
    await prisma.project.deleteMany({ where: { workspaceId: testWorkspaceId } })
    await prisma.workspace.delete({ where: { id: testWorkspaceId } })
  }
  await server.stop()
})

beforeEach(async () => {
  // Generate unique pipeline ID for each test
  testPipelineId = nanoid()

  // Create pipeline state
  await prisma.pipelineState.create({
    data: {
      outputId: testPipelineId,
      status: 'running',
      stage: 'planning',
      progress: 0,
      lastEventId: 0,
    },
  })

  // Seed some events
  await OrchestratorEventService.persistAndEmit(testPipelineId, 'planning', {
    type: 'agent:planning_start',
    level: 'info',
    message: 'Starting planning phase',
  })

  await OrchestratorEventService.persistAndEmit(testPipelineId, 'planning', {
    type: 'agent:error',
    level: 'error',
    message: 'Planning timeout exceeded',
    metadata: { timeout: 30000 },
  })

  await OrchestratorEventService.persistAndEmit(testPipelineId, 'writing', {
    type: 'agent:writing_start',
    level: 'info',
    message: 'Starting code generation',
  })

  await OrchestratorEventService.persistAndEmit(testPipelineId, 'complete', {
    type: 'agent:complete',
    level: 'info',
    message: 'Pipeline completed successfully',
  })

  // Flush batch to ensure events are persisted
  await new Promise((resolve) => setTimeout(resolve, 200))
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/orchestrator/:outputId/logs/export', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // JSON Export Tests
  // ───────────────────────────────────────────────────────────────────────────

  it('should export logs as JSON with correct headers', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json' })
      .expect(200)

    // Check Content-Type
    expect(response.headers['content-type']).toContain('application/json')

    // Check Content-Disposition
    expect(response.headers['content-disposition']).toContain('attachment')
    expect(response.headers['content-disposition']).toContain(`logs-${testPipelineId}.json`)

    // Check body is valid JSON
    expect(() => JSON.parse(response.text)).not.toThrow()

    const events = JSON.parse(response.text)
    expect(Array.isArray(events)).toBe(true)
    expect(events.length).toBeGreaterThan(0)
  })

  it('should export JSON with all event fields', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json' })
      .expect(200)

    const events = JSON.parse(response.text)
    const firstEvent = events[0]

    // Check required fields
    expect(firstEvent).toHaveProperty('type')
    expect(firstEvent).toHaveProperty('timestamp')

    // Check at least one event has level and stage
    const eventWithMeta = events.find((e: any) => e._level && e._stage)
    expect(eventWithMeta).toBeDefined()
  })

  it('should default to JSON format when format param is omitted', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .expect(200)

    expect(response.headers['content-type']).toContain('application/json')
    expect(response.headers['content-disposition']).toContain('.json')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // CSV Export Tests
  // ───────────────────────────────────────────────────────────────────────────

  it('should export logs as CSV with correct headers', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    // Check Content-Type
    expect(response.headers['content-type']).toContain('text/csv')

    // Check Content-Disposition
    expect(response.headers['content-disposition']).toContain('attachment')
    expect(response.headers['content-disposition']).toContain(`logs-${testPipelineId}.csv`)

    // Check body is string
    expect(typeof response.text).toBe('string')
    expect(response.text.length).toBeGreaterThan(0)
  })

  it('should export valid CSV format (parseable with csv-parse)', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    // Parse CSV
    let records: any[]
    expect(() => {
      records = parse(response.text, {
        columns: true,
        skip_empty_lines: true,
      })
    }).not.toThrow()

    // Check parsed records
    expect(Array.isArray(records!)).toBe(true)
    expect(records!.length).toBeGreaterThan(0)

    // Check CSV header columns
    const firstRecord = records![0]
    expect(firstRecord).toHaveProperty('timestamp')
    expect(firstRecord).toHaveProperty('level')
    expect(firstRecord).toHaveProperty('stage')
    expect(firstRecord).toHaveProperty('type')
    expect(firstRecord).toHaveProperty('message')
    expect(firstRecord).toHaveProperty('metadata')
  })

  it('should escape CSV special characters correctly', async () => {
    // Create event with special characters
    await OrchestratorEventService.persistAndEmit(testPipelineId, 'planning', {
      type: 'agent:test',
      level: 'info',
      message: 'Message with "quotes", commas, and\nnewlines',
      metadata: { key: 'value with, comma' },
    })

    await new Promise((resolve) => setTimeout(resolve, 200))

    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    // Parse CSV should not throw even with special chars
    let records: any[]
    expect(() => {
      records = parse(response.text, {
        columns: true,
        skip_empty_lines: true,
      })
    }).not.toThrow()

    // Find the event with special chars
    const specialEvent = records!.find((r) => r.type === 'agent:test')
    expect(specialEvent).toBeDefined()
    expect(specialEvent.message).toContain('quotes')
    expect(specialEvent.message).toContain('commas')
  })

  it('should include metadata as JSON string in CSV', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    const records = parse(response.text, {
      columns: true,
      skip_empty_lines: true,
    })

    // Find error event with metadata
    const errorEvent = records.find((r: any) => r.type === 'agent:error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent.metadata).toBeTruthy()

    // Metadata should be parseable JSON
    const metadata = JSON.parse(errorEvent.metadata)
    expect(metadata).toHaveProperty('timeout')
    expect(metadata.timeout).toBe(30000)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Filtering Tests
  // ───────────────────────────────────────────────────────────────────────────

  it('should export filtered logs (level=error)', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json', level: 'error' })
      .expect(200)

    const events = JSON.parse(response.text)

    // Should only include error events
    expect(events.length).toBeGreaterThan(0)
    events.forEach((event: any) => {
      const level = event._level || event.level
      expect(level).toBe('error')
    })
  })

  it('should export filtered logs (stage=planning)', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json', stage: 'planning' })
      .expect(200)

    const events = JSON.parse(response.text)

    // Should only include planning events
    expect(events.length).toBeGreaterThan(0)
    events.forEach((event: any) => {
      const stage = event._stage || event.stage
      expect(stage).toBe('planning')
    })
  })

  it('should export filtered logs (search=timeout)', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json', search: 'timeout' })
      .expect(200)

    const events = JSON.parse(response.text)

    // Should only include events with "timeout" in message
    expect(events.length).toBeGreaterThan(0)
    events.forEach((event: any) => {
      const message = event._message || event.message || ''
      const type = event.type || ''
      expect(
        message.toLowerCase().includes('timeout') || type.toLowerCase().includes('timeout')
      ).toBe(true)
    })
  })

  it('should export filtered logs with multiple filters combined', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv', level: 'error', stage: 'planning' })
      .expect(200)

    const records = parse(response.text, {
      columns: true,
      skip_empty_lines: true,
    })

    // Should only include error events in planning stage
    expect(records.length).toBeGreaterThan(0)
    records.forEach((record: any) => {
      expect(record.level).toBe('error')
      expect(record.stage).toBe('planning')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ───────────────────────────────────────────────────────────────────────────

  it('should return empty array for non-existent pipeline (JSON)', async () => {
    const fakeId = 'nonexistent-pipeline-id'
    const response = await request(app)
      .get(`/api/orchestrator/${fakeId}/logs/export`)
      .query({ format: 'json' })
      .expect(200)

    const events = JSON.parse(response.text)
    expect(Array.isArray(events)).toBe(true)
    expect(events.length).toBe(0)
  })

  it('should return CSV with header only for non-existent pipeline', async () => {
    const fakeId = 'nonexistent-pipeline-id'
    const response = await request(app)
      .get(`/api/orchestrator/${fakeId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    const records = parse(response.text, {
      columns: true,
      skip_empty_lines: true,
    })

    expect(Array.isArray(records)).toBe(true)
    expect(records.length).toBe(0)
  })

  it('should handle invalid format parameter gracefully', async () => {
    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'invalid' })
      .expect(400) // Zod validation should fail

    expect(response.body).toHaveProperty('error')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Performance & Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  it('should handle empty metadata gracefully in CSV', async () => {
    await OrchestratorEventService.persistAndEmit(testPipelineId, 'planning', {
      type: 'agent:no_metadata',
      level: 'info',
      message: 'Event without metadata',
    })

    await new Promise((resolve) => setTimeout(resolve, 200))

    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'csv' })
      .expect(200)

    const records = parse(response.text, {
      columns: true,
      skip_empty_lines: true,
    })

    const noMetadataEvent = records.find((r: any) => r.type === 'agent:no_metadata')
    expect(noMetadataEvent).toBeDefined()
    expect(noMetadataEvent.metadata).toBe('')
  })

  it('should export large number of events without error', async () => {
    // Create 100 events
    const promises = Array.from({ length: 100 }, (_, i) =>
      OrchestratorEventService.persistAndEmit(testPipelineId, 'planning', {
        type: 'agent:bulk_test',
        level: 'info',
        message: `Bulk event ${i}`,
      })
    )

    await Promise.all(promises)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const response = await request(app)
      .get(`/api/orchestrator/${testPipelineId}/logs/export`)
      .query({ format: 'json' })
      .expect(200)

    const events = JSON.parse(response.text)
    expect(events.length).toBeGreaterThanOrEqual(100)
  })
})
