import { z } from 'zod'

// ─── Size Constraints ─────────────────────────────────────────────────────────
// Coincide com MAX_PAYLOAD_SIZE do OrchestratorEventService
const MAX_TEXT_LENGTH = 10240 // 10KB
const MAX_TASK_LENGTH = 10000
const MAX_PATH_LENGTH = 1000
const MAX_REF_LENGTH = 500
const MAX_TYPE_LENGTH = 100

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const GeneratePlanSchema = z.object({
  taskDescription: z
    .string()
    .min(10, 'taskDescription deve ter pelo menos 10 caracteres')
    .max(MAX_TASK_LENGTH, `taskDescription não pode exceder ${MAX_TASK_LENGTH} caracteres`),
  taskType: z.enum(['feature', 'bugfix', 'refactor']).optional(),
  profileId: z.string().max(MAX_REF_LENGTH).optional(),
  model: z.string().max(MAX_TYPE_LENGTH).optional(),
})

export const GenerateSpecSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório').max(MAX_REF_LENGTH),
  profileId: z.string().max(MAX_REF_LENGTH).optional(),
  model: z.string().max(MAX_TYPE_LENGTH).optional(),
})

export const FixArtifactsSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório').max(MAX_REF_LENGTH),
  target: z.enum(['plan', 'spec']),
  runId: z.string().max(MAX_REF_LENGTH).optional(), // Optional when fixing schema errors
  failedValidators: z
    .array(z.string().min(1).max(MAX_TYPE_LENGTH))
    .min(1, 'failedValidators deve ter pelo menos 1 item'),
  rejectionReport: z.string().max(MAX_TEXT_LENGTH).optional(), // For schema errors without runId
  profileId: z.string().max(MAX_REF_LENGTH).optional(),
  model: z.string().max(MAX_TYPE_LENGTH).optional(),
  provider: z.string().max(MAX_TYPE_LENGTH).optional(),
  projectPath: z.string().max(MAX_PATH_LENGTH).optional(),
  taskPrompt: z.string().max(MAX_TASK_LENGTH).optional(),
  customInstructions: z.string().max(MAX_TEXT_LENGTH).optional(),
})

export const ExecuteSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório').max(MAX_REF_LENGTH),
  projectPath: z.string().min(1, 'projectPath é obrigatório').max(MAX_PATH_LENGTH),
  model: z.string().max(MAX_TYPE_LENGTH).optional(),
})

export const StatusParamsSchema = z.object({
  outputId: z.string().min(1, 'outputId é obrigatório').max(MAX_REF_LENGTH),
})

export const EventsQuerySchema = z.object({
  sinceId: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const RunPipelineSchema = z.object({
  projectId: z.string().min(1, 'projectId é obrigatório').max(MAX_REF_LENGTH),
  task: z
    .string()
    .min(10, 'task deve ter pelo menos 10 caracteres')
    .max(MAX_TASK_LENGTH, `task não pode exceder ${MAX_TASK_LENGTH} caracteres`),
  phases: z.array(z.enum(['PLANNING', 'WRITING', 'VALIDATION'])).min(1),
  provider: z.string().max(MAX_TYPE_LENGTH).optional(),
  model: z.string().max(MAX_TYPE_LENGTH).optional(),
})

export type GeneratePlanInput = z.infer<typeof GeneratePlanSchema>
export type GenerateSpecInput = z.infer<typeof GenerateSpecSchema>
export type FixArtifactsInput = z.infer<typeof FixArtifactsSchema>
export type ExecuteInput = z.infer<typeof ExecuteSchema>
export type RunPipelineInput = z.infer<typeof RunPipelineSchema>
