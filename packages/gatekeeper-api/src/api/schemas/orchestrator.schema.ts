import { z } from 'zod'

export const GeneratePlanSchema = z.object({
  taskDescription: z.string().min(10, 'taskDescription deve ter pelo menos 10 caracteres'),
  taskType: z.enum(['feature', 'bugfix', 'refactor']).optional(),
  profileId: z.string().optional(),
  model: z.string().optional(),
})

export const GenerateSpecSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório'),
  profileId: z.string().optional(),
  model: z.string().optional(),
})

export const FixArtifactsSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório'),
  target: z.enum(['plan', 'spec']),
  runId: z.string().optional(), // Optional when fixing schema errors
  failedValidators: z.array(z.string().min(1)).min(1, 'failedValidators deve ter pelo menos 1 item'),
  rejectionReport: z.string().optional(), // For schema errors without runId
  profileId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  projectPath: z.string().optional(),
  taskPrompt: z.string().optional(),
  customInstructions: z.string().optional(),
})

export const ExecuteSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório'),
  projectPath: z.string().min(1, 'projectPath é obrigatório'),
  model: z.string().optional(),
})

export const StatusParamsSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório'),
})

export const EventsQuerySchema = z.object({
  sinceId: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>
export type GenerateSpecInput = z.infer<typeof GenerateSpecSchema>
export type FixArtifactsInput = z.infer<typeof FixArtifactsSchema>
export type ExecuteInput = z.infer<typeof ExecuteSchema>
