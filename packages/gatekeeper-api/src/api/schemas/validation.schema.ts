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
 * Contract clause schema following T020 decision.
 * ID format: CL-<TYPE>-<SEQUENCE> (e.g., CL-ENDPOINT-001)
 */
export const ContractClauseSchema = z.object({
  id: z.string().regex(/^CL-[A-Z_]+-\d{3,}$/, 'Clause ID must follow format: CL-<TYPE>-<SEQUENCE>'),
  description: z.string().min(1),
  type: z.enum(['ENDPOINT', 'UI', 'BUSINESS_LOGIC', 'ERROR_HANDLING', 'INTEGRATION', 'SIDE_EFFECT', 'STRUCTURE', 'OTHER']).optional(),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Contract schema following T014-T019 decisions.
 * Optional field - validators SKIP if absent (T015)
 */
export const ContractSchema = z.object({
  mode: z.enum(['STRICT', 'CREATIVE']),
  clauses: z.array(ContractClauseSchema).min(1),
  version: z.string().optional(),
  metadata: z.object({
    generatedBy: z.string().optional(),
    generatedAt: z.string().optional(),
    taskType: z.string().optional(),
  }).optional(),
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
