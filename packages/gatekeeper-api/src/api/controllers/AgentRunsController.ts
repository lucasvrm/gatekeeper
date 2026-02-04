/**
 * Agent Runs Controller
 *
 * Read-only endpoints for observing agent pipeline runs.
 *
 * Routes (mounted under /api/agent/):
 *   GET /runs          → List recent runs with summary stats
 *   GET /runs/:id      → Get detailed cost stats for a run
 */

import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { AgentRunPersistenceService } from '../../services/AgentRunPersistenceService.js'

const persistence = new AgentRunPersistenceService(prisma)

export class AgentRunsController {
  /**
   * GET /agent/runs?limit=20&status=completed
   */
  async list(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20
    const status = req.query.status as string | undefined

    const runs = await persistence.listRuns({ limit, status })

    res.json({
      count: runs.length,
      runs: runs.map((r) => ({
        ...r,
        durationMs: r.completedAt
          ? r.completedAt.getTime() - r.startedAt.getTime()
          : null,
      })),
    })
  }

  /**
   * GET /agent/runs/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      const stats = await persistence.getCostStats(id)
      res.json(stats)
    } catch {
      res.status(404).json({ error: `Run not found: ${id}` })
    }
  }
}
