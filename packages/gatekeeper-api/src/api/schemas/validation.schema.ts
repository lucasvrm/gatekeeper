import { z } from 'zod'
import { DEFAULT_GIT_REFS, DEFAULT_RUN_CONFIG } from '../../config/defaults.js'

export const ManifestFileSchema = z.object({
  path: z.string().min(1),
  action: z.enum(['CREATE', 'MODIFY', 'DELETE']),
  reason: z.string().optional(),
})

export const ManifestSchema = z.object({
  files: z.array(ManifestFileSchema).min(1),
  testFile: z.string().min(1),
})

/**
 * Contract clause schema following RULES.md specification (T041-T052).
 * ID format: CL-<TYPE>-<SEQUENCE> (e.g., CL-AUTH-001)
 */
export const ContractClauseSchema = z.object({
  id: z.string().regex(/^CL-[A-Z_]+-\d{3,}$/, 'Clause ID must follow format: CL-<TYPE>-<SEQUENCE>'),
  kind: z.enum(['behavior', 'error', 'invariant', 'constraint', 'security', 'ui']),
  normativity: z.enum(['MUST', 'SHOULD', 'MAY']),
  title: z.string().min(1).max(80),
  spec: z.string().min(1),
  observables: z.array(z.enum(['http', 'ui', 'db-effect', 'event', 'file', 'log'])).min(1),
  when: z.array(z.string()).optional(),
  inputs: z.record(z.string()).optional(),
  outputs: z.record(z.string()).optional(),
  negativeCases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

/**
 * Contract schema following RULES.md specification (T031-T040).
 * Optional field - validators SKIP if absent (T015)
 */
export const ContractSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'schemaVersion must be semantic version (e.g., "1.0.0")'),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case').max(64),
  title: z.string().min(1).max(120),
  mode: z.enum(['STRICT', 'CREATIVE']),
  scope: z.enum(['internal', 'external', 'mixed']).optional(),
  changeType: z.enum(['new', 'modify', 'bugfix', 'refactor']),
  targetArtifacts: z.array(z.string()).min(1),
  owners: z.array(z.string()).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  clauses: z.array(ContractClauseSchema).min(1),
  createdAt: z.string().optional(),
  elicitorVersion: z.string().optional(),
  inputsHash: z.string().optional(),
})

export const CreateRunSchema = z.object({
  outputId: z.string().min(1),
  projectPath: z.string().min(1),
  taskPrompt: z.string().min(10),
  manifest: ManifestSchema,
  testFilePath: z.string().min(1),
  baseRef: z.string().default(DEFAULT_GIT_REFS.BASE_REF),
  targetRef: z.string().default(DEFAULT_GIT_REFS.TARGET_REF),
  dangerMode: z.boolean().default(DEFAULT_RUN_CONFIG.DANGER_MODE),
  runType: z.enum(['CONTRACT', 'EXECUTION']).default(DEFAULT_RUN_CONFIG.RUN_TYPE),
  contractRunId: z.string().optional(),
  testFileContent: z.string().optional(),
  contract: ContractSchema.optional(), // T014: Optional field for backward compatibility
})

export type CreateRunInput = z.infer<typeof CreateRunSchema>
