/**
 * Local Docs Reader v2
 * Reads all files from a prompt subfolder inside DOCS_DIR
 */

import * as fs from 'fs'
import * as path from 'path'

export class LocalDocsReader {
  private docsDir: string

  constructor(docsDir: string) {
    this.docsDir = docsDir
  }

  /**
   * Check if DOCS_DIR exists
   */
  exists(): boolean {
    return fs.existsSync(this.docsDir)
  }

  /**
   * Read a single file from DOCS_DIR
   */
  readFile(filename: string): string {
    const filepath = path.join(this.docsDir, filename)

    if (!fs.existsSync(filepath)) {
      return `[${filename} not found - using fallback]`
    }

    try {
      return fs.readFileSync(filepath, 'utf-8')
    } catch {
      return `[Error reading ${filename} - using fallback]`
    }
  }

  /**
   * Read ALL files from a subfolder inside DOCS_DIR.
   * Returns concatenated content with file separators.
   * Supports .md, .txt, .json files. Sorted alphabetically.
   *
   * Example: readFolder('create_plan') reads everything in DOCS_DIR/create_plan/
   */
  readFolder(folderName: string): string {
    const folderPath = path.join(this.docsDir, folderName)

    if (!fs.existsSync(folderPath)) {
      return `[Folder "${folderName}" not found in ${this.docsDir}]`
    }

    const stat = fs.statSync(folderPath)
    if (!stat.isDirectory()) {
      return `["${folderName}" is not a directory]`
    }

    try {
      const extensions = ['.md', '.txt', '.json']
      const files = fs.readdirSync(folderPath)
        .filter(f => extensions.some(ext => f.endsWith(ext)))
        .sort()

      if (files.length === 0) {
        return `[No .md/.txt/.json files found in "${folderName}"]`
      }

      const sections: string[] = []
      for (const file of files) {
        const filepath = path.join(folderPath, file)
        try {
          const content = fs.readFileSync(filepath, 'utf-8')
          sections.push(`--- ${file} ---\n${content}`)
        } catch {
          sections.push(`--- ${file} ---\n[Error reading file]`)
        }
      }

      return sections.join('\n\n')
    } catch {
      return `[Error reading folder "${folderName}"]`
    }
  }

  /**
   * List subfolders in DOCS_DIR (each represents a prompt)
   */
  listPromptFolders(): string[] {
    if (!this.exists()) return []
    try {
      return fs.readdirSync(this.docsDir)
        .filter(f => fs.statSync(path.join(this.docsDir, f)).isDirectory())
    } catch {
      return []
    }
  }
}
