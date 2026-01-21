import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class ProjectController {
  async listProjects(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 20, workspaceId, includeInactive } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (workspaceId) {
      where.workspaceId = String(workspaceId)
    }
    if (includeInactive !== 'true') {
      where.isActive = true
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              validationRuns: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ])

    res.json({
      data: projects,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  }

  async getProject(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            rootPath: true,
            artifactsDir: true,
          },
        },
        _count: {
          select: {
            validationRuns: true,
          },
        },
      },
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    res.json(project)
  }

  async createProject(req: Request, res: Response): Promise<void> {
    const { workspaceId, name, description, baseRef, targetRef, backendWorkspace } = req.body

    // Validate workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    })

    if (!workspace) {
      res.status(400).json({ error: 'Workspace not found' })
      return
    }

    try {
      const project = await prisma.project.create({
        data: {
          workspaceId,
          name,
          description,
          baseRef: baseRef || 'origin/main',
          targetRef: targetRef || 'HEAD',
          backendWorkspace,
        },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      res.status(201).json(project)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        res.status(400).json({ error: 'Project with this name already exists in this workspace' })
        return
      }
      throw error
    }
  }

  async updateProject(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, description, baseRef, targetRef, backendWorkspace, isActive } = req.body

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    try {
      const updated = await prisma.project.update({
        where: { id },
        data: {
          name,
          description,
          baseRef,
          targetRef,
          backendWorkspace,
          isActive,
        },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      res.json(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        res.status(400).json({ error: 'Project with this name already exists in this workspace' })
        return
      }
      throw error
    }
  }

  async deleteProject(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await prisma.project.delete({ where: { id } })
    res.status(204).send()
  }
}
