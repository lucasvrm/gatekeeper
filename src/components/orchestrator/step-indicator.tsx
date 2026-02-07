import { STEPS, type WizardStep } from './types'

interface StepIndicatorProps {
  current: WizardStep
  completed: Set<number>
  onStepClick?: (step: WizardStep) => void
}

export function StepIndicator({ current, completed, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ num, label }, i) => {
        const canClick = onStepClick && completed.has(num) && num !== current
        return (
          <div key={num} className="flex items-center">
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
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${completed.has(num) ? "bg-green-500/40" : "bg-border"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
