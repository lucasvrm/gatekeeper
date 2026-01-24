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
  gitAdd: () => Promise<void>
  gitCommit: (message: string) => Promise<GitCommitResponse>
  gitPush: () => Promise<GitPushResponse>
  gitPull: () => Promise<void>
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

  const gitAdd = async (): Promise<void> => {
    setLoadingState('staging')
    try {
      await api.git.add()
    } finally {
      setLoadingState('idle')
    }
  }

  const gitCommit = async (message: string): Promise<GitCommitResponse> => {
    setLoadingState('committing')
    try {
      const result = await api.git.commit(message)
      setCommitHash(result.commitHash)
      return result
    } finally {
      setLoadingState('idle')
    }
  }

  const gitPush = async (): Promise<GitPushResponse> => {
    setLoadingState('pushing')
    try {
      const result = await api.git.push()
      return result
    } finally {
      setLoadingState('idle')
    }
  }

  const gitPull = async (): Promise<void> => {
    await api.git.pull()
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
