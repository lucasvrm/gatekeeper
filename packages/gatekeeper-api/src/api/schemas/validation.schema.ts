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
  projectPath: z.string().min(1),
  taskPrompt: z.string().min(10),
  manifest: ManifestSchema.optional(),
  testFilePath: z.string().optional(),
  baseRef: z.string().default('HEAD~1'),
  targetRef: z.string().default('HEAD'),
  dangerMode: z.boolean().default(false),
})

export type CreateRunInput = z.infer<typeof CreateRunSchema>
