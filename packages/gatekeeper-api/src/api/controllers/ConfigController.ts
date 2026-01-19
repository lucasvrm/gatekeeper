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

const CUSTOMIZATION_CATEGORY = 'CUSTOMIZATION'
const CUSTOMIZATION_KEYS = {
  appName: 'CUSTOMIZATION_APP_NAME',
  appSubtitle: 'CUSTOMIZATION_APP_SUBTITLE',
  logoUrl: 'CUSTOMIZATION_LOGO_URL',
  faviconUrl: 'CUSTOMIZATION_FAVICON_URL',
  fontSans: 'CUSTOMIZATION_FONT_SANS',
  fontSerif: 'CUSTOMIZATION_FONT_SERIF',
  fontMono: 'CUSTOMIZATION_FONT_MONO',
  uploadLimitMb: 'CUSTOMIZATION_UPLOAD_LIMIT_MB',
  accentBg: 'CUSTOMIZATION_COLOR_ACCENT_BG',
  accentText: 'CUSTOMIZATION_COLOR_ACCENT_TEXT',
  primaryBg: 'CUSTOMIZATION_COLOR_PRIMARY_BG',
  primaryText: 'CUSTOMIZATION_COLOR_PRIMARY_TEXT',
  secondaryBg: 'CUSTOMIZATION_COLOR_SECONDARY_BG',
  secondaryText: 'CUSTOMIZATION_COLOR_SECONDARY_TEXT',
  baseBg: 'CUSTOMIZATION_COLOR_BASE_BG',
  baseText: 'CUSTOMIZATION_COLOR_BASE_TEXT',
  backgroundBg: 'CUSTOMIZATION_COLOR_BACKGROUND_BG',
  backgroundText: 'CUSTOMIZATION_COLOR_BACKGROUND_TEXT',
  textBg: 'CUSTOMIZATION_COLOR_TEXT_BG',
  textText: 'CUSTOMIZATION_COLOR_TEXT_TEXT',
} as const

const customizationDefaults = {
  appName: 'Gatekeeper',
  appSubtitle: 'Dashboard de Validações',
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  fontSans: 'Inter',
  fontSerif: 'Merriweather',
  fontMono: 'JetBrains Mono',
  uploadLimitMb: 2,
  accentBg: null as string | null,
  accentText: null as string | null,
  primaryBg: null as string | null,
  primaryText: null as string | null,
  secondaryBg: null as string | null,
  secondaryText: null as string | null,
  baseBg: null as string | null,
  baseText: null as string | null,
  backgroundBg: null as string | null,
  backgroundText: null as string | null,
  textBg: null as string | null,
  textText: null as string | null,
}

const parseNumberField = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return null
}

const isAllowedImageDataUrl = (value: string): boolean => {
  return value.startsWith('data:image/png') || value.startsWith('data:image/svg+xml')
}

