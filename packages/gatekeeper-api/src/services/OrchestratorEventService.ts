import { EventEmitter } from 'events'
import type { PrismaClient, PipelineEvent } from '@prisma/client'
import type { AgentEvent } from '../types/agent.types.js'
import type { LogMetrics } from '../types/index.js'
import { createLogger } from '../utils/logger.js'

const log = createLogger('OrchestratorEventService')

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Orchestrator SSE event types.
 * Defined locally to avoid circular dependency with gatekeeper-orchestrator package.
 */
export interface OrchestratorEventData {
  type: string
  [key: string]: unknown
}

/**
 * Any event that can flow through the SSE channel.
 * AgentEvent (discriminated union) is structurally compatible with
 * OrchestratorEventData but TypeScript can't prove it due to index
 * signature constraints — so we accept both explicitly.
 */
export type EmittableEvent = OrchestratorEventData | AgentEvent

export interface OrchestratorStreamEvent {
  outputId: string
  event: OrchestratorEventData
  seq?: number // monotonic sequence for SSE id:
}

export interface PersistAndEmitOptions {
  runId?: string
  agentRunId?: string
  source?: string
  skipPersist?: boolean // Para eventos que só devem ser emitidos
}

interface BufferedEvent {
  event: OrchestratorEventData
  timestamp: number
  seq: number // monotonic sequence for SSE id:
  id?: number // ID do evento persistido (se disponível)
}

interface BatchEvent {
  outputId: string
  runId?: string
  agentRunId?: string
  stage: string
  eventType: string
  level?: string
  message?: string
  payload?: string
  source?: string
}

// ─── Configuration ────────────────────────────────────────────────────────────

const BATCH_FLUSH_MS = parseInt(process.env.BATCH_FLUSH_INTERVAL || '100', 10) // Intervalo de flush do batch em ms
const MAX_BATCH_SIZE = 50 // Tamanho máximo do batch antes de flush forçado
const MAX_BUFFER_PER_OUTPUT = 100 // Máximo de eventos no buffer por outputId
const BUFFER_TTL_MS = parseInt(process.env.SSE_BUFFER_TTL || '60000', 10) // TTL do buffer em ms (60s)
const MAX_PAYLOAD_SIZE = 10_240 // Tamanho máximo de payload em bytes (10KB)
const TOOL_RESULT_MAX_SIZE = 5_000 // Tamanho máximo de tool_result.output (5000 chars)
const GC_INTERVAL_MS = parseInt(process.env.EVENT_BUFFER_GC_INTERVAL || '300000', 10) // Intervalo de GC em ms (5min)

/**
 * Eventos que NÃO devem ser persistidos (alto volume, baixo valor para auditoria).
 * São emitidos via SSE mas não gravados no banco.
 */
const IGNORED_EVENT_TYPES = new Set(['agent:text', 'agent:thinking'])

/**
 * Eventos que disparam atualização de PipelineState.
 */
const TRANSITION_EVENTS: Record<string, { stage?: string; status?: string; progress?: number }> = {
  'agent:bridge_init': { status: 'running', stage: 'planning' },
  'agent:bridge_start': { status: 'running' },
  'agent:bridge_plan_start': { stage: 'planning' },
  'agent:bridge_plan_done': { stage: 'spec', progress: 25 },
  'agent:bridge_spec_start': { stage: 'spec' },
  'agent:bridge_spec_done': { stage: 'fix', progress: 50 },
  'agent:bridge_execute_start': { stage: 'execute' },
  'agent:bridge_execute_done': { stage: 'complete', progress: 100 },
  'agent:complete': { status: 'completed', stage: 'complete', progress: 100 },
  'agent:error': { status: 'failed' },
}

/**
 * Campos sensíveis que devem ser mascarados antes da persistência.
 */
const SENSITIVE_FIELDS = new Set([
  'apiKey',
  'api_key',
  'token',
  'password',
  'secret',
  'credential',
  'authorization',
  'Authorization',
])

// ─── Service Class ────────────────────────────────────────────────────────────

class OrchestratorEventServiceClass extends EventEmitter {
  private prisma: PrismaClient | null = null

  /** Monotonic sequence counter for SSE id: frames */
  private seq = 0

  /** Recent events per outputId for replay on late SSE connections */
  private eventBuffer = new Map<string, BufferedEvent[]>()

  /** Batch queue for pending persistence */
  private batchQueue: BatchEvent[] = []

  /** Timer for batch flush */
  private batchTimer: ReturnType<typeof setTimeout> | null = null

  /** Flag to track if flush is in progress */
  private flushInProgress = false

  /** Timer for garbage collection */
  private gcTimer: ReturnType<typeof setInterval> | null = null

  // ─── Log Rotation ─────────────────────────────────────────────────────────
  /** Timer for log rotation */
  private rotationTimer: ReturnType<typeof setInterval> | null = null

