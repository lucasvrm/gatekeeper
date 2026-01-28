import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from '@phosphor-icons/react'
import type { GitStatusResponse } from '@/lib/types'

interface GitCommitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gitStatus: GitStatusResponse
  defaultMessage: string
  onCommit: (message: string, pushToRemote: boolean) => Promise<void>
  isCommitting: boolean
  loadingText?: string
  repoName?: string
}

export function GitCommitModal({
  open,
  onOpenChange,
  gitStatus,
  defaultMessage,
  onCommit,
  isCommitting,
  loadingText = 'Commit & Push',
  repoName,
}: GitCommitModalProps) {
  const [commitMessage, setCommitMessage] = useState(defaultMessage)
  const [pushToRemote, setPushToRemote] = useState(true)

  const isMessageValid = commitMessage.trim().length >= 10
  const isProtectedBranch = gitStatus.isProtected

  const handleSubmit = async () => {
    if (!isMessageValid || isCommitting) return
    await onCommit(commitMessage, pushToRemote)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="git-commit-modal" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Repo and Branch Badges */}
          <div className="flex items-center gap-2">
            {repoName && (
              <Badge
                variant="secondary"
                data-testid="repo-badge"
                className="font-mono text-xs"
              >
                {repoName}
              </Badge>
            )}
            <Badge
              variant="outline"
              data-testid="branch-badge"
              className="font-mono text-xs"
            >
              {gitStatus.branch}
            </Badge>
            {isProtectedBranch && (
              <Badge
                variant="destructive"
                data-testid="protected-branch-warning"
                className="flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                Protected branch
              </Badge>
            )}
          </div>

          {/* Diff Summary */}
          <div
            data-testid="diff-summary"
            className="p-3 bg-gray-50 rounded-md border border-gray-200 font-mono text-xs text-gray-700"
          >
            {gitStatus.diffStat}
          </div>

          {/* Commit Message Input */}
          <div className="space-y-2">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Input
              id="commit-message"
              data-testid="commit-message-input"
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter commit message..."
              disabled={isCommitting}
            />
            {commitMessage.trim().length < 10 && commitMessage.trim().length > 0 && (
              <p className="text-sm text-red-500">Message must be at least 10 characters</p>
            )}
          </div>

          {/* Push to Remote Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="push-checkbox"
              data-testid="push-checkbox"
              checked={pushToRemote}
              onCheckedChange={(checked) => setPushToRemote(checked === true)}
              disabled={isCommitting}
            />
            <label
              htmlFor="push-checkbox"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Push to remote after commit
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel"
            disabled={isCommitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            data-testid="btn-commit-push"
            disabled={!isMessageValid || isCommitting}
          >
            {isCommitting ? loadingText : 'Commit & Push'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
