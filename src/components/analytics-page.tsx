import { useState, useEffect } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api"
import type { AgentRunSummary } from "@/lib/api"
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  ChevronLeft,
  ChevronsLeft,
  ChevronRightIcon,
  ChevronsRight,
  DollarSign,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { ExecutionsChart } from "@/components/charts/executions-chart"
import { DurationTrendChart } from "@/components/charts/duration-trend-chart"
import { ErrorRateChart } from "@/components/charts/error-rate-chart"
import { TokenUsageChart } from "@/components/charts/token-usage-chart"
import { TokenHeatmap } from "@/components/charts/token-heatmap"
import { MultiSelectFilter } from "@/components/analytics/multi-select-filter"
import { ProviderComparisonTable } from "@/components/analytics/provider-comparison-table"
import type { Granularity } from "@/lib/analytics-utils"
import { useMemo } from "react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { Input } from "@/components/ui/input"
import { X, ChevronDown, ChevronUp } from "lucide-react"

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [runs, setRuns] = useState<AgentRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [exporting, setExporting] = useState(false)

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all")
  const [phaseFilter, setPhaseFilter] = useState<string>(searchParams.get("phase") || "all")
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    searchParams.get("providers")?.split(",").filter(Boolean) || []
  )
  const [selectedModels, setSelectedModels] = useState<string[]>(
    searchParams.get("models")?.split(",").filter(Boolean) || []
  )
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("search") || "")
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const [startDate, setStartDate] = useState<string>(searchParams.get("startDate") || "")
  const [endDate, setEndDate] = useState<string>(searchParams.get("endDate") || "")

  // Granularidade dos charts
  const [granularity, setGranularity] = useState<Granularity>("day")

  // Advanced Analytics toggle
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false)

  // Paginação
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1)
  const pageSize = 20
  const totalPages = Math.ceil(runs.length / pageSize)

  // Extrair providers e models únicos
  const providers = useMemo(() => [...new Set(runs.map((r) => r.provider))].sort(), [runs])
  const models = useMemo(() => [...new Set(runs.map((r) => r.model))].sort(), [runs])

  useEffect(() => {
    loadRuns()
  }, [])

  // Sync URL params com filtros
  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (phaseFilter !== "all") params.set("phase", phaseFilter)
    if (selectedProviders.length > 0) params.set("providers", selectedProviders.join(","))
    if (selectedModels.length > 0) params.set("models", selectedModels.join(","))
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    if (page !== 1) params.set("page", String(page))
    setSearchParams(params, { replace: true })
  }, [statusFilter, phaseFilter, selectedProviders, selectedModels, debouncedSearch, startDate, endDate, page, setSearchParams])

  const loadRuns = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("🔍 [Analytics] Carregando runs...")
      const data = await api.agentRuns.list(100) // Carregar mais runs para stats
      console.log("✅ [Analytics] Dados recebidos:", data)
      console.log("📊 [Analytics] Total de runs:", data.runs?.length || 0)
      setRuns(data.runs)
    } catch (err) {
      console.error("❌ [Analytics] Error loading analytics:", err)
      setError(err as Error)
      toast.error("Erro ao carregar analytics", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setLoading(false)
    }
  }

  // Aplicar filtros
  const filteredRuns = runs.filter((run) => {
    if (statusFilter !== "all" && run.status !== statusFilter) return false
    if (phaseFilter !== "all" && run.lastPhase !== phaseFilter) return false
    if (selectedProviders.length > 0 && !selectedProviders.includes(run.provider)) return false
    if (selectedModels.length > 0 && !selectedModels.includes(run.model)) return false
    if (debouncedSearch && !run.taskDescription.toLowerCase().includes(debouncedSearch.toLowerCase())) return false

    // Date range filter
    if (startDate) {
      const runDate = new Date(run.startedAt)
      const filterStartDate = new Date(startDate)
      if (runDate < filterStartDate) return false
    }
    if (endDate) {
      const runDate = new Date(run.startedAt)
      const filterEndDate = new Date(endDate)
      if (runDate > filterEndDate) return false
    }

    return true
  })

  // Aplicar paginação
  const paginatedRuns = filteredRuns.slice((page - 1) * pageSize, page * pageSize)
  const totalFilteredPages = Math.ceil(filteredRuns.length / pageSize)

  // Export handler
  const handleExport = async (format: "json" | "csv") => {
    setExporting(true)
    try {
      const dataToExport = filteredRuns.map((run) => ({
        id: run.id,
        taskDescription: run.taskDescription,
        status: run.status,
        phase: run.lastPhase,
        provider: run.provider,
        model: run.model,
        durationMs: run.durationMs,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      }))

      let blob: Blob
      let filename: string
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)

      if (format === "json") {
        blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
        filename = `analytics-${timestamp}.json`
      } else {
        // CSV format
        const headers = Object.keys(dataToExport[0] || {}).join(",")
        const rows = dataToExport.map((row) => Object.values(row).join(","))
        const csv = [headers, ...rows].join("\n")
        blob = new Blob([csv], { type: "text/csv" })
        filename = `analytics-${timestamp}.csv`
      }

      // Download
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success(`Analytics exportados com sucesso`, {
        description: `${filteredRuns.length} registros - ${filename}`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erro ao exportar analytics", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setExporting(false)
    }
  }

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalFilteredPages)))
  }

  // Refresh handler
  const handleRefresh = () => {
    loadRuns()
    toast.success("Dados atualizados")
  }

  // Calcular stats agregados (baseados em filteredRuns)
  const stats = {
    total: filteredRuns.length,
    completed: filteredRuns.filter((r) => r.status === "completed").length,
    failed: filteredRuns.filter((r) => r.status === "failed" || r.status === "error").length,
    running: filteredRuns.filter((r) => r.status === "running").length,
    avgDuration:
      filteredRuns.filter((r) => r.durationMs).reduce((sum, r) => sum + (r.durationMs || 0), 0) /
      (filteredRuns.filter((r) => r.durationMs).length || 1),
    totalCost: filteredRuns
      .filter((r) => r.estimatedCostUsd !== null)
      .reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0),
    totalTokens: filteredRuns.reduce(
      (sum, r) => sum + (r.totalInputTokens || 0) + (r.totalOutputTokens || 0),
      0
    ),
  }

  const successRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-"
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Sucesso</Badge>
      case "failed":
      case "error":
        return <Badge variant="destructive">Erro</Badge>
      case "running":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Executando</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleRowClick = (id: string) => {
    navigate(`/logs?pipelineId=${id}`)
  }

  if (loading && runs.length === 0) {
    return (
      <div className="page-gap">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Carregando analytics...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && runs.length === 0) {
    return (
      <div className="page-gap">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertTriangle className="size-16 text-red-500" />
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Erro ao carregar analytics</h2>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-gap">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Analytics</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {stats.total} runs
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Export dropdown - Icon only on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting || filteredRuns.length === 0}>
                <Download className="size-4 md:mr-2" />
                <span className="hidden md:inline">{exporting ? "Exportando..." : "Exportar"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileJson className="size-4 mr-2" />
                Exportar JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileSpreadsheet className="size-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh button - Icon only on mobile */}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="size-4 md:mr-2" />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Execuções */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Execuções</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <BarChart3 className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-3xl font-bold mt-2">{successRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.completed} de {stats.total}
                </p>
              </div>
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        {/* Custo Total */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Total</p>
                <p className="text-3xl font-bold mt-2 font-mono">
                  ${stats.totalCost.toFixed(4)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${(stats.totalCost / (stats.total || 1)).toFixed(6)} / run
                </p>
              </div>
              <DollarSign className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha de stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Duração Média */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Duração Média</p>
                <p className="text-3xl font-bold mt-2">{formatDuration(stats.avgDuration)}</p>
              </div>
              <Clock className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Tokens Totais */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tokens Totais</p>
                <p className="text-3xl font-bold mt-2">
                  {(stats.totalTokens / 1000).toFixed(1)}K
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(stats.totalTokens / (stats.total || 1))} / run
                </p>
              </div>
              <Zap className="size-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        {/* Erros Totais */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Erros Totais</p>
                <p className="text-3xl font-bold mt-2">{stats.failed}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((stats.failed / (stats.total || 1)) * 100).toFixed(1)}% do total
                </p>
              </div>
              <AlertTriangle className="size-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Charts Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Timeline de Execuções</CardTitle>
              <CardDescription>Visualize métricas ao longo do tempo</CardDescription>
            </div>
            <Select value={granularity} onValueChange={(value) => setGranularity(value as Granularity)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Por Dia</SelectItem>
                <SelectItem value="week">Por Semana</SelectItem>
                <SelectItem value="month">Por Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Execuções por Período */}
            <div>
              <h3 className="text-sm font-medium mb-4">Execuções por Período</h3>
              <ExecutionsChart runs={filteredRuns} granularity={granularity} />
            </div>

            {/* Duração Trending */}
            <div>
              <h3 className="text-sm font-medium mb-4">Duração ao Longo do Tempo</h3>
              <DurationTrendChart runs={filteredRuns} granularity={granularity} />
            </div>

            {/* Taxa de Erro */}
            <div>
              <h3 className="text-sm font-medium mb-4">Taxa de Erro</h3>
              <ErrorRateChart runs={filteredRuns} granularity={granularity} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Analytics Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Análise de Tokens</CardTitle>
          <CardDescription>Uso de tokens ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <TokenUsageChart runs={filteredRuns} granularity={granularity} />
        </CardContent>
      </Card>

      {/* Advanced Analytics Section (collapsible) */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analytics Avançado</CardTitle>
              <CardDescription>
                Heatmap de tokens e comparação de providers
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
            >
              {showAdvancedAnalytics ? (
                <>
                  <ChevronUp className="size-4 mr-2" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="size-4 mr-2" />
                  Mostrar
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {showAdvancedAnalytics && (
          <CardContent className="space-y-8">
            {/* Token Heatmap */}
            <div>
              <h3 className="text-sm font-semibold mb-4">
                Heatmap de Tokens (7 dias × 24 horas)
              </h3>
              <TokenHeatmap runs={filteredRuns} />
            </div>

            <div className="border-t" />

            {/* Provider Comparison */}
            <div>
              <h3 className="text-sm font-semibold mb-4">
                Comparação de Performance por Provider
              </h3>
              <ProviderComparisonTable runs={filteredRuns} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* Search bar - Full width */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Buscar por descrição</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Digite para buscar..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setPage(1)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="failed">Falhadas</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Fase</label>
              <Select value={phaseFilter} onValueChange={(value) => { setPhaseFilter(value); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="spec">Spec</SelectItem>
                  <SelectItem value="execute">Execute</SelectItem>
                  <SelectItem value="writing">Writing</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <MultiSelectFilter
                label="Provedor"
                options={providers}
                selected={selectedProviders}
                onChange={(selected) => {
                  setSelectedProviders(selected)
                  setPage(1)
                }}
                placeholder="Todos os provedores"
              />
            </div>

            <div className="flex-1">
              <MultiSelectFilter
                label="Modelo"
                options={models}
                selected={selectedModels}
                onChange={(selected) => {
                  setSelectedModels(selected)
                  setPage(1)
                }}
                placeholder="Todos os modelos"
              />
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Data Início</label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Data Fim</label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Active period badge */}
          {(startDate || endDate) && (
            <div className="mt-3">
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                📅 Período ativo
                {startDate && endDate
                  ? `: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                  : startDate
                  ? `: A partir de ${new Date(startDate).toLocaleDateString()}`
                  : `: Até ${new Date(endDate).toLocaleDateString()}`}
              </Badge>
            </div>
          )}

          {(statusFilter !== "all" || phaseFilter !== "all" || selectedProviders.length > 0 || selectedModels.length > 0 || searchQuery || startDate || endDate) && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all")
                  setPhaseFilter("all")
                  setSelectedProviders([])
                  setSelectedModels([])
                  setSearchQuery("")
                  setStartDate("")
                  setEndDate("")
                  setPage(1)
                }}
              >
                Limpar Todos os Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipelines Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipelines Executadas</CardTitle>
              <CardDescription>
                {filteredRuns.length === runs.length
                  ? `${runs.length} execuções (mais recentes primeiro)`
                  : `${filteredRuns.length} de ${runs.length} execuções (filtradas)`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="size-12 mb-4 opacity-30" />
              <p className="text-sm">
                {runs.length === 0
                  ? "Nenhuma pipeline executada ainda"
                  : "Nenhuma pipeline corresponde aos filtros"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Pipeline ID</th>
                      <th className="pb-3 font-medium">Tarefa</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Provedor</th>
                      <th className="pb-3 font-medium">Duração</th>
                      <th className="pb-3 font-medium">Custo</th>
                      <th className="pb-3 font-medium">Criado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedRuns.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() => handleRowClick(run.id)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {run.id.slice(-8)}
                          </Badge>
                        </td>
                        <td className="py-3 max-w-md truncate" title={run.taskDescription}>
                          {run.taskDescription || "Sem descrição"}
                        </td>
                        <td className="py-3">{getStatusBadge(run.status)}</td>
                        <td className="py-3">
                          <span className="text-sm font-mono">
                            {run.provider}/{run.model}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-sm">
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className="py-3 font-mono text-sm">
                          {run.estimatedCostUsd !== null
                            ? `$${run.estimatedCostUsd.toFixed(6)}`
                            : "-"}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="md:hidden space-y-4">
                {paginatedRuns.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => handleRowClick(run.id)}
                    className="cursor-pointer p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {run.id.slice(-8)}
                      </Badge>
                      {getStatusBadge(run.status)}
                    </div>
                    <p className="text-sm mb-3 line-clamp-2">
                      {run.taskDescription || "Sem descrição"}
                    </p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Provedor:</span>
                        <span className="font-mono">
                          {run.provider}/{run.model}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duração:</span>
                        <span className="font-mono">{formatDuration(run.durationMs)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Custo:</span>
                        <span className="font-mono">
                          {run.estimatedCostUsd !== null
                            ? `$${run.estimatedCostUsd.toFixed(6)}`
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Criado:</span>
                        <span>{new Date(run.startedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {totalFilteredPages > 1 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground text-center md:text-left">
                    Página {page} de {totalFilteredPages}
                    <span className="hidden md:inline"> • {filteredRuns.length} registros</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={page === 1}
                      className="hidden md:flex"
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalFilteredPages}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalFilteredPages)}
                      disabled={page === totalFilteredPages}
                      className="hidden md:flex"
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
