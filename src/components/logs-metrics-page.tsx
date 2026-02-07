import { useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogViewer } from "./orchestrator/log-viewer"
import { MetricsPanel } from "./orchestrator/metrics-panel"
import { FileText, ChevronRight, Download, FileJson, FileSpreadsheet, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { LogFilterOptions } from "@/lib/types"

export function LogsMetricsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const pipelineId = searchParams.get("pipelineId")
  const [activeTab, setActiveTab] = useState<"logs" | "metrics">("logs")
  const [currentFilters, setCurrentFilters] = useState<LogFilterOptions>({})
  const [inputPipelineId, setInputPipelineId] = useState("")
  const [exporting, setExporting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleLoadPipeline = () => {
    if (inputPipelineId.trim()) {
      navigate(`/logs?pipelineId=${inputPipelineId.trim()}`)
    }
  }

  // Export handler (adaptado de LogsDrawer)
  const handleExport = async (format: "json" | "csv") => {
    if (!pipelineId) return

    setExporting(true)
    try {
      const blob = await api.orchestrator.exportLogs(pipelineId, currentFilters, format)

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const filename = `logs-${pipelineId}-${timestamp}.${format}`

      // Create blob URL and trigger download
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()

      // Cleanup
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      toast.success(`Logs exportados com sucesso`, {
        description: `Arquivo: ${filename}`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Erro ao exportar logs", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setExporting(false)
    }
  }

  // Refresh handler: incrementa key para forçar remount
  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
    toast.success("Dados atualizados", {
      description: "Os componentes foram recarregados",
    })
  }

  // Empty state quando não há pipelineId
  if (!pipelineId) {
    return (
      <div className="page-gap">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <FileText className="size-16 text-muted-foreground/30" />
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Logs &amp; Métricas</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Digite o ID da pipeline para visualizar logs detalhados e métricas de execução
            </p>
          </div>
          <div className="flex gap-2 w-full max-w-md">
            <Input
              placeholder="Digite o pipeline ID"
              value={inputPipelineId}
              onChange={(e) => setInputPipelineId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLoadPipeline()
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleLoadPipeline}>Carregar</Button>
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
        <Link to="/logs" className="hover:text-foreground transition-colors">
          Logs
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{pipelineId.slice(-8)}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Logs &amp; Métricas</h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {pipelineId.slice(-8)}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Export dropdown (apenas visível na tab logs) - Icon only on mobile */}
          {activeTab === "logs" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
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
          )}

          {/* Refresh button - Icon only on mobile */}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="size-4 md:mr-2" />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "logs" | "metrics")}>
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
        </TabsList>

        {/* Tab Content: Logs */}
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="min-h-[60vh]">
                <LogViewer
                  key={refreshKey}
                  pipelineId={pipelineId}
                  onFiltersChange={setCurrentFilters}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Content: Métricas */}
        <TabsContent value="metrics" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <div className="min-h-[60vh]">
                <MetricsPanel key={refreshKey} pipelineId={pipelineId} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
