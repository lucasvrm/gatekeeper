import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

function formatProfile(profile: {
  id: string
  name: string
  taskType: string
  gitStrategy: string
  branch: string | null
  docsDir: string | null
  createdAt: Date
  updatedAt: Date
  prompts: { prompt: { id: string; name: string; content: string; isActive: boolean; createdAt: Date; updatedAt: Date } }[]
}) {
  return {
    id: profile.id,
    name: profile.name,
    taskType: profile.taskType,
    gitStrategy: profile.gitStrategy,
    branch: profile.branch,
    docsDir: profile.docsDir,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    prompts: profile.prompts.map((pp) => pp.prompt),
  }
}

const PROFILE_INCLUDE = {
  prompts: {
    include: { prompt: true },
  },
} as const

export class MCPProfileController {
  /**
   * GET /mcp/profiles
   */
  async list(_req: Request, res: Response): Promise<void> {
    const profiles = await prisma.sessionProfile.findMany({
      orderBy: { name: 'asc' },
      include: PROFILE_INCLUDE,
    })

    res.json({ data: profiles.map(formatProfile) })
  }

  /**
   * GET /mcp/profiles/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const profile = await prisma.sessionProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    })

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json(formatProfile(profile))
  }

  /**
   * POST /mcp/profiles
   * Body: { name, taskType?, gitStrategy?, branch?, docsDir?, promptIds?: string[] }
   */
  async create(req: Request, res: Response): Promise<void> {
    const { name, taskType, gitStrategy, branch, docsDir, promptIds } = req.body

    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    try {
      const profile = await prisma.sessionProfile.create({
        data: {
          name,
          ...(taskType && { taskType }),
          ...(gitStrategy && { gitStrategy }),
          ...(branch !== undefined && { branch }),
          ...(docsDir !== undefined && { docsDir }),
          ...(promptIds?.length && {
            prompts: {
              create: promptIds.map((promptId: string) => ({ promptId })),
            },
          }),
        },
        include: PROFILE_INCLUDE,
      })

      res.status(201).json(formatProfile(profile))
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002') {
        res.status(409).json({ error: `Profile with name "${name}" already exists` })
        return
      }
      throw error
    }
  }

  /**
   * PUT /mcp/profiles/:id
   * Body: { name?, taskType?, gitStrategy?, branch?, docsDir? }
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, taskType, gitStrategy, branch, docsDir } = req.body

    try {
      const profile = await prisma.sessionProfile.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(taskType !== undefined && { taskType }),
          ...(gitStrategy !== undefined && { gitStrategy }),
          ...(branch !== undefined && { branch }),
          ...(docsDir !== undefined && { docsDir }),
        },
        include: PROFILE_INCLUDE,
      })

      res.json(formatProfile(profile))
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      if (prismaError.code === 'P2002') {
        res.status(409).json({ error: `Profile with name "${name}" already exists` })
        return
      }
      throw error
    }
  }

  /**
   * DELETE /mcp/profiles/:id
   */
  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.sessionProfile.delete({ where: { id } })
      res.json({ deleted: true })
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: 'Profile not found' })
        return
      }
      throw error
    }
  }

  /**
   * PUT /mcp/profiles/:id/prompts
   * Replace all linked prompts
   * Body: { promptIds: string[] }
   */
  async setPrompts(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { promptIds } = req.body

    if (!Array.isArray(promptIds)) {
      res.status(400).json({ error: 'promptIds must be an array' })
      return
    }

    const profile = await prisma.sessionProfile.findUnique({ where: { id } })
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    await prisma.$transaction([
      prisma.sessionProfilePrompt.deleteMany({ where: { profileId: id } }),
      ...promptIds.map((promptId: string) =>
        prisma.sessionProfilePrompt.create({
          data: { profileId: id, promptId },
        })
      ),
    ])

    const updated = await prisma.sessionProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    })

    res.json(formatProfile(updated!))
  }
}
