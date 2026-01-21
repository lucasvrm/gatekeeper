import { z } from 'zod'

export const ManifestFileSchema = z.object({
  path: z.string().min(1),
  action: z.enum(['CREATE', 'MODIFY', 'DELETE']),
  reason: z.string().optional(),
})

export const ManifestSchema = z.object({
  files: z.array(ManifestFileSchema).min(1),
  testFile: z.string().min(1),
})

export const ContractClauseSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['behavior', 'error', 'invariant', 'ui']),
  normativity: z.enum(['MUST', 'SHOULD', 'MAY']),
  when: z.string().min(1),
  then: z.string().min(1),
})

export const AssertionSurfaceHttpSchema = z.object({
  methods: z.array(z.string()).optional(),
  successStatuses: z.array(z.number().int()).optional(),
  errorStatuses: z.array(z.number().int()).optional(),
  payloadPaths: z.array(z.string()).optional(),
})

export const AssertionSurfaceUiSchema = z.object({
  routes: z.array(z.string()).optional(),
  testIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  ariaLabels: z.array(z.string()).optional(),
})

export const AssertionSurfaceSchema = z.object({
  http: AssertionSurfaceHttpSchema.optional(),
  ui: AssertionSurfaceUiSchema.optional(),
  effects: z.array(z.string().min(1)).optional(),
})

export const TestMappingSchema = z
  .object({
    tagPattern: z.string().min(1).default('// @clause'),
  })
  .partial()

export const ContractSchema = z.object({
  schemaVersion: z.string().min(1).default('1.0'),
  slug: z.string().min(1),
  title: z.string().min(1),
  mode: z.string().min(1).default('STRICT'),
  changeType: z.string().min(1),
  criticality: z.string().min(1).optional(),
  clauses: z.array(ContractClauseSchema).min(1),
  assertionSurface: AssertionSurfaceSchema.optional(),
  testMapping: TestMappingSchema.optional(),
})

export const CreateRunSchema = z.object({
  projectId: z.string().optional(),
  outputId: z.string().min(1),
  projectPath: z.string().min(1).optional(),
  taskPrompt: z.string().min(10),
  manifest: ManifestSchema,
  contract: ContractSchema.optional(),
  baseRef: z.string().default('origin/main'),
  targetRef: z.string().default('HEAD'),
  dangerMode: z.boolean().default(false),
  runType: z.enum(['CONTRACT', 'EXECUTION']).default('CONTRACT'),
  contractRunId: z.string().optional(),
})

export type CreateRunInput = z.infer<typeof CreateRunSchema>
