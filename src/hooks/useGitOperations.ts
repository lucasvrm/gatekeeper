import { useState } from 'react'
import { api } from '@/lib/api'
import type {
  GitStatusResponse,
  GitCommitResponse,
  GitPushResponse,
} from '@/lib/types'
import { toast } from 'sonner'

export interface UseGitOperationsReturn {
  gitStatus: GitStatusResponse | null
  commitHash: string | null
  isLoading: boolean
  loadingState: 'idle' | 'staging' | 'committing' | 'pushing'
  checkGitStatus: () => Promise<GitStatusResponse | null>
  gitAdd: () => Promise<boolean>
  gitCommit: (message: string) => Promise<GitCommitResponse | null>
  gitPush: () => Promise<GitPushResponse | null>
  gitPull: () => Promise<boolean>
}

export function useGitOperations(): UseGitOperationsReturn {
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null)
  const [commitHash, setCommitHash] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingState, setLoadingState] = useState<'idle' | 'staging' | 'committing' | 'pushing'>('idle')

  const checkGitStatus = async (): Promise<GitStatusResponse | null> => {
    try {
      setIsLoading(true)
      const status = await api.git.status()
      setGitStatus(status)
      return status
    } catch (error) {
      console.error('Failed to check git status:', error)
      toast.error('Failed to check git status')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const gitAdd = async (): Promise<boolean> => {
    try {
      setLoadingState('staging')
      await api.git.add()
      return true
    } catch (error: any) {
      const message = error?.message || 'Unknown error'
      toast.error(`Failed to stage changes: ${message}`)
      return false
    } finally {
      setLoadingState('idle')
    }
  }

  const gitCommit = async (message: string): Promise<GitCommitResponse | null> => {
    try {
      setLoadingState('committing')
      const result = await api.git.commit(message)
      setCommitHash(result.commitHash)
      return result
    } catch (error: any) {
      const message = error?.message || 'Unknown error'
      toast.error(`Commit failed: ${message}`, {
        action: {
          label: 'View Details',
          onClick: () => {
            console.error('Commit error details:', error)
          },
        },
      })
      return null
    } finally {
      setLoadingState('idle')
    }
  }

  const gitPush = async (): Promise<GitPushResponse | null> => {
    try {
      setLoadingState('pushing')
      const result = await api.git.push()
      return result
    } catch (error: any) {
      const code = error?.code
      const message = error?.message || 'Unknown error'

      if (code === 'REMOTE_AHEAD') {
        toast.warning('Remote has new commits', {
          action: [
            {
              label: 'Pull & Retry',
              onClick: async () => {
                const pullSuccess = await gitPull()
                if (pullSuccess) {
                  await gitPush()
                }
              },
            },
            {
              label: 'Keep Local',
              onClick: () => {
                toast.info('Keeping commit local only')
              },
            },
          ],
        })
      } else if (code === 'PERMISSION_DENIED') {
        toast.error(`Permission denied: ${message}. Check your SSH keys or repository permissions.`)
      } else {
        toast.error(`Push failed: ${message}`)
      }

      return null
    } finally {
      setLoadingState('idle')
    }
  }

  const gitPull = async (): Promise<boolean> => {
    try {
      await api.git.pull()
      toast.success('Pulled latest changes from remote')
      return true
    } catch (error: any) {
      const message = error?.message || 'Unknown error'
      toast.error(`Pull failed: ${message}`)
      return false
    }
  }

  return {
    gitStatus,
    commitHash,
    isLoading,
    loadingState,
    checkGitStatus,
    gitAdd,
    gitCommit,
    gitPush,
    gitPull,
  }
}
