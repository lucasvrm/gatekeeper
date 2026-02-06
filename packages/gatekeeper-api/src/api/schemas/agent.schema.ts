import { z } from 'zod'

// ─── Provider string (dynamic — validated against DB at runtime) ──────────

const ProviderString = z.string().min(1)

// ─── AgentPhaseConfig CRUD ─────────────────────────────────────────────────

export const CreatePhaseConfigSchema = z.object({
  step: z.number().int().min(1).max(4),
  provider: ProviderString.default('claude-code'),
  model: z.string().min(1),
  maxTokens: z.number().int().min(256).max(65536).default(8192),
  maxIterations: z.number().int().min(1).max(100).default(30),
  maxInputTokensBudget: z.number().int().min(0).default(0),
  temperature: z.number().min(0).max(2).optional(),
  fallbackProvider: ProviderString.optional(),
  fallbackModel: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const UpdatePhaseConfigSchema = z.object({
  provider: ProviderString.optional(),
  model: z.string().min(1).optional(),
  maxTokens: z.number().int().min(256).max(65536).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  maxInputTokensBudget: z.number().int().min(0).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  fallbackProvider: ProviderString.nullable().optional(),
  fallbackModel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── PromptInstruction Pipeline Content CRUD ────────────────────────────────

export const CreateContentSchema = z.object({
  step: z.number().int().min(0).max(4),
  kind: z.enum(['instruction', 'doc', 'prompt']),
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

export const UpdateContentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

// ─── Agent Runner ──────────────────────────────────────────────────────────

export const RunAgentSchema = z.object({
  taskDescription: z.string().min(10, 'taskDescription deve ter pelo menos 10 caracteres'),
  projectPath: z.string().min(1, 'projectPath é obrigatório'),
  // Override provider/model per-phase (optional)
  overrides: z.record(
    z.string(), // step as string key: "1", "2", "4"
    z.object({
      provider: ProviderString.optional(),
      model: z.string().optional(),
    }),
  ).optional(),
})

export const RunSinglePhaseSchema = z.object({
  step: z.number().int().refine((v) => [1, 2, 3, 4].includes(v), {
    message: 'step deve ser 1, 2, 3 ou 4',
  }),
  taskDescription: z.string().min(10),
  projectPath: z.string().min(1),
  provider: ProviderString.optional(),
  model: z.string().optional(),
})

// ─── ProviderModel CRUD ───────────────────────────────────────────────────

export const CreateProviderModelSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  label: z.string().optional(),
})

export const UpdateProviderModelSchema = z.object({
  label: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const DiscoverModelsSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'mistral']),
})

// ─── Provider CRUD ────────────────────────────────────────────────────────

export const CreateProviderSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'name must be a lowercase slug (a-z, 0-9, hyphens)'),
  label: z.string().min(1).max(100),
  authType: z.enum(['api_key', 'cli']).default('api_key'),
  envVarName: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  note: z.string().max(500).nullable().optional(),
})

export const UpdateProviderSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  authType: z.enum(['api_key', 'cli']).optional(),
  envVarName: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  note: z.string().max(500).nullable().optional(),
})

// ─── Types ─────────────────────────────────────────────────────────────────

export type CreatePhaseConfigInput = z.infer<typeof CreatePhaseConfigSchema>
export type UpdatePhaseConfigInput = z.infer<typeof UpdatePhaseConfigSchema>
export type CreateContentInput = z.infer<typeof CreateContentSchema>
export type UpdateContentInput = z.infer<typeof UpdateContentSchema>
export type RunAgentInput = z.infer<typeof RunAgentSchema>
export type RunSinglePhaseInput = z.infer<typeof RunSinglePhaseSchema>
export type CreateProviderModelInput = z.infer<typeof CreateProviderModelSchema>
export type UpdateProviderModelInput = z.infer<typeof UpdateProviderModelSchema>
export type DiscoverModelsInput = z.infer<typeof DiscoverModelsSchema>
export type CreateProviderInput = z.infer<typeof CreateProviderSchema>
export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>
