import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

/**
 * MCPPromptController — Full CRUD for PromptInstruction
 *
 * Supports the new pipeline fields (kind, step, order) for
 * DB-driven prompt assembly. All prompts are editable via API.
 *
 * Endpoints:
 *   GET    /mcp/prompts              — List all (with optional ?step=&kind= filters)
 *   GET    /mcp/prompts/steps        — Overview: counts + char totals per step
 *   GET    /mcp/prompts/preview/:step — Assembled prompt preview for a step
 *   GET    /mcp/prompts/:id          — Get single prompt
 *   POST   /mcp/prompts              — Create new prompt
 *   PUT    /mcp/prompts/:id          — Update prompt (partial)
 *   PATCH  /mcp/prompts/:id/toggle   — Toggle isActive
 *   DELETE /mcp/prompts/:id          — Delete prompt
 *   POST   /mcp/prompts/reorder      — Batch update order values
 */
export class MCPPromptController {
  /**
   * GET /mcp/prompts?step=1&kind=playbook&active=true
   *
   * Filters:
   *   step   — Pipeline step (1-4), omit for all steps
   *   kind   — playbook | questionnaire | template | instruction
   *   active — true | false, omit for all
   */
  async list(req: Request, res: Response): Promise<void> {
    const where: Record<string, unknown> = {}

    if (req.query.step !== undefined) {
      const step = parseInt(req.query.step as string, 10)
      if (!isNaN(step)) where.step = step
    }

    if (req.query.kind) {
      where.kind = req.query.kind as string
    }

    if (req.query.active !== undefined) {
      where.isActive = req.query.active === 'true'
    }

    const prompts = await prisma.promptInstruction.findMany({
      where,
      orderBy: [{ step: 'asc' }, { kind: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        name: true,
        kind: true,
        step: true,
        order: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // content omitted from list for performance — use GET /:id for full content
        content: req.query.full === 'true',
      },
    })

    res.json({ data: prompts, total: prompts.length })
  }

  /**
   * GET /mcp/prompts/steps
   *
   * Returns overview per step: count of prompts, total chars, kinds breakdown.
   * Useful for a dashboard/management UI.
   */
  async stepOverview(_req: Request, res: Response): Promise<void> {
    const all = await prisma.promptInstruction.findMany({
      orderBy: [{ step: 'asc' }, { kind: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        name: true,
        kind: true,
        step: true,
        order: true,
        isActive: true,
        content: true,
      },
    })

    const stepNames: Record<number, string> = {
      1: 'Planner (create_plan)',
      2: 'Spec Writer (generate_spec)',
      3: 'Fix (artifact correction)',
      4: 'Executor (implement_code)',
    }

    const steps = [1, 2, 3, 4].map((step) => {
      const items = all.filter((p) => p.step === step)
      const active = items.filter((p) => p.isActive)

      return {
        step,
        name: stepNames[step] || `Step ${step}`,
        total: items.length,
        active: active.length,
        totalChars: active.reduce((sum, p) => sum + p.content.length, 0),
        kinds: Object.fromEntries(
          ['playbook', 'questionnaire', 'template', 'instruction'].map((kind) => [
            kind,
            items.filter((p) => p.kind === kind).length,
          ])
        ),
        prompts: items.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          order: p.order,
          isActive: p.isActive,
          chars: p.content.length,
        })),
      }
    })

    // Also include unassigned (step === null)
    const unassigned = all.filter((p) => p.step === null)

