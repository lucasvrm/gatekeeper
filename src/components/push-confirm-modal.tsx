import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PushConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commitHash: string
  onKeepLocal: () => void
  onPushNow: () => void
  isPushing: boolean
}

export function PushConfirmModal({
  open,
  onOpenChange,
  commitHash,
  onKeepLocal,
  onPushNow,
  isPushing,
}: PushConfirmModalProps) {
  const shortHash = commitHash.slice(0, 7)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="push-confirm-modal">
        <DialogHeader>
          <DialogTitle>Push to Remote?</DialogTitle>
          <DialogDescription>
            Commit{' '}
            <code
              data-testid="commit-hash-display"
              className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-sm"
            >
              {shortHash}
            </code>{' '}
            created successfully.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Do you want to push to remote now?</p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onKeepLocal}
            data-testid="btn-keep-local"
            disabled={isPushing}
          >
            No, Keep Local
          </Button>
          <Button
            type="button"
            onClick={onPushNow}
            data-testid="btn-push-now"
            disabled={isPushing}
          >
            {isPushing ? 'Pushing...' : 'Yes, Push Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
