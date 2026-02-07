import { useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LogViewer } from "./orchestrator/log-viewer"
import { FileText, ChevronRight } from "lucide-react"
import type { LogFilterOptions } from "@/lib/types"

export function LogsMetricsPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const pipelineId = searchParams.get("pipelineId")
  const [activeTab, setActiveTab] = useState<"logs" | "metrics">("logs")
  const [currentFilters, setCurrentFilters] = useState<LogFilterOptions>({})
  const [inputPipelineId, setInputPipelineId] = useState("")

  const handleLoadPipeline = () => {
    if (inputPipelineId.trim()) {
      navigate(`/logs?pipelineId=${inputPipelineId.trim()}`)
    }
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
            <CardHeader>
              <CardTitle>Métricas</CardTitle>
              <CardDescription>
                Visualização agregada dos eventos da pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Conteúdo da tab Métricas (será implementado em MP-LOGS-03)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
