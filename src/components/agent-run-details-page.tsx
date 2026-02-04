import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api, type AgentRunCostStats } from "@/lib/api"
import { usePageShell } from "@/hooks/use-page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<number, string> = {
  1: "📋 Plano",
  2: "🧪 Spec",
  3: "🔧 Fix",
  4: "⚡ Execução",
}

function fmt(n: number): string {
  if (n === 0) return "0"
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function fmtCost(usd: number): string {
  if (usd === 0) return "$0.00"
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function fmtDur(ms: number | null): string {
  if (ms == null) return "—"
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.round((ms % 60_000) / 1_000)
  return `${mins}m ${secs}s`
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

// ─── Token Bar ────────────────────────────────────────────────────────────────

function TokenBar({ input, output, cacheRead, cacheWrite }: {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}) {
  const total = input + output + cacheRead + cacheWrite
  if (total === 0) return <span style={{ color: "var(--orqui-colors-text-muted)" }}>—</span>

  const pInput = (input / total) * 100
  const pOutput = (output / total) * 100
  const pCacheRead = (cacheRead / total) * 100
  const pCacheWrite = (cacheWrite / total) * 100

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{
        display: "flex",
        height: 8,
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--orqui-colors-surface-2)",
      }}>
        {pInput > 0 && (
          <div style={{ width: `${pInput}%`, background: "var(--orqui-colors-accent)", minWidth: 2 }}
            title={`Input: ${fmt(input)}`} />
        )}
        {pOutput > 0 && (
          <div style={{ width: `${pOutput}%`, background: "#f59e0b", minWidth: 2 }}
            title={`Output: ${fmt(output)}`} />
        )}
        {pCacheRead > 0 && (
          <div style={{ width: `${pCacheRead}%`, background: "#22c55e", minWidth: 2 }}
            title={`Cache Read: ${fmt(cacheRead)}`} />
        )}
        {pCacheWrite > 0 && (
          <div style={{ width: `${pCacheWrite}%`, background: "#a855f7", minWidth: 2 }}
            title={`Cache Write: ${fmt(cacheWrite)}`} />
        )}
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--orqui-colors-text-muted)" }}>
        <span>In: {fmt(input)}</span>
        <span>Out: {fmt(output)}</span>
        {cacheRead > 0 && <span style={{ color: "#22c55e" }}>Cache↓: {fmt(cacheRead)}</span>}
        {cacheWrite > 0 && <span style={{ color: "#a855f7" }}>Cache↑: {fmt(cacheWrite)}</span>}
      </div>
    </div>
  )
}

// ─── Cache Savings Card ───────────────────────────────────────────────────────

