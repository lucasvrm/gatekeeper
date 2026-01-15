import simpleGit, { SimpleGit } from 'simple-git'
import { readFile } from 'fs/promises'
import { join } from 'path'
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
    const fullPath = join(this.projectPath, filePath)
    return await readFile(fullPath, 'utf-8')
  }

  async checkout(ref: string): Promise<void> {
    await this.git.checkout(ref)
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
}
