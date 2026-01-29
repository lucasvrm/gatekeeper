import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPStatusController {
  async get(_req: Request, res: Response): Promise<void> {
    let databaseOk = false

    try {
      await prisma.$queryRaw`SELECT 1`
      databaseOk = true
    } catch {
      databaseOk = false
    }

    res.json({
      database: databaseOk,
      timestamp: new Date().toISOString(),
    })
  }
}
