import type { Request, Response } from 'express'
import { execSync } from 'child_process'
import * as fs from 'fs'
import { prisma } from '../../db/client.js'

export class MCPStatusController {
  async get(_req: Request, res: Response): Promise<void> {
    // 1. gatekeeperApi — se chegou aqui, está online
    const gatekeeperApi = 'online'

    // 2. database
    let database: 'connected' | 'disconnected' = 'disconnected'
    try {
      await prisma.$queryRaw`SELECT 1`
      database = 'connected'
    } catch {
      database = 'disconnected'
    }

    // 3. docsDir — lê do session config e verifica se existe no filesystem
    let docsDir: 'accessible' | 'not-found' | 'not-configured' = 'not-configured'
    try {
      const sessionConfig = await prisma.mCPSessionConfig.findUnique({
        where: { id: 'singleton' },
      })
      if (sessionConfig) {
        const config = JSON.parse(sessionConfig.config)
        if (config.docsDir && config.docsDir.trim() !== '') {
          docsDir = fs.existsSync(config.docsDir) ? 'accessible' : 'not-found'
        }
      }
    } catch {
      // se falhar, mantém not-configured
    }

    // 4. git — branch atual
    let git = 'N/A'
    try {
      git = execSync('git branch --show-current', {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim() || 'HEAD (detached)'
    } catch {
      git = 'N/A'
    }

    res.json({ gatekeeperApi, database, docsDir, git })
  }
}
