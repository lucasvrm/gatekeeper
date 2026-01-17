import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'

const hasMissingFields = (fields: Array<[string, unknown]>): string[] => {
  return fields
    .filter(([_, value]) => value === undefined || value === null || value === '')
    .map(([name]) => name)
}

const getStringField = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }
  return undefined
}

export class ConfigController {
  async listSensitiveFileRules(req: Request, res: Response): Promise<void> {
    const rules = await prisma.sensitiveFileRule.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(rules)
  }

  async createSensitiveFileRule(req: Request, res: Response): Promise<void> {
    const { pattern, category, severity, description, isActive } = req.body
    const missing = hasMissingFields([
      ['pattern', pattern],
      ['category', category],
      ['severity', severity],
    ])

    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
      return
    }

    const existing = await prisma.sensitiveFileRule.findUnique({
      where: { pattern: String(pattern) },
    })

    if (existing) {
      res.status(400).json({ message: 'Duplicate pattern exists' })
      return
    }

    const rule = await prisma.sensitiveFileRule.create({
      data: {
        pattern: String(pattern),
        category: String(category),
        severity: String(severity),
        description: typeof description === 'string' ? description : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    })

    res.status(201).json(rule)
  }

  async updateSensitiveFileRule(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { pattern, category, severity, description, isActive } = req.body

    const existing = await prisma.sensitiveFileRule.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'SensitiveFileRule not found' })
      return
    }

    const nextPattern = getStringField(pattern)
    if (nextPattern && nextPattern !== existing.pattern) {
      const duplicate = await prisma.sensitiveFileRule.findUnique({
        where: { pattern: nextPattern },
      })
      if (duplicate) {
        res.status(400).json({ message: 'Duplicate pattern exists' })
        return
      }
    }

    const data: {
      pattern?: string
      category?: string
      severity?: string
      description?: string | null
      isActive?: boolean
    } = {}

    if (nextPattern) data.pattern = nextPattern
    if (getStringField(category)) data.category = String(category)
    if (getStringField(severity)) data.severity = String(severity)
    if ('description' in req.body) {
      data.description = description === null || typeof description === 'string' ? description : undefined
    }
    if (typeof isActive === 'boolean') data.isActive = isActive

    if (Object.keys(data).length === 0) {
      res.status(400).json({ message: 'Missing fields to update' })
      return
    }

    const updated = await prisma.sensitiveFileRule.update({
      where: { id },
      data,
    })

    res.json(updated)
  }

  async deleteSensitiveFileRule(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.sensitiveFileRule.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'SensitiveFileRule not found' })
      return
    }

    await prisma.sensitiveFileRule.delete({ where: { id } })
    res.status(204).send()
  }

  async listAmbiguousTerms(req: Request, res: Response): Promise<void> {
    const terms = await prisma.ambiguousTerm.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(terms)
  }

  async createAmbiguousTerm(req: Request, res: Response): Promise<void> {
    const { term, category, suggestion, isActive } = req.body
    const missing = hasMissingFields([
      ['term', term],
      ['category', category],
    ])

    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
      return
    }

    const existing = await prisma.ambiguousTerm.findUnique({
      where: { term: String(term) },
    })

    if (existing) {
      res.status(400).json({ message: 'Duplicate term exists' })
      return
    }

    const created = await prisma.ambiguousTerm.create({
      data: {
        term: String(term),
        category: String(category),
        suggestion: typeof suggestion === 'string' ? suggestion : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    })

    res.status(201).json(created)
  }

  async updateAmbiguousTerm(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { term, category, suggestion, isActive } = req.body

    const existing = await prisma.ambiguousTerm.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AmbiguousTerm not found' })
      return
    }

    const nextTerm = getStringField(term)
    if (nextTerm && nextTerm !== existing.term) {
      const duplicate = await prisma.ambiguousTerm.findUnique({ where: { term: nextTerm } })
      if (duplicate) {
        res.status(400).json({ message: 'Duplicate term exists' })
        return
      }
    }

    const data: {
      term?: string
      category?: string
      suggestion?: string | null
      isActive?: boolean
    } = {}

    if (nextTerm) data.term = nextTerm
    if (getStringField(category)) data.category = String(category)
    if ('suggestion' in req.body) {
      data.suggestion = suggestion === null || typeof suggestion === 'string' ? suggestion : undefined
    }
    if (typeof isActive === 'boolean') data.isActive = isActive

    if (Object.keys(data).length === 0) {
      res.status(400).json({ message: 'Missing fields to update' })
      return
    }

    const updated = await prisma.ambiguousTerm.update({
      where: { id },
      data,
    })

    res.json(updated)
  }

  async deleteAmbiguousTerm(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.ambiguousTerm.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'AmbiguousTerm not found' })
      return
    }

    await prisma.ambiguousTerm.delete({ where: { id } })
    res.status(204).send()
  }

  async listValidationConfigs(req: Request, res: Response): Promise<void> {
    const configs = await prisma.validationConfig.findMany({ orderBy: { updatedAt: 'desc' } })
    res.json(configs)
  }

  async createValidationConfig(req: Request, res: Response): Promise<void> {
    const { key, value, type, category, description } = req.body
    const missing = hasMissingFields([
      ['key', key],
      ['value', value],
      ['type', type],
      ['category', category],
    ])

    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` })
      return
    }

    const existing = await prisma.validationConfig.findUnique({
      where: { key: String(key) },
    })

    if (existing) {
      res.status(400).json({ message: 'Duplicate key exists' })
      return
    }

    const created = await prisma.validationConfig.create({
      data: {
        key: String(key),
        value: String(value),
        type: String(type),
        category: String(category),
        description: typeof description === 'string' ? description : undefined,
      },
    })

    res.status(201).json(created)
  }

  async updateValidationConfig(req: Request, res: Response): Promise<void> {
    const { id } = req.params
    const { key, value, type, category, description } = req.body

    const existing = await prisma.validationConfig.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'ValidationConfig not found' })
      return
    }

    const nextKey = getStringField(key)
    if (nextKey && nextKey !== existing.key) {
      const duplicate = await prisma.validationConfig.findUnique({ where: { key: nextKey } })
      if (duplicate) {
        res.status(400).json({ message: 'Duplicate key exists' })
        return
      }
    }

    const data: {
      key?: string
      value?: string
      type?: string
      category?: string
      description?: string | null
    } = {}

    if (nextKey) data.key = nextKey
    if ('value' in req.body && value !== undefined && value !== null) data.value = String(value)
    if (getStringField(type)) data.type = String(type)
    if (getStringField(category)) data.category = String(category)
    if ('description' in req.body) {
      data.description = description === null || typeof description === 'string' ? description : undefined
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ message: 'Missing fields to update' })
      return
    }

    const updated = await prisma.validationConfig.update({
      where: { id },
      data,
    })

    res.json(updated)
  }

  async deleteValidationConfig(req: Request, res: Response): Promise<void> {
    const { id } = req.params

    const existing = await prisma.validationConfig.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: 'ValidationConfig not found' })
      return
    }

    await prisma.validationConfig.delete({ where: { id } })
    res.status(204).send()
  }
}
