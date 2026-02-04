import { execSync } from 'child_process'

export interface GitStatusResult {
  hasChanges: boolean
  hasConflicts: boolean
  branch: string
  isProtected: boolean
  diffStat: string
}

export interface GitCommitResult {
  commitHash: string
  message: string
}

export interface GitDiffResult {
  filePath: string
  status: 'modified' | 'added' | 'deleted'
  diff: string
}

export interface GitPushResult {
  branch: string
  commitHash: string
}

export class GitOperationsService {
  private rootPath: string

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath
  }

  /**
   * Execute git command in the root path
   */
  private execGit(command: string): string {
    try {
      return execSync(`git ${command}`, {
        cwd: this.rootPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    } catch (error) {
      const execError =
        typeof error === 'object' && error !== null
          ? (error as {
              stderr?: { toString?: () => string } | string
              stdout?: { toString?: () => string } | string
              message?: string
            })
          : null
      const stderr = typeof execError?.stderr === 'string' ? execError.stderr : execError?.stderr?.toString?.()
      const stdout = typeof execError?.stdout === 'string' ? execError.stdout : execError?.stdout?.toString?.()
      const detail = [stderr, stdout].filter(Boolean).join('\n')
      const fallbackMessage = error instanceof Error ? error.message : execError?.message
      throw new Error(detail || fallbackMessage || 'Git command failed')
    }
  }

  private escapePath(filePath: string): string {
    return filePath.replace(/"/g, '\\"')
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return this.execGit('rev-parse --abbrev-ref HEAD')
  }

  /**
   * Check if branch is protected (main, master, develop)
   */
  isProtectedBranch(branch: string): boolean {
    const protectedBranches = ['main', 'master', 'develop']
    return protectedBranches.includes(branch.toLowerCase())
  }

  /**
   * Check if repository has uncommitted changes
   */
  hasChanges(): boolean {
    const status = this.execGit('status --porcelain')
    return status.length > 0
  }

  /**
   * Check if repository has merge conflicts
   */
  hasConflicts(): boolean {
    try {
      const status = this.execGit('status --porcelain')
      // Lines starting with "UU" indicate merge conflicts
      return status.split('\n').some(line => line.startsWith('UU') || line.startsWith('AA') || line.startsWith('DD'))
    } catch (err) {
      return false
    }
  }

  /**
   * Get git diff statistics
   */
  getDiffStat(): string {
    try {
      return this.execGit('diff --stat')
    } catch (err) {
      return 'No changes'
    }
  }

  /**
   * Fetch latest refs from remote
   */
  fetch(): string {
    return this.execGit('fetch')
  }

  /**
   * Get human-readable git status
   */
  getStatusText(): string {
    return this.execGit('status')
  }

  /**
   * Fetch then return status text
   */
  fetchStatus(): { fetchOutput: string; statusText: string } {
    const fetchOutput = this.fetch()
    const statusText = this.getStatusText()
    return {
      fetchOutput,
      statusText,
    }
  }

  /**
   * Get current git status
   */
  async getStatus(): Promise<GitStatusResult> {
    const branch = this.getCurrentBranch()
    const hasChanges = this.hasChanges()
    const hasConflicts = this.hasConflicts()
    const isProtected = this.isProtectedBranch(branch)
    const diffStat = this.getDiffStat()

    return {
      hasChanges,
      hasConflicts,
      branch,
      isProtected,
      diffStat,
    }
  }

  /**
   * Stage all changes (git add .)
   */
  async add(): Promise<void> {
    try {
      this.execGit('add .')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stage changes'
      throw new Error(`Failed to stage changes: ${message}`)
    }
  }

  /**
   * Commit staged changes
   */
  async commit(message: string): Promise<GitCommitResult> {
    if (!message || message.trim().length < 10) {
      throw new Error('Commit message must be at least 10 characters')
    }

    try {
      // Escape the message for shell execution
      const escapedMessage = message.replace(/"/g, '\\"')
      this.execGit(`commit -m "${escapedMessage}"`)

      // Get the commit hash
      const commitHash = this.execGit('rev-parse HEAD')

      return {
        commitHash,
        message,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Commit failed'

      // Check for common error scenarios
      if (errorMessage.includes('nothing to commit')) {
        throw { code: 'NO_CHANGES', message: 'No changes to commit' }
      }
      if (
        errorMessage.includes('Author identity unknown') ||
        errorMessage.includes('Please tell me who you are') ||
        errorMessage.includes('user.name') ||
        errorMessage.includes('user.email')
      ) {
        throw {
          code: 'GIT_IDENTITY_MISSING',
          message: 'Git user.name/email not configured. Set them in this repo or globally.',
        }
      }
      if (errorMessage.includes('pre-commit')) {
        throw { code: 'COMMIT_FAILED', message: 'Pre-commit hook failed' }
      }

      throw { code: 'COMMIT_FAILED', message: errorMessage }
    }
  }

  /**
   * Push commits to remote
   */
  async push(): Promise<GitPushResult> {
    const branch = this.getCurrentBranch()
    const commitHash = this.execGit('rev-parse HEAD')

    try {
      this.execGit(`push origin ${branch}`)

      return {
        branch,
        commitHash,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Push failed'

      // Check for specific error scenarios
      if (errorMessage.includes('rejected') || errorMessage.includes('non-fast-forward')) {
        throw { code: 'REMOTE_AHEAD', message: 'Remote has new commits. Pull first.' }
      }
      if (errorMessage.includes('Permission denied') || errorMessage.includes('authentication failed')) {
        throw { code: 'PERMISSION_DENIED', message: 'Permission denied. Check your SSH keys or credentials.' }
      }

      throw { code: 'PUSH_FAILED', message: errorMessage }
    }
  }

  /**
   * Pull latest changes from remote
   */
  async pull(): Promise<void> {
    try {
      this.execGit('pull')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pull'
      throw new Error(`Failed to pull: ${message}`)
    }
  }

  /**
   * Get branch information
   */
  async getBranchInfo(): Promise<{ branch: string; isProtected: boolean }> {
    const branch = this.getCurrentBranch()
    const isProtected = this.isProtectedBranch(branch)

    return {
      branch,
      isProtected,
    }
  }

  async getFileDiff(filePath: string, baseRef: string, targetRef: string): Promise<GitDiffResult> {
    const safePath = this.escapePath(filePath)
    const statusOutput = this.execGit(`diff --name-status ${baseRef}...${targetRef} -- "${safePath}"`)
    const statusToken = statusOutput.split('\t')[0]?.trim()

    let status: GitDiffResult['status'] = 'modified'
    if (statusToken.startsWith('A')) {
      status = 'added'
    } else if (statusToken.startsWith('D')) {
      status = 'deleted'
    }

    const diff = this.execGit(`diff ${baseRef}...${targetRef} -- "${safePath}"`)

    return {
      filePath,
      status,
      diff,
    }
  }
}
