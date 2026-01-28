export class UITestCoverageService {
  /**
   * Extrai tags @ui-clause de um arquivo de teste
   */
  extractUIClauseTags(testFileContent: string): string[] {
    const tags: string[] = []
    const lines = testFileContent.split('\n')

    const tagPattern = /@ui-clause\s+([A-Z0-9_-]+)/gi

    for (const line of lines) {
      const matches = line.matchAll(tagPattern)
      for (const match of matches) {
        if (match[1]) {
          tags.push(match[1])
        }
      }
    }

    return Array.from(new Set(tags))
  }
}
