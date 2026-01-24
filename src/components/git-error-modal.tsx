import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface GitErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  summary: string
  details: string
}

export function GitErrorModal({ open, onOpenChange, title, summary, details }: GitErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <pre className="mt-4 text-xs whitespace-pre-wrap rounded-md bg-muted p-3 text-foreground">
          {details}
        </pre>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
