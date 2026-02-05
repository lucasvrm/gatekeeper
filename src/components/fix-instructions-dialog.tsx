import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface FixInstructionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: "plan" | "spec"
  failedValidators: string[]
  onConfirm: (customInstructions: string) => void
}

export function FixInstructionsDialog({
  open,
  onOpenChange,
  target,
  failedValidators,
  onConfirm,
}: FixInstructionsDialogProps) {
  const [instructions, setInstructions] = useState("")

  const handleConfirm = () => {
    onConfirm(instructions.trim())
    setInstructions("")
    onOpenChange(false)
  }

  const handleSkip = () => {
    onConfirm("")
    setInstructions("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">
            Corrigir {target === "plan" ? "Plano" : "Testes"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-auto">
          {failedValidators.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Validators:</Label>
              <div className="flex flex-wrap gap-1">
                {failedValidators.slice(0, 4).map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-destructive/10 text-destructive"
                  >
                    {v}
                  </span>
                ))}
                {failedValidators.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{failedValidators.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="custom-instructions" className="text-sm">Instruções extras (opcional)</Label>
            <Textarea
              id="custom-instructions"
              placeholder="Ex: Foque nos imports..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 pt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSkip}>
            Sem instruções
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!instructions.trim()}>
            Com instruções
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