  // ─── Configuration ────────────────────────────────────────────────────────

  /**
   * Initialize with Prisma client for persistence.
   * Must be called before persistAndEmit() can persist events.
   */
  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma
    this.startGarbageCollection()
    this.startLogRotation()
  }

  /**
   * Start periodic garbage collection for event buffers.
   * Automatically called by setPrisma().
   */
  private startGarbageCollection() {
    if (this.gcTimer) {
      return // Already running
    }

    log.info({ interval: GC_INTERVAL_MS }, 'Starting event buffer garbage collection')

    this.gcTimer = setInterval(() => {
      this.runGarbageCollection()
    }, GC_INTERVAL_MS)

    // Don't prevent Node.js from exiting
    if (this.gcTimer.unref) {
      this.gcTimer.unref()
    }
  }

  /**
   * Stop garbage collection timer.
   * Call during shutdown.
   */
  stopGarbageCollection() {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
      log.info('Stopped event buffer garbage collection')
    }
  }

  /**
   * Start periodic log rotation (cleanup of old events).
   * Automatically called by setPrisma().
   */
  private startLogRotation() {
    const rotationInterval = parseInt(process.env.LOG_ROTATION_INTERVAL || '86400000', 10) // Default: 24h

    if (this.rotationTimer) {
      return // Already running
    }

    log.info({ interval: rotationInterval }, 'Starting log rotation')

    this.rotationTimer = setInterval(() => {
      this.cleanupOldEvents().catch((err) => {
        log.error({ err }, 'Log rotation failed')
      })
    }, rotationInterval)

    // Don't prevent Node.js from exiting
    if (this.rotationTimer.unref) {
      this.rotationTimer.unref()
    }

    // Run immediately on startup
    this.cleanupOldEvents().catch((err) => {
      log.error({ err }, 'Initial log rotation failed')
    })
  }

  /**
   * Stop log rotation timer.
   * Call during shutdown.
   */
  stopLogRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
      this.rotationTimer = null
      log.info('Stopped log rotation')
    }
  }

  /**
   * Clean up events older than specified days.
   * Default: 30 days (configurable via LOG_RETENTION_DAYS env var)
   *
   * @param olderThanDays Number of days to retain logs (default from env or 30)
   * @returns Number of deleted events
   */
  async cleanupOldEvents(olderThanDays?: number): Promise<number> {
    if (!this.prisma) {
      log.warn('Prisma not initialized, skipping log rotation')
      return 0
    }

    const retentionDays = olderThanDays ?? parseInt(process.env.LOG_RETENTION_DAYS || '30', 10)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    log.info({ retentionDays, cutoffDate }, 'Starting log cleanup')

    try {
      const result = await this.prisma.pipelineEvent.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      })

      log.info({ deletedCount: result.count, retentionDays }, 'Log cleanup completed')
      return result.count
    } catch (err) {
      log.error({ err, retentionDays }, 'Log cleanup failed')
      throw err
    }
  }

  /**
   * Run garbage collection on event buffers.
   * Removes buffers for completed pipelines and expired events.
   */
  private runGarbageCollection() {
    const startSize = this.eventBuffer.size
    const cutoff = Date.now() - BUFFER_TTL_MS
    let evictedBuffers = 0
    let evictedEvents = 0

    // 1. Remove completely expired buffers
    for (const [outputId, buffer] of this.eventBuffer.entries()) {
      const recentEvents = buffer.filter((e) => e.timestamp >= cutoff)

      if (recentEvents.length === 0) {
        // No recent events, remove entire buffer
        this.eventBuffer.delete(outputId)
        evictedBuffers++
        evictedEvents += buffer.length
      } else if (recentEvents.length < buffer.length) {
        // Some events expired, update buffer
        this.eventBuffer.set(outputId, recentEvents)
        evictedEvents += buffer.length - recentEvents.length
      }
    }

    // 2. Check for completed pipelines in DB (only if Prisma initialized)
    if (this.prisma) {
      this.evictCompletedPipelines().catch((err) => {
        log.error({ err }, 'Failed to evict completed pipelines')
      })
    }

    if (evictedBuffers > 0 || evictedEvents > 0) {
      log.info(
        {
          evictedBuffers,
          evictedEvents,
          remainingBuffers: this.eventBuffer.size,
          beforeSize: startSize,
        },
        'Garbage collection completed',
      )
    }
  }

  /**
   * Remove event buffers for completed pipelines.
   * Queries PipelineState to find completed/failed pipelines and removes their buffers.
   */
  private async evictCompletedPipelines() {
    if (!this.prisma) return

    try {
      // Get all completed/failed pipelines from the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const completedPipelines = await this.prisma.pipelineState.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          updatedAt: { gte: oneDayAgo },
        },
        select: { outputId: true },
      })

      let removed = 0
      for (const { outputId } of completedPipelines) {
        if (this.eventBuffer.has(outputId)) {
          this.eventBuffer.delete(outputId)
          removed++
        }
      }

      if (removed > 0) {
        log.debug({ removed }, 'Evicted buffers for completed pipelines')
      }
    } catch (err) {
      log.error({ err }, 'Failed to query completed pipelines for GC')
    }
  }

  // ─── EventEmitter Overloads ───────────────────────────────────────────────

  emit(event: 'orchestrator-event', payload: OrchestratorStreamEvent): boolean
  emit(event: string, payload: OrchestratorStreamEvent): boolean {
    return super.emit(event, payload)
  }

  // ─── Main API ─────────────────────────────────────────────────────────────

  /**
   * Persist and emit an event.
   *
   * Flow:
   * 1. Check payload size and emit warning if exceeds MAX_PAYLOAD_SIZE
   * 2. Add to in-memory buffer (for SSE replay)
   * 3. Emit via EventEmitter for connected SSE clients
   * 4. Check if event should be persisted (filter agent:text, agent:thinking)
   * 5. Sanitize payload (mask sensitive fields, truncate large strings)
   * 6. Add to batch queue (will be flushed after BATCH_FLUSH_MS or MAX_BATCH_SIZE)
   * 7. Update PipelineState if transition event
   *
   * @example
   * await eventService.persistAndEmit('abc123', 'planning', {
   *   type: 'agent:tool_call',
   *   tool: 'read_file',
   *   input: { path: '/src/index.ts' }
   * }, {
   *   runId: 'run-xyz',
   *   agentRunId: 'agent-456',
   *   source: 'AgentRunnerService'
   * })
   */
  async persistAndEmit(
    outputId: string,
    stage: string,
    event: EmittableEvent,
    options: PersistAndEmitOptions = {},
  ): Promise<void> {
    const data = event as OrchestratorEventData
    const eventType = data.type

    // 1. Check payload size BEFORE adding to buffer
    const payloadStr = JSON.stringify(data)
    if (payloadStr.length > MAX_PAYLOAD_SIZE) {
      log.warn(
        {
          outputId,
          eventType,
          originalSize: payloadStr.length,
          maxSize: MAX_PAYLOAD_SIZE,
        },
        'Event payload exceeds max size, will be truncated',
      )

      // Emit warning event to SSE clients (skip persist to avoid recursion)
      const warningEvent: OrchestratorEventData = {
        type: 'orchestrator:payload_warning',
        outputId,
        originalEventType: eventType,
        originalSize: payloadStr.length,
        maxSize: MAX_PAYLOAD_SIZE,
        truncated: true,
      }

      // Add warning to buffer and emit immediately
      const warningSeq = this.addToBuffer(outputId, warningEvent)
      this.emit('orchestrator-event', { outputId, event: warningEvent, seq: warningSeq })
    }

    // 2. Add to buffer (for SSE replay) — returns monotonic seq
    const seq = this.addToBuffer(outputId, data)

    // 3. Always emit via EventEmitter (even for filtered events)
    log.debug({ outputId, eventType, seq }, 'Emitting event')
    this.emit('orchestrator-event', { outputId, event: data, seq })

    // 4. Check if should persist (skip agent:text, agent:thinking)
    if (options.skipPersist || !this.shouldPersist(eventType)) {
      return
    }

    // 5. Sanitize and prepare for batch
    const sanitizedPayload = this.filterSensitive(data)
    const batchEvent: BatchEvent = {
      outputId,
      runId: options.runId,
      agentRunId: options.agentRunId,
      stage,
      eventType,
      level: this.inferLevel(eventType),
      message: this.extractMessage(data),
      payload: JSON.stringify(sanitizedPayload),
      source: options.source,
    }

    // 6. Add to batch
    this.addToBatch(batchEvent)

    // 7. Update PipelineState if transition event
    if (this.isTransitionEvent(eventType)) {
      await this.updatePipelineState(outputId, eventType, data, options.agentRunId, seq)
    }
  }

  /**
   * Legacy method for backward compatibility.
   * Calls persistAndEmit with default options.
   */
  emitOrchestratorEvent(outputId: string, event: EmittableEvent, options?: Partial<PersistAndEmitOptions>) {
    // Infer stage from event type
    const data = event as OrchestratorEventData
    const stage = this.inferStage(data)

    // Fire and forget (don't await to maintain sync behavior)
    this.persistAndEmit(outputId, stage, event, options).catch((err) => {
      log.error({ err, outputId }, 'persistAndEmit failed')
    })
  }

  /**
   * Persist a single event individually and optionally update PipelineState.
   *
   * Unlike persistAndEmit (batch+SSE), this method:
   * - Uses prisma.pipelineEvent.create() (individual, not batch)
   * - Returns the saved PipelineEvent (with id) or null
   * - Updates PipelineState with lastEventId on transition events
   *
   * @returns The persisted PipelineEvent or null (filtered/no prisma)
   */
  async persistEventAndMaybeUpdateState(
    outputId: string,
    event: OrchestratorEventData,
  ): Promise<PipelineEvent | null> {
    // 1. Filter volatile events (agent:text, agent:thinking)
    if (!this.shouldPersist(event.type)) {
      return null
    }

    // 2. Guard: Prisma not initialized
    if (!this.prisma) {
      log.warn('Prisma not initialized, cannot persist event')
      return null
    }

    // 3. Sanitize payload
    const cleanPayload = this.filterSensitive(event)
    const stage = this.inferStage(event)
    const level = this.inferLevel(event.type)
    const message = this.extractMessage(event)

    // 4. Persist individually via create()
    const saved = await this.prisma.pipelineEvent.create({
      data: {
        outputId,
        stage,
        eventType: event.type,
        level,
        message,
        payload: JSON.stringify(cleanPayload),
      },
    })

    // 5. Update PipelineState on transition events (with lastEventId)
    if (this.isTransitionEvent(event.type)) {
      await this.updatePipelineState(outputId, event.type, event, undefined, saved.id)
    }

    return saved
  }

  /**
   * Get buffered events for an outputId (for replay on SSE connect).
   * Returns events from the last BUFFER_TTL_MS milliseconds.
   * @deprecated Use getBufferedEventsWithSeq for SSE id: support
   */
  getBufferedEvents(outputId: string): OrchestratorEventData[] {
    const buffer = this.eventBuffer.get(outputId)
    if (!buffer) return []

    const cutoff = Date.now() - BUFFER_TTL_MS
    return buffer.filter((b) => b.timestamp >= cutoff).map((b) => b.event)
  }

  /**
   * Get buffered events with seq numbers for SSE replay with id: support.
   * Returns events from the last BUFFER_TTL_MS milliseconds.
   */
  getBufferedEventsWithSeq(outputId: string): Array<{ event: OrchestratorEventData; seq: number }> {
    const buffer = this.eventBuffer.get(outputId)
    if (!buffer) return []

    const cutoff = Date.now() - BUFFER_TTL_MS
    return buffer
      .filter((b) => b.timestamp >= cutoff)
      .map((b) => ({ event: b.event, seq: b.seq }))
  }

  /**
   * Get buffered events after a specific seq number (for SSE reconnection replay).
   * Returns only events with seq > afterSeq from the last BUFFER_TTL_MS milliseconds.
   */
  getBufferedEventsAfter(
    outputId: string,
    afterSeq: number,
  ): Array<{ event: OrchestratorEventData; seq: number }> {
    const buffer = this.eventBuffer.get(outputId)
    if (!buffer || buffer.length === 0) return []

    const cutoff = Date.now() - BUFFER_TTL_MS
    return buffer
      .filter((b) => b.timestamp >= cutoff && b.seq > afterSeq)
      .map((b) => ({ event: b.event, seq: b.seq }))
  }

  /**
   * Replay events from database for late-joining SSE clients.
   * Use when buffer doesn't have enough history.
   */
  async replayFromDb(outputId: string, afterEventId?: number): Promise<PipelineEvent[]> {
    if (!this.prisma) {
      log.warn('Prisma not initialized, cannot replay from DB')
      return []
    }

    const where: Record<string, unknown> = { outputId }
    if (afterEventId !== undefined) {
      where.id = { gt: afterEventId }
    }

    return this.prisma.pipelineEvent.findMany({
      where,
      orderBy: { id: 'asc' },
      take: 200, // Limit to prevent huge responses
    })
  }

  /**
   * Force flush pending batch immediately.
   * Call this during shutdown or when you need to ensure persistence.
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    await this.flushBatch()
  }

  /**
   * Graceful shutdown: flush pending events and stop GC.
   * Call this when shutting down the server.
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down OrchestratorEventService')
    this.stopGarbageCollection()
    this.stopLogRotation()
    await this.flush()
    log.info('OrchestratorEventService shutdown complete')
  }

  /**
   * Get the current PipelineState snapshot for an outputId.
   * Returns null if not found or Prisma not initialized.
   */
  async getStatus(outputId: string): Promise<import('@prisma/client').PipelineState | null> {
    if (!this.prisma) return null
    return this.prisma.pipelineState.findUnique({ where: { outputId } })
  }

  /**
   * Get paginated events for an outputId, ordered by id ascending.
   * Uses cursor-based pagination (sinceId) with N+1 pattern for hasMore detection.
   */
  async getEventsPaginated(
    outputId: string,
    sinceId?: number,
    limit: number = 50,
  ): Promise<{ events: PipelineEvent[]; hasMore: boolean }> {
    if (!this.prisma) return { events: [], hasMore: false }
    const take = Math.min(limit, 200)
    const where: Record<string, unknown> = { outputId }
    if (sinceId !== undefined) where.id = { gt: sinceId }
    const events = await this.prisma.pipelineEvent.findMany({
      where,
      orderBy: { id: 'asc' },
      take: take + 1,
    })
    const hasMore = events.length > take
    if (hasMore) events.pop()
    return { events, hasMore }
  }

  /**
   * Get filtered events for an outputId from both buffer and database.
   * Filters by level, stage, type, search text, and date range.
   *
   * Flow:
   * 1. Fetch all events from buffer (in-memory, recent)
   * 2. Fetch all events from database (persistent, historical)
   * 3. Merge and deduplicate by seq/id
   * 4. Apply filters in-memory
   * 5. Return filtered events
   *
   * @param outputId Pipeline output ID
   * @param filters Filter options (level, stage, type, search, startDate, endDate)
   * @returns Array of filtered events
   *
   * @example
   * const events = await eventService.getEventsFiltered('abc123', {
   *   level: 'error',
   *   stage: 'planning',
   *   search: 'timeout'
   * })
   */
  async getEventsFiltered(
    outputId: string,
    filters: {
      level?: 'error' | 'warn' | 'info' | 'debug'
      stage?: string
      type?: string
      search?: string
      startDate?: string
      endDate?: string
    } = {},
  ): Promise<Array<OrchestratorEventData & { id?: number; timestamp?: number; seq?: number }>> {
    // 1. Get buffer events (recent, in-memory)
    const bufferEvents = this.getBufferedEventsWithSeq(outputId).map((e) => {
      const event = e.event as OrchestratorEventData
      return {
        ...event,
        seq: e.seq,
        timestamp: Date.now(), // Approximate timestamp
        // Inject metadata for filtering (same as DB events)
        _level: event.level || this.inferLevel(event.type),
        _stage: this.inferStage(event),
        _eventType: event.type,
        _message: event.message || this.extractMessage(event) || undefined,
      }
    })

    // 2. Get database events (persistent, historical)
    let dbEvents: Array<OrchestratorEventData & { id: number; timestamp: number }> = []
    if (this.prisma) {
      const dbRecords = await this.prisma.pipelineEvent.findMany({
        where: { outputId },
        orderBy: { id: 'asc' },
        take: 1000, // Limit to prevent huge responses
      })

      dbEvents = dbRecords.map((record) => {
        let parsedPayload: OrchestratorEventData
        try {
          parsedPayload = JSON.parse(record.payload || '{}')
        } catch {
          parsedPayload = { type: record.eventType }
        }

        return {
          ...parsedPayload,
          id: record.id,
          timestamp: record.createdAt.getTime(),
          // Inject metadata for filtering
          _level: record.level || undefined,
          _stage: record.stage,
          _eventType: record.eventType,
          _message: record.message || undefined,
        }
      })
    }

    // 3. Merge buffer + DB events (prioritize buffer for recent events)
    const allEvents = [...bufferEvents, ...dbEvents]

    // 4. Apply filters
    let filtered = allEvents

    // Filter by level
    if (filters.level) {
      filtered = filtered.filter((e) => {
        const eventLevel = '_level' in e ? e._level : this.inferLevel(e.type)
        return eventLevel === filters.level
      })
    }

    // Filter by stage
    if (filters.stage) {
      filtered = filtered.filter((e) => {
        const eventStage = '_stage' in e ? e._stage : this.inferStage(e)
        return eventStage === filters.stage
      })
    }

    // Filter by type (exact match on event.type)
    if (filters.type) {
      filtered = filtered.filter((e) => e.type === filters.type)
    }

    // Filter by search (case-insensitive, searches in message and type)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter((e) => {
        const message = ('_message' in e && e._message) ? String(e._message) : (this.extractMessage(e) || '')
        const type = e.type || ''
        return (
          message.toLowerCase().includes(searchLower) ||
          type.toLowerCase().includes(searchLower)
        )
      })
    }

    // Filter by date range
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime()
      filtered = filtered.filter((e) => {
        if (!e.timestamp) return true // Keep events without timestamp
        return e.timestamp >= startTime
      })
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime()
      filtered = filtered.filter((e) => {
        if (!e.timestamp) return true // Keep events without timestamp
        return e.timestamp <= endTime
      })
    }

    return filtered
  }

  /**
   * Format events as pretty-printed JSON string for export.
   *
   * @param events Array of events to format
   * @returns JSON string with 2-space indentation
   *
   * @example
   * const json = eventService.formatEventsAsJSON(events)
   * // Returns: "[\n  { \"type\": \"...\", ... },\n  ...\n]"
   */
  formatEventsAsJSON(
    events: Array<OrchestratorEventData & { id?: number; timestamp?: number; seq?: number }>,
  ): string {
    return JSON.stringify(events, null, 2)
  }

  /**
   * Format events as CSV string for export.
   * Columns: timestamp, level, stage, type, message, metadata
   *
   * @param events Array of events to format
   * @returns CSV string with header row
   *
   * @example
   * const csv = eventService.formatEventsAsCSV(events)
   * // Returns: "timestamp,level,stage,type,message,metadata\n..."
   */
  formatEventsAsCSV(
    events: Array<OrchestratorEventData & { id?: number; timestamp?: number; seq?: number }>,
  ): string {
    // CSV header
    const header = 'timestamp,level,stage,type,message,metadata'

    // CSV rows
    const rows = events.map((event) => {
      const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : ''
      const level = ('_level' in event && event._level) ? String(event._level) : this.inferLevel(event.type)
      const stage = ('_stage' in event && event._stage) ? String(event._stage) : this.inferStage(event)
      const type = event.type || ''
      const message = ('_message' in event && event._message) ? String(event._message) : (this.extractMessage(event) || '')

      // Metadata: extract metadata field if exists, otherwise collect remaining fields
      let metadataObj: Record<string, any> = {}

      if ('metadata' in event && event.metadata && typeof event.metadata === 'object') {
        // Event has explicit metadata field, use only that
        metadataObj = event.metadata as Record<string, any>
      } else {
        // Collect all fields except those already exported in columns
        metadataObj = { ...event }
        delete metadataObj.type
        delete metadataObj.level  // Remove duplicate (exported in column)
        delete metadataObj.stage  // Remove duplicate (exported in column)
        delete metadataObj.message  // Remove duplicate (exported in column)
        delete metadataObj.id
        delete metadataObj.timestamp
        delete metadataObj.seq
        delete metadataObj._level
        delete metadataObj._stage
        delete metadataObj._eventType
        delete metadataObj._message
      }

      const metadataStr = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : ''

      // Escape CSV values (double quotes and newlines)
      const escape = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }

      return [
        escape(timestamp),
        escape(level),
        escape(stage),
        escape(type),
        escape(message),
        escape(metadataStr),
      ].join(',')
    })

    return [header, ...rows].join('\n')
  }

  /**
   * Get aggregated metrics for a pipeline.
   *
   * Calculates metrics from in-memory buffered events:
   * - Total event count
   * - Count by level (error, warning, info)
   * - Count by stage (planning, spec, fix, execute)
   * - Count by type (agent:start, agent:error, etc)
   * - Execution duration (first to last event)
   *
   * @param pipelineId Pipeline ID (outputId)
   * @returns LogMetrics object with aggregated data
   *
   * @example
   * ```ts
   * const metrics = eventService.getMetrics('pipeline-123')
   * console.log(metrics.totalEvents) // => 42
   * console.log(metrics.duration.formatted) // => '00:05:30'
   * ```
   */
  async getMetrics(pipelineId: string): Promise<LogMetrics> {
    // Import metrics helpers (dynamic import to avoid circular deps)
    const { countByField, calculateDuration } = await import('../utils/metrics.js')

    // 1. Get buffered events with timestamps from internal buffer
    const buffer = this.eventBuffer.get(pipelineId)
    if (!buffer || buffer.length === 0) {
      return {
        pipelineId,
        totalEvents: 0,
        byLevel: {},
        byStage: {},
        byType: {},
        duration: { ms: 0, formatted: '00:00:00' },
        firstEvent: null,
        lastEvent: null,
      }
    }

    // Filter by TTL
    const cutoff = Date.now() - BUFFER_TTL_MS
    const validEvents = buffer.filter((b) => b.timestamp >= cutoff)

    if (validEvents.length === 0) {
      return {
        pipelineId,
        totalEvents: 0,
        byLevel: {},
        byStage: {},
        byType: {},
        duration: { ms: 0, formatted: '00:00:00' },
        firstEvent: null,
        lastEvent: null,
      }
    }

    // 2. Extract enriched fields (level, stage) for aggregation
    const enrichedEvents = validEvents.map((bufferedEvent) => {
      const event = bufferedEvent.event
      return {
        ...event,
        level: ('_level' in event && event._level)
          ? String(event._level)
          : this.inferLevel(event.type),
        stage: ('_stage' in event && event._stage)
          ? String(event._stage)
          : this.inferStage(event),
        type: event.type || 'unknown',
        timestamp: bufferedEvent.timestamp,
      }
    })

    // 3. Aggregate
    const byLevel = countByField(enrichedEvents, 'level')
    const byStage = countByField(enrichedEvents, 'stage')
    const byType = countByField(enrichedEvents, 'type')

    // 4. Calculate duration
    const sortedByTime = [...enrichedEvents].sort((a, b) => a.timestamp - b.timestamp)
    const firstEvent = new Date(sortedByTime[0].timestamp).toISOString()
    const lastEvent = new Date(sortedByTime[sortedByTime.length - 1].timestamp).toISOString()

    const duration = calculateDuration(
      sortedByTime.map((e) => ({ timestamp: new Date(e.timestamp) }))
    )

    return {
      pipelineId,
      totalEvents: validEvents.length,
      byLevel,
      byStage,
      byType,
      duration,
      firstEvent,
      lastEvent,
    }
  }

  /**
   * Clean up buffer for a completed outputId.
   */
  clearBuffer(outputId: string) {
    this.eventBuffer.delete(outputId)
  }

  // ─── Filtering ────────────────────────────────────────────────────────────

  /**
   * Check if event type should be persisted.
   * Filters out high-volume, low-audit-value events.
   */
  private shouldPersist(eventType: string): boolean {
    return !IGNORED_EVENT_TYPES.has(eventType)
  }

  /**
   * Sanitize event data for persistence.
   * - Masks sensitive fields (apiKey, token, etc)
   * - Truncates large strings
   * - Removes undefined/null values
   */
  private filterSensitive(event: OrchestratorEventData): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(event)) {
      if (value === undefined || value === null) {
        continue
      }

      if (SENSITIVE_FIELDS.has(key)) {
        result[key] = '[REDACTED]'
        continue
      }

      if (typeof value === 'string') {
        result[key] = this.truncateString(value)
        continue
      }

      if (typeof value === 'object' && value !== null) {
        const sanitized = this.sanitizeObject(value as Record<string, unknown>)
        // Truncamento específico de tool_result.output (5000 chars, sufixo pt-br)
        if (key === 'tool_result' && typeof sanitized.output === 'string' && sanitized.output.length > TOOL_RESULT_MAX_SIZE) {
          sanitized.output = sanitized.output.slice(0, TOOL_RESULT_MAX_SIZE) + '... [truncado]'
        }
        result[key] = sanitized
        continue
      }

      result[key] = value
    }

    return result
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        continue
      }

      if (SENSITIVE_FIELDS.has(key)) {
        result[key] = '[REDACTED]'
        continue
      }

      if (typeof value === 'string') {
        result[key] = this.truncateString(value)
        continue
      }

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          result[key] = value.slice(0, 50).map((item) =>
            typeof item === 'object' && item !== null
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
          )
        } else {
          result[key] = this.sanitizeObject(value as Record<string, unknown>)
        }
        continue
      }

      result[key] = value
    }

    return result
  }

  private truncateString(str: string): string {
    if (str.length <= MAX_PAYLOAD_SIZE) {
      return str
    }
    return str.slice(0, MAX_PAYLOAD_SIZE - 20) + '... [truncated]'
  }

  // ─── Batching ─────────────────────────────────────────────────────────────

  private addToBatch(event: BatchEvent) {
    this.batchQueue.push(event)

    // Flush immediately if batch is full
    if (this.batchQueue.length >= MAX_BATCH_SIZE) {
      this.flush().catch((err) => {
        log.error({ err }, 'Batch flush failed')
      })
      return
    }

    // Schedule flush if not already scheduled
    if (!this.batchTimer && !this.flushInProgress) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null
        this.flushBatch().catch((err) => {
          log.error({ err }, 'Scheduled batch flush failed')
        })
      }, BATCH_FLUSH_MS)
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return
    }

    if (!this.prisma) {
      log.warn({ queueLength: this.batchQueue.length }, 'Prisma not initialized, skipping persistence')
      this.batchQueue = [] // Clear queue to prevent memory leak
      return
    }

    this.flushInProgress = true
    const eventsToFlush = this.batchQueue.splice(0, this.batchQueue.length)

    try {
      // Batch insert all events
      await this.prisma.pipelineEvent.createMany({
        data: eventsToFlush.map((e) => ({
          outputId: e.outputId,
          runId: e.runId,
          agentRunId: e.agentRunId,
          stage: e.stage,
          eventType: e.eventType,
          level: e.level,
          message: e.message,
          payload: e.payload,
          source: e.source,
        })),
      })

      log.debug({ count: eventsToFlush.length }, 'Flushed events to DB')
    } catch (err) {
      log.error({ err, count: eventsToFlush.length }, 'Failed to flush batch')
      // Re-add events to queue on failure (best-effort retry)
      this.batchQueue.unshift(...eventsToFlush)
    } finally {
      this.flushInProgress = false
    }
  }

  // ─── Buffer ───────────────────────────────────────────────────────────────

  private addToBuffer(outputId: string, event: OrchestratorEventData): number {
    if (!this.eventBuffer.has(outputId)) {
      this.eventBuffer.set(outputId, [])
    }

    const seq = ++this.seq
    const buffer = this.eventBuffer.get(outputId)!
    buffer.push({ event, timestamp: Date.now(), seq })

    // Trim buffer size
    if (buffer.length > MAX_BUFFER_PER_OUTPUT) {
      buffer.splice(0, buffer.length - MAX_BUFFER_PER_OUTPUT)
    }

    // Evict stale events periodically (on write, not on read)
    this.evictStaleEvents(buffer)

    return seq
  }

  private evictStaleEvents(buffer: BufferedEvent[]) {
    const cutoff = Date.now() - BUFFER_TTL_MS
    let i = 0
    while (i < buffer.length && buffer[i].timestamp < cutoff) {
      i++
    }
    if (i > 0) {
      buffer.splice(0, i)
    }
  }

  // ─── PipelineState ────────────────────────────────────────────────────────

  private isTransitionEvent(eventType: string): boolean {
    return eventType in TRANSITION_EVENTS
  }

  private async updatePipelineState(
    outputId: string,
    eventType: string,
    event: OrchestratorEventData,
    agentRunId?: string,
    lastEventId?: number,
  ): Promise<void> {
    if (!this.prisma) {
      log.warn({ outputId, eventType }, 'Prisma not initialized, cannot update PipelineState')
      return
    }

    const transition = TRANSITION_EVENTS[eventType]
    if (!transition) return

    try {
      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (transition.stage) updateData.stage = transition.stage
      if (transition.status) updateData.status = transition.status
      if (transition.progress !== undefined) updateData.progress = transition.progress
      if (agentRunId) updateData.agentRunId = agentRunId
      if (lastEventId !== undefined) updateData.lastEventId = lastEventId

      // Extract summary from event if available
      if ('artifacts' in event || 'tokensUsed' in event) {
        const summary: Record<string, unknown> = {}
        if ('artifacts' in event) {
          const artifacts = event.artifacts as unknown[]
          summary.artifactNames = Array.isArray(artifacts)
            ? artifacts.map((a: unknown) =>
                typeof a === 'object' && a !== null && 'filename' in a
                  ? (a as { filename: string }).filename
                  : String(a),
              )
            : []
        }
        if ('tokensUsed' in event) summary.tokensUsed = event.tokensUsed
        updateData.summary = JSON.stringify(summary)
      }

      await this.prisma.pipelineState.upsert({
        where: { outputId },
        create: {
          outputId,
          status: (transition.status as string) || 'running',
          stage: (transition.stage as string) || 'planning',
          progress: transition.progress ?? 0,
          agentRunId,
          lastEventId: lastEventId ?? 0,
          summary: updateData.summary as string | undefined,
        },
        update: updateData,
      })

      log.debug(
        {
          outputId,
          stage: transition.stage,
          status: transition.status,
          progress: transition.progress,
        },
        'Updated PipelineState',
      )
    } catch (err) {
      log.error({ err, outputId, eventType }, 'Failed to update PipelineState')
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private inferLevel(eventType: string): string {
    if (eventType.includes('error') || eventType.includes('failed')) return 'error'
    if (eventType.includes('warning') || eventType.includes('budget')) return 'warn'
    return 'info'
  }

  private extractMessage(event: OrchestratorEventData): string | undefined {
    if ('message' in event && typeof event.message === 'string') return event.message
    if ('error' in event && typeof event.error === 'string') return event.error
    if ('tool' in event && typeof event.tool === 'string') return `Tool: ${event.tool}`
    return undefined
  }

  private inferStage(event: OrchestratorEventData): string {
    if ('step' in event) {
      const step = event.step as number
      switch (step) {
        case 1:
          return 'planning'
        case 2:
          return 'spec'
        case 3:
          return 'fix'
        case 4:
          return 'execute'
      }
    }

    // Infer from event type
    if (event.type.includes('plan')) return 'planning'
    if (event.type.includes('spec')) return 'spec'
    if (event.type.includes('fix')) return 'fix'
    if (event.type.includes('execute')) return 'execute'

    return 'unknown'
  }

  /**
   * Retorna estatísticas do buffer de eventos (apenas para diagnóstico/testes)
   */
  getBufferStats(): { size: number; totalEvents: number; outputIds: string[] } {
    let totalEvents = 0
    const outputIds: string[] = []

    for (const [outputId, buffer] of this.eventBuffer.entries()) {
      outputIds.push(outputId)
      totalEvents += buffer.length
    }

    return {
      size: this.eventBuffer.size,
      totalEvents,
      outputIds,
    }
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const OrchestratorEventService = new OrchestratorEventServiceClass()
