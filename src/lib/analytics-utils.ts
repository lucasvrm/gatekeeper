import type { AgentRunSummary } from "./api"

export type Granularity = "day" | "week" | "month"

export interface TimeSeriesPoint {
  date: string
  count: number
  avgDuration: number
  errorCount: number
  successCount: number
}

export interface ProviderStats {
  provider: string
  avgCost: number
  avgDuration: number
  successRate: number
  totalRuns: number
}

export interface FilterOptions {
  status?: string
  phase?: string
  providers?: string[]
  models?: string[]
  searchQuery?: string
  startDate?: string
  endDate?: string
}

export interface TokenSeriesPoint {
  date: string
  inputTokens: number
  outputTokens: number
}

export interface TokenStats {
  totalInput: number
  totalOutput: number
  avgPerRun: number
}

/**
 * Agrupa runs por período (dia, semana, mês)
 */
export function groupRunsByDate(
  runs: AgentRunSummary[],
  granularity: Granularity
): TimeSeriesPoint[] {
  const groups = new Map<string, AgentRunSummary[]>()

  runs.forEach((run) => {
    const date = new Date(run.startedAt)
    let key: string

    switch (granularity) {
      case "day":
        key = date.toISOString().split("T")[0] // YYYY-MM-DD
        break
      case "week": {
        const year = date.getFullYear()
        const week = getWeekNumber(date)
        key = `${year}-W${week.toString().padStart(2, "0")}`
        break
      }
      case "month":
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
        break
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(run)
  })

  const result: TimeSeriesPoint[] = []

  groups.forEach((groupRuns, date) => {
    const errorCount = groupRuns.filter(
      (r) => r.status === "failed" || r.status === "error"
    ).length
    const successCount = groupRuns.filter((r) => r.status === "completed").length

    const durationsWithValue = groupRuns.filter((r) => r.durationMs !== null)
    const avgDuration =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
          durationsWithValue.length
        : 0

    result.push({
      date,
      count: groupRuns.length,
      avgDuration,
      errorCount,
      successCount,
    })
  })

  // Ordenar por data
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calcula métricas de trending (min/max/avg) para duração
 */
export function calculateTimeSeriesMetrics(runs: AgentRunSummary[]): TimeSeriesPoint[] {
  return groupRunsByDate(runs, "day")
}

/**
 * Agrega estatísticas por provider
 */
export function aggregateByProvider(runs: AgentRunSummary[]): ProviderStats[] {
  const groups = new Map<string, AgentRunSummary[]>()

  runs.forEach((run) => {
    if (!groups.has(run.provider)) {
      groups.set(run.provider, [])
    }
    groups.get(run.provider)!.push(run)
  })

  const result: ProviderStats[] = []

  groups.forEach((providerRuns, provider) => {
    const successCount = providerRuns.filter((r) => r.status === "completed").length
    const successRate = (successCount / providerRuns.length) * 100

    const costsWithValue = providerRuns.filter((r) => r.estimatedCostUsd !== null)
    const avgCost =
      costsWithValue.length > 0
        ? costsWithValue.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0) /
          costsWithValue.length
        : 0

    const durationsWithValue = providerRuns.filter((r) => r.durationMs !== null)
    const avgDuration =
      durationsWithValue.length > 0
        ? durationsWithValue.reduce((sum, r) => sum + (r.durationMs || 0), 0) /
          durationsWithValue.length
        : 0

    result.push({
      provider,
      avgCost,
      avgDuration,
      successRate,
      totalRuns: providerRuns.length,
    })
  })

  return result.sort((a, b) => b.totalRuns - a.totalRuns)
}

/**
 * Formata data para labels de charts
 */
export function formatDateForChart(dateStr: string, granularity: Granularity): string {
  if (granularity === "week") {
    // Format: "2024-W01" -> "Sem 01, 2024"
    const [year, weekPart] = dateStr.split("-W")
    return `Sem ${weekPart}, ${year}`
  }

  if (granularity === "month") {
    // Format: "2024-01" -> "Jan 2024"
    const [year, month] = dateStr.split("-")
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ]
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  // Day format: "2024-01-15" -> "15 Jan"
  const date = new Date(dateStr)
  const day = date.getDate()
  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ]
  const month = monthNames[date.getMonth()]
  return `${day} ${month}`
}

/**
 * Formata duração em formato legível
 */
