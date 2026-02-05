/**
 * ChatGPTController — Example controller demonstrating ChatGPTProvider usage
 *
 * This controller serves as a reference implementation showing how to:
 *  - Inject ChatGPTProvider via dependency injection
 *  - Validate input using Zod schemas
 *  - Handle API responses and errors
 *  - Return JSON responses in a consistent format
 *
 * Endpoint: POST /api/chatgpt/send
 * Body: { prompt: string }
 * Response 200: { response: string }
 * Response 400: { error: string } (validation error)
 * Response 500: { error: string } (API error)
 */

import type { Request, Response } from 'express'
import { z } from 'zod'
import { ChatGPTProvider } from '../../services/providers/ChatGPTProvider.js'

/**
 * Zod schema for validating sendMessage endpoint input.
 * @clause CL-CTRL-001
 */
const SendMessageSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty'),
})

/**
 * ChatGPTController demonstrates dependency injection pattern with ChatGPTProvider.
 */
export class ChatGPTController {
  /**
   * Create a new controller with an injected ChatGPTProvider instance.
   *
   * @param provider - The ChatGPTProvider instance to use for LLM calls
   */
  constructor(private provider: ChatGPTProvider) {}

  /**
   * Handle POST /api/chatgpt/send requests.
   *
   * @clause CL-CTRL-001 — Controller injeta provider e retorna resposta do LLM
   * @clause CL-CTRL-002 — Retorna JSON com campo 'response'
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const parseResult = SendMessageSchema.safeParse(req.body)

      if (!parseResult.success) {
        res.status(400).json({
          error: parseResult.error.errors[0]?.message ?? 'Invalid input',
        })
        return
      }

      const { prompt } = parseResult.data

      // Call provider
      const response = await this.provider.sendMessage(prompt)

      // Return formatted response
      // @clause CL-CTRL-002
      res.status(200).json({ response })
    } catch (error) {
      // Handle API errors
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      res.status(500).json({ error: message })
    }
  }
}
