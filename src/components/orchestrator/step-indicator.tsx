import { STEPS, type WizardStep, type PlannerSubstep } from './types'
import { Badge } from '@/components/ui/badge'

interface StepIndicatorProps {
  current: WizardStep
  completed: Set<number>
  onStepClick?: (step: WizardStep) => void
  plannerSubstep?: PlannerSubstep
}

export function StepIndicator({ current, completed, onStepClick, plannerSubstep }: StepIndicatorProps) {
  const getSubstepLabel = (substep: PlannerSubstep) => {
    if (substep === 'discovery') return 'Discovery'
    if (substep === 'planner') return 'Plano'
    return null
  }

  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ num, label }, i) => {
        const canClick = onStepClick && completed.has(num) && num !== current
        const showSubstep = num === 1 && plannerSubstep !== null && current === 1
        const substepLabel = showSubstep ? getSubstepLabel(plannerSubstep) : null

        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onStepClick(num as WizardStep)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  num === current
                    ? "bg-primary text-primary-foreground"
                    : completed.has(num)
                    ? "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 cursor-pointer"
                    : "bg-muted text-muted-foreground"
                } ${!canClick ? "cursor-default" : ""}`}
              >
                <span>{completed.has(num) ? "✓" : num}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {substepLabel && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {substepLabel}
                </Badge>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${completed.has(num) ? "bg-green-500/40" : "bg-border"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
