import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { OrchestratorEvent } from '@/hooks/useOrchestratorEvents'

// ─── Minimal session shape (structurally compatible with orchestrator-page) ──

interface SessionSnapshot {
  outputId?: string
  step: number
  completedSteps: number[]
  lastEventId: number
  lastSeq: number
  pipelineStatus: string | null
  pipelineStage: string | null
  pipelineProgress: number
}

export interface ReconciliationResult {
  /** Remote pipeline state merged with local (null = no session / 404) */
  remoteStep: number | null
  remoteCompletedSteps: number[] | null
  /** Events the frontend missed since last save */
  missedEvents: Array<{ id: number; eventType: string; payload: string | null; stage: string }>
  /** Authoritative lastEventId from backend */
  lastEventId: number
  /** Last SSE seq (from local, backend doesn't track this cross-session) */
  lastSeq: number
  /** Whether the pipeline reached a terminal state */
  isTerminal: boolean
  /** Pipeline status from backend */
  pipelineStatus: string | null
  /** Pipeline stage from backend */
  pipelineStage: string | null
  /** Pipeline progress from backend */
  pipelineProgress: number
  /** Whether reconciliation is still running */
  isLoading: boolean
  /** Error message if reconciliation failed */
  error: string | null
}

// ─── Stage-to-step mapping ───────────────────────────────────────────────────

export function mapStageToStep(stage: string): number {
  switch (stage) {
    case 'planning': return 1
    case 'spec': return 2
    case 'fix': return 3
    case 'execute': return 4
    case 'complete': return 4
    default: return 0
  }
}

export function mapStageToCompletedSteps(stage: string): number[] {
  switch (stage) {
    case 'planning': return [0]
    case 'spec': return [0, 1]
    case 'fix': return [0, 1, 2]
    case 'execute': return [0, 1, 2, 3]
    case 'complete': return [0, 1, 2, 3, 4]
    default: return []
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECONCILIATION_DEBOUNCE_MS = 5000 // Max 1 reconciliation per 5 seconds

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePipelineReconciliation(
  outputId: string | undefined,
  localSession: SessionSnapshot | null,
  triggerReconciliation: number = 0,
): ReconciliationResult {
  const [result, setResult] = useState<ReconciliationResult>({
    remoteStep: null,
    remoteCompletedSteps: null,
    missedEvents: [],
    lastEventId: localSession?.lastEventId ?? 0,
    lastSeq: localSession?.lastSeq ?? 0,
    isTerminal: false,
    pipelineStatus: localSession?.pipelineStatus ?? null,
    pipelineStage: localSession?.pipelineStage ?? null,
    pipelineProgress: localSession?.pipelineProgress ?? 0,
    isLoading: !!outputId,
    error: null,
  })

  const lastReconcileTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!outputId) return

    // Debounce: skip if last reconciliation was less than 5 seconds ago
    const now = Date.now()
    if (now - lastReconcileTimeRef.current < RECONCILIATION_DEBOUNCE_MS) {
      console.log('[Reconciliation] Debounced - too soon since last reconciliation')
      return
    }

    async function reconcile() {
      lastReconcileTimeRef.current = Date.now()
      setResult(prev => ({ ...prev, isLoading: true }))

      try {
        // 1. Fetch remote status (source of truth)
        const remote = await api.orchestrator.status(outputId!)
        if (!remote) {
          // Pipeline not found — keep local session as-is
          setResult(prev => ({ ...prev, isLoading: false }))
          return
        }

        // 2. Determine authoritative state from backend
        const remoteStep = mapStageToStep(remote.stage)
        const remoteCompleted = mapStageToCompletedSteps(remote.stage)
        const terminal = remote.status === 'completed' || remote.status === 'failed'

        // 3. Backfill missed events since last known eventId
        const localLastEventId = localSession?.lastEventId ?? 0
        let missedEvents: ReconciliationResult['missedEvents'] = []

        if (localLastEventId < remote.lastEventId) {
          let sinceId = localLastEventId
          let hasMore = true
          while (hasMore) {
            const page = await api.orchestrator.events(outputId!, sinceId, 200)
            missedEvents = missedEvents.concat(page.events.map(e => ({
              id: e.id,
              eventType: e.eventType,
              payload: e.payload,
              stage: e.stage,
            })))
            hasMore = page.hasMore
            if (page.events.length > 0) {
              sinceId = page.events[page.events.length - 1].id
            } else {
              hasMore = false
            }
          }
        }

        // 4. Build reconciled result — backend always wins for step/stage/status
        setResult({
          remoteStep: Math.max(remoteStep, localSession?.step ?? 0),
          remoteCompletedSteps: Array.from(new Set([
            ...(localSession?.completedSteps ?? []),
            ...remoteCompleted,
          ])),
          missedEvents,
          lastEventId: remote.lastEventId,
          lastSeq: localSession?.lastSeq ?? 0,
          isTerminal: terminal,
          pipelineStatus: remote.status,
          pipelineStage: remote.stage,
          pipelineProgress: remote.progress,
          isLoading: false,
          error: null,
        })
      } catch (err) {
        setResult(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Reconciliation failed',
        }))
      }
    }

    reconcile()
  }, [outputId, triggerReconciliation]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
}
