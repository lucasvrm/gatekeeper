import { encoding_for_model } from 'tiktoken'
import type { TokenCounterService as ITokenCounterService } from '../types/index.js'

export class TokenCounterService implements ITokenCounterService {
  private encoder

  constructor() {
    this.encoder = encoding_for_model('gpt-4')
  }

  count(text: string): number {
    const tokens = this.encoder.encode(text)
    return tokens.length
  }
}
