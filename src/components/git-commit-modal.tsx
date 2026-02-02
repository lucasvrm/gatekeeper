import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  loadingText = 'Commit & Enviar',
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
      {/* CL-UI-MODAL-001: max-h-[85vh] flex flex-col */}
      <DialogContent data-testid="git-commit-modal" className="sm:max-w-lg max-h-[85vh] flex flex-col">
        {/* CL-UI-MODAL-005: Fixed header with flex-shrink-0 */}
        <DialogHeader data-testid="dialog-header" className="flex-shrink-0">
          <DialogTitle>Commit de Alterações</DialogTitle>
          <DialogDescription className="sr-only">Dialog para criar um commit e opcionalmente enviar para o remoto.</DialogDescription>
        </DialogHeader>

        {/* CL-UI-MODAL-002: Scrollable content wrapper */}
        <div data-testid="content-wrapper" className="flex-1 overflow-y-auto min-h-0">
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
                Branch protegida
              </Badge>
            )}
          </div>

          {/* CL-UI-MODAL-003: Diff summary with max-h-[200px] overflow-y-auto */}
          <div
            data-testid="diff-summary"
            className="p-3 bg-gray-50 rounded-md border border-gray-200 font-mono text-xs text-gray-700 overflow-x-auto max-h-[200px] overflow-y-auto"
          >
            {gitStatus.diffStat}
          </div>

          {/* Commit Message Input */}
          <div className="space-y-2">
            <Label htmlFor="commit-message">Mensagem do Commit</Label>
            <Input
              id="commit-message"
              data-testid="commit-message-input"
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Digite a mensagem do commit..."
              disabled={isCommitting}
            />
            {commitMessage.trim().length < 10 && commitMessage.trim().length > 0 && (
              <p className="text-sm text-red-500">A mensagem deve ter pelo menos 10 caracteres</p>
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
              Enviar para remoto após commit
            </label>
          </div>
          </div>
        </div>

        {/* CL-UI-MODAL-004: Fixed footer with flex-shrink-0 */}
        <DialogFooter data-testid="dialog-footer" className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="btn-cancel"
            disabled={isCommitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            data-testid="btn-commit-push"
            disabled={!isMessageValid || isCommitting}
          >
            {isCommitting ? loadingText : 'Commit & Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

