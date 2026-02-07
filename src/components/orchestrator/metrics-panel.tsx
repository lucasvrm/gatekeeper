import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Activity, AlertTriangle, Clock, BarChart3, Layers } from 'lucide-react'
import { api } from '@/lib/api'
import type { LogMetrics } from '@/lib/types'

interface MetricsPanelProps {
  pipelineId: string
}

/**
 * MetricsPanel - Exibe métricas agregadas de uma pipeline.
 *
 * Mostra contadores por level, stage, type e duração total da execução.
 * Dados obtidos do endpoint GET /api/orchestrator/:pipelineId/metrics
 */
export function MetricsPanel({ pipelineId }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<LogMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadMetrics() {
      try {
        setLoading(true)
        const data = await api.orchestrator.getMetrics(pipelineId)
        if (mounted) {
          setMetrics(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadMetrics()

    return () => {
      mounted = false
    }
  }, [pipelineId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Carregando métricas...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-2 text-red-500">
          <AlertTriangle className="h-8 w-8" />
          <span className="text-sm">Erro ao carregar métricas</span>
          <span className="text-xs text-muted-foreground">{error.message}</span>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  // Se não há eventos, mostrar empty state
  if (metrics.totalEvents === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8" />
          <span className="text-sm">Sem eventos para exibir</span>
          <span className="text-xs">Execute a pipeline para ver métricas</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      {/* Summary card */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Resumo</h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total de eventos:</span>
            <strong className="text-lg">{metrics.totalEvents}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Duração:</span>
            <strong className="font-mono">{metrics.duration.formatted}</strong>
          </div>
          {metrics.firstEvent && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Início:</span>
              <span className="font-mono">{new Date(metrics.firstEvent).toLocaleString()}</span>
            </div>
          )}
          {metrics.lastEvent && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Fim:</span>
              <span className="font-mono">{new Date(metrics.lastEvent).toLocaleString()}</span>
            </div>
          )}
        </div>
      </Card>

      {/* By Level card */}
      {Object.keys(metrics.byLevel).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold">Por Nível</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(metrics.byLevel)
              .sort(([, a], [, b]) => b - a) // Sort by count (descending)
              .map(([level, count]) => {
                const percentage = ((count / metrics.totalEvents) * 100).toFixed(1)
                const levelColor = getLevelColor(level)

                return (
                  <div key={level} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="capitalize" style={{ color: levelColor }}>
                        {level}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{percentage}%</span>
                        <strong>{count}</strong>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: levelColor,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* By Stage card */}
      {Object.keys(metrics.byStage).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold">Por Fase</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(metrics.byStage)
              .sort(([, a], [, b]) => b - a) // Sort by count (descending)
              .map(([stage, count]) => {
                const percentage = ((count / metrics.totalEvents) * 100).toFixed(1)
                const stageColor = getStageColor(stage)

                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="capitalize" style={{ color: stageColor }}>
                        {stage}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{percentage}%</span>
                        <strong>{count}</strong>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: stageColor,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* By Type card (mostrar apenas os 10 mais frequentes) */}
      {Object.keys(metrics.byType).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-purple-500" />
            <h3 className="font-semibold">Por Tipo</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            {Object.entries(metrics.byType)
              .sort(([, a], [, b]) => b - a) // Sort by count (descending)
              .slice(0, 10) // Top 10
              .map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-muted-foreground font-mono text-xs truncate">
                    {type}
                  </span>
                  <strong className="ml-2">{count}</strong>
                </div>
              ))}
            {Object.keys(metrics.byType).length > 10 && (
              <div className="text-xs text-muted-foreground text-center pt-1">
                + {Object.keys(metrics.byType).length - 10} tipos adicionais
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * Retorna cor para um nível de log.
 */
function getLevelColor(level: string): string {
  const normalized = level.toLowerCase()

  switch (normalized) {
    case 'error':
      return 'hsl(0, 70%, 50%)' // Red
    case 'warn':
    case 'warning':
      return 'hsl(30, 80%, 50%)' // Orange
    case 'info':
      return 'hsl(210, 70%, 50%)' // Blue
    case 'debug':
      return 'hsl(150, 50%, 45%)' // Green
    default:
      return 'hsl(0, 0%, 60%)' // Gray
  }
}

/**
 * Retorna cor para uma fase da pipeline.
 */
function getStageColor(stage: string): string {
  const normalized = stage.toLowerCase()

  switch (normalized) {
    case 'discovery':
      return 'hsl(180, 65%, 50%)' // Cyan
    case 'planning':
      return 'hsl(270, 60%, 55%)' // Purple
    case 'spec':
      return 'hsl(210, 70%, 50%)' // Blue
    case 'fix':
      return 'hsl(30, 80%, 50%)' // Orange
    case 'execute':
      return 'hsl(150, 60%, 45%)' // Green
    case 'complete':
      return 'hsl(120, 50%, 50%)' // Green success
    default:
      return 'hsl(0, 0%, 60%)' // Gray
  }
}
