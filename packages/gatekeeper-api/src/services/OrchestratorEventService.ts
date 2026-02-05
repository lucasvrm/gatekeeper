import { EventEmitter } from 'events'
import type { PrismaClient, PipelineEvent } from '@prisma/client'
import type { AgentEvent } from '../types/agent.types.js'

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

const BATCH_FLUSH_MS = 100 // Intervalo de flush do batch em ms
const MAX_BATCH_SIZE = 50 // Tamanho máximo do batch antes de flush forçado
const MAX_BUFFER_PER_OUTPUT = 100 // Máximo de eventos no buffer por outputId
const BUFFER_TTL_MS = 60_000 // TTL do buffer em ms (60s)
const MAX_PAYLOAD_SIZE = 10_240 // Tamanho máximo de payload em bytes (10KB)

/**
 * Eventos que NÃO devem ser persistidos (alto volume, baixo valor para auditoria).
 * São emitidos via SSE mas não gravados no banco.
 */
const IGNORED_EVENT_TYPES = new Set(['agent:text', 'agent:thinking'])

/**
 * Eventos que disparam atualização de PipelineState.
 */
const TRANSITION_EVENTS: Record<string, { stage?: string; status?: string; progress?: number }> = {
  'agent:bridge_start': { status: 'running' },
  'agent:bridge_plan_done': { stage: 'spec', progress: 25 },
  'agent:bridge_spec_done': { stage: 'fix', progress: 50 },
  'agent:bridge_execute_done': { stage: 'complete', progress: 100 },
  'agent:complete': { status: 'completed' },
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

  /** Recent events per outputId for replay on late SSE connections */
  private eventBuffer = new Map<string, BufferedEvent[]>()

  /** Batch queue for pending persistence */
  private batchQueue: BatchEvent[] = []

  /** Timer for batch flush */
  private batchTimer: ReturnType<typeof setTimeout> | null = null

  /** Flag to track if flush is in progress */
  private flushInProgress = false

  // ─── Configuration ────────────────────────────────────────────────────────

  /**
   * Initialize with Prisma client for persistence.
   * Must be called before persistAndEmit() can persist events.
   */
  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma
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
   * 1. Check if event should be persisted (filter agent:text, agent:thinking)
   * 2. Sanitize payload (mask sensitive fields, truncate large strings)
   * 3. Add to batch queue (will be flushed after BATCH_FLUSH_MS or MAX_BATCH_SIZE)
   * 4. Add to in-memory buffer (for SSE replay)
   * 5. Update PipelineState if transition event
   * 6. Emit via EventEmitter for connected SSE clients
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

    // 1. Always emit via EventEmitter (even for filtered events)
    console.log('[OrchestratorEventService] Emitting:', eventType, 'for:', outputId)
    this.emit('orchestrator-event', { outputId, event: data })

    // 2. Add to buffer (for SSE replay)
    this.addToBuffer(outputId, data)

    // 3. Check if should persist (skip agent:text, agent:thinking)
    if (options.skipPersist || !this.shouldPersist(eventType)) {
      return
    }

    // 4. Sanitize and prepare for batch
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

    // 5. Add to batch
    this.addToBatch(batchEvent)

    // 6. Update PipelineState if transition event
    if (this.isTransitionEvent(eventType)) {
      await this.updatePipelineState(outputId, eventType, data, options.agentRunId)
    }
  }

  /**
   * Legacy method for backward compatibility.
   * Calls persistAndEmit with default options.
   */
  emitOrchestratorEvent(outputId: string, event: EmittableEvent) {
    // Infer stage from event type
    const data = event as OrchestratorEventData
    const stage = this.inferStage(data)

    // Fire and forget (don't await to maintain sync behavior)
    this.persistAndEmit(outputId, stage, event).catch((err) => {
      console.error('[OrchestratorEventService] persistAndEmit failed:', err)
    })
  }

  /**
   * Get buffered events for an outputId (for replay on SSE connect).
   * Returns events from the last BUFFER_TTL_MS milliseconds.
   */
  getBufferedEvents(outputId: string): OrchestratorEventData[] {
    const buffer = this.eventBuffer.get(outputId)
    if (!buffer) return []

    const cutoff = Date.now() - BUFFER_TTL_MS
    return buffer.filter((b) => b.timestamp >= cutoff).map((b) => b.event)
  }

  /**
   * Replay events from database for late-joining SSE clients.
   * Use when buffer doesn't have enough history.
   */
  async replayFromDb(outputId: string, afterEventId?: number): Promise<PipelineEvent[]> {
    if (!this.prisma) {
      console.warn('[OrchestratorEventService] Prisma not initialized, cannot replay from DB')
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
        result[key] = this.sanitizeObject(value as Record<string, unknown>)
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
        console.error('[OrchestratorEventService] Batch flush failed:', err)
      })
      return
    }

    // Schedule flush if not already scheduled
    if (!this.batchTimer && !this.flushInProgress) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null
        this.flushBatch().catch((err) => {
          console.error('[OrchestratorEventService] Scheduled batch flush failed:', err)
        })
      }, BATCH_FLUSH_MS)
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return
    }

    if (!this.prisma) {
      console.warn('[OrchestratorEventService] Prisma not initialized, skipping persistence')
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

      console.log(`[OrchestratorEventService] Flushed ${eventsToFlush.length} events to DB`)
    } catch (err) {
      console.error('[OrchestratorEventService] Failed to flush batch:', err)
      // Re-add events to queue on failure (best-effort retry)
      this.batchQueue.unshift(...eventsToFlush)
    } finally {
      this.flushInProgress = false
    }
  }

  // ─── Buffer ───────────────────────────────────────────────────────────────

  private addToBuffer(outputId: string, event: OrchestratorEventData) {
    if (!this.eventBuffer.has(outputId)) {
      this.eventBuffer.set(outputId, [])
    }

    const buffer = this.eventBuffer.get(outputId)!
    buffer.push({ event, timestamp: Date.now() })

    // Trim buffer size
    if (buffer.length > MAX_BUFFER_PER_OUTPUT) {
      buffer.splice(0, buffer.length - MAX_BUFFER_PER_OUTPUT)
    }

    // Evict stale events periodically (on write, not on read)
    this.evictStaleEvents(buffer)
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
  ): Promise<void> {
    if (!this.prisma) {
      console.warn('[OrchestratorEventService] Prisma not initialized, cannot update PipelineState')
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
          summary: updateData.summary as string | undefined,
        },
        update: updateData,
      })

      console.log(`[OrchestratorEventService] Updated PipelineState for ${outputId}:`, {
        stage: transition.stage,
        status: transition.status,
        progress: transition.progress,
      })
    } catch (err) {
      console.error('[OrchestratorEventService] Failed to update PipelineState:', err)
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
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const OrchestratorEventService = new OrchestratorEventServiceClass()