    res.json({
      steps,
      unassigned: unassigned.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        order: p.order,
        isActive: p.isActive,
        chars: p.content.length,
      })),
    })
  }

  /**
   * GET /mcp/prompts/preview/:step
   *
   * Shows the assembled system prompt for a pipeline step,
   * exactly as AgentPromptAssembler would build it.
   */
  async previewStep(req: Request, res: Response): Promise<void> {
    const step = parseInt(req.params.step, 10)

    if (isNaN(step) || step < 1 || step > 4) {
      res.status(400).json({ error: 'step must be 1-4' })
      return
    }

    const rows = await prisma.promptInstruction.findMany({
      where: { step, isActive: true },
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
    })

    // Assembly order: playbook → questionnaire → template → instruction
    const kindOrder = ['playbook', 'questionnaire', 'template', 'instruction']
    const grouped = new Map<string, typeof rows>()

    for (const row of rows) {
      const list = grouped.get(row.kind) || []
      list.push(row)
      grouped.set(row.kind, list)
    }

    const parts: string[] = []
    const manifest: Array<{ name: string; kind: string; order: number; chars: number }> = []

    for (const kind of kindOrder) {
      const items = grouped.get(kind)
      if (!items?.length) continue
      for (const item of items) {
        parts.push(item.content)
        manifest.push({
          name: item.name,
          kind: item.kind,
          order: item.order,
          chars: item.content.length,
        })
      }
    }

    // Any remaining kinds not in kindOrder
    for (const [kind, items] of grouped) {
      if (kindOrder.includes(kind)) continue
      for (const item of items) {
        parts.push(item.content)
        manifest.push({
          name: item.name,
          kind: item.kind,
          order: item.order,
          chars: item.content.length,
        })
      }
    }

    const assembled = parts.join('\n\n---\n\n')

    res.json({
      step,
      entryCount: rows.length,
      charCount: assembled.length,
      estimatedTokens: Math.ceil(assembled.length / 4), // rough estimate
      manifest,
      preview: assembled,
    })
  }

  /**
   * GET /mcp/prompts/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const prompt = await prisma.promptInstruction.findUnique({ where: { id } })

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' })
      return
    }

    res.json(prompt)
  }

  /**
   * POST /mcp/prompts
   * Body: { name, content, kind?, step?, order?, isActive? }
   */
  async create(req: Request, res: Response): Promise<void> {
    const { name, content, kind, step, order, isActive } = req.body

    if (!name || !content) {
      res.status(400).json({ error: 'name and content are required' })
      return
    }

    // Validate kind if provided
    const validKinds = ['playbook', 'questionnaire', 'template', 'instruction']
    if (kind && !validKinds.includes(kind)) {
      res.status(400).json({
        error: `kind must be one of: ${validKinds.join(', ')}`,
      })
      return
    }

    // Validate step if provided
    if (step !== undefined && step !== null) {
      const stepNum = typeof step === 'string' ? parseInt(step, 10) : step
      if (isNaN(stepNum) || stepNum < 1 || stepNum > 4) {
        res.status(400).json({ error: 'step must be 1-4 or null' })
        return
      }
    }

    try {
      const prompt = await prisma.promptInstruction.create({
        data: {
          name,
          content,
          kind: kind || 'instruction',
          step: step !== undefined ? (typeof step === 'string' ? parseInt(step, 10) : step) : null,
          order: order !== undefined ? (typeof order === 'string' ? parseInt(order as string, 10) : order) : 0,
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

  /**
   * PUT /mcp/prompts/:id
   * Body: { name?, content?, kind?, step?, order?, isActive? }
   */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { name, content, kind, step, order, isActive } = req.body

    // Validate kind if provided
    const validKinds = ['playbook', 'questionnaire', 'template', 'instruction']
    if (kind !== undefined && !validKinds.includes(kind)) {
      res.status(400).json({
        error: `kind must be one of: ${validKinds.join(', ')}`,
      })
      return
    }

    // Validate step if provided (allow null to unassign)
    if (step !== undefined && step !== null) {
      const stepNum = typeof step === 'string' ? parseInt(step, 10) : step
      if (isNaN(stepNum) || stepNum < 1 || stepNum > 4) {
        res.status(400).json({ error: 'step must be 1-4 or null' })
        return
      }
    }

    // Build update data — only include fields that were sent
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (content !== undefined) data.content = content
    if (kind !== undefined) data.kind = kind
    if (step !== undefined) data.step = step === null ? null : (typeof step === 'string' ? parseInt(step, 10) : step)
    if (order !== undefined) data.order = typeof order === 'string' ? parseInt(order as string, 10) : order
    if (isActive !== undefined) data.isActive = isActive

    try {
      const prompt = await prisma.promptInstruction.update({
        where: { id },
        data,
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

  /**
   * PATCH /mcp/prompts/:id/toggle
   * Toggles isActive flag.
   */
  async toggle(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.promptInstruction.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Prompt not found' })
      return
    }

    const prompt = await prisma.promptInstruction.update({
      where: { id },
      data: { isActive: !existing.isActive },
    })

    res.json(prompt)
  }

  /**
   * DELETE /mcp/prompts/:id
   */
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

  /**
   * POST /mcp/prompts/reorder
   * Batch update order values.
   * Body: { items: [{ id: string, order: number }] }
   */
  async reorder(req: Request, res: Response): Promise<void> {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items must be a non-empty array of { id, order }' })
      return
    }

    for (const item of items) {
      if (!item.id || typeof item.order !== 'number') {
        res.status(400).json({ error: 'Each item must have id (string) and order (number)' })
        return
      }
    }

    await prisma.$transaction(
      items.map((item: { id: string; order: number }) =>
        prisma.promptInstruction.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    res.json({ updated: items.length })
  }
}
