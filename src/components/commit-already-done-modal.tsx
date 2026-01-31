import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface CommitAlreadyDoneModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commitHash: string | null
  commitMessage: string | null
  committedAt: string | null
}

export function CommitAlreadyDoneModal({
  open,
  onOpenChange,
  commitHash,
  commitMessage,
  committedAt,
}: CommitAlreadyDoneModalProps) {
  const formattedDate = committedAt ? new Date(committedAt).toLocaleString() : "-"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="commit-already-done-modal"
        className="sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Commit já realizado</DialogTitle>
          <DialogDescription className="sr-only">Modal com detalhes do commit já realizado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Hash</div>
            <div data-testid="commit-info-hash" className="font-mono">
              {commitHash ?? "-"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Mensagem</div>
            <div data-testid="commit-info-message">
              {commitMessage ?? "-"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Data</div>
            <div data-testid="commit-info-date" className="font-mono">
              {formattedDate}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

