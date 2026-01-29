/**
 * Local Docs Reader
 * Reads playbook and template files from DOCS_DIR
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
   * Read a file from DOCS_DIR
   * Returns content or fallback message if not found
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
   * Read multiple files and combine them
   */
  readFiles(filenames: string[]): Record<string, string> {
    const result: Record<string, string> = {}

    for (const filename of filenames) {
      result[filename] = this.readFile(filename)
    }

    return result
  }

  /**
   * List all .md files in DOCS_DIR
   */
  listMarkdownFiles(): string[] {
    if (!this.exists()) {
      return []
    }

    try {
      return fs.readdirSync(this.docsDir).filter(f => f.endsWith('.md'))
    } catch {
      return []
    }
  }
}
