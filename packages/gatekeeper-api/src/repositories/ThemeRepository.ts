import { type PrismaClient, type Theme } from '@prisma/client'
import type { CreateThemeData } from '../types/theme.types.js'

export class ThemeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Theme[]> {
    return this.prisma.theme.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async findActive(): Promise<Theme | null> {
    return this.prisma.theme.findFirst({
      where: { isActive: true },
    })
  }

  async findById(id: string): Promise<Theme | null> {
    return this.prisma.theme.findUnique({
      where: { id },
    })
  }

  async create(data: CreateThemeData): Promise<Theme> {
    return this.prisma.theme.create({
      data: {
        name: data.name,
        version: data.version,
        presetRaw: data.presetRaw,
        cssVariables: data.cssVariables,
        layoutConfig: data.layoutConfig,
        componentStyles: data.componentStyles,
        metadata: data.metadata,
        isActive: false,
      },
    })
  }

  async activate(themeId: string): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({ where: { id: themeId } })
    if (!theme) throw new Error('Theme not found')
    return this.prisma.$transaction(async (tx) => {
      await tx.theme.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })
      return tx.theme.update({
        where: { id: themeId },
        data: { isActive: true },
      })
    })
  }

  async deactivateAll(): Promise<void> {
    await this.prisma.theme.updateMany({
      where: {},
      data: { isActive: false },
    })
  }

  async delete(themeId: string): Promise<Theme> {
    return this.prisma.theme.delete({
      where: { id: themeId },
    })
  }
}
