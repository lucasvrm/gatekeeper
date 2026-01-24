import { Request, Response } from 'express'
import { GitOperationsService } from '../../services/GitOperationsService.js'

export class GitController {
  private gitService: GitOperationsService

  constructor() {
    // Initialize with current working directory
    this.gitService = new GitOperationsService(process.cwd())
  }

  /**
   * GET /api/git/status
   * Check git status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.gitService.getStatus()
      res.json(status)
    } catch (error: any) {
      console.error('Git status error:', error)
      res.status(500).json({
        error: {
          code: 'STATUS_CHECK_FAILED',
          message: error.message || 'Failed to check git status',
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
      await this.gitService.add()
      res.json({ success: true })
    } catch (error: any) {
      console.error('Git add error:', error)
      res.status(500).json({
        error: {
          code: 'ADD_FAILED',
          message: error.message || 'Failed to stage changes',
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
      const { message } = req.body

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

      const result = await this.gitService.commit(message)
      res.json(result)
    } catch (error: any) {
      console.error('Git commit error:', error)

      if (error.code) {
        res.status(400).json({ error })
      } else {
        res.status(500).json({
          error: {
            code: 'COMMIT_FAILED',
            message: error.message || 'Failed to commit changes',
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
      const result = await this.gitService.push()
      res.json(result)
    } catch (error: any) {
      console.error('Git push error:', error)

      if (error.code) {
        const statusCode = error.code === 'REMOTE_AHEAD' ? 409 : error.code === 'PERMISSION_DENIED' ? 403 : 500
        res.status(statusCode).json({ error })
      } else {
        res.status(500).json({
          error: {
            code: 'PUSH_FAILED',
            message: error.message || 'Failed to push changes',
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
      await this.gitService.pull()
      res.json({ success: true })
    } catch (error: any) {
      console.error('Git pull error:', error)
      res.status(500).json({
        error: {
          code: 'PULL_FAILED',
          message: error.message || 'Failed to pull changes',
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
      const result = await this.gitService.getBranchInfo()
      res.json(result)
    } catch (error: any) {
      console.error('Git branch error:', error)
      res.status(500).json({
        error: {
          code: 'BRANCH_CHECK_FAILED',
          message: error.message || 'Failed to get branch info',
        },
      })
    }
  }
}
