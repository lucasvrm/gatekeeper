/**
 * Gatekeeper Orchestrator — Artifact Manager
 *
 * Handles reading and writing artifact files to the artifacts directory.
 * Same directory structure as the MCP server: artifacts/{outputId}/{filename}
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ParsedArtifact, Microplan, MicroplansDocument } from './types.js'

export class ArtifactManager {
  constructor(private artifactsDir: string) {}

  /**
   * Generate an outputId from a task description.
   * Format: YYYY_MM_DD_NNN_slug
   */
  generateOutputId(taskDescription: string): string {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const nnn = String(Math.floor(Math.random() * 900) + 100)
    const slug = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      .replace(/-$/, '')
    return `${yyyy}_${mm}_${dd}_${nnn}_${slug}`
  }

  /**
   * Save parsed artifacts to disk.
   * Creates the outputId directory if it doesn't exist.
   */
  saveArtifacts(outputId: string, artifacts: ParsedArtifact[]): void {
    const dir = path.join(this.artifactsDir, outputId)
    fs.mkdirSync(dir, { recursive: true })

    for (const artifact of artifacts) {
      const filepath = path.join(dir, artifact.filename)
      fs.writeFileSync(filepath, artifact.content, 'utf-8')
    }
  }

  /**
   * Read a single artifact from disk.
   * Returns null if not found.
   */
  readArtifact(outputId: string, filename: string): string | null {
    const filepath = path.join(this.artifactsDir, outputId, filename)
    try {
      return fs.readFileSync(filepath, 'utf-8')
    } catch {
      return null
    }
  }

  /**
   * List all artifact filenames for an outputId.
   */
  listArtifacts(outputId: string): string[] {
    const dir = path.join(this.artifactsDir, outputId)
    try {
      return fs.readdirSync(dir)
    } catch {
      return []
    }
  }

  /**
   * Read all standard artifacts for a given outputId.
   * Returns a map of filename → content.
   */
  readAllArtifacts(outputId: string): Record<string, string> {
    const files = this.listArtifacts(outputId)
    const result: Record<string, string> = {}
    for (const file of files) {
      const content = this.readArtifact(outputId, file)
      if (content !== null) {
        result[file] = content
      }
    }
    return result
  }

  /**
   * Find the test file in an outputId folder.
   * Matches common patterns: *.spec.ts, *.test.ts, spec.test, etc.
   */
  findTestFile(outputId: string): { filename: string; content: string } | null {
    const files = this.listArtifacts(outputId)
    const testFile = files.find(
      f =>
        /\.spec\.(ts|tsx|js|jsx)$/.test(f) ||
        /\.test\.(ts|tsx|js|jsx)$/.test(f) ||
        f === 'spec.test'
    )
    if (!testFile) return null

    const content = this.readArtifact(outputId, testFile)
    if (!content) return null

    return { filename: testFile, content }
  }

  /**
   * Get the full path to the outputId directory.
   */
  getOutputDir(outputId: string): string {
    return path.join(this.artifactsDir, outputId)
  }

  /**
   * Read microplans.json from runDir.
   * Throws error if file doesn't exist or JSON is invalid.
   */
  async readMicroplans(runDir: string): Promise<MicroplansDocument> {
    const filepath = path.join(runDir, 'microplans.json')
    try {
      const content = fs.readFileSync(filepath, 'utf-8')
      const parsed = JSON.parse(content) as MicroplansDocument
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`microplans.json not found in ${runDir}`)
      }
      throw new Error(`Failed to parse microplans.json: ${(error as Error).message}`)
    }
  }

  /**
   * Write microplans.json to runDir.
   * Formats JSON with 2-space indentation.
   */
  async saveMicroplans(runDir: string, microplans: MicroplansDocument): Promise<void> {
    const filepath = path.join(runDir, 'microplans.json')
    const content = JSON.stringify(microplans, null, 2)
    fs.writeFileSync(filepath, content, 'utf-8')
  }

  /**
   * Get a specific microplan by ID from microplans.json.
   * Returns null if microplan not found.
   */
  async getMicroplanById(runDir: string, microplanId: string): Promise<Microplan | null> {
    try {
      const doc = await this.readMicroplans(runDir)
      const microplan = doc.microplans.find(mp => mp.id === microplanId)
      return microplan || null
    } catch {
      return null
    }
  }

  /**
   * List all microplan IDs from microplans.json.
   * Returns empty array if file doesn't exist.
   */
  async listMicroplanIds(runDir: string): Promise<string[]> {
    try {
      const doc = await this.readMicroplans(runDir)
      return doc.microplans.map(mp => mp.id)
    } catch {
      return []
    }
  }
}
