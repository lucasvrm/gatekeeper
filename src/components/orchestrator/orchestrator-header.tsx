import type { WizardStep, PlannerSubstep } from "./types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StepIndicator } from "./step-indicator"
import { Square } from "lucide-react"

export interface AgentStatus {
  status: 'idle' | 'running' | 'cancelled' | 'error'
  provider?: string
  model?: string
  iteration?: number
  tokensUsed?: { inputTokens: number; outputTokens: number }
  elapsedMs?: number
  step?: number
  /** Flag indicating execution stopped (error/cancelled) - ignore subsequent iteration/tool events */
  isTerminal?: boolean
}

interface OrchestratorHeaderProps {
  step: WizardStep
  completedSteps: Set<number>
  onStepClick: (step: WizardStep) => void
  outputId?: string
  onReset: () => void
  loading: boolean
  plannerSubstep?: PlannerSubstep
  agentStatus: AgentStatus
  onKillAgent: () => void
}

export function OrchestratorHeader({
  step,
  completedSteps,
  onStepClick,
  outputId,
  onReset,
  loading,
  plannerSubstep,
  agentStatus = { status: 'idle' },
  onKillAgent,
}: OrchestratorHeaderProps) {
  const { status, provider, model, iteration, tokensUsed } = agentStatus
  const isRunning = status === 'running'

  return (
    <div className="rounded-lg border p-3 mb-4 flex items-center justify-between gap-4 bg-sidebar w-full">
      {/* Left: Steps + Reset */}
      <div className="flex items-center gap-3">
        <StepIndicator current={step} completed={completedSteps} onStepClick={onStepClick} plannerSubstep={plannerSubstep} />
        {outputId && !loading && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>

      {/* Right: Agent Status */}
      {outputId && (
        <div className="flex items-center gap-3 text-xs">
          {/* Status badge */}
          <Badge
            variant={
              status === 'running' ? 'default' :
              status === 'cancelled' ? 'secondary' :
              status === 'error' ? 'destructive' :
              'outline'
            }
            className="font-mono"
          >
            {status === 'running' && '🤖 Running'}
            {status === 'cancelled' && '⛔ Cancelled'}
            {status === 'error' && '❌ Error'}
            {status === 'idle' && '💤 Idle'}
          </Badge>

          {/* Iteration + Tokens (when running) */}
          {isRunning && (
            <span className="text-muted-foreground font-mono">
              {iteration ?? 0} iter • {(tokensUsed?.inputTokens || 0).toLocaleString()}in/{(tokensUsed?.outputTokens || 0).toLocaleString()}out
            </span>
          )}

          {/* Kill button (only when running) */}
          {isRunning && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onKillAgent}
              className="gap-1.5"
            >
              <Square className="size-3" />
              Kill
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
