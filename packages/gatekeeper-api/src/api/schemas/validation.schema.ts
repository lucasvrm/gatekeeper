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

export const CreateRunSchema = z.object({
  outputId: z.string().min(1),
  projectPath: z.string().min(1),
  taskPrompt: z.string().min(10),
  manifest: ManifestSchema,
  testFilePath: z.string().min(1),
  baseRef: z.string().default('origin/main'),
  targetRef: z.string().default('HEAD'),
  dangerMode: z.boolean().default(false),
  runType: z.enum(['CONTRACT', 'EXECUTION']).default('CONTRACT'),
  contractRunId: z.string().optional(),
  testFileContent: z.string().optional(),
})

export type CreateRunInput = z.infer<typeof CreateRunSchema>
