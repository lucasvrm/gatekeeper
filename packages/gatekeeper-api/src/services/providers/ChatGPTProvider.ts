/**
 * ChatGPTProvider — Simple wrapper for OpenAI Chat API
 *
 * Simplified provider for direct chat interactions without the complexity
 * of the full LLMProvider interface. Ideal for simple chat use cases that
 * don't require tool calling or multi-turn conversation management.
 *
 * Key characteristics:
 *  - Lightweight: single method `sendMessage(prompt) → Promise<string>`
 *  - Model: hardcoded to `gpt-5.2` (configurable internally only)
 *  - API Key: reads from `OPENAI_API_KEY` environment variable or constructor
 *  - No tools: text-only responses
 *  - Isolated: independent from agent system and LLMProvider interface
 */

import OpenAI from 'openai'

export class ChatGPTProvider {
  private client: OpenAI
  #model: string = 'gpt-5.2'

  /**
   * Create a new ChatGPTProvider instance.
   *
   * @param apiKey - Optional API key. If not provided, reads from OPENAI_API_KEY env var.
   * @throws {Error} If no API key is available from either source.
   */
  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY
    if (!key) {
      throw new Error('OPENAI_API_KEY not found in environment')
    }
    this.client = new OpenAI({ apiKey: key })
  }

  /**
   * Send a message to ChatGPT and get a text response.
   *
   * @param prompt - The text prompt to send to the model
   * @returns The model's text response
   * @throws {Error} If the API call fails
   */
  async sendMessage(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.#model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // Handle edge cases in response
      const choice = response.choices?.[0]
      if (!choice) {
        return ''
      }

      const content = choice.message?.content
      return content ?? ''
    } catch (error) {
      // Propagate errors with descriptive messages
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Unknown error occurred while calling OpenAI API')
    }
  }
}
