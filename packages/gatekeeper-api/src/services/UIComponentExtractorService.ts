import type { ManifestInput } from '../types/index.js'

export class UIComponentExtractorService {
  /**
   * Extrai componentes UI afetados pelo manifest
   * Retorna lista de nomes de componentes (ex: Button, Input)
   */
  extractAffectedComponents(manifest: ManifestInput): string[] {
    const affected: string[] = []

    for (const file of manifest.files) {
      const pathLower = file.path.toLowerCase()

      // Detecta se é arquivo de componente UI
      if (
        pathLower.includes('/components/') ||
        pathLower.includes('\\components\\') ||
        pathLower.endsWith('.tsx') ||
        pathLower.endsWith('.jsx')
      ) {
        // Extrai nome do componente do path
        const match = file.path.match(/\/([A-Z][a-zA-Z]+)\.(tsx?|jsx?)$/)
        if (match && match[1]) {
          affected.push(match[1])
        }
      }
    }

    return Array.from(new Set(affected))
  }
}
