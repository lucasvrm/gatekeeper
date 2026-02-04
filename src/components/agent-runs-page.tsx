import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, type AgentRunSummary } from "@/lib/api"
import { usePageShell } from "@/hooks/use-page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<number, string> = {
  1: "Plano",
  2: "Spec",
  3: "Fix",
  4: "Execução",
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1_000)
  return `${mins}m ${secs}s`
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n === 0) return "0"
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return "agora"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    running: { variant: "default", label: "Executando" },
    completed: { variant: "secondary", label: "Concluído" },
    failed: { variant: "destructive", label: "Falhou" },
    pending: { variant: "outline", label: "Pendente" },
  }
  const v = variants[status] || { variant: "outline" as const, label: status }
  return <Badge variant={v.variant}>{v.label}</Badge>
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsCards({ runs }: { runs: AgentRunSummary[] }) {
  const totalCost = runs.reduce((sum, r) => sum + r.estimatedCostUsd, 0)
  const totalTokens = runs.reduce((sum, r) => sum + r.totalInputTokens + r.totalOutputTokens, 0)
  const completedRuns = runs.filter((r) => r.status === "completed")
  const avgDuration = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => sum + (r.durationMs || 0), 0) / completedRuns.length
    : 0
  const failedCount = runs.filter((r) => r.status === "failed").length

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      <Card>
        <CardContent style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>
            Runs Totais
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{runs.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>
            Custo Total
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatCost(totalCost)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>
            Tokens Totais
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatTokens(totalTokens)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>
            Duração Média
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatDuration(avgDuration)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>
            Falhas
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: failedCount > 0 ? "var(--destructive)" : undefined }}>
            {failedCount}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AgentRunsPage() {
  const headerPortals = usePageShell({ page: "agent-runs" })

  const navigate = useNavigate()
  const [runs, setRuns] = useState<AgentRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  const loadRuns = async () => {
    setLoading(true)
    try {
      const result = await api.agentRuns.list(
        50,
        statusFilter === "ALL" ? undefined : statusFilter
      )
      setRuns(result.runs)
    } catch (error) {
      console.error("Failed to load agent runs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [statusFilter])

  return (
    <>
    {headerPortals}
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 4 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Agent Pipeline Runs</h1>
          <p style={{ fontSize: 13, color: "var(--orqui-colors-text-muted)", marginTop: 2 }}>
            Histórico de execuções do pipeline LLM com custos, tokens e cache.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger style={{ width: 160 }}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="running">Executando</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadRuns} disabled={loading}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && runs.length > 0 && <StatsCards runs={runs} />}

      {/* Runs Table */}
      <Card>
        <CardContent style={{ padding: 0 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 120 }}>Status</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead style={{ width: 140 }}>Modelo</TableHead>
                <TableHead style={{ textAlign: "right", width: 100 }}>Tokens</TableHead>
                <TableHead style={{ textAlign: "right", width: 80 }}>Custo</TableHead>
                <TableHead style={{ textAlign: "right", width: 100 }}>Duração</TableHead>
                <TableHead style={{ textAlign: "right", width: 130 }}>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton style={{ height: 20 }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--orqui-colors-text-muted)" }}>
                    Nenhuma execução do pipeline encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow
                    key={run.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/agent-runs/${run.id}`)}
                  >
                    <TableCell>{statusBadge(run.status)}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span style={{
                              display: "block",
                              maxWidth: 320,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                            }}>
                              {run.taskDescription}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" style={{ maxWidth: 400 }}>
                            {run.taskDescription}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--orqui-colors-text-muted)" }}>
                        {run.model.replace("claude-", "").replace("-20250929", "")}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                      {formatTokens(run.totalInputTokens + run.totalOutputTokens)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>
                      {formatCost(run.estimatedCostUsd)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontSize: 13 }}>
                      {formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontSize: 12, color: "var(--orqui-colors-text-muted)" }}>
                      {formatDate(run.startedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </>
  )
}
