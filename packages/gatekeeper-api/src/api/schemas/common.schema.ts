import { z } from 'zod'

export const IdParamSchema = z.object({
  id: z.string(),
})

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})
