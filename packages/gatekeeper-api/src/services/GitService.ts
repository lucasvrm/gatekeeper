import { simpleGit, SimpleGit } from 'simple-git'
import { readFile } from 'fs/promises'
import { isAbsolute, join } from 'path'
import type { GitService as IGitService } from '../types/index.js'

export class GitService implements IGitService {
  private git: SimpleGit
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.git = simpleGit(projectPath)
  }

  async diff(baseRef: string, targetRef: string): Promise<string> {
    const result = await this.git.diff([`${baseRef}...${targetRef}`])
    return result
  }

  async readFile(filePath: string, ref?: string): Promise<string> {
    if (ref) {
      const content = await this.git.show([`${ref}:${filePath}`])
      return content
    }
    const fullPath = isAbsolute(filePath) ? filePath : join(this.projectPath, filePath)
    return await readFile(fullPath, 'utf-8')
  }

  async checkout(ref: string): Promise<void> {
    await this.git.checkout(ref)
  }

  async stash(): Promise<void> {
    // Stash both tracked and untracked files to protect them during checkout
    await this.git.stash(['push', '--include-untracked', '--message', 'Gatekeeper temporary stash'])
  }

  async stashPop(): Promise<void> {
    try {
      // Apply then drop so we don't lose the stash entry if apply fails
      await this.git.stash(['apply'])
      await this.git.stash(['drop'])
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // No stash is fine
      if (
        msg.includes('No stash entries found') ||
        msg.includes('No stash entries') ||
        msg.includes('No stash found')
      ) {
        console.warn('[GitService] No stash entries to apply/drop.')
        return
      }

      // Anything else is a real problem (conflicts, index lock, etc.)
      throw new Error(`[GitService] Stash apply/drop failed: ${msg}`)
    }
  }

  async getDiffFiles(baseRef: string, targetRef: string): Promise<string[]> {
    const result = await this.git.diff([
      `${baseRef}...${targetRef}`,
      '--name-only',
    ])
    return result.split('\n').filter(Boolean)
  }

  async getCurrentRef(): Promise<string> {
    const result = await this.git.revparse(['--abbrev-ref', 'HEAD'])
    return result.trim()
  }

  async createWorktree(ref: string, worktreePath: string): Promise<void> {
    await this.git.raw(['worktree', 'add', '--force', '--detach', worktreePath, ref])
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    await this.git.raw(['worktree', 'remove', '--force', worktreePath])
  }
}

