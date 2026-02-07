import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GitCommit } from 'lucide-react'
import { GitCommitModal } from './git-commit-modal'
import { PushConfirmModal } from './push-confirm-modal'
import { GitErrorModal } from './git-error-modal'
import { CommitAlreadyDoneModal } from './commit-already-done-modal'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import type { GitStatusResponse, Run } from '@/lib/types'
import { getRepoNameFromPath } from '@/lib/utils'

interface GitCommitButtonProps {
  contractRun: Run
  executionRun: Run | null
  outputId: string
}

export function GitCommitButton({ contractRun, executionRun, outputId }: GitCommitButtonProps) {
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [showPushConfirmModal, setShowPushConfirmModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showCommitAlreadyDone, setShowCommitAlreadyDone] = useState(false)
  const [localCommitHash, setLocalCommitHash] = useState<string | null>(null)
  const [commitJustDone, setCommitJustDone] = useState(false)
  const [localGitStatus, setLocalGitStatus] = useState<GitStatusResponse | null>(null)
  const [loadingState, setLoadingState] = useState<'idle' | 'staging' | 'committing' | 'pushing'>('idle')
  const [errorTitle, setErrorTitle] = useState('Erro do Git')
  const [errorSummary, setErrorSummary] = useState('')
  const [errorDetails, setErrorDetails] = useState('')

  const projectId = executionRun?.projectId || contractRun.projectId
  const projectPath = executionRun?.projectPath || contractRun.projectPath
  const hasGitContext = Boolean(projectId || projectPath)

  const buildGitDetails = (debug: { fetchOutput: string; statusText: string } | null) => {
    const fetchOutput = debug?.fetchOutput?.trim() || '(sem output)'
    const statusText = debug?.statusText?.trim() || '(sem output)'
    return `git fetch:\n${fetchOutput}\n\ngit status:\n${statusText}`
  }

  const openGitErrorModal = (title: string, summary: string, details: string) => {
    setErrorTitle(title)
    setErrorSummary(summary)
    setErrorDetails(details)
    setShowErrorModal(true)
  }

  const showGitError = (title: string, summary: string, details: string) => {
    openGitErrorModal(title, summary, details)
    toast.warning(summary)
  }

  // CL-GC-001, CL-GC-002, CL-GC-003: Button visible only when both runs passed
  const isVisible = contractRun.status === 'PASSED' && executionRun?.status === 'PASSED'
  const hasExistingCommit = executionRun?.commitHash !== null && executionRun?.commitHash !== undefined

  if (!isVisible) {
    return null
  }

  const handleButtonClick = async () => {
    if (hasExistingCommit) {
      setShowCommitAlreadyDone(true)
      return
    }

    if (!projectId) {
      if (!projectPath) {
        showGitError(
          'Git status falhou',
          'ProjectId necessário para operações git.',
          'projectId ou projectPath é necessário para localizar o repositório.'
        )
        return
      }
    }

    let status
    try {
      status = await api.git.status(projectId, projectPath)
      setLocalGitStatus(status)
    } catch {
      const debug = await api.git.fetchStatus(projectId, projectPath).catch(() => null)
      const details = buildGitDetails(debug)
      showGitError('Git status falhou', 'Falha ao verificar git status.', details)
      return
    }

    // CL-GC-009: No changes
    if (!status.hasChanges) {
      toast.info('Nenhuma alteração para commit')
      return
    }

    // CL-GC-010: Has conflicts
    if (status.hasConflicts) {
      toast.warning('Resolva os conflitos de merge primeiro')
      return
    }

    // CL-GC-011: Open modal
    setShowCommitModal(true)
  }

  const handleCommit = async (message: string, pushToRemote: boolean) => {
    if (!projectId) {
      if (!projectPath) {
        showGitError(
          'Git commit falhou',
          'ProjectId necessário para operações git.',
          'projectId ou projectPath é necessário para localizar o repositório.'
        )
        return
      }
    }

    let currentStep: 'staging' | 'committing' = 'staging'

    try {
      // CL-GC-021: Staging
      currentStep = 'staging'
      setLoadingState('staging')
      await api.git.add(projectId, projectPath)

      // CL-GC-022: Committing
      currentStep = 'committing'
      setLoadingState('committing')
      const commitResult = await api.git.commit(projectId, message, executionRun?.id, projectPath)
      setLocalCommitHash(commitResult.commitHash)
      setCommitJustDone(true)

      // Close commit modal
      setShowCommitModal(false)

      // CL-GC-025, CL-GC-026: Show push modal or success toast
      if (pushToRemote) {
        setShowPushConfirmModal(true)
      } else {
        // CL-GC-033: Local commit success
        toast.success(
          `Commit criado com sucesso - ${commitResult.commitHash.slice(0, 7)} - Apenas local (não enviado)`
        )
      }
    } catch (error: unknown) {
      setShowCommitModal(false)
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const debug = await api.git.fetchStatus(projectId, projectPath).catch(() => null)
      const details = buildGitDetails(debug)

      if (currentStep === 'staging') {
        // CL-GC-029: Add failure
        showGitError('Git add falhou', `Falha ao preparar alterações: ${message}`, details)
      } else {
        // CL-GC-030: Commit failure
        showGitError('Git commit falhou', `Commit falhou: ${message}`, details)
        console.error('Commit error details:', error)
      }
    } finally {
      setLoadingState('idle')
    }
  }

  const handleKeepLocal = () => {
    // CL-GC-027: Keep local
    setShowPushConfirmModal(false)
    if (localCommitHash) {
      toast.success(`Commit ${localCommitHash.slice(0, 7)} criado - Apenas local`)
    }
  }

  const handlePushNow = async () => {
    if (!projectId) {
      if (!projectPath) {
        showGitError(
          'Git push falhou',
          'ProjectId necessário para operações git.',
          'projectId ou projectPath é necessário para localizar o repositório.'
        )
        return
      }
    }

    try {
      // CL-GC-028, CL-GC-023: Push now
      setLoadingState('pushing')
      const pushResult = await api.git.push(projectId, projectPath)
      // CL-GC-034: Commit + push success
      toast.success(
        `Alterações commitadas e enviadas para ${pushResult.branch} - ${pushResult.commitHash.slice(0, 7)}`
      )
      setShowPushConfirmModal(false)
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const debug = await api.git.fetchStatus(projectId, projectPath).catch(() => null)
      const details = buildGitDetails(debug)

      // CL-GC-031: Remote ahead
      if (code === 'REMOTE_AHEAD') {
        openGitErrorModal('Git push bloqueado', 'Remoto tem novos commits.', details)
        toast.warning('Remoto tem novos commits', {
          action: [
            {
              label: 'Pull & Tentar Novamente',
              onClick: async () => {
                try {
                  await api.git.pull(projectId, projectPath)
                  toast.success('Últimas alterações puxadas')
                  await handlePushNow()
                } catch (pullError: unknown) {
                  const pullDebug = await api.git.fetchStatus(projectId, projectPath).catch(() => null)
                  const pullDetails = buildGitDetails(pullDebug)
                  const pullMessage = pullError instanceof Error ? pullError.message : 'Erro desconhecido'
                  showGitError(
                    'Git pull falhou',
                    `Pull falhou: ${pullMessage}`,
                    pullDetails
                  )
                }
              },
            },
            {
              label: 'Manter Local',
              onClick: () => {
                setShowPushConfirmModal(false)
                toast.info('Mantendo commit apenas local')
              },
            },
          ],
        })
      }
      // CL-GC-032: Permission denied
      else if (code === 'PERMISSION_DENIED') {
        showGitError(
          'Git push falhou',
          `Permissão negada: ${message}. Verifique suas chaves SSH ou permissões do repositório.`,
          details
        )
      } else {
        showGitError('Git push falhou', `Push falhou: ${message}`, details)
      }
    }
    setLoadingState('idle')
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
        return 'Commitando...'
      case 'pushing':
        return 'Enviando...'
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
              aria-label="Commit das alterações validadas no Git"
              aria-disabled={hasExistingCommit || commitJustDone || !hasGitContext || loadingState !== 'idle'}
              disabled={loadingState !== 'idle'}
              className={
                hasExistingCommit || commitJustDone || !hasGitContext
                  ? "font-sans opacity-50 cursor-not-allowed"
                  : "font-sans"
              }
            >
              <GitCommit className="w-4 h-4" />
              {getLoadingText()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Commit das alterações validadas no Git</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Commit Modal */}
      {localGitStatus && (
        <GitCommitModal
          open={showCommitModal}
          onOpenChange={setShowCommitModal}
          gitStatus={localGitStatus}
          defaultMessage={getDefaultMessage()}
          onCommit={handleCommit}
          isCommitting={loadingState === 'staging' || loadingState === 'committing'}
          loadingText={getLoadingText()}
          repoName={getRepoNameFromPath(projectPath)}
        />
      )}

      {/* Push Confirmation Modal */}
      {localCommitHash && (
        <PushConfirmModal
          open={showPushConfirmModal}
          onOpenChange={setShowPushConfirmModal}
          commitHash={localCommitHash}
          onKeepLocal={handleKeepLocal}
          onPushNow={handlePushNow}
          isPushing={loadingState === 'pushing'}
          repoName={getRepoNameFromPath(projectPath)}
        />
      )}

      <CommitAlreadyDoneModal
        open={showCommitAlreadyDone}
        onOpenChange={setShowCommitAlreadyDone}
        commitHash={executionRun?.commitHash ?? null}
        commitMessage={executionRun?.commitMessage ?? null}
        committedAt={executionRun?.committedAt ?? null}
      />

      <GitErrorModal
        open={showErrorModal}
        onOpenChange={setShowErrorModal}
        title={errorTitle}
        summary={errorSummary}
        details={errorDetails}
      />
    </>
  )
}
