import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPPromptController {
  async list(_req: Request, res: Response): Promise<void> {
    const prompts = await prisma.promptInstruction.findMany({
      orderBy: { createdAt: 'desc' },
    })
    res.json({ data: prompts })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const prompt = await prisma.promptInstruction.findUnique({ where: { id } })

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' })
      return
    }

    res.json(prompt)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, content, isActive } = req.body

    if (!name || !content) {
      res.status(400).json({ error: 'name and content are required' })
      return
    }

    try {
      const prompt = await prisma.promptInstruction.create({
        data: {
          name,
          content,
          isActive: isActive ?? true,
        },
      })
      res.status(201).json(prompt)
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2002') {
        res.status(409).json({ error: `Prompt with name "${name}" already exists` })
        return
      }
      throw error
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, content, isActive } = req.body

    try {
      const prompt = await prisma.promptInstruction.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(content !== undefined && { content }),
          ...(isActive !== undefined && { isActive }),
        },
      })
      res.json(prompt)
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: 'Prompt not found' })
        return
      }
      if (prismaError.code === 'P2002') {
        res.status(409).json({ error: `Prompt with name "${name}" already exists` })
        return
      }
      throw error
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    try {
      await prisma.promptInstruction.delete({ where: { id } })
      res.json({ deleted: true })
    } catch (error: unknown) {
      const prismaError = error as { code?: string }
      if (prismaError.code === 'P2025') {
        res.status(404).json({ error: 'Prompt not found' })
        return
      }
      throw error
    }
  }
}
