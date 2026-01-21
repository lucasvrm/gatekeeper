import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class WorkspaceController {
  async listWorkspaces(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, includeInactive } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where = includeInactive === 'true' ? undefined : { isActive: true }

    const [workspaces, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              projects: true,
              workspaceConfigs: true,
            },
          },
        },
      }),
      prisma.workspace.count({ where }),
    ])

    res.json({
      data: workspaces,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async getWorkspace(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projects: true,
            workspaceConfigs: true,
            testPathConventions: true,
          },
        },
      },
    })

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    res.json(workspace)
  }

  async createWorkspace(req: Request, res: Response): Promise<void> {
    const { name, description, rootPath, artifactsDir } = req.body

    try {
      const workspace = await prisma.workspace.create({
        data: {
          name,
          description,
          rootPath,
          artifactsDir: artifactsDir || 'artifacts',
        },
      })

      res.status(201).json(workspace)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        res.status(400).json({ error: 'Workspace with this name already exists' })
        return
      }
      throw error
    }
  }

  async updateWorkspace(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, description, rootPath, artifactsDir, isActive } = req.body

    const workspace = await prisma.workspace.findUnique({ where: { id } })
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    try {
      const updated = await prisma.workspace.update({
        where: { id },
        data: {
          name,
          description,
          rootPath,
          artifactsDir,
          isActive,
        },
      })

      res.json(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        res.status(400).json({ error: 'Workspace with this name already exists' })
        return
      }
      throw error
    }
  }

  async deleteWorkspace(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const workspace = await prisma.workspace.findUnique({ where: { id } })
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    await prisma.workspace.delete({ where: { id } })
    res.status(204).send()
  }

  async getWorkspaceConfigs(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const configs = await prisma.workspaceConfig.findMany({
      where: { workspaceId: id },
      orderBy: { key: 'asc' },
    })

    res.json(configs)
  }

  async updateWorkspaceConfig(req: Request, res: Response): Promise<void> {
    const { id, key } = req.params
    const { value, type, category, description } = req.body

    const workspace = await prisma.workspace.findUnique({ where: { id } })
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const config = await prisma.workspaceConfig.upsert({
      where: {
        workspaceId_key: {
          workspaceId: id,
          key,
        },
      },
      create: {
        workspaceId: id,
        key,
        value: String(value),
        type: type || 'STRING',
        category: category || 'GENERAL',
        description,
      },
      update: {
        value: String(value),
        type,
        category,
        description,
      },
    })

    res.json(config)
  }

  async deleteWorkspaceConfig(req: Request, res: Response): Promise<void> {
    const { id, key } = req.params

    await prisma.workspaceConfig.delete({
      where: {
        workspaceId_key: {
          workspaceId: id,
          key,
        },
      },
    })

    res.status(204).send()
  }
}
