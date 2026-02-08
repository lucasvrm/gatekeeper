/**
 * ResilientEventSource - EventSource with automatic reconnection
 *
 * Features:
 *   - Exponential backoff on reconnection (1s -> 30s max)
 *   - Max retries limit (default: 10)
 *   - Watchdog timer to detect silent connection death
 *   - Tracks Last-Event-Id for seamless replay
 *
 * Usage:
 *   const source = new ResilientEventSource(url, {
 *     onMessage: (event) => console.log(event.data),
 *     onError: (err) => console.error(err),
 *   })
 *   source.connect()
 *   // later...
 *   source.close()
 */

export interface ResilientEventSourceOptions {
  /** Callback when a message is received */
  onMessage: (event: MessageEvent) => void
  /** Callback when an error occurs (optional) */
  onError?: (error: Event) => void
  /** Callback when connection opens (optional) */
  onOpen?: () => void
  /** Callback when connection state changes (optional) */
  onStateChange?: (state: 'connecting' | 'open' | 'closed' | 'reconnecting') => void
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelay?: number
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelay?: number
  /** Retry delay multiplier (default: 2) */
  retryMultiplier?: number
  /** Maximum number of retries (default: 10, 0 = unlimited) */
  maxRetries?: number
  /** Watchdog timeout - reconnect if no data for this long (default: 30000ms) */
  watchdogTimeout?: number
}

export class ResilientEventSource {
  private url: string
  private options: Required<ResilientEventSourceOptions>
  private eventSource: EventSource | null = null
  private retryCount = 0
  private retryDelay: number
  private lastEventId: string | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private state: 'connecting' | 'open' | 'closed' | 'reconnecting' = 'closed'

  constructor(url: string, options: ResilientEventSourceOptions) {
    this.url = url
    this.options = {
      onMessage: options.onMessage,
      onError: options.onError || (() => {}),
      onOpen: options.onOpen || (() => {}),
      onStateChange: options.onStateChange || (() => {}),
      initialRetryDelay: options.initialRetryDelay ?? 1000,
      maxRetryDelay: options.maxRetryDelay ?? 30000,
      retryMultiplier: options.retryMultiplier ?? 2,
      maxRetries: options.maxRetries ?? 10,
      watchdogTimeout: options.watchdogTimeout ?? 30000,
    }
    this.retryDelay = this.options.initialRetryDelay
  }

  /** Start the connection */
  connect(): void {
    if (this.closed) return
    this.doConnect()
  }

  private doConnect(): void {
    if (this.closed) return

    this.setState('connecting')

    // Build URL with lastEventId if available (fallback for browsers that don't send header)
    let connectUrl = this.url
    if (this.lastEventId) {
      const separator = this.url.includes('?') ? '&' : '?'
      connectUrl = `${this.url}${separator}lastEventId=${encodeURIComponent(this.lastEventId)}`
    }

    this.eventSource = new EventSource(connectUrl)

    this.eventSource.onopen = () => {
      console.log('[ResilientEventSource] Connection opened')
      this.setState('open')
      this.retryCount = 0
      this.retryDelay = this.options.initialRetryDelay
      this.resetWatchdog()
      this.options.onOpen()
    }

    this.eventSource.onmessage = (event: MessageEvent) => {
      // Track lastEventId for reconnection
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId
      }
      this.resetWatchdog()
      this.options.onMessage(event)
    }

    this.eventSource.onerror = (error: Event) => {
      console.error('[ResilientEventSource] Connection error:', error)
      this.options.onError(error)

      // EventSource auto-reconnects, but we want more control
      this.eventSource?.close()
      this.eventSource = null

      if (!this.closed) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return

    // Check max retries
    if (this.options.maxRetries > 0 && this.retryCount >= this.options.maxRetries) {
      console.error('[ResilientEventSource] Max retries reached, giving up')
      this.setState('closed')
      return
    }

    this.setState('reconnecting')
    this.retryCount++

    console.log(
      `[ResilientEventSource] Reconnecting in ${this.retryDelay}ms (attempt ${this.retryCount}/${this.options.maxRetries || '∞'})`
    )

    this.retryTimer = setTimeout(() => {
      this.doConnect()
    }, this.retryDelay)

    // Exponential backoff
    this.retryDelay = Math.min(
      this.retryDelay * this.options.retryMultiplier,
      this.options.maxRetryDelay
    )
  }

  private resetWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
    }

    this.watchdogTimer = setTimeout(() => {
      console.warn('[ResilientEventSource] Watchdog timeout - no data received, reconnecting')
      this.eventSource?.close()
      this.eventSource = null
      this.scheduleReconnect()
    }, this.options.watchdogTimeout)
  }

  private setState(state: 'connecting' | 'open' | 'closed' | 'reconnecting'): void {
    if (this.state !== state) {
      this.state = state
      this.options.onStateChange(state)
    }
  }

  /** Get current connection state */
  getState(): 'connecting' | 'open' | 'closed' | 'reconnecting' {
    return this.state
  }

  /** Get current retry count */
  getRetryCount(): number {
    return this.retryCount
  }

  /** Get last event ID received */
  getLastEventId(): string | null {
    return this.lastEventId
  }

  /** Close the connection and stop all timers */
  close(): void {
    this.closed = true
    this.setState('closed')

    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    console.log('[ResilientEventSource] Closed')
  }
}
