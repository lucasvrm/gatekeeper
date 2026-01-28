import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import type { FailMode } from "@/lib/types"

interface FailModePopoverProps {
  currentMode: FailMode
  onModeChange: (mode: FailMode) => void
  disabled?: boolean
}

export function FailModePopover({
  currentMode,
  onModeChange,
  disabled = false,
}: FailModePopoverProps) {
  const [open, setOpen] = useState(false)

  const getBadgeText = () => {
    if (currentMode === "HARD") return "Hard"
    if (currentMode === "WARNING") return "Warning"
    return "Default"
  }

  const handleSelectMode = (mode: FailMode) => {
    onModeChange(mode)
    setOpen(false)
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-testid="fail-mode-trigger"
          aria-disabled={disabled}
          className={`px-2 py-1 h-auto font-medium text-xs ${
            currentMode === "HARD"
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
              : currentMode === "WARNING"
                ? "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {getBadgeText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        <div className="flex flex-col gap-1" role="listbox" data-testid="fail-mode-options">
          <Button
            variant="ghost"
            size="sm"
            role="option"
            data-testid="fail-mode-option-hard"
            onClick={() => handleSelectMode("HARD")}
            className="justify-start text-sm"
          >
            Hard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            role="option"
            data-testid="fail-mode-option-warning"
            onClick={() => handleSelectMode("WARNING")}
            className="justify-start text-sm"
          >
            Warning
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
