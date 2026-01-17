import { GoogleGenerativeAI, type Content } from '@google/generative-ai'

import { BaseLLMAdapter } from './BaseLLMAdapter.js'
import { ModelInfo } from './ILLMAdapter.js'
import { ChatMessage, LLMProvider, LLMResponse, MessageRole } from '../types/elicitor.types.js'

export class GoogleAdapter extends BaseLLMAdapter {
  readonly provider = LLMProvider.GOOGLE
  private client: GoogleGenerativeAI | null = null

  private static readonly MODEL_INFO: Record<string, { contextWindow: number }> = {
    'gemini-pro': { contextWindow: 32768 },
    'gemini-pro-vision': { contextWindow: 32768 },
    'gemini-1.5-pro': { contextWindow: 1000000 },
  }

  protected async doInitialize(): Promise<void> {
    const apiKey = this.getApiKey()
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<LLMResponse> {
    this.ensureInitialized()
    if (!this.client || !this.config) {
      throw new Error('Not initialized')
    }

    const startTime = Date.now()
    const model = this.client.getGenerativeModel({
      model: this.config.model,
      systemInstruction: systemPrompt || undefined,
    })

    const history: Content[] = []
    let lastUserMessage = ''

    for (const message of messages) {
      if (message.role === MessageRole.USER) {
        lastUserMessage = message.content
        history.push({ role: 'user', parts: [{ text: message.content }] })
      } else if (message.role === MessageRole.ASSISTANT) {
        history.push({ role: 'model', parts: [{ text: message.content }] })
      }
    }

    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history.pop()
    }

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    })

    const result = await chat.sendMessage(lastUserMessage)
    const response = result.response
    const durationMs = Date.now() - startTime

    const tokensIn = Math.ceil(lastUserMessage.length / 4)
    const tokensOut = Math.ceil(response.text().length / 4)

    return {
      content: response.text(),
      tokensIn,
      tokensOut,
      durationMs,
      finishReason: 'stop',
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const apiKey = this.getApiKey()
      const testClient = new GoogleGenerativeAI(apiKey)
      const model = testClient.getGenerativeModel({ model: 'gemini-pro' })
      await model.generateContent('test')
      return true
    } catch {
      return false
    }
  }

  getModelInfo(): ModelInfo {
    if (!this.config) {
      throw new Error('Not initialized')
    }

    const modelData = GoogleAdapter.MODEL_INFO[this.config.model] || { contextWindow: 32768 }

    return {
      provider: this.provider,
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      contextWindow: modelData.contextWindow,
      supportsStreaming: true,
      supportsTools: true,
    }
  }
}
