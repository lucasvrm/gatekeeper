import { useEffect, useRef, useState } from "react"
import { LogViewer } from "./log-viewer"
import { MetricsPanel } from "./metrics-panel"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Download, FileJson, FileSpreadsheet } from "lucide-react"
import { api } from "@/lib/api"
import { toast } from "sonner"
import type { LogFilterOptions } from "@/lib/types"

interface LogsDrawerProps {
  isOpen: boolean
  onClose: () => void
  pipelineId: string
}

export function LogsDrawer({
  isOpen,
  onClose,
  pipelineId,
}: LogsDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [exporting, setExporting] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<LogFilterOptions>({})
  const [activeTab, setActiveTab] = useState<'logs' | 'metrics'>('logs')

  // ESC key listener
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // Focus trap: focus close button when drawer opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [isOpen])

  // Export handler
  const handleExport = async (format: "json" | "csv") => {
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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - RF-01: z-[100] to cover collapse button */}
      <div
        onClick={onClose}
        data-testid="drawer-backdrop"
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        style={{ zIndex: 100 }}
        aria-hidden="true"
      />

      {/* Drawer panel - RF-01: z-[110] to be above backdrop */}
      <aside
        data-testid="drawer-panel"
        className="fixed right-0 top-0 z-[110] h-screen w-full max-w-3xl bg-background shadow-2xl border-l border-border overflow-hidden flex flex-col"
        style={{ zIndex: 110 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logs-drawer-title"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-4">
            <h3 id="logs-drawer-title" className="text-lg font-semibold">
              Pipeline Logs
            </h3>

            {/* Toggle Logs / Metrics */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'logs' | 'metrics')}>
              <TabsList>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            {/* Export button - apenas visível na tab Logs */}
            {activeTab === 'logs' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting}
                    className="gap-2"
                  >
                    <Download className="size-3.5" />
                    {exporting ? "Exportando..." : "Exportar"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[120]">
                  <DropdownMenuItem onClick={() => handleExport("json")} className="gap-2">
                    <FileJson className="size-4" />
                    Exportar como JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
                    <FileSpreadsheet className="size-4" />
                    Exportar como CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Close button */}
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close logs drawer"
              className="shrink-0"
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'logs' ? (
            <div className="h-full p-6">
              <LogViewer pipelineId={pipelineId} onFiltersChange={setCurrentFilters} />
            </div>
          ) : (
            <MetricsPanel pipelineId={pipelineId} />
          )}
        </div>
      </aside>
    </>
  )
}
