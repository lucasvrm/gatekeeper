import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { MicroplansDocument } from '../types/gates.types.js'

export interface ArtifactFolderInfo {
  outputId: string
  hasSpec: boolean
  hasPlan: boolean
  specFileName: string | null
  createdAt: string
}

export interface ArtifactFolderStatus {
  exists: boolean
  hasSpec: boolean
  hasPlan: boolean
  specFileName: string | null
}

export interface ArtifactContents {
  planJson: Record<string, unknown> | null
  specContent: string | null
  specFileName: string | null
}

const isSpecFile = (fileName: string) => fileName.endsWith('.spec.tsx') || fileName.endsWith('.spec.ts')

export class ArtifactsService {
  async listFolders(artifactsBasePath: string): Promise<ArtifactFolderInfo[]> {
    const entries = await fs.readdir(artifactsBasePath, { withFileTypes: true })
    const folders = entries.filter((entry) => entry.isDirectory())

    const results: ArtifactFolderInfo[] = []

    for (const folder of folders) {
      const folderPath = path.join(artifactsBasePath, folder.name)
      const contents = await fs.readdir(folderPath)
      const hasPlan = contents.includes('microplans.json') || contents.includes('plan.json')
      const specFileName = contents.find((file) => isSpecFile(file)) || null
      const hasSpec = Boolean(specFileName)
      const stat = await fs.stat(folderPath)
      const createdAt = (stat.birthtime ?? stat.mtime).toISOString()

      results.push({
        outputId: folder.name,
        hasSpec,
        hasPlan,
        specFileName,
        createdAt,
      })
    }

    return results
  }

  async validateFolder(artifactsBasePath: string, outputId: string): Promise<ArtifactFolderStatus> {
    const folderPath = path.join(artifactsBasePath, outputId)
    try {
      const stat = await fs.stat(folderPath)
      if (!stat.isDirectory()) {
        return { exists: false, hasSpec: false, hasPlan: false, specFileName: null }
      }
    } catch (err) {
      console.debug('[ArtifactsService] Folder not found:', folderPath, (err as Error).message)
      return { exists: false, hasSpec: false, hasPlan: false, specFileName: null }
    }

    const contents = await fs.readdir(folderPath)
    const specFileName = contents.find((file) => isSpecFile(file)) || null

    return {
      exists: true,
      hasSpec: Boolean(specFileName),
      hasPlan: contents.includes('microplans.json') || contents.includes('plan.json'),
      specFileName,
    }
  }

  async readContents(artifactsBasePath: string, outputId: string): Promise<ArtifactContents> {
    const folderPath = path.join(artifactsBasePath, outputId)
    const contents = await this.validateFolder(artifactsBasePath, outputId)

    if (!contents.exists) {
      return { planJson: null, specContent: null, specFileName: null }
    }

    let planJson: Record<string, unknown> | null = null
    let specContent: string | null = null

    // Try microplans.json first (new format), fallback to plan.json (backward compatibility)
    if (contents.hasPlan) {
      const microplansPath = path.join(folderPath, 'microplans.json')
      const planPath = path.join(folderPath, 'plan.json')

      try {
        const microplansContent = await fs.readFile(microplansPath, 'utf-8')
        const microplans = JSON.parse(microplansContent) as MicroplansDocument | Record<string, unknown>

        // Convert microplans format to legacy plan format if needed
        if ('microplans' in microplans && Array.isArray(microplans.microplans)) {
          // Already in microplans format - convert to legacy format for API compatibility
          planJson = {
            task: microplans.task,
            approach: '',
            files_to_create: [],
            files_to_modify: [],
            test_files: [],
            steps: microplans.microplans.map((mp: any, idx: number) => ({
              order: idx + 1,
              action: mp.goal || mp.task || '',
              files: mp.files || [],
              details: mp.verify || ''
            }))
          }
        } else {
          // Unknown format - use as-is
          planJson = microplans as Record<string, unknown>
        }
      } catch (microplansError) {
        // Fallback to plan.json (backward compatibility)
        try {
          const planContent = await fs.readFile(planPath, 'utf-8')
          planJson = JSON.parse(planContent) as Record<string, unknown>
        } catch (planError) {
          console.debug('[ArtifactsService] Failed to read microplans.json or plan.json:', { microplansError, planError })
          planJson = null
        }
      }
    }

    if (contents.hasSpec && contents.specFileName) {
      try {
        const specPath = path.join(folderPath, contents.specFileName)
        specContent = await fs.readFile(specPath, 'utf-8')
      } catch (err) {
        console.debug('[ArtifactsService] Failed to read spec file:', contents.specFileName, (err as Error).message)
        specContent = null
      }
    }

    return {
      planJson,
      specContent,
      specFileName: contents.specFileName,
    }
  }
}
