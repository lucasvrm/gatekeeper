import { execa } from 'execa'
import { join } from 'path'
import { existsSync } from 'fs'
import type { SandboxService as ISandboxService, SandboxResult } from '../types/index.js'

export class SandboxService implements ISandboxService {
  async create(
    originalProjectPath: string,
    sandboxBasePath: string,
    targetRef: string
  ): Promise<SandboxResult> {
    const safeRef = targetRef.replace(/[\\/]/g, '-')
    const sandboxPath = join(sandboxBasePath, `sandbox-${safeRef}`)

    try {
      const result = await execa('git', ['worktree', 'add', sandboxPath, targetRef], {
        cwd: originalProjectPath,
        reject: false,
        windowsHide: true,
      })

      if (result.exitCode !== 0) {
        const errorMsg = result.stderr || result.stdout || 'git worktree add failed'
        return {
          success: false,
          sandboxPath,
          junctionCreated: false,
          error: errorMsg,
        }
      }
    } catch (error) {
      return {
        success: false,
        sandboxPath,
        junctionCreated: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    const nodeModulesPath = join(originalProjectPath, 'node_modules')
    if (!existsSync(nodeModulesPath)) {
      console.warn('[SandboxService] node_modules not found, skipping junction creation')
      return {
        success: true,
        sandboxPath,
        junctionCreated: false,
      }
    }

    const junctionResult = await this.createNodeModulesJunction(originalProjectPath, sandboxPath)
    if (!junctionResult.success) {
      console.error('[SandboxService] Failed to create node_modules junction:', junctionResult.error)
    }

    return {
      success: true,
      sandboxPath,
      junctionCreated: junctionResult.success,
    }
  }

  async createNodeModulesJunction(
    originalProjectPath: string,
    sandboxPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const sourcePath = join(originalProjectPath, 'node_modules')
    if (!existsSync(sourcePath)) {
      return { success: false, error: 'node_modules not found' }
    }

    const junctionPath = join(sandboxPath, 'node_modules')

    try {
      const result = await execa('cmd', ['/c', 'mklink', '/J', junctionPath, sourcePath], {
        reject: false,
        windowsHide: true,
      })

      if (result.exitCode !== 0) {
        const errorMsg = result.stderr || result.stdout || 'mklink failed'
        return { success: false, error: errorMsg }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async cleanup(sandboxPath: string): Promise<void> {
    try {
      const junctionPath = join(sandboxPath, 'node_modules')
      if (existsSync(junctionPath)) {
        await execa('cmd', ['/c', 'rmdir', junctionPath], {
          reject: false,
          windowsHide: true,
        })
      }
    } catch (error) {
      console.warn('[SandboxService] Failed to remove node_modules junction:', error)
    }

    try {
      if (existsSync(sandboxPath)) {
        await execa('git', ['worktree', 'remove', '--force', sandboxPath], {
          cwd: sandboxPath,
          reject: false,
          windowsHide: true,
        })
      }
    } catch (error) {
      console.warn('[SandboxService] Failed to remove worktree:', error)
    }
  }
}
