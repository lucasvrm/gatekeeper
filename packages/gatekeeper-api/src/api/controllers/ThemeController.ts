import type { Request, Response } from 'express'
import { prisma } from '../../db/client.js'
import { ThemeRepository } from '../../repositories/ThemeRepository.js'
import { ThemeEngine } from '../../services/ThemeEngine.js'
import type { ThemePreset } from '../../types/theme.types.js'

const themeRepo = new ThemeRepository(prisma)
const themeEngine = new ThemeEngine()

export class ThemeController {
  async createTheme(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params
      const preset = req.body as ThemePreset

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) {
        res.status(404).json({
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
          },
        })
        return
      }

      const output = themeEngine.process(preset)

      if (!output.validation.valid) {
        res.status(400).json({
          error: {
            code: 'INVALID_PRESET',
            message: 'Preset validation failed',
            details: output.validation.errors,
          },
        })
        return
      }

      const theme = await themeRepo.create({
        projectId,
        name: preset.metadata.name,
        version: preset.version,
        presetRaw: JSON.stringify(preset),
        cssVariables: output.cssVariables,
        layoutConfig: JSON.stringify(output.layoutConfig),
        componentStyles: JSON.stringify(output.componentStyles),
        metadata: JSON.stringify(preset.metadata),
      })

      res.status(201).json({
        id: theme.id,
        projectId: theme.projectId,
        name: theme.name,
        version: theme.version,
        isActive: theme.isActive,
        createdAt: theme.createdAt,
      })
    } catch (error) {
      console.error('Error creating theme:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create theme' } })
    }
  }

  async listThemes(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params

      const themes = await themeRepo.findByProjectId(projectId)

      res.status(200).json({
        themes: themes.map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          isActive: t.isActive,
          createdAt: t.createdAt,
        })),
      })
    } catch (error) {
      console.error('Error listing themes:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list themes' } })
    }
  }

  async getActiveTheme(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params

      const theme = await themeRepo.findActive(projectId)

      if (!theme) {
        res.status(404).json({
          error: {
            code: 'THEME_NOT_FOUND',
            message: 'No active theme found',
          },
        })
        return
      }

      res.status(200).json({
        id: theme.id,
        projectId: theme.projectId,
        name: theme.name,
        version: theme.version,
        cssVariables: theme.cssVariables,
        layoutConfig: JSON.parse(theme.layoutConfig),
        componentStyles: JSON.parse(theme.componentStyles),
        isActive: theme.isActive,
        createdAt: theme.createdAt,
      })
    } catch (error) {
      console.error('Error getting active theme:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get active theme' } })
    }
  }

  async activateTheme(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, themeId } = req.params

      const theme = await themeRepo.findById(themeId)

      if (!theme) {
        res.status(404).json({
          error: {
            code: 'THEME_NOT_FOUND',
            message: 'Theme not found',
          },
        })
        return
      }

      if (theme.projectId !== projectId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Theme does not belong to this project',
          },
        })
        return
      }

      const activatedTheme = await themeRepo.setActive(themeId)

      res.status(200).json({
        id: activatedTheme.id,
        isActive: activatedTheme.isActive,
      })
    } catch (error) {
      console.error('Error activating theme:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to activate theme' } })
    }
  }

  async deleteTheme(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, themeId } = req.params

      const theme = await themeRepo.findById(themeId)

      if (!theme) {
        res.status(404).json({
          error: {
            code: 'THEME_NOT_FOUND',
            message: 'Theme not found',
          },
        })
        return
      }

      if (theme.projectId !== projectId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Theme does not belong to this project',
          },
        })
        return
      }

      if (theme.isActive) {
        res.status(400).json({
          error: {
            code: 'CANNOT_DELETE_ACTIVE_THEME',
            message: 'Cannot delete an active theme. Deactivate it first.',
          },
        })
        return
      }

      await themeRepo.delete(themeId)

      res.status(204).send()
    } catch (error) {
      console.error('Error deleting theme:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete theme' } })
    }
  }

  async previewTheme(req: Request, res: Response): Promise<void> {
    try {
      const preset = req.body as ThemePreset

      const output = themeEngine.process(preset)

      res.status(200).json({
        cssVariables: output.cssVariables,
        layoutConfig: output.layoutConfig,
        validation: output.validation,
      })
    } catch (error) {
      console.error('Error previewing theme:', error)
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to preview theme' } })
    }
  }
}
