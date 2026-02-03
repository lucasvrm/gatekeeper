import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api, API_BASE } from "@/lib/api"
import type { Project } from "@/lib/types"
import { useEffect } from "react"
import { useOrchestratorEvents, type OrchestratorEvent } from "@/hooks/useOrchestratorEvents"
import { usePageShell } from "@/hooks/use-page-shell"
import { OrchestratorConfigPanel } from "@/components/orchestrator-config-panel"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedArtifact {
  filename: string
  content: string
}

interface StepResult {
  outputId?: string
  artifacts?: ParsedArtifact[]
  tokensUsed?: { inputTokens: number; outputTokens: number }
}

interface LogEntry {
  time: string
  type: string
  text: string
}

type WizardStep = 0 | 1 | 2 | 3 | 4
type PageTab = "pipeline" | "config"

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 0, label: "Tarefa" },
  { num: 1, label: "Plano" },
  { num: 2, label: "Testes" },
  { num: 3, label: "Validação" },
  { num: 4, label: "Execução" },
] as const

function StepIndicator({ current, completed }: { current: WizardStep; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ num, label }, i) => (
        <div key={num} className="flex items-center">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              num === current
                ? "bg-primary text-primary-foreground"
                : completed.has(num)
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span>{completed.has(num) ? "✓" : num}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-px mx-1 ${completed.has(num) ? "bg-green-500/40" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact viewer
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactViewer({ artifacts }: { artifacts: ParsedArtifact[] }) {
  const [selected, setSelected] = useState(0)
  if (artifacts.length === 0) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex border-b border-border bg-muted/30">
        {artifacts.map((a, i) => (
          <button
            key={a.filename}
            onClick={() => setSelected(i)}
            className={`px-3 py-2 text-xs font-mono transition-colors ${
              i === selected
                ? "bg-card text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.filename}
          </button>
        ))}
      </div>
      <pre className="p-4 text-xs font-mono overflow-auto max-h-96 bg-card">
        {artifacts[selected]?.content}
      </pre>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Log panel
// ─────────────────────────────────────────────────────────────────────────────

function LogPanel({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return null

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-48 overflow-auto space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 text-xs font-mono">
              <span className="text-muted-foreground shrink-0">{log.time}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">{log.type}</Badge>
              <span className="text-foreground">{log.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function OrchestratorPage() {
  const navigate = useNavigate()
  const headerPortals = usePageShell({ page: "orchestrator" })

  // ── Tab state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PageTab>("pipeline")

  // ── Pipeline state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Step 0
  const [taskDescription, setTaskDescription] = useState("")
  const [taskType, setTaskType] = useState<string | undefined>(undefined)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Step 1 result
  const [outputId, setOutputId] = useState<string | undefined>()
  const [planArtifacts, setPlanArtifacts] = useState<ParsedArtifact[]>([])

  // Step 2 result
  const [specArtifacts, setSpecArtifacts] = useState<ParsedArtifact[]>([])

  // Step 3 result
  const [runId, setRunId] = useState<string | null>(null)
  const [validationStatus, setValidationStatus] = useState<string | null>(null)

  // Step 4 result
  const [executeResult, setExecuteResult] = useState<{ mode: string; command?: string } | null>(null)

  // ── Load projects ──────────────────────────────────────────────────────
  useEffect(() => {
    api.projects.list(1, 100).then((res) => {
      if (!res) return
      setProjects(res.data)
      const active = res.data.filter((p) => p.isActive)
      if (active.length > 0) {
        setSelectedProjectId((prev) => prev ?? active[0].id)
      }
    })
  }, [])

  // ── SSE events ─────────────────────────────────────────────────────────
  const addLog = useCallback((type: string, text: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    setLogs((prev) => [...prev, { time, type, text }])
  }, [])

  const handleSSE = useCallback(
    (event: OrchestratorEvent) => {
      addLog(event.type, typeof event.text === "string" ? event.text : JSON.stringify(event))
    },
    [addLog]
  )

  useOrchestratorEvents(outputId, handleSSE)

  // ── Helpers ────────────────────────────────────────────────────────────
  const markComplete = (s: number) => setCompletedSteps((prev) => new Set([...prev, s]))

  const apiPost = async (endpoint: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/orchestrator/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(err?.error || err?.message || `HTTP ${res.status}`)
    }
    return res.json()
  }

  // ── Step 1: Generate Plan ──────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    setError(null)
    setLoading(true)
    addLog("info", "Gerando plano...")

    try {
      const result: StepResult = await apiPost("plan", { taskDescription, taskType })

      setOutputId(result.outputId)
      setPlanArtifacts(result.artifacts || [])
      markComplete(0)
      markComplete(1)
      setStep(2)
      addLog("success", `Plano gerado: ${result.outputId}`)
      toast.success("Plano gerado com sucesso")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar plano"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Generate Spec ──────────────────────────────────────────────
  const handleGenerateSpec = async () => {
    if (!outputId) return
    setError(null)
    setLoading(true)
    addLog("info", "Gerando testes...")

    try {
      const result: StepResult = await apiPost("spec", { outputId })

      setSpecArtifacts(result.artifacts || [])
      markComplete(2)
      setStep(3)
      addLog("success", `Testes gerados: ${result.artifacts?.map((a) => a.filename).join(", ")}`)
      toast.success("Testes gerados com sucesso")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar testes"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Validate ───────────────────────────────────────────────────
  const handleValidate = async () => {
    if (!outputId || !selectedProjectId) return
    setError(null)
    setLoading(true)
    setValidationStatus("RUNNING")
    addLog("info", "Iniciando validação Gatekeeper...")

    try {
      const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
      if (!planArtifact) throw new Error("plan.json não encontrado")

      const plan = JSON.parse(planArtifact.content)

      const manifest = {
        files: plan.files || [],
        testFile: plan.testFile || specArtifacts[0]?.filename || "spec.test.ts",
      }

      const response = await api.runs.create({
        projectId: selectedProjectId,
        outputId,
        taskPrompt: taskDescription,
        manifest,
        runType: "CONTRACT",
      })

      setRunId(response.runId)

      if (specArtifacts.length > 0) {
        const formData = new FormData()
        const planBlob = new Blob([planArtifact.content], { type: "application/json" })
        formData.append("planJson", planBlob, "plan.json")
        const specBlob = new Blob([specArtifacts[0].content], { type: "text/plain" })
        formData.append("specFile", specBlob, specArtifacts[0].filename)
        await api.runs.uploadFiles(response.runId, formData)
      }

      addLog("success", `Run criada: ${response.runId}`)
      toast.success("Validação iniciada")
      navigate(`/runs/${response.runId}/v2`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar validação"
      setError(msg)
      setValidationStatus("FAILED")
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3b: Fix artifacts ─────────────────────────────────────────────
  const handleFix = async (target: "plan" | "spec") => {
    if (!outputId || !runId) return
    setError(null)
    setLoading(true)
    addLog("info", `Corrigindo ${target}...`)

    try {
      const result: StepResult = await apiPost("fix", {
        outputId,
        target,
        runId,
        failedValidators: ["manual-fix"],
      })

      if (target === "plan") {
        setPlanArtifacts(result.artifacts || planArtifacts)
      } else {
        setSpecArtifacts(result.artifacts || specArtifacts)
      }
      addLog("success", `${target} corrigido`)
      toast.success(`${target === "plan" ? "Plano" : "Testes"} corrigido`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Erro ao corrigir ${target}`
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 4: Execute ────────────────────────────────────────────────────
  const handleExecute = async () => {
    if (!outputId) return
    setError(null)
    setLoading(true)
    addLog("info", "Executando implementação...")

    const project = projects.find((p) => p.id === selectedProjectId)
    const projectPath = project?.workspace?.rootPath || ""

    try {
      const result = await apiPost("execute", { outputId, projectPath })
      setExecuteResult(result)
      markComplete(3)
      markComplete(4)
      setStep(4)
      addLog("success", `Execução concluída (modo: ${result.mode})`)
      toast.success("Execução concluída")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro na execução"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {headerPortals}

      {/* Page tabs: Pipeline | Config */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setTab("pipeline")}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "pipeline" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setTab("config")}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === "config" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Config
          </button>
        </div>

        {tab === "pipeline" && outputId && (
          <Badge variant="outline" className="font-mono text-xs">
            {outputId}
          </Badge>
        )}
      </div>

      {/* ─── Config tab ──────────────────────────────────────────────── */}
      {tab === "config" && <OrchestratorConfigPanel />}

      {/* ─── Pipeline tab ────────────────────────────────────────────── */}
      {tab === "pipeline" && (
        <>
          {/* Step indicator */}
          <StepIndicator current={step} completed={completedSteps} />

          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ─── Step 0: Task input ─────────────────────────────────── */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Descreva a Tarefa</CardTitle>
                <CardDescription>
                  Descreva o que precisa ser implementado. O LLM vai gerar o plano, contrato e especificação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  {projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border border-amber-500/50 bg-amber-500/10 rounded">
                      Nenhum projeto configurado. Crie um em <a href="/projects" className="underline">/projects</a>.
                    </div>
                  ) : (
                    <Select value={selectedProjectId || undefined} onValueChange={setSelectedProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.filter((p) => p.isActive).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.workspace?.name} / {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="bugfix">Bugfix</SelectItem>
                      <SelectItem value="refactor">Refactor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição da tarefa</Label>
                  <Textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Ex: Criar um botão de logout no header que limpa a sessão e redireciona para /login"
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleGeneratePlan}
                  disabled={loading || taskDescription.length < 10 || !selectedProjectId}
                  className="w-full"
                >
                  {loading ? "Gerando..." : "Gerar Plano →"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ─── Step 2: Plan review + generate spec ─────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Artefatos do Plano</CardTitle>
                  <CardDescription>
                    plan.json, contract.md e task.spec.md gerados pelo LLM. Revise antes de prosseguir.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ArtifactViewer artifacts={planArtifacts} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gerar Testes</CardTitle>
                  <CardDescription>
                    O LLM vai criar o arquivo de testes baseado no plano e contrato acima.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleGenerateSpec} disabled={loading} className="w-full">
                    {loading ? "Gerando..." : "Gerar Testes →"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── Step 3: Validate ─────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Artefatos Gerados</CardTitle>
                </CardHeader>
                <CardContent>
                  <ArtifactViewer artifacts={[...planArtifacts, ...specArtifacts]} />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Validar com Gatekeeper</CardTitle>
                    <CardDescription>
                      Enviar artefatos para validação (Gates 0 e 1).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleValidate} disabled={loading || !selectedProjectId} className="w-full">
                      {loading ? "Validando..." : "Validar →"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Executar Direto</CardTitle>
                    <CardDescription>
                      Pular validação e executar via Claude Agent SDK.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleExecute} disabled={loading} variant="outline" className="w-full">
                      {loading ? "Executando..." : "Executar sem validar →"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {validationStatus === "FAILED" && runId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-destructive">Validação Falhou</CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button variant="outline" onClick={() => handleFix("plan")} disabled={loading}>
                      Corrigir Plano
                    </Button>
                    <Button variant="outline" onClick={() => handleFix("spec")} disabled={loading}>
                      Corrigir Testes
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/runs/${runId}/v2`)}>
                      Ver Resultados
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ─── Step 4: Execute result ───────────────────────────────── */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-400">Execução Concluída</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {executeResult?.mode === "cli" && executeResult.command && (
                  <div className="space-y-2">
                    <Label>Comando para executar manualmente:</Label>
                    <pre className="p-4 rounded bg-muted text-xs font-mono overflow-auto">
                      {executeResult.command}
                    </pre>
                  </div>
                )}
                {executeResult?.mode === "sdk" && (
                  <p className="text-sm text-muted-foreground">
                    Implementação executada via Claude Agent SDK.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setStep(0)
                      setCompletedSteps(new Set())
                      setOutputId(undefined)
                      setLogs([])
                    }}
                  >
                    Nova Tarefa
                  </Button>
                  {runId && (
                    <Button variant="outline" onClick={() => navigate(`/runs/${runId}/v2`)}>
                      Ver Run
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Log panel */}
          <LogPanel logs={logs} />
        </>
      )}
    </div>
  )
}
