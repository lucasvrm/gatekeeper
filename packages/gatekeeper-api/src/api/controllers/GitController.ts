import { Request, Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'path'
import { prisma } from '../../db/client.js'
import { GitOperationsService } from '../../services/GitOperationsService.js'

export class GitController {
  private async resolveGitService(req: Request, res: Response): Promise<GitOperationsService | null> {
    const projectId = req.body?.projectId ?? req.query?.projectId
    const projectPath = req.body?.projectPath ?? req.query?.projectPath
    if ((!projectId || typeof projectId !== 'string') && (!projectPath || typeof projectPath !== 'string')) {
      res.status(400).json({
        error: {
          code: 'PROJECT_ID_REQUIRED',
          message: 'projectId or projectPath is required for git operations',
        },
      })
      return null
    }

    if (!projectId || typeof projectId !== 'string') {
      const gitPath = join(projectPath, '.git')
      if (!existsSync(gitPath)) {
        res.status(400).json({
          error: {
            code: 'GIT_REPO_NOT_FOUND',
            message: 'No git repository found at project path',
          },
        })
        return null
      }

      return new GitOperationsService(projectPath)
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    })

    if (!project) {
      res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      })
      return null
    }

    if (!project.isActive) {
      res.status(400).json({
        error: {
          code: 'PROJECT_INACTIVE',
          message: 'Project is not active',
        },
      })
      return null
    }

    const projectRoot = project.workspace?.rootPath
    if (!projectRoot) {
      res.status(400).json({
        error: {
          code: 'PROJECT_ROOT_MISSING',
          message: 'Project root path is not configured',
        },
      })
      return null
    }

    const gitPath = join(projectRoot, '.git')
    if (!existsSync(gitPath)) {
      res.status(400).json({
        error: {
          code: 'GIT_REPO_NOT_FOUND',
          message: 'No git repository found at project root',
        },
      })
      return null
    }

    return new GitOperationsService(projectRoot)
  }

  /**
   * GET /api/git/status
   * Check git status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const status = await gitService.getStatus()
      res.json(status)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check git status'
      console.error('Git status error:', error)
      res.status(500).json({
        error: {
          code: 'STATUS_CHECK_FAILED',
          message,
        },
      })
    }
  }

  /**
   * POST /api/git/add
   * Stage all changes
   */
  async add(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      await gitService.add()
      res.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stage changes'
      console.error('Git add error:', error)
      res.status(500).json({
        error: {
          code: 'ADD_FAILED',
          message,
        },
      })
    }
  }

  /**
   * POST /api/git/commit
   * Commit staged changes
   */
  async commit(req: Request, res: Response): Promise<void> {
    try {
      const { message, runId } = req.body

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_MESSAGE',
            message: 'Commit message is required',
          },
        })
        return
      }

      if (message.trim().length < 10) {
        res.status(400).json({
          error: {
            code: 'MESSAGE_TOO_SHORT',
            message: 'Commit message must be at least 10 characters',
          },
        })
        return
      }

      if (runId !== undefined) {
        if (typeof runId !== 'string' || !runId.trim()) {
          res.status(404).json({
            error: {
              code: 'RUN_NOT_FOUND',
              message: 'Run not found',
            },
          })
          return
        }

        const run = await prisma.validationRun.findUnique({ where: { id: runId } })
        if (!run) {
          res.status(404).json({
            error: {
              code: 'RUN_NOT_FOUND',
              message: 'Run not found',
            },
          })
          return
        }
      }

      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const result = await gitService.commit(message)

      if (runId !== undefined) {
        const committedAt = new Date()
        try {
          await prisma.$executeRaw`
            UPDATE ValidationRun
            SET commitHash = ${result.commitHash},
                commitMessage = ${message},
                committedAt = ${committedAt.toISOString()}
            WHERE id = ${runId}
          `
        } catch (error) {
          const messageText = error instanceof Error ? error.message : ''
          const needsColumns =
            messageText.includes('no such column') ||
            messageText.includes('Unknown column') ||
            messageText.includes('unknown column')

          if (needsColumns) {
            try {
              await prisma.$executeRaw`ALTER TABLE ValidationRun ADD COLUMN commitHash TEXT`
              await prisma.$executeRaw`ALTER TABLE ValidationRun ADD COLUMN commitMessage TEXT`
              await prisma.$executeRaw`ALTER TABLE ValidationRun ADD COLUMN committedAt DATETIME`
              await prisma.$executeRaw`
                UPDATE ValidationRun
                SET commitHash = ${result.commitHash},
                    commitMessage = ${message},
                    committedAt = ${committedAt.toISOString()}
                WHERE id = ${runId}
              `
            } catch (columnError) {
              console.error('Failed to update commit fields after adding columns:', columnError)
            }
          } else {
            console.error('Failed to update run commit fields:', error)
          }
        }
      }
      res.json(result)
    } catch (error) {
      console.error('Git commit error:', error)

      const errorWithCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string; message?: string })
          : null
      if (errorWithCode?.code) {
        res.status(400).json({ error: errorWithCode })
      } else {
        const message = error instanceof Error ? error.message : 'Failed to commit changes'
        res.status(500).json({
          error: {
            code: 'COMMIT_FAILED',
            message,
          },
        })
      }
    }
  }

  /**
   * POST /api/git/push
   * Push commits to remote
   */
  async push(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const result = await gitService.push()
      res.json(result)
    } catch (error) {
      console.error('Git push error:', error)
      const errorWithCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string; message?: string })
          : null

      if (errorWithCode?.code) {
        const statusCode =
          errorWithCode.code === 'REMOTE_AHEAD' ? 409 : errorWithCode.code === 'PERMISSION_DENIED' ? 403 : 500
        res.status(statusCode).json({ error: errorWithCode })
      } else {
        const message = error instanceof Error ? error.message : 'Failed to push changes'
        res.status(500).json({
          error: {
            code: 'PUSH_FAILED',
            message,
          },
        })
      }
    }
  }

  /**
   * POST /api/git/pull
   * Pull latest changes from remote
   */
  async pull(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      await gitService.pull()
      res.json({ success: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pull changes'
      console.error('Git pull error:', error)
      res.status(500).json({
        error: {
          code: 'PULL_FAILED',
          message,
        },
      })
    }
  }

  /**
   * GET /api/git/branch
   * Get current branch information
   */
  async getBranch(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const result = await gitService.getBranchInfo()
      res.json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get branch info'
      console.error('Git branch error:', error)
      res.status(500).json({
        error: {
          code: 'BRANCH_CHECK_FAILED',
          message,
        },
      })
    }
  }

  /**
   * GET /api/git/diff
   * Get diff for a file between base and target refs
   */
  async getDiff(req: Request, res: Response): Promise<void> {
    try {
      const { file, baseRef, targetRef } = req.query

      if (!file || typeof file !== 'string') {
        res.status(400).json({
          error: {
            code: 'FILE_REQUIRED',
            message: 'file is required',
          },
        })
        return
      }

      if (!baseRef || typeof baseRef !== 'string') {
        res.status(400).json({
          error: {
            code: 'BASE_REF_REQUIRED',
            message: 'baseRef is required',
          },
        })
        return
      }

      if (!targetRef || typeof targetRef !== 'string') {
        res.status(400).json({
          error: {
            code: 'TARGET_REF_REQUIRED',
            message: 'targetRef is required',
          },
        })
        return
      }

      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const result = await gitService.getFileDiff(file, baseRef, targetRef)
      res.json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get diff'
      console.error('Git diff error:', error)
      res.status(500).json({
        error: {
          code: 'DIFF_FAILED',
          message,
        },
      })
    }
  }

  /**
   * POST /api/git/fetch-status
   * Run git fetch and return git status output
   */
  async fetchStatus(req: Request, res: Response): Promise<void> {
    try {
      const gitService = await this.resolveGitService(req, res)
      if (!gitService) return
      const result = await gitService.fetchStatus()
      res.json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch and check status'
      console.error('Git fetch/status error:', error)
      res.status(500).json({
        error: {
          code: 'FETCH_STATUS_FAILED',
          message,
        },
      })
    }
  }
}
