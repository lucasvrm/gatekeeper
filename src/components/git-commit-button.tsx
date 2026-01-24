import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GitCommit } from '@phosphor-icons/react'
import { GitCommitModal } from './git-commit-modal'
import { PushConfirmModal } from './push-confirm-modal'
import { useGitOperations } from '@/hooks/useGitOperations'
import { toast } from 'sonner'
import type { Run } from '@/lib/types'

interface GitCommitButtonProps {
  contractRun: Run
  executionRun: Run | null
  outputId: string
}

export function GitCommitButton({ contractRun, executionRun, outputId }: GitCommitButtonProps) {
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [showPushConfirmModal, setShowPushConfirmModal] = useState(false)
  const [shouldPush, setShouldPush] = useState(false)

  const {
    gitStatus,
    commitHash,
    loadingState,
    checkGitStatus,
    gitAdd,
    gitCommit,
    gitPush,
  } = useGitOperations()

  // CL-GC-001, CL-GC-002, CL-GC-003: Button visible only when both runs passed
  const isVisible = contractRun.status === 'PASSED' && executionRun?.status === 'PASSED'

  if (!isVisible) {
    return null
  }

  const handleButtonClick = async () => {
    const status = await checkGitStatus()
    if (!status) return

    // CL-GC-009: No changes
    if (!status.hasChanges) {
      toast.info('No changes to commit')
      return
    }

    // CL-GC-010: Has conflicts
    if (status.hasConflicts) {
      toast.warning('Please resolve merge conflicts first')
      return
    }

    // CL-GC-011: Open modal
    setShowCommitModal(true)
  }

  const handleCommit = async (message: string, pushToRemote: boolean) => {
    setShouldPush(pushToRemote)
    let currentStep: 'staging' | 'committing' = 'staging'

    try {
      // CL-GC-021: Staging
      currentStep = 'staging'
      await gitAdd()

      // CL-GC-022: Committing
      currentStep = 'committing'
      const commitResult = await gitCommit(message)

      // Close commit modal
      setShowCommitModal(false)

      // CL-GC-025, CL-GC-026: Show push modal or success toast
      if (pushToRemote) {
        setShowPushConfirmModal(true)
      } else {
        // CL-GC-033: Local commit success
        toast.success(
          `Commit created successfully - ${commitResult.commitHash.slice(0, 7)} - Local only (not pushed)`
        )
      }
    } catch (error: any) {
      setShowCommitModal(false)
      const message = error?.message || 'Unknown error'

      if (currentStep === 'staging') {
        // CL-GC-029: Add failure
        toast.error(`Failed to stage changes: ${message}`)
      } else {
        // CL-GC-030: Commit failure
        toast.error(`Commit failed: ${message}`, {
          action: {
            label: 'View Details',
            onClick: () => {
              console.error('Commit error details:', error)
            },
          },
        })
      }
    }
  }

  const handleKeepLocal = () => {
    // CL-GC-027: Keep local
    setShowPushConfirmModal(false)
    if (commitHash) {
      toast.success(`Commit ${commitHash.slice(0, 7)} created - Local only`)
    }
  }

  const handlePushNow = async () => {
    try {
      // CL-GC-028, CL-GC-023: Push now
      const pushResult = await gitPush()
      // CL-GC-034: Commit + push success
      toast.success(
        `Changes committed and pushed to ${pushResult.branch} - ${pushResult.commitHash.slice(0, 7)}`
      )
      setShowPushConfirmModal(false)
    } catch (error: any) {
      const code = error?.code
      const message = error?.message || 'Unknown error'

      // CL-GC-031: Remote ahead
      if (code === 'REMOTE_AHEAD') {
        toast.warning('Remote has new commits', {
          action: [
            {
              label: 'Pull & Retry',
              onClick: async () => {
                try {
                  await gitPull()
                  toast.success('Pulled latest changes')
                  await handlePushNow()
                } catch (pullError: any) {
                  toast.error(`Pull failed: ${pullError?.message || 'Unknown error'}`)
                }
              },
            },
            {
              label: 'Keep Local',
              onClick: () => {
                setShowPushConfirmModal(false)
                toast.info('Keeping commit local only')
              },
            },
          ],
        })
      }
      // CL-GC-032: Permission denied
      else if (code === 'PERMISSION_DENIED') {
        toast.error(`Permission denied: ${message}. Check your SSH keys or repository permissions.`)
      } else {
        toast.error(`Push failed: ${message}`)
      }
    }
  }

  // CL-GC-012: Generate default message in YYYY_MM_DD_slug format
  const getDefaultMessage = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}_${month}_${day}_${outputId}`
  }

  const getLoadingText = () => {
    switch (loadingState) {
      case 'staging':
        return 'Staging...'
      case 'committing':
        return 'Committing...'
      case 'pushing':
        return 'Pushing...'
      default:
        return 'Git Commit'
    }
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              data-testid="btn-git-commit"
              onClick={handleButtonClick}
              aria-label="Commit validated changes to Git"
              disabled={loadingState !== 'idle'}
              className="font-sans"
            >
              <GitCommit className="w-4 h-4" />
              {getLoadingText()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Commit validated changes to Git</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Commit Modal */}
      {gitStatus && (
        <GitCommitModal
          open={showCommitModal}
          onOpenChange={setShowCommitModal}
          gitStatus={gitStatus}
          defaultMessage={getDefaultMessage()}
          onCommit={handleCommit}
          isCommitting={loadingState === 'staging' || loadingState === 'committing'}
          loadingText={getLoadingText()}
        />
      )}

      {/* Push Confirmation Modal */}
      {commitHash && (
        <PushConfirmModal
          open={showPushConfirmModal}
          onOpenChange={setShowPushConfirmModal}
          commitHash={commitHash}
          onKeepLocal={handleKeepLocal}
          onPushNow={handlePushNow}
          isPushing={loadingState === 'pushing'}
        />
      )}
    </>
  )
}
