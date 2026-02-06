/**
 * Cliente HTTP + SSE para testes E2E
 */

// EventSource polyfill for Node.js
import { EventSource } from 'eventsource'

export interface SSEConnection {
  source: EventSource
  close: () => void
  addEventListener: (event: string, handler: EventListener) => void
}

export class TestClient {
  private sseConnections: EventSource[] = []

  constructor(private baseUrl: string) {}

  /**
   * POST request
   */
  async post(path: string, body: any): Promise<any> {
    const url = `${this.baseUrl}${path}`
    console.log(`[TestClient] POST ${url}`)
    console.log(`[TestClient] Body:`, JSON.stringify(body))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25s timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log(`[TestClient] Response status: ${res.status}`)

      if (!res.ok) {
        const text = await res.text()
        console.error(`[TestClient] Error response:`, text)
        throw new Error(`POST ${path} failed: ${res.status} ${text}`)
      }

      const json = await res.json()
      console.log(`[TestClient] Response JSON:`, json)
      return json
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`POST ${path} timeout after 25s`)
      }
      throw error
    }
  }

  /**
   * GET request
   */
  async get(path: string): Promise<any> {
    const url = `${this.baseUrl}${path}`
    console.log(`[TestClient] GET ${url}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      console.log(`[TestClient] Response status: ${res.status}`)

      if (!res.ok) {
        const text = await res.text()
        console.error(`[TestClient] Error response:`, text)
        throw new Error(`GET ${path} failed: ${res.status} ${text}`)
      }

      const json = await res.json()
      return json
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GET ${path} timeout after 25s`)
      }
      throw error
    }
  }

  /**
   * Conecta a endpoint SSE
   */
  connectSSE(
    path: string,
    opts?: {
      lastEventId?: string
      onMessage?: (event: MessageEvent) => void
      onError?: (error: Event) => void
    }
  ): SSEConnection {
    // EventSource não suporta headers customizados diretamente,
    // mas envia Last-Event-ID automaticamente se a URL incluir o parâmetro
    // ou se reconexão acontecer após desconexão (comportamento nativo do browser)
    let url = `${this.baseUrl}${path}`

    // Para simular Last-Event-ID em ambiente de teste, podemos usar query param
    if (opts?.lastEventId) {
      const separator = url.includes('?') ? '&' : '?'
      url += `${separator}lastEventId=${opts.lastEventId}`
    }

    const sse = new EventSource(url)

    if (opts?.onMessage) {
      sse.onmessage = opts.onMessage
    }

    if (opts?.onError) {
      sse.onerror = opts.onError
    }

    this.sseConnections.push(sse)

    return {
      source: sse,
      close: () => sse.close(),
      addEventListener: (event: string, handler: EventListener) =>
        sse.addEventListener(event, handler),
    }
  }

  /**
   * Fecha todas as conexões SSE abertas
   */
  closeAllSSE() {
    this.sseConnections.forEach((sse) => sse.close())
    this.sseConnections = []
  }

  /**
   * Aguarda até que um predicado seja satisfeito pelos logs SSE.
   *
   * IMPORTANTE: Este método adiciona um listener ADICIONAL em vez de sobrescrever
   * o handler existente, permitindo que múltiplos handlers coexistam.
   */
  async waitForEvent(
    connection: SSEConnection,
    predicate: (logs: any[]) => boolean,
    timeout = 30000
  ): Promise<void> {
    const logs: any[] = []

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`waitForEvent timeout after ${timeout}ms`))
      }, timeout)

      // Cria handler que NÃO sobrescreve o existente
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          logs.push(data)

          if (predicate(logs)) {
            clearTimeout(timer)
            connection.source.removeEventListener('message', handler)
            resolve()
          }
        } catch (error) {
          console.error('[TestClient] Parse error:', error)
        }
      }

      // Adiciona como listener adicional (não sobrescreve onmessage)
      connection.source.addEventListener('message', handler)

      const errorHandler = () => {
        clearTimeout(timer)
        connection.source.removeEventListener('message', handler)
        reject(new Error('SSE connection error'))
      }

      connection.source.addEventListener('error', errorHandler, { once: true })
    })
  }

  /**
   * Polling até que condição seja satisfeita
   */
  async pollUntil<T>(
    fn: () => Promise<T>,
    predicate: (result: T) => boolean,
    timeout = 30000,
    interval = 500
  ): Promise<T> {
    const start = Date.now()

    while (Date.now() - start < timeout) {
      const result = await fn()
      if (predicate(result)) {
        return result
      }
      await new Promise((r) => setTimeout(r, interval))
    }

    throw new Error(`pollUntil timeout after ${timeout}ms`)
  }

  /**
   * Aguarda um tempo fixo
   */
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
