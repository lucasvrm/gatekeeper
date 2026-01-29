import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

export class MCPSnippetController {
  async list(req: Request, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const category = req.query.category as string | undefined
    const skip = (page - 1) * limit

    const where = category ? { category } : {}

    const [snippets, total] = await Promise.all([
      prisma.snippet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.snippet.count({ where }),
    ])

    res.json({
      data: snippets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  }

  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const snippet = await prisma.snippet.findUnique({ where: { id } })

    if (!snippet) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }

    res.json(snippet)
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, category, content, tags } = req.body

    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const existing = await prisma.snippet.findUnique({ where: { name: String(name) } })
    if (existing) {
      res.status(400).json({ error: 'Snippet with this name already exists' })
      return
    }

    const snippet = await prisma.snippet.create({
      data: {
        name: String(name),
        category: String(category || 'OTHER'),
        content: String(content || ''),
        tags: JSON.stringify(tags || []),
      },
    })

    res.status(201).json(snippet)
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, category, content, tags } = req.body

    const existing = await prisma.snippet.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }

    const updated = await prisma.snippet.update({
      where: { id },
      data: {
        ...(name && { name: String(name) }),
        ...(category && { category: String(category) }),
        ...(content !== undefined && { content: String(content) }),
        ...(tags && { tags: JSON.stringify(tags) }),
      },
    })

    res.json(updated)
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.snippet.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Snippet not found' })
      return
    }

    await prisma.snippet.delete({ where: { id } })
    res.status(204).send()
  }
}
