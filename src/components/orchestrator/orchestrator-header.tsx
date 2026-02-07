import type { WizardStep } from "./types"
import { Button } from "@/components/ui/button"
import { StepIndicator } from "./step-indicator"

interface OrchestratorHeaderProps {
  step: WizardStep
  completedSteps: Set<number>
  onStepClick: (step: WizardStep) => void
  taskDescription: string
  outputId?: string
  onReset: () => void
  loading: boolean
}

export function OrchestratorHeader({
  step,
  completedSteps,
  onStepClick,
  taskDescription,
  outputId,
  onReset,
  loading,
}: OrchestratorHeaderProps) {
  return (
    <div className="rounded-lg border p-3 mb-4 flex items-center justify-between gap-4 bg-sidebar w-full">
      <StepIndicator current={step} completed={completedSteps} onStepClick={onStepClick} />

      {outputId && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <span className="truncate max-w-[200px]" title={taskDescription}>
            {taskDescription}
          </span>
          <span className="text-primary">{outputId.slice(-8)}</span>
        </div>
      )}

      {outputId && !loading && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      )}
    </div>
  )
}
