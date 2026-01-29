import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPSessionConfigController {
  async get(_req: Request, res: Response): Promise<void> {
    let config = await prisma.mCPSessionConfig.findUnique({
      where: { id: 'singleton' },
    })

    if (!config) {
      config = await prisma.mCPSessionConfig.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          config: JSON.stringify({}),
        },
      })
    }

    res.json({
      id: config.id,
      config: JSON.parse(config.config),
      updatedAt: config.updatedAt,
    })
  }

  async update(req: Request, res: Response): Promise<void> {
    const { config } = req.body

    const updated = await prisma.mCPSessionConfig.upsert({
      where: { id: 'singleton' },
      update: {
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
      create: {
        id: 'singleton',
        config: typeof config === 'string' ? config : JSON.stringify(config),
      },
    })

    res.json({
      id: updated.id,
      config: JSON.parse(updated.config),
      updatedAt: updated.updatedAt,
    })
  }
}
