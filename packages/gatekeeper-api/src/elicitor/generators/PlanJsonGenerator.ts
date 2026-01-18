import path from 'node:path'
import { minimatch } from 'minimatch'
import { IGenerator, GeneratorContext } from './IGenerator.js'
import { ElicitationState, ManifestFile, TaskType } from '../types/elicitor.types.js'
import { TaskPromptGenerator } from './TaskPromptGenerator.js'
import { DEFAULT_GIT_REFS, SENSITIVE_FILE_PATTERNS } from '../../config/defaults.js'
import { Contract } from '../../types/contract.types.js'

/**
 * plan.json structure for Gatekeeper validation runs.
 * T151: Added optional contract field for structured contract validation.
 */
export interface PlanJson {
  outputId: string
  projectPath: string
  baseRef: string
  targetRef: string
  taskPrompt: string
  manifest: {
    files: ManifestFile[]
    testFile: string
  }
  testFilePath: string
  dangerMode: boolean
  contract?: Contract // T151: Optional contract field (backward compatible)
}

export class PlanJsonGenerator implements IGenerator<PlanJson> {
  private taskPromptGenerator = new TaskPromptGenerator()

  generate(_state: ElicitationState, _taskType: TaskType): PlanJson {
    throw new Error('PlanJsonGenerator requires context. Use generateWithContext(context).')
  }

  generateWithContext(context: GeneratorContext): PlanJson {
    const taskPrompt = this.taskPromptGenerator.generate(context.state, context.taskType)
    const testFilePath = this.generateTestFilePath(context)
    const manifest = this.generateManifest(context.state, testFilePath)
    const dangerMode = this.requiresDangerMode(manifest.files)

    // T152, T153: Generate contract only if shouldGenerateContract is true and clauses exist
    const contract = this.shouldGenerateContract(context.state)
      ? this.generateContract(context)
      : undefined

    return {
      outputId: context.outputId,
      projectPath: context.projectPath,
      baseRef: DEFAULT_GIT_REFS.BASE_REF,
      targetRef: DEFAULT_GIT_REFS.TARGET_REF,
      taskPrompt,
      manifest,
      testFilePath,
      dangerMode,
      ...(contract && { contract }), // T151: Include contract only if generated
    }
  }

  private generateManifest(
    state: ElicitationState,
    testFilePath: string
  ): { files: ManifestFile[]; testFile: string } {
    const files = this.getManifestFiles(state)
    return { files, testFile: testFilePath }
  }

  private generateTestFilePath(context: GeneratorContext): string {
    const state = context.state
    const name = typeof state.name === 'string' ? state.name.trim() : ''
    const entityValue = (state as { entity?: string | { name?: string } }).entity
    const entity = typeof entityValue === 'string' ? entityValue : entityValue?.name
    const slugSource = name || entity || context.outputId
    const slug = this.toKebabCase(slugSource)
    const fileName = `${slug}.spec.tsx`
    return path.join(context.outputDir, context.outputId, fileName)
  }

  private requiresDangerMode(files: ManifestFile[]): boolean {
    for (const file of files) {
      for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (minimatch(file.path, pattern, { dot: true })) {
          return true
        }
      }
    }
    return false
  }

  private getManifestFiles(state: ElicitationState): ManifestFile[] {
    const files = state.manifestFiles

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('manifestFiles is required and must be a non-empty array.')
    }

    for (const file of files) {
      if (!file || typeof file.path !== 'string' || file.path.trim() === '') {
        throw new Error('manifestFiles entries must include a non-empty path.')
      }
      if (!file.action || !this.isValidAction(file.action)) {
        throw new Error('manifestFiles entries must include a valid action (CREATE, MODIFY, DELETE).')
      }
      if (file.reason !== undefined && String(file.reason).trim() === '') {
        throw new Error('manifestFiles entries must not include empty reason values.')
      }
    }

    return files
  }

  private isValidAction(action: string): action is ManifestFile['action'] {
    return action === 'CREATE' || action === 'MODIFY' || action === 'DELETE'
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  }

  /**
   * T153: Determine if contract should be generated for this task.
   * Contract is generated when:
   * - shouldGenerateContract flag is explicitly true, OR
   * - clauses exist and shouldGenerateContract is not explicitly false
   */
  private shouldGenerateContract(state: ElicitationState): boolean {
    // Explicit decision takes precedence
    if (state.shouldGenerateContract === false) {
      return false
    }

    // Generate if clauses exist
    return Array.isArray(state.clauses) && state.clauses.length > 0
  }

  /**
   * T152: Generate Contract from ElicitationState.
   * T154: Use agent configuration for mode if not specified.
   */
  private generateContract(context: GeneratorContext): Contract {
    const state = context.state
    const clauses = state.clauses || []

    // Generate slug from name or outputId
    const slug = this.generateSlug(state, context.outputId)

    // Determine mode (T154: from state or default to STRICT)
    const mode = state.contractMode || 'STRICT'

    // Generate clause IDs if not present
    const finalizedClauses = clauses.map((clause, index) => ({
      ...clause,
      id: clause.id || this.generateClauseId(clause.kind, index + 1),
    }))

    // Build targetArtifacts from manifestFiles
    const targetArtifacts = (state.manifestFiles || []).map((f) => f.path)

    return {
      schemaVersion: '1.0.0',
      slug,
      title: state.contractTitle || state.name || `Contract for ${slug}`,
      mode,
      scope: state.contractScope,
      changeType: state.changeType || this.inferChangeType(state),
      targetArtifacts,
      owners: state.owners,
      criticality: state.criticality,
      clauses: finalizedClauses,
      createdAt: new Date().toISOString(),
      elicitorVersion: '1.0.0', // TODO: Get from package.json
    }
  }

  /**
   * Generate slug for contract from state.
   */
  private generateSlug(state: ElicitationState, fallback: string): string {
    const source = state.name || state._initialPrompt || fallback
    return this.toKebabCase(source.slice(0, 50))
  }

  /**
   * Generate clause ID following format: CL-<TYPE>-<SEQUENCE>
   */
  private generateClauseId(kind: string, sequence: number): string {
    const type = kind.toUpperCase().replace(/-/g, '_')
    const seq = String(sequence).padStart(3, '0')
    return `CL-${type}-${seq}`
  }

  /**
   * Infer changeType from task metadata.
   */
  private inferChangeType(state: ElicitationState): 'new' | 'modify' | 'bugfix' | 'refactor' {
    const prompt = state._initialPrompt?.toLowerCase() || ''

    if (prompt.includes('fix') || prompt.includes('bug')) {
      return 'bugfix'
    }

    if (prompt.includes('refactor') || prompt.includes('restructure')) {
      return 'refactor'
    }

    if (prompt.includes('modify') || prompt.includes('update') || prompt.includes('change')) {
      return 'modify'
    }

    return 'new'
  }
}