export function formatDuration(ms: number | null): string {
  if (!ms) return "-"
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/**
 * Agrega tokens por data
 */
export function aggregateTokensByDate(
  runs: AgentRunSummary[],
  granularity: Granularity
): TokenSeriesPoint[] {
  const groups = new Map<string, AgentRunSummary[]>()

  runs.forEach((run) => {
    const date = new Date(run.startedAt)
    let key: string

    switch (granularity) {
      case "day":
        key = date.toISOString().split("T")[0]
        break
      case "week": {
        const year = date.getFullYear()
        const week = getWeekNumber(date)
        key = `${year}-W${week.toString().padStart(2, "0")}`
        break
      }
      case "month":
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
        break
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(run)
  })

  const result: TokenSeriesPoint[] = []

  groups.forEach((groupRuns, date) => {
    const inputTokens = groupRuns.reduce((sum, r) => sum + (r.totalInputTokens || 0), 0)
    const outputTokens = groupRuns.reduce((sum, r) => sum + (r.totalOutputTokens || 0), 0)

    result.push({
      date,
      inputTokens,
      outputTokens,
    })
  })

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Calcula estatísticas de tokens
 */
export function getTokenStats(runs: AgentRunSummary[]): TokenStats {
  const totalInput = runs.reduce((sum, r) => sum + (r.totalInputTokens || 0), 0)
  const totalOutput = runs.reduce((sum, r) => sum + (r.totalOutputTokens || 0), 0)
  const avgPerRun = runs.length > 0 ? (totalInput + totalOutput) / runs.length : 0

  return {
    totalInput,
    totalOutput,
    avgPerRun,
  }
}

/**
 * Calcula taxa de erro por período
 */
export function calculateErrorRate(runs: AgentRunSummary[]): number {
  if (runs.length === 0) return 0
  const errorCount = runs.filter((r) => r.status === "failed" || r.status === "error").length
  return (errorCount / runs.length) * 100
}

/**
 * Compara providers por performance
 */
export function compareProviders(runs: AgentRunSummary[]): ProviderStats[] {
  return aggregateByProvider(runs)
}

/**
 * Aplica todos os filtros a uma lista de runs
 */
export function applyFilters(
  runs: AgentRunSummary[],
  filters: FilterOptions
): AgentRunSummary[] {
  return runs.filter((run) => {
    // Status filter
    if (filters.status && filters.status !== "all" && run.status !== filters.status) {
      return false
    }

    // Phase filter
    if (filters.phase && filters.phase !== "all" && run.lastPhase !== filters.phase) {
      return false
    }

    // Provider filter (multi-select)
    if (filters.providers && filters.providers.length > 0) {
      if (!filters.providers.includes(run.provider)) {
        return false
      }
    }

    // Model filter (multi-select)
    if (filters.models && filters.models.length > 0) {
      if (!filters.models.includes(run.model)) {
        return false
      }
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      if (!run.taskDescription.toLowerCase().includes(query)) {
        return false
      }
    }

    // Date range filter
    if (filters.startDate) {
      const runDate = new Date(run.startedAt)
      const startDate = new Date(filters.startDate)
      if (runDate < startDate) {
        return false
      }
    }

    if (filters.endDate) {
      const runDate = new Date(run.startedAt)
      const endDate = new Date(filters.endDate)
      if (runDate > endDate) {
        return false
      }
    }

    return true
  })
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Calcula o número da semana no ano (ISO week)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Rangos de tokens para colormap de heatmap
 */
export const TOKEN_RANGES = [
  { min: 0, max: 1000, color: "#22c55e", label: "0-1K" },
  { min: 1000, max: 10000, color: "#eab308", label: "1K-10K" },
  { min: 10000, max: 100000, color: "#f97316", label: "10K-100K" },
  { min: 100000, max: Infinity, color: "#ef4444", label: "100K+" },
]

/**
 * Calcula heatmap de tokens (7 dias x 24 horas)
 */
export function calculateTokensHeatmap(
  runs: AgentRunSummary[]
): Array<Array<{ count: number; tokens: number }>> {
  // Inicializa matriz 7x24 com zeros
  const heatmap: Array<Array<{ count: number; tokens: number }>> = Array.from(
    { length: 7 },
    () => Array.from({ length: 24 }, () => ({ count: 0, tokens: 0 }))
  )

  runs.forEach((run) => {
    const date = new Date(run.startedAt)
    const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday
    const hour = date.getHours()
    const tokens = (run.totalInputTokens || 0) + (run.totalOutputTokens || 0)

    heatmap[dayOfWeek][hour].count++
    heatmap[dayOfWeek][hour].tokens += tokens
  })

  return heatmap
}
