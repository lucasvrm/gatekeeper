import { promises as fs } from 'node:fs'
import path from 'node:path'

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
      const hasPlan = contents.includes('plan.json')
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
    } catch {
      return { exists: false, hasSpec: false, hasPlan: false, specFileName: null }
    }

    const contents = await fs.readdir(folderPath)
    const specFileName = contents.find((file) => isSpecFile(file)) || null

    return {
      exists: true,
      hasSpec: Boolean(specFileName),
      hasPlan: contents.includes('plan.json'),
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

    if (contents.hasPlan) {
      try {
        const planPath = path.join(folderPath, 'plan.json')
        const planRaw = await fs.readFile(planPath, 'utf-8')
        planJson = JSON.parse(planRaw) as Record<string, unknown>
      } catch {
        planJson = null
      }
    }

    if (contents.hasSpec && contents.specFileName) {
      try {
        const specPath = path.join(folderPath, contents.specFileName)
        specContent = await fs.readFile(specPath, 'utf-8')
      } catch {
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