const buildCustomizationResponse = (entries: Array<{ key: string; value: string }>) => {
  const map = new Map(entries.map((entry) => [entry.key, entry.value]))
  const getValue = (key: string) => {
    const value = map.get(key)
    return value !== undefined && value !== '' ? value : null
  }

  const uploadLimit = parseNumberField(map.get(CUSTOMIZATION_KEYS.uploadLimitMb)) ?? customizationDefaults.uploadLimitMb

  return {
    appName: map.get(CUSTOMIZATION_KEYS.appName) ?? customizationDefaults.appName,
    appSubtitle: map.get(CUSTOMIZATION_KEYS.appSubtitle) ?? customizationDefaults.appSubtitle,
    logoUrl: getValue(CUSTOMIZATION_KEYS.logoUrl),
    faviconUrl: getValue(CUSTOMIZATION_KEYS.faviconUrl),
    fonts: {
      sans: map.get(CUSTOMIZATION_KEYS.fontSans) ?? customizationDefaults.fontSans,
      serif: map.get(CUSTOMIZATION_KEYS.fontSerif) ?? customizationDefaults.fontSerif,
      mono: map.get(CUSTOMIZATION_KEYS.fontMono) ?? customizationDefaults.fontMono,
    },
    maxUploadMb: uploadLimit,
    colors: {
      accent: {
        background: getValue(CUSTOMIZATION_KEYS.accentBg),
        text: getValue(CUSTOMIZATION_KEYS.accentText),
      },
      primary: {
        background: getValue(CUSTOMIZATION_KEYS.primaryBg),
        text: getValue(CUSTOMIZATION_KEYS.primaryText),
      },
      secondary: {
        background: getValue(CUSTOMIZATION_KEYS.secondaryBg),
        text: getValue(CUSTOMIZATION_KEYS.secondaryText),
      },
      base: {
        background: getValue(CUSTOMIZATION_KEYS.baseBg),
        text: getValue(CUSTOMIZATION_KEYS.baseText),
      },
      background: {
        background: getValue(CUSTOMIZATION_KEYS.backgroundBg),
        text: getValue(CUSTOMIZATION_KEYS.backgroundText),
      },
      text: {
        background: getValue(CUSTOMIZATION_KEYS.textBg),
        text: getValue(CUSTOMIZATION_KEYS.textText),
      },
    },
  }
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
    const configs = await prisma.validationConfig.findMany({
      where: { NOT: { category: CUSTOMIZATION_CATEGORY } },
      orderBy: { updatedAt: 'desc' },
    })
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

  async getCustomization(req: Request, res: Response): Promise<void> {
    const keys = Object.values(CUSTOMIZATION_KEYS)
    const entries = await prisma.validationConfig.findMany({
      where: { key: { in: keys } },
      orderBy: { key: 'asc' },
    })

    res.json(buildCustomizationResponse(entries))
  }

  async updateCustomization(req: Request, res: Response): Promise<void> {
    const payload = req.body as Record<string, unknown>
    const keys = Object.values(CUSTOMIZATION_KEYS)

    const existing = await prisma.validationConfig.findMany({
      where: { key: { in: keys } },
      orderBy: { key: 'asc' },
    })

    const current = buildCustomizationResponse(existing)
    const next = {
      ...current,
      appName: typeof payload.appName === 'string' && payload.appName.trim() ? payload.appName.trim() : current.appName,
      appSubtitle: typeof payload.appSubtitle === 'string' && payload.appSubtitle.trim() ? payload.appSubtitle.trim() : current.appSubtitle,
      logoUrl: payload.logoUrl === null || typeof payload.logoUrl === 'string' ? payload.logoUrl : current.logoUrl,
      faviconUrl: payload.faviconUrl === null || typeof payload.faviconUrl === 'string' ? payload.faviconUrl : current.faviconUrl,
      fonts: {
        sans: typeof payload?.fonts === 'object' && payload.fonts && typeof (payload.fonts as Record<string, unknown>).sans === 'string'
          ? String((payload.fonts as Record<string, unknown>).sans)
          : current.fonts.sans,
        serif: typeof payload?.fonts === 'object' && payload.fonts && typeof (payload.fonts as Record<string, unknown>).serif === 'string'
          ? String((payload.fonts as Record<string, unknown>).serif)
          : current.fonts.serif,
        mono: typeof payload?.fonts === 'object' && payload.fonts && typeof (payload.fonts as Record<string, unknown>).mono === 'string'
          ? String((payload.fonts as Record<string, unknown>).mono)
          : current.fonts.mono,
      },
      maxUploadMb: parseNumberField(payload.maxUploadMb) ?? current.maxUploadMb,
      colors: {
        accent: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).accent === 'object'
            ? (((payload.colors as Record<string, unknown>).accent as Record<string, unknown>).background as string | null) ?? current.colors.accent.background
            : current.colors.accent.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).accent === 'object'
            ? (((payload.colors as Record<string, unknown>).accent as Record<string, unknown>).text as string | null) ?? current.colors.accent.text
            : current.colors.accent.text,
        },
        primary: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).primary === 'object'
            ? (((payload.colors as Record<string, unknown>).primary as Record<string, unknown>).background as string | null) ?? current.colors.primary.background
            : current.colors.primary.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).primary === 'object'
            ? (((payload.colors as Record<string, unknown>).primary as Record<string, unknown>).text as string | null) ?? current.colors.primary.text
            : current.colors.primary.text,
        },
        secondary: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).secondary === 'object'
            ? (((payload.colors as Record<string, unknown>).secondary as Record<string, unknown>).background as string | null) ?? current.colors.secondary.background
            : current.colors.secondary.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).secondary === 'object'
            ? (((payload.colors as Record<string, unknown>).secondary as Record<string, unknown>).text as string | null) ?? current.colors.secondary.text
            : current.colors.secondary.text,
        },
        base: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).base === 'object'
            ? (((payload.colors as Record<string, unknown>).base as Record<string, unknown>).background as string | null) ?? current.colors.base.background
            : current.colors.base.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).base === 'object'
            ? (((payload.colors as Record<string, unknown>).base as Record<string, unknown>).text as string | null) ?? current.colors.base.text
            : current.colors.base.text,
        },
        background: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).background === 'object'
            ? (((payload.colors as Record<string, unknown>).background as Record<string, unknown>).background as string | null) ?? current.colors.background.background
            : current.colors.background.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).background === 'object'
            ? (((payload.colors as Record<string, unknown>).background as Record<string, unknown>).text as string | null) ?? current.colors.background.text
            : current.colors.background.text,
        },
        text: {
          background: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).text === 'object'
            ? (((payload.colors as Record<string, unknown>).text as Record<string, unknown>).background as string | null) ?? current.colors.text.background
            : current.colors.text.background,
          text: typeof payload?.colors === 'object' && payload.colors && typeof (payload.colors as Record<string, unknown>).text === 'object'
            ? (((payload.colors as Record<string, unknown>).text as Record<string, unknown>).text as string | null) ?? current.colors.text.text
            : current.colors.text.text,
        },
      },
    }

    if (next.maxUploadMb <= 0) {
      res.status(400).json({ message: 'maxUploadMb must be greater than 0' })
      return
    }

    const maxBytes = Math.floor(next.maxUploadMb * 1024 * 1024)

    if (typeof next.logoUrl === 'string' && next.logoUrl.trim() !== '') {
      if (!isAllowedImageDataUrl(next.logoUrl)) {
        res.status(400).json({ message: 'Logo must be a PNG or SVG data URL' })
        return
      }
      if (Buffer.byteLength(next.logoUrl, 'utf8') > maxBytes) {
        res.status(400).json({ message: 'Logo exceeds upload size limit' })
        return
      }
    }

    if (typeof next.faviconUrl === 'string' && next.faviconUrl.trim() !== '') {
      if (!isAllowedImageDataUrl(next.faviconUrl)) {
        res.status(400).json({ message: 'Favicon must be a PNG or SVG data URL' })
        return
      }
      if (Buffer.byteLength(next.faviconUrl, 'utf8') > maxBytes) {
        res.status(400).json({ message: 'Favicon exceeds upload size limit' })
        return
      }
    }

    const records = [
      { key: CUSTOMIZATION_KEYS.appName, value: next.appName, type: 'STRING', description: 'Application name' },
      { key: CUSTOMIZATION_KEYS.appSubtitle, value: next.appSubtitle, type: 'STRING', description: 'Application subtitle' },
      { key: CUSTOMIZATION_KEYS.logoUrl, value: next.logoUrl ?? '', type: 'STRING', description: 'Logo data URL' },
      { key: CUSTOMIZATION_KEYS.faviconUrl, value: next.faviconUrl ?? '', type: 'STRING', description: 'Favicon data URL' },
      { key: CUSTOMIZATION_KEYS.fontSans, value: next.fonts.sans, type: 'STRING', description: 'Sans font family' },
      { key: CUSTOMIZATION_KEYS.fontSerif, value: next.fonts.serif, type: 'STRING', description: 'Serif font family' },
      { key: CUSTOMIZATION_KEYS.fontMono, value: next.fonts.mono, type: 'STRING', description: 'Monospace font family' },
      { key: CUSTOMIZATION_KEYS.uploadLimitMb, value: String(next.maxUploadMb), type: 'NUMBER', description: 'Upload limit in MB' },
      { key: CUSTOMIZATION_KEYS.accentBg, value: next.colors.accent.background ?? '', type: 'STRING', description: 'Accent background color' },
      { key: CUSTOMIZATION_KEYS.accentText, value: next.colors.accent.text ?? '', type: 'STRING', description: 'Accent text color' },
      { key: CUSTOMIZATION_KEYS.primaryBg, value: next.colors.primary.background ?? '', type: 'STRING', description: 'Primary background color' },
      { key: CUSTOMIZATION_KEYS.primaryText, value: next.colors.primary.text ?? '', type: 'STRING', description: 'Primary text color' },
      { key: CUSTOMIZATION_KEYS.secondaryBg, value: next.colors.secondary.background ?? '', type: 'STRING', description: 'Secondary background color' },
      { key: CUSTOMIZATION_KEYS.secondaryText, value: next.colors.secondary.text ?? '', type: 'STRING', description: 'Secondary text color' },
      { key: CUSTOMIZATION_KEYS.baseBg, value: next.colors.base.background ?? '', type: 'STRING', description: 'Base background color' },
      { key: CUSTOMIZATION_KEYS.baseText, value: next.colors.base.text ?? '', type: 'STRING', description: 'Base text color' },
      { key: CUSTOMIZATION_KEYS.backgroundBg, value: next.colors.background.background ?? '', type: 'STRING', description: 'Background color' },
      { key: CUSTOMIZATION_KEYS.backgroundText, value: next.colors.background.text ?? '', type: 'STRING', description: 'Background text color' },
      { key: CUSTOMIZATION_KEYS.textBg, value: next.colors.text.background ?? '', type: 'STRING', description: 'Text background color' },
      { key: CUSTOMIZATION_KEYS.textText, value: next.colors.text.text ?? '', type: 'STRING', description: 'Text color' },
    ]

    await prisma.$transaction(
      records.map((record) =>
        prisma.validationConfig.upsert({
          where: { key: record.key },
          create: {
            key: record.key,
            value: record.value,
            type: record.type,
            category: CUSTOMIZATION_CATEGORY,
            description: record.description,
          },
          update: {
            value: record.value,
            type: record.type,
            category: CUSTOMIZATION_CATEGORY,
            description: record.description,
          },
        }),
      ),
    )

    res.json(next)
  }
}