function CacheSavingsCard({ stats }: { stats: AgentRunCostStats }) {
  const { run } = stats
  const totalInput = run.totalInputTokens
  const cacheRead = run.cacheReadTokens

  if (totalInput === 0 || cacheRead === 0) {
    return (
      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Cache</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ fontSize: 13, color: "var(--orqui-colors-text-muted)" }}>
            Nenhum cache utilizado neste run.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Cache read tokens are charged at 0.1x, so savings = cacheRead * 0.9
  const cacheHitRate = ((cacheRead / (totalInput + cacheRead)) * 100).toFixed(1)
  const estimatedSavings = cacheRead * 0.9 // in token-equivalents

  return (
    <Card>
      <CardHeader style={{ paddingBottom: 8 }}>
        <CardTitle style={{ fontSize: 14 }}>💰 Economia de Cache</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)" }}>Cache Hit Rate</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{cacheHitRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)" }}>Tokens Economizados</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(estimatedSavings)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)" }}>Cache Read</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "monospace" }}>{fmt(cacheRead)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)" }}>Cache Write</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "monospace" }}>{fmt(run.cacheWriteTokens)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AgentRunDetailsPage() {
  const headerPortals = usePageShell({ page: "agent-runs" })

  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [stats, setStats] = useState<AgentRunCostStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.agentRuns.getById(id)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>{headerPortals}<div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}>
        <Skeleton style={{ height: 32, width: 240 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <Skeleton style={{ height: 100 }} />
          <Skeleton style={{ height: 100 }} />
          <Skeleton style={{ height: 100 }} />
        </div>
        <Skeleton style={{ height: 300 }} />
      </div></>
    )
  }

  if (error || !stats) {
    return (
      <>{headerPortals}<div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--destructive)", marginBottom: 16 }}>
          {error || "Run não encontrado"}
        </p>
        <Button variant="outline" onClick={() => navigate("/agent-runs")}>
          Voltar
        </Button>
      </div></>
    )
  }

  const { run, steps } = stats

  const handleResume = async () => {
    try {
      const result = await api.agentRuns.resume(run.id)
      toast.success(`Pipeline retomado do step ${result.resumeFromStep + 1}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
    {headerPortals}
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 4 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/agent-runs")}
            style={{ marginBottom: 8, marginLeft: -8 }}>
            ← Voltar
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
              {run.id}
            </h1>
            {statusBadge(run.status)}
            {run.status === "failed" && (
              <Button variant="outline" size="sm" onClick={handleResume}>
                ▶ Retomar
              </Button>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 13, color: "var(--orqui-colors-text-muted)" }}>
          <div>Duração: <strong>{fmtDur(run.durationMs)}</strong></div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Card>
          <CardContent style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>Custo Total</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtCost(run.estimatedCostUsd)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>Input Tokens</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(run.totalInputTokens)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--orqui-colors-text-muted)", marginBottom: 4 }}>Output Tokens</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(run.totalOutputTokens)}</div>
          </CardContent>
        </Card>
        <CacheSavingsCard stats={stats} />
      </div>

      {/* Token Distribution */}
      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Distribuição de Tokens</CardTitle>
          <CardDescription style={{ fontSize: 12 }}>Visão geral: input, output, cache read e cache write</CardDescription>
        </CardHeader>
        <CardContent>
          <TokenBar
            input={run.totalInputTokens}
            output={run.totalOutputTokens}
            cacheRead={run.cacheReadTokens}
            cacheWrite={run.cacheWriteTokens}
          />
        </CardContent>
      </Card>

      {/* Steps Breakdown */}
      <Card>
        <CardHeader style={{ paddingBottom: 8 }}>
          <CardTitle style={{ fontSize: 14 }}>Etapas do Pipeline</CardTitle>
          <CardDescription style={{ fontSize: 12 }}>Custo e tokens por etapa (iterações incluem retries)</CardDescription>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 140 }}>Etapa</TableHead>
                <TableHead style={{ width: 100 }}>Status</TableHead>
                <TableHead style={{ width: 80, textAlign: "right" }}>Iterações</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead style={{ textAlign: "right", width: 90 }}>Custo</TableHead>
                <TableHead style={{ textAlign: "right", width: 90 }}>Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--orqui-colors-text-muted)" }}>
                    Nenhuma etapa registrada.
                  </TableCell>
                </TableRow>
              ) : (
                steps.map((step, i) => (
                  <TableRow key={`${step.step}-${i}`}>
                    <TableCell style={{ fontWeight: 600, fontSize: 13 }}>
                      {STEP_LABELS[step.step] || `Step ${step.step}`}
                    </TableCell>
                    <TableCell>{statusBadge(step.status)}</TableCell>
                    <TableCell style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                      {step.iterations}
                    </TableCell>
                    <TableCell>
                      <TokenBar
                        input={step.inputTokens}
                        output={step.outputTokens}
                        cacheRead={step.cacheReadTokens}
                        cacheWrite={step.cacheWriteTokens}
                      />
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>
                      {fmtCost(step.estimatedCostUsd)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right", fontSize: 13 }}>
                      {fmtDur(step.durationMs)}
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
