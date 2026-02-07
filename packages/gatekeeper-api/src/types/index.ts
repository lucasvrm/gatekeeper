export * from './gates.types.js'

// ─── Orchestrator Log Filtering ──────────────────────────────────────────────

/**
 * Opções de filtro para logs do orquestrador.
 * Usado para filtrar eventos persistidos no banco de dados.
 */
export interface LogFilterOptions {
  /** Filtrar por nível do log (error, warn, info, debug) */
  level?: 'error' | 'warn' | 'info' | 'debug'

  /** Filtrar por estágio da pipeline (planning, spec, fix, execute, etc) */
  stage?: string

  /** Filtrar por tipo de evento (agent:tool_call, agent:error, etc) */
  type?: string

  /** Busca textual na mensagem do log (case-insensitive) */
  search?: string

  /** Data/hora inicial para filtro de range (ISO string) */
  startDate?: string

  /** Data/hora final para filtro de range (ISO string) */
  endDate?: string
}

/**
 * Métricas agregadas de logs do orquestrador.
 * Geradas a partir dos eventos em buffer in-memory.
 */
export interface LogMetrics {
  /** ID da pipeline */
  pipelineId: string

  /** Número total de eventos */
  totalEvents: number

  /** Contagem de eventos por nível (error, warning, info) */
  byLevel: Record<string, number>

  /** Contagem de eventos por fase (planning, spec, fix, execute) */
  byStage: Record<string, number>

  /** Contagem de eventos por tipo (agent:start, agent:error, etc) */
  byType: Record<string, number>

  /** Duração da execução */
  duration: {
    /** Duração em milissegundos */
    ms: number
    /** Duração formatada (HH:mm:ss) */
    formatted: string
  }

  /** Timestamp do primeiro evento (ISO string) */
  firstEvent: string | null

  /** Timestamp do último evento (ISO string) */
  lastEvent: string | null
}
