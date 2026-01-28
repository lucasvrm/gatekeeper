import { type PrismaClient, type Theme } from '@prisma/client'
import type { CreateThemeData } from '../types/theme.types.js'

export class ThemeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProjectId(projectId: string): Promise<Theme[]> {
    return this.prisma.theme.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findActive(projectId: string): Promise<Theme | null> {
    return this.prisma.theme.findFirst({
      where: { projectId, isActive: true },
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
        projectId: data.projectId,
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

  async setActive(themeId: string): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({ where: { id: themeId } })
    if (!theme) {
      throw new Error('Theme not found')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.theme.updateMany({
        where: { projectId: theme.projectId, isActive: true },
        data: { isActive: false },
      })

      return tx.theme.update({
        where: { id: themeId },
        data: { isActive: true },
      })
    })
  }

  async delete(themeId: string): Promise<Theme> {
    return this.prisma.theme.delete({
      where: { id: themeId },
    })
  }
}
