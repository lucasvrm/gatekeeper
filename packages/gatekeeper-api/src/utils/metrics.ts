/**
 * Helpers de agregação de métricas para logs do orquestrador.
 */

/**
 * Agrupa e conta itens por um campo específico.
 *
 * @param items - Array de objetos a serem contados
 * @param field - Campo a ser usado para agrupamento
 * @returns Record com contagens por valor do campo
 *
 * @example
 * ```ts
 * const events = [
 *   { level: 'info', stage: 'planning' },
 *   { level: 'error', stage: 'planning' },
 *   { level: 'info', stage: 'execute' }
 * ]
 *
 * countByField(events, 'level')
 * // => { info: 2, error: 1 }
 *
 * countByField(events, 'stage')
 * // => { planning: 2, execute: 1 }
 * ```
 */
export function countByField<T extends Record<string, any>>(
  items: T[],
  field: keyof T
): Record<string, number> {
  if (!items || items.length === 0) {
    return {}
  }

  const counts: Record<string, number> = {}

  for (const item of items) {
    const value = item[field]

    // Skip se o valor for undefined/null
    if (value === undefined || value === null) {
      continue
    }

    const key = String(value)
    counts[key] = (counts[key] || 0) + 1
  }

  return counts
}

/**
 * Calcula a duração entre o primeiro e último evento.
 *
 * @param events - Array de eventos com timestamps
 * @returns Objeto com duração em milissegundos e formatada (HH:mm:ss)
 *
 * @example
 * ```ts
 * const events = [
 *   { createdAt: new Date('2026-01-01T10:00:00Z') },
 *   { createdAt: new Date('2026-01-01T10:05:30Z') }
 * ]
 *
 * calculateDuration(events)
 * // => { ms: 330000, formatted: '00:05:30' }
 * ```
 */
export function calculateDuration(
  events: Array<{ createdAt: Date | string } | { timestamp: Date | string }>
): { ms: number; formatted: string } {
  if (!events || events.length === 0) {
    return { ms: 0, formatted: '00:00:00' }
  }

  // Suporta tanto createdAt quanto timestamp
  const timestamps = events.map((e) => {
    const ts = 'createdAt' in e ? e.createdAt : 'timestamp' in e ? e.timestamp : null

    if (!ts) {
      return null
    }

    return typeof ts === 'string' ? new Date(ts) : ts
  }).filter((t): t is Date => t !== null)

  if (timestamps.length === 0) {
    return { ms: 0, formatted: '00:00:00' }
  }

  // Apenas um evento: duração = 0
  if (timestamps.length === 1) {
    return { ms: 0, formatted: '00:00:00' }
  }

  // Ordenar por timestamp (crescente)
  const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime())

  const firstTime = sorted[0].getTime()
  const lastTime = sorted[sorted.length - 1].getTime()

  const ms = lastTime - firstTime

  return {
    ms,
    formatted: formatDuration(ms),
  }
}

/**
 * Formata duração em milissegundos para formato HH:mm:ss.
 *
 * @param ms - Duração em milissegundos
 * @returns String formatada (HH:mm:ss)
 *
 * @example
 * ```ts
 * formatDuration(330000)  // => '00:05:30'
 * formatDuration(3661000) // => '01:01:01'
 * formatDuration(500)     // => '00:00:00'
 * ```
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
