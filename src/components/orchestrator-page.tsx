import { useState, useCallback, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api, API_BASE } from "@/lib/api"
import type { Project, RunWithResults, ValidatorResult, GateResult } from "@/lib/types"
import { useEffect } from "react"
import { useOrchestratorEvents, type OrchestratorEvent } from "@/hooks/useOrchestratorEvents"
import { useRunEvents } from "@/hooks/useRunEvents"
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
// Session persistence
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "gk-orchestrator-session"

interface OrchestratorSession {
  outputId?: string
  step: number
  completedSteps: number[]
  taskDescription: string
  taskType?: string
  selectedProjectId: string | null
  provider: string
  model: string
  stepLLMs?: Record<number, { provider: string; model: string }>
  planArtifacts: ParsedArtifact[]
  specArtifacts: ParsedArtifact[]
  runId: string | null
  savedAt: number
}

function saveSession(session: OrchestratorSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch { /* sessionStorage full or unavailable */ }
}

function loadSession(): OrchestratorSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as OrchestratorSession
    // Expire sessions older than 4 hours
    if (Date.now() - session.savedAt > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

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
  correctedTaskPrompt?: string
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

  const content = artifacts[selected]?.content ?? ""
  const lines = content.split("\n")

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
      <div className="overflow-auto max-h-96 bg-card">
        <table className="w-full" style={{ borderCollapse: 'collapse', borderSpacing: 0 }}>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} style={{ border: 'none' }}>
                <td className="select-none text-right pr-2 pl-2 py-0 text-[10px] font-mono text-muted-foreground/25 w-[1%] whitespace-nowrap align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {i + 1}
                </td>
                <td className="pl-3 pr-4 py-0 text-xs font-mono whitespace-pre text-foreground align-top leading-[1.35rem]" style={{ border: 'none' }}>
                  {line || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const headerPortals = usePageShell({ page: "orchestrator" })

  // ── Restore session from sessionStorage or URL params ────────────────
  const saved = useRef(loadSession()).current
  const resumeOutputId = searchParams.get("outputId")
  const resumeStep = searchParams.get("step") ? Number(searchParams.get("step")) : undefined

  // ── Tab state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PageTab>("pipeline")

  // ── Pipeline state (initialized from saved session) ────────────────────
  const [step, setStep] = useState<WizardStep>(() =>
    (resumeStep ?? saved?.step ?? 0) as WizardStep
  )
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() =>
    new Set(saved?.completedSteps ?? [])
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [resuming, setResuming] = useState(false)

  // Step 0
  const [taskDescription, setTaskDescription] = useState(saved?.taskDescription ?? "")
  const [taskType, setTaskType] = useState<string | undefined>(saved?.taskType)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(saved?.selectedProjectId ?? null)

  // ── Per-step LLM configuration ─────────────────────────────────────────
  // CRITICAL: Each pipeline step MUST use a different LLM to prevent bias.
  // Per-step LLM configuration — allows choosing different models per step.
  // Session isolation is guaranteed by the backend: each step spawns
  // a fresh CLI process with its own session_id.
  interface StepLLMConfig { provider: string; model: string }

  const [stepLLMs, setStepLLMs] = useState<Record<number, StepLLMConfig>>(
    saved?.stepLLMs ?? {
      1: { provider: "claude-code", model: "sonnet" },
      2: { provider: "claude-code", model: "sonnet" },
      3: { provider: "claude-code", model: "sonnet" },
      4: { provider: "claude-code", model: "sonnet" },
    }
  )

  const setStepLLM = (step: number, field: "provider" | "model", value: string) => {
    setStepLLMs((prev) => {
      const updated = { ...prev, [step]: { ...prev[step], [field]: value } }
      if (field === "provider") {
        const models = PROVIDER_MODELS[value]?.models
        if (models?.length) updated[step].model = models[0].value
      }
      return updated
    })
  }

  // Convenience aliases
  const provider = stepLLMs[1]?.provider ?? "claude-code"
  const model = stepLLMs[1]?.model ?? "sonnet"

  const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
    "anthropic": {
      label: "Anthropic (API Key)",
      models: [
        { value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
        { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
        { value: "claude-opus-4-5-20251101", label: "Opus 4.5" },
      ],
    },
    "openai": {
      label: "OpenAI (API Key)",
      models: [
        { value: "gpt-4.1", label: "GPT-4.1" },
        { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
        { value: "o3-mini", label: "o3-mini" },
      ],
    },
    "mistral": {
      label: "Mistral (API Key)",
      models: [
        { value: "mistral-large-latest", label: "Mistral Large" },
        { value: "codestral-latest", label: "Codestral" },
      ],
    },
    "claude-code": {
      label: "Claude Code (Max/Pro \u2014 sem API Key)",
      models: [
        { value: "sonnet", label: "Sonnet" },
        { value: "opus", label: "Opus" },
        { value: "haiku", label: "Haiku" },
      ],
    },
    "codex-cli": {
      label: "Codex CLI (OpenAI \u2014 sem API Key)",
      models: [
        { value: "o3-mini", label: "o3-mini" },
        { value: "o4-mini", label: "o4-mini" },
        { value: "gpt-4.1", label: "GPT-4.1" },
        { value: "codex-mini", label: "Codex Mini" },
      ],
    },
  }

  // Step 1 result
  const [outputId, setOutputId] = useState<string | undefined>(resumeOutputId ?? saved?.outputId)
  const [planArtifacts, setPlanArtifacts] = useState<ParsedArtifact[]>(saved?.planArtifacts ?? [])

  // Step 2 result
  const [specArtifacts, setSpecArtifacts] = useState<ParsedArtifact[]>(saved?.specArtifacts ?? [])

  // Step 3 result
  const [runId, setRunId] = useState<string | null>(saved?.runId ?? null)
  const [validationStatus, setValidationStatus] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<RunWithResults | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  // Step 4 result
  const [executeResult, setExecuteResult] = useState<{ mode: string; command?: string } | null>(null)

  // Attachments (ad-hoc files for plan generation context)
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; content: string; size: number }>>([])

  // ── Persist session on state changes ───────────────────────────────────
  useEffect(() => {
    if (!outputId && step === 0) return // nothing to persist
    saveSession({
      outputId,
      step,
      completedSteps: [...completedSteps],
      taskDescription,
      taskType,
      selectedProjectId,
      provider,
      model,
      stepLLMs,
      planArtifacts,
      specArtifacts,
      runId,
      savedAt: Date.now(),
    })
  }, [outputId, step, completedSteps, taskDescription, taskType, selectedProjectId, provider, model, stepLLMs, planArtifacts, specArtifacts, runId])

  // ── Resume from URL ?outputId=xxx — reload artifacts from disk ─────────
  useEffect(() => {
    if (!resumeOutputId || planArtifacts.length > 0) return
    // Clean URL params after reading
    setSearchParams({}, { replace: true })

    setResuming(true)
    const projectPath = projects.find((p) => p.id === selectedProjectId)?.workspace?.rootPath

    api.bridgeArtifacts.readAll(resumeOutputId, projectPath).then((artifacts) => {
      const plan = artifacts.filter((a) =>
        ["plan.json", "contract.md", "task.spec.md"].includes(a.filename)
      )
      const specs = artifacts.filter((a) =>
        a.filename.endsWith(".spec.ts") || a.filename.endsWith(".spec.tsx") || a.filename.endsWith(".test.ts") || a.filename.endsWith(".test.tsx")
      )

      if (plan.length > 0) setPlanArtifacts(plan)
      if (specs.length > 0) setSpecArtifacts(specs)

      // Determine which step to show
      const targetStep = (resumeStep ?? (specs.length > 0 ? 3 : plan.length > 0 ? 2 : 0)) as WizardStep
      setStep(targetStep)

      const completed = new Set<number>()
      if (plan.length > 0) { completed.add(0); completed.add(1) }
      if (specs.length > 0) { completed.add(2) }
      setCompletedSteps(completed)

      addLog("info", `Sessão restaurada: ${resumeOutputId} (${artifacts.length} artefatos)`)
      toast.success("Sessão restaurada")
    }).catch((err) => {
      addLog("error", `Falha ao restaurar: ${err.message}`)
      toast.error("Não foi possível carregar artefatos do outputId")
    }).finally(() => {
      setResuming(false)
    })
  }, [resumeOutputId, projects]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset all state ────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    clearSession()
    setStep(0)
    setCompletedSteps(new Set())
    setOutputId(undefined)
    setPlanArtifacts([])
    setSpecArtifacts([])
    setRunId(null)
    setValidationStatus(null)
    setRunResults(null)
    setExecuteResult(null)
    setError(null)
    setLogs([])
    setTaskDescription("")
    setTaskType(undefined)
    toast.success("Sessão resetada")
  }, [])

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
      // ── User-friendly log messages ─────────────────────────────────────
      switch (event.type) {
        case "agent:bridge_start":
          addLog("info", `Iniciando etapa ${event.step}...`)
          break
        case "agent:start":
          addLog("info", `LLM ${event.provider}/${event.model} conectado`)
          break
        case "agent:iteration":
          addLog("info", `Iteração ${event.iteration} — ${(event.tokensUsed as any)?.inputTokens?.toLocaleString() ?? "?"} tokens in`)
          break
        case "agent:tool_call":
          addLog("info", `🔧 ${event.tool}`)
          break
        case "agent:tool_result":
          addLog(event.isError ? "error" : "info", `${event.tool} (${event.durationMs}ms)`)
          break
        case "agent:budget_warning":
          addLog("warning", `⚠️ Budget ${event.percentUsed}% usado (${event.usedTokens}/${event.budgetTokens})`)
          break
        case "agent:complete":
          addLog("info", `LLM finalizado`)
          break
        case "agent:bridge_plan_done": {
          const artifacts = (event.artifacts ?? []) as ParsedArtifact[]
          const tokens = event.tokensUsed as { inputTokens: number; outputTokens: number } | undefined
          setPlanArtifacts(artifacts)
          markComplete(0)
          markComplete(1)
          setStep(2)
          setLoading(false)
          addLog("success", `Plano gerado: ${event.outputId} (${artifacts.length} artefatos${tokens ? `, ${tokens.inputTokens.toLocaleString()} tokens` : ""})`)
          toast.success("Plano gerado com sucesso")
          break
        }
        case "agent:error":
          setError(String(event.error))
          setLoading(false)
          addLog("error", String(event.error))
          toast.error(String(event.error))
          break
        default:
          addLog(event.type, typeof event.text === "string" ? event.text : JSON.stringify(event))
      }
    },
    [addLog]
  )

  useOrchestratorEvents(outputId, handleSSE)

  // ── Run validation SSE — polls run status inline ──────────────────────
  const validationResolvedRef = useRef(false)

  const handleRunEvent = useCallback(async () => {
    if (!runId || validationResolvedRef.current) return
    try {
      const results = await api.runs.getWithResults(runId)
      setRunResults(results)

      const status = results.status
      if (status === "COMPLETED" || status === "FAILED") {
        // Guard: only process terminal status once
        if (validationResolvedRef.current) return
        validationResolvedRef.current = true

        const passed = results.gateResults?.every((g: GateResult) => g.passed) ?? false
        setValidationStatus(passed ? "PASSED" : "FAILED")
        setLoading(false)

        if (passed) {
          markComplete(3)
          addLog("success", "✅ Gates 0-1 aprovados — avançando para execução...")
          toast.success("Validação aprovada! Avançando para execução...")
          // Auto-advance to step 4 after a brief pause so user can see the result
          setTimeout(() => {
            setStep(4)
          }, 1500)
        } else {
          const failedGates = results.gateResults?.filter((g: GateResult) => !g.passed).map((g: GateResult) => g.gateName)
          const failedValidatorNames = results.validatorResults
            ?.filter((v: ValidatorResult) => !v.passed && !v.bypassed)
            .map((v: ValidatorResult) => v.validatorCode) ?? []
          addLog("error", `Validação falhou: ${failedGates?.join(", ")} (${failedValidatorNames.length} validator${failedValidatorNames.length !== 1 ? "s" : ""})`)
          toast.error("Validação falhou")
        }
      }
    } catch (err) {
      console.error("Failed to refresh run:", err)
    }
  }, [runId, addLog]) // eslint-disable-line react-hooks/exhaustive-deps

  const shouldConnectRunEvents = validationStatus === "RUNNING" && !!runId
  useRunEvents(shouldConnectRunEvents ? runId ?? undefined : undefined, handleRunEvent)

  // ── Helpers ────────────────────────────────────────────────────────────
  const markComplete = (s: number) => setCompletedSteps((prev) => new Set([...prev, s]))

  /** Merge fix results into existing artifacts: update matching filenames, keep the rest intact.
   *  If fixResult is empty/undefined, returns existing artifacts unchanged. */
  const mergeArtifacts = (existing: ParsedArtifact[], fixResult?: ParsedArtifact[]): ParsedArtifact[] => {
    if (!fixResult || fixResult.length === 0) return existing
    const merged = [...existing]
    for (const fixed of fixResult) {
      const idx = merged.findIndex((a) => a.filename === fixed.filename)
      if (idx >= 0) {
        merged[idx] = fixed
      } else {
        merged.push(fixed)
      }
    }
    return merged
  }

  // Check LLM isolation: step 1 model must differ from step 2, and both from step 4
  const apiPost = async (endpoint: string, body: Record<string, unknown>, retries = 0, timeoutMs = 300_000): Promise<any> => {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          addLog("warning", `Tentativa ${attempt + 1}/${retries + 1} para ${endpoint}...`)
          await new Promise((r) => setTimeout(r, 1500 * attempt))
        }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        try {
          const res = await fetch(`${API_BASE}/agent/bridge/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          clearTimeout(timer)
          if (!res.ok) {
            const err = await res.json().catch(() => null)
            throw new Error(err?.error || err?.message || `HTTP ${res.status}`)
          }
          return res.json()
        } catch (err) {
          clearTimeout(timer)
          if (err instanceof DOMException && err.name === "AbortError") {
            throw new Error(`Timeout: ${endpoint} demorou mais de ${Math.round(timeoutMs / 60000)}min — verifique o servidor`)
          }
          throw err
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isNetwork = lastError.message === "Failed to fetch" || lastError.message.includes("NetworkError")
        if (!isNetwork || attempt >= retries) throw lastError
      }
    }
    throw lastError!
  }

  const getProjectPath = () => {
    const project = projects.find((p) => p.id === selectedProjectId)
    return project?.workspace?.rootPath || ""
  }

  // ── Step 1: Generate Plan ──────────────────────────────────────────────
  // ── File drop handler ────────────────────────────────────────────────
  const handleFileDrop = useCallback((files: File[]) => {
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB per file
    const MAX_FILES = 10

    for (const file of files) {
      if (attachments.length >= MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} anexos`)
        break
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede 5MB`)
        continue
      }

      const reader = new FileReader()
      reader.onload = () => {
        const isImage = file.type.startsWith("image/")
        const content = isImage
          ? (reader.result as string) // data URL (base64)
          : (reader.result as string) // text content

        setAttachments((prev) => {
          if (prev.some((a) => a.name === file.name)) return prev // dedupe
          return [...prev, { name: file.name, type: file.type, content, size: file.size }]
        })
      }

      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
    }
  }, [attachments.length])

  const handleGeneratePlan = async () => {
    setError(null)
    setLoading(true)
    addLog("info", "Gerando plano...")

    try {
      // POST returns 202 immediately with outputId — plan runs in background
      const payload: Record<string, unknown> = {
        taskDescription,
        taskType,
        provider: stepLLMs[1].provider,
        model: stepLLMs[1].model,
        projectPath: getProjectPath(),
      }

      // Include attachments as context
      if (attachments.length > 0) {
        payload.attachments = attachments.map((a) => ({
          name: a.name,
          type: a.type,
          content: a.content,
        }))
        addLog("info", `${attachments.length} anexo(s) incluído(s)`)
      }

      const result = await apiPost("plan", payload)

      // Set outputId immediately so SSE connects and starts receiving events
      setOutputId(result.outputId)
      addLog("info", `Conectado: ${result.outputId}`)

      // Completion is handled by handleSSE when it receives 'agent:bridge_plan_done'
      // loading=false is also set there
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar plano"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
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
      const result: StepResult = await apiPost("spec", { outputId, provider: stepLLMs[2].provider, model: stepLLMs[2].model, projectPath: getProjectPath() })

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
    setRunResults(null)
    validationResolvedRef.current = false
    addLog("info", "Iniciando validação Gatekeeper...")

    try {
      const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
      if (!planArtifact) throw new Error("plan.json não encontrado")

      const plan = JSON.parse(planArtifact.content)

      // plan.json can follow LLMPlanOutput schema (manifest.files) or be flat (files at root)
      const files = plan.manifest?.files || plan.files || []
      const testFile = plan.manifest?.testFile || plan.testFile || specArtifacts[0]?.filename || "spec.test.ts"

      if (files.length === 0) {
        throw new Error(
          "plan.json não contém arquivos no manifest. " +
          "Verifique se o plano gerado inclui 'manifest.files' com pelo menos um arquivo."
        )
      }

      const manifest = { files, testFile }

      // Extract contract from plan.json if present (used by TestClauseMappingValid)
      const contract = plan.contract || undefined

      const response = await api.runs.create({
        projectId: selectedProjectId,
        outputId,
        taskPrompt: taskDescription,
        manifest,
        contract,
        dangerMode: plan.dangerMode || false,
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

      addLog("success", `Run criada: ${response.runId} — aguardando resultado...`)
      // SSE via useRunEvents will pick up the run and update results inline
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar validação"
      const isSchemaError = msg.includes("CONTRACT_SCHEMA_INVALID") || msg.includes("erros de schema")
      if (isSchemaError) {
        setError(null) // Don't show generic error banner — show specific schema error state
        setValidationStatus("SCHEMA_ERROR")
        setSchemaError(msg)
        addLog("error", `Schema do contrato inválido: ${msg}`)
        toast.error("Contrato com erros de schema — regenere o plano", { duration: 6000 })
      } else {
        setError(msg)
        setValidationStatus("FAILED")
        addLog("error", msg)
        toast.error(msg)
      }
      setLoading(false)
    }
  }

  // ── Step 3b: Fix artifacts ─────────────────────────────────────────────
  const lastFixHashRef = useRef<string | null>(null)

  const handleFix = async (target: "plan" | "spec") => {
    if (!outputId) return
    // For schema errors, we don't need runId — we pass the error directly
    const isSchemaFix = validationStatus === "SCHEMA_ERROR" && !!schemaError
    if (!runId && !isSchemaFix) return
    setError(null)
    setLoading(true)

    // Capture pre-fix hash to detect loops
    const preFix = target === "spec" ? specArtifacts : planArtifacts
    const preHash = preFix.map((a) => a.content).join("|||")

    // Log detailed info about what we're fixing
    let failedVCodes: string[]
    if (isSchemaFix) {
      failedVCodes = ["CONTRACT_SCHEMA_INVALID"]
      addLog("info", `Corrigindo ${target} — schema inválido no contrato`)
    } else {
      const failedVs = (runResults?.validatorResults ?? [])
        .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
      failedVCodes = failedVs.map((v: ValidatorResult) => v.validatorCode)
      if (failedVCodes.length === 0) failedVCodes.push("unknown")
      addLog("info", `Corrigindo ${target} — validators: ${failedVCodes.join(", ")}`)
      for (const v of failedVs.slice(0, 3)) {
        addLog("info", `  → ${v.validatorCode}: ${v.message || v.validatorName}`)
      }
    }

    try {
      const fixLLM = stepLLMs[3] ?? stepLLMs[2] // step 3 = fix, fallback to step 2
      const result: StepResult = await apiPost("fix", {
        outputId,
        target,
        runId: runId || undefined,
        failedValidators: failedVCodes,
        // For schema errors, pass the error as rejectionReport since there's no runId
        rejectionReport: isSchemaFix ? schemaError : undefined,
        provider: fixLLM.provider,
        model: fixLLM.model,
        projectPath: getProjectPath(),
        taskPrompt: taskDescription,
      })

      // Check for fix loop
      const postHash = (result.artifacts ?? []).map((a: ParsedArtifact) => a.content).join("|||")
      const isLoop = postHash === preHash || (lastFixHashRef.current && postHash === lastFixHashRef.current)
      lastFixHashRef.current = postHash

      if (target === "plan") {
        setPlanArtifacts((prev) => mergeArtifacts(prev, result.artifacts))
      } else {
        setSpecArtifacts((prev) => mergeArtifacts(prev, result.artifacts))
      }

      if (result.correctedTaskPrompt) {
        setTaskDescription(result.correctedTaskPrompt)
        addLog("info", "Task prompt atualizado pelo fixer (termos implícitos removidos)")
      }

      setValidationStatus(null)
      setSchemaError(null)
      setRunResults(null)
      setRunId(null)

      if (isLoop) {
        const warn = `⚠️ Fix loop: resultado idêntico ao anterior! ` +
          `Tente: (1) editar o spec manualmente, (2) trocar o provider do step ${fixStep}, ou (3) reescrever a task.`
        addLog("warning", warn)
        toast.error("Fix loop — resultado idêntico", { duration: 8000 })
      } else {
        addLog("success", `${target} corrigido (${result.artifacts?.length ?? 0} arquivo(s)) — pronto para re-validar`)
        toast.success(`${target === "plan" ? "Plano" : "Testes"} corrigido`)
      }
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
    const projectPath = getProjectPath()
    if (!projectPath) {
      const msg = "Projeto sem workspace.rootPath configurado — execute requer um diretório de trabalho."
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
      return
    }
    setError(null)
    setLoading(true)
    addLog("info", `Executando implementação... (provider: ${stepLLMs[4].provider}, model: ${stepLLMs[4].model})`)
    try {
      // Execute returns 202 — result comes via SSE (agent:bridge_execute_done)
      const result = await apiPost("execute", { outputId, projectPath, provider: stepLLMs[4].provider, model: stepLLMs[4].model }, 1)
      setExecuteResult(result)
      markComplete(3)
      markComplete(4)
      setStep(4)
      addLog("success", `Execução concluída (modo: ${result.mode})`)
      toast.success("Execução concluída — iniciando validação de integridade...")

      // Auto-trigger post-execution validation (Gates 2-3)
      try {
        addLog("info", "Iniciando validação pós-execução (Gates 2-3)...")
        setValidationStatus("RUNNING")
        validationResolvedRef.current = false

        const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
        if (planArtifact) {
          const plan = JSON.parse(planArtifact.content)
          const files = plan.manifest?.files || plan.files || []
          const testFile = plan.manifest?.testFile || plan.testFile || specArtifacts[0]?.filename || "spec.test.ts"
          const contract = plan.contract || undefined

          const execRunResponse = await api.runs.create({
            projectId: selectedProjectId!,
            outputId,
            taskPrompt: taskDescription,
            manifest: { files, testFile },
            contract,
            dangerMode: plan.dangerMode || false,
            runType: "EXECUTION",
          })

          setRunId(execRunResponse.runId)
          addLog("success", `Run de execução criada: ${execRunResponse.runId}`)

          if (specArtifacts.length > 0) {
            const formData = new FormData()
            const planBlob = new Blob([planArtifact.content], { type: "application/json" })
            formData.append("planJson", planBlob, "plan.json")
            const specBlob = new Blob([specArtifacts[0].content], { type: "text/plain" })
            formData.append("specFile", specBlob, specArtifacts[0].filename)
            await api.runs.uploadFiles(execRunResponse.runId, formData)
          }
        }
      } catch (execValErr) {
        addLog("warning", `Validação pós-execução não pôde ser iniciada: ${execValErr instanceof Error ? execValErr.message : String(execValErr)}`)
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro na execução"
      const isNetwork = raw === "Failed to fetch" || raw.includes("NetworkError")
      const msg = isNetwork
        ? `Erro de rede ao chamar /agent/bridge/execute — verifique se o servidor está rodando em ${API_BASE}`
        : raw
      setError(msg)
      addLog("error", msg)
      toast.error(isNetwork ? "Servidor inacessível" : msg)
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {outputId}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-muted-foreground hover:text-destructive">
              ✕ Resetar
            </Button>
          </div>
        )}
        {tab === "pipeline" && !outputId && saved?.outputId && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              // Restore from last session
              if (saved.outputId) setOutputId(saved.outputId)
              if (saved.planArtifacts?.length) setPlanArtifacts(saved.planArtifacts)
              if (saved.specArtifacts?.length) setSpecArtifacts(saved.specArtifacts)
              setStep((saved.step ?? 0) as WizardStep)
              setCompletedSteps(new Set(saved.completedSteps ?? []))
              if (saved.taskDescription) setTaskDescription(saved.taskDescription)
              if (saved.runId) setRunId(saved.runId)
              addLog("info", `Sessão anterior restaurada: ${saved.outputId}`)
            }}
          >
            Retomar sessão ({saved.outputId?.slice(-20)})
          </Button>
        )}
      </div>

      {/* ─── Config tab ──────────────────────────────────────────────── */}
      {tab === "config" && <OrchestratorConfigPanel />}

      {/* ─── Pipeline tab ────────────────────────────────────────────── */}
      {tab === "pipeline" && (
        <>
          {/* Step indicator */}
          <StepIndicator current={step} completed={completedSteps} />

          {/* Resuming indicator */}
          {resuming && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-400 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Restaurando sessão...
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 text-xs">
                Resetar
              </Button>
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

                <div className="grid grid-cols-2 gap-4">
                  {/* Per-step LLM configuration */}
                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>LLMs por Etapa</Label>
                      <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 bg-muted rounded">
                        Sessões isoladas
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Cada etapa roda em sessão independente. Você pode usar o mesmo ou diferentes modelos por etapa.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { step: 1, label: "Planejamento", desc: "plan + contract" },
                        { step: 2, label: "Testes", desc: "spec file" },
                        { step: 4, label: "Execução", desc: "implementation" },
                      ] as const).map(({ step: s, label, desc }) => {
                        const cfg = stepLLMs[s]

                        return (
                          <div key={s} className="space-y-1.5 p-2.5 rounded-lg border border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{label}</span>
                              <span className="text-[10px] text-muted-foreground">{desc}</span>
                            </div>
                            <Select value={cfg.provider} onValueChange={(v) => setStepLLM(s, "provider", v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PROVIDER_MODELS).map(([key, c]) => (
                                  <SelectItem key={key} value={key}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={cfg.model} onValueChange={(v) => setStepLLM(s, "model", v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(PROVIDER_MODELS[cfg.provider]?.models || []).map((m) => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
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

                {/* Attachments */}
                <div className="space-y-2">
                  <Label>Anexos (opcional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Imagens, documentos ou arquivos de referência que não são recorrentes. Serão incluídos como contexto para o LLM.
                  </p>
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                    onClick={() => document.getElementById("orchestrator-file-input")?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleFileDrop(Array.from(e.dataTransfer.files))
                    }}
                  >
                    <input
                      id="orchestrator-file-input"
                      type="file"
                      multiple
                      className="hidden"
                      accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,.yml,.yaml,.toml,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf"
                      onChange={(e) => handleFileDrop(Array.from(e.target.files || []))}
                    />
                    <p className="text-sm text-muted-foreground">
                      {attachments.length === 0
                        ? "Arraste arquivos aqui ou clique para selecionar"
                        : `${attachments.length} arquivo(s) anexado(s)`}
                    </p>
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((att, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          <span className="text-xs font-mono truncate max-w-[200px]">{att.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({att.type.startsWith("image/") ? "img" : (att.size / 1024).toFixed(0) + "KB"})
                          </span>
                          <button
                            className="ml-1 rounded-full hover:bg-destructive/20 px-1 text-xs"
                            onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        </Badge>
                      ))}
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setAttachments([])}
                      >
                        Limpar todos
                      </button>
                    </div>
                  )}
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

              {/* Actions: Validate / Execute / View Run */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Validar com Gatekeeper</CardTitle>
                    <CardDescription>
                      Enviar artefatos para validação (Gates 0 e 1).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleValidate}
                      disabled={loading || !selectedProjectId || validationStatus === "RUNNING"}
                      className="w-full"
                    >
                      {validationStatus === "RUNNING" ? "Validando..." : validationStatus === "FAILED" ? "Re-validar →" : "Validar →"}
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
                  <CardContent className="space-y-2">
                    {/* Inline LLM selector for execute */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">LLM:</span>
                      <Select value={stepLLMs[4]?.provider ?? "claude-code"} onValueChange={(v) => setStepLLM(4, "provider", v)}>
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROVIDER_MODELS).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={stepLLMs[4]?.model ?? "sonnet"} onValueChange={(v) => setStepLLM(4, "model", v)}>
                        <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(PROVIDER_MODELS[stepLLMs[4]?.provider ?? "claude-code"]?.models || []).map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleExecute} disabled={loading} variant="outline" className="w-full">
                      {loading && validationStatus !== "RUNNING" ? "Executando..." : "Executar sem validar →"}
                    </Button>
                    {runId && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/runs/${runId}/v2`)} className="w-full text-xs text-muted-foreground">
                        Ver detalhes da run →
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Inline validation results ─────────────────────────── */}
              {validationStatus === "SCHEMA_ERROR" && schemaError && (
                <Card className="border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="text-amber-400">⚠ Contrato com Schema Inválido</CardTitle>
                    <CardDescription>
                      O LLM gerou um contrato com campos de tipo errado. A validação não pode prosseguir até que o contrato esteja correto.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <pre className="text-xs font-mono text-amber-200 bg-amber-950/30 rounded p-3 max-h-40 overflow-auto whitespace-pre-wrap">
                      {schemaError}
                    </pre>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Volta ao step 0 para regenerar o plano
                          setStep(0)
                          setCompletedSteps(new Set())
                          setOutputId(null)
                          setPlanArtifacts([])
                          setSpecArtifacts([])
                          setValidationStatus(null)
                          setSchemaError(null)
                          setRunId(null)
                          addLog("info", "Pipeline reiniciado — regenere o plano")
                        }}
                        variant="outline"
                      >
                        Regenerar Plano do Zero
                      </Button>
                      <Button
                        onClick={() => {
                          // Try to fix the contract in-place by re-running plan step
                          setValidationStatus(null)
                          setSchemaError(null)
                          handleFix("plan")
                        }}
                        variant="outline"
                      >
                        Corrigir Plano (LLM)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-xs text-muted-foreground"
                        onClick={() => {
                          setValidationStatus(null)
                          setSchemaError(null)
                        }}
                      >
                        Fechar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {validationStatus === "RUNNING" && (
                <Card className="border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                      Validação em andamento...
                    </CardTitle>
                  </CardHeader>
                  {runResults && (
                    <CardContent>
                      <div className="space-y-2">
                        {(runResults.gateResults ?? []).map((gate: GateResult) => (
                          <div key={gate.gateNumber} className="flex items-center gap-2 text-sm">
                            <span className={gate.passed ? "text-green-400" : gate.status === "RUNNING" ? "text-blue-400" : "text-muted-foreground"}>
                              {gate.passed ? "✓" : gate.status === "RUNNING" ? "⟳" : "○"}
                            </span>
                            <span>Gate {gate.gateNumber}: {gate.gateName}</span>
                            {gate.passed && <Badge variant="outline" className="text-green-400 text-[10px]">OK</Badge>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {validationStatus === "PASSED" && runId && (
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400">✓ Validação Aprovada</CardTitle>
                    <CardDescription>
                      Gates 0 e 1 passaram. Pronto para executar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">LLM p/ execução:</span>
                      <Select value={stepLLMs[4]?.provider ?? "claude-code"} onValueChange={(v) => setStepLLM(4, "provider", v)}>
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(PROVIDER_MODELS).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={stepLLMs[4]?.model ?? "sonnet"} onValueChange={(v) => setStepLLM(4, "model", v)}>
                        <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(PROVIDER_MODELS[stepLLMs[4]?.provider ?? "claude-code"]?.models || []).map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleExecute} disabled={loading} className="w-full">
                      {loading ? "Executando..." : "Executar Implementação →"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {validationStatus === "FAILED" && runId && runResults && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">✗ Validação Falhou</CardTitle>
                    <CardDescription>
                      Os erros dos validators serão enviados para a LLM corrigir os artefatos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Gate results summary */}
                    <div className="space-y-2">
                      {(runResults.gateResults ?? []).map((gate: GateResult) => (
                        <div key={gate.gateNumber} className="flex items-center gap-2 text-sm">
                          <span className={gate.passed ? "text-green-400" : "text-destructive"}>
                            {gate.passed ? "✓" : "✗"}
                          </span>
                          <span>Gate {gate.gateNumber}: {gate.gateName}</span>
                          <Badge variant="outline" className={`text-[10px] ${gate.passed ? "text-green-400" : "text-destructive"}`}>
                            {gate.passed ? "OK" : "FAIL"}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Failed validators with details */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Validators que falharam:</Label>
                      {(runResults.validatorResults ?? [])
                        .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
                        .map((v: ValidatorResult) => (
                          <div key={v.validatorCode} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-destructive">{v.validatorCode}</span>
                              <span className="text-xs text-muted-foreground">{v.validatorName}</span>
                              {v.isHardBlock && <Badge variant="destructive" className="text-[10px]">HARD BLOCK</Badge>}
                            </div>
                            {v.message && (
                              <p className="text-xs text-foreground">{v.message}</p>
                            )}
                            {v.details && (
                              <pre className="text-[11px] font-mono text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                                {typeof v.details === "string" ? v.details : JSON.stringify(v.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Fix actions */}
                    <div className="space-y-3 pt-2">
                      {/* Inline LLM selector for fix */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">LLM p/ correção:</span>
                        <Select value={stepLLMs[3]?.provider ?? "claude-code"} onValueChange={(v) => setStepLLM(3, "provider", v)}>
                          <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(PROVIDER_MODELS).map(([key, c]) => (
                              <SelectItem key={key} value={key}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={stepLLMs[3]?.model ?? "sonnet"} onValueChange={(v) => setStepLLM(3, "model", v)}>
                          <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(PROVIDER_MODELS[stepLLMs[3]?.provider ?? "claude-code"]?.models || []).map((m) => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        {(() => {
                          // Auto-detect fix target based on failed validators
                          const PLAN_VALIDATORS = [
                            'NO_IMPLICIT_FILES', 'TASK_CLARITY_CHECK', 'TOKEN_BUDGET_FIT',
                            'TASK_SCOPE_SIZE', 'DELETE_DEPENDENCY_CHECK', 'PATH_CONVENTION',
                            'SENSITIVE_FILES_LOCK', 'DANGER_MODE_EXPLICIT',
                            'TEST_CLAUSE_MAPPING_VALID', 'CONTRACT_SCHEMA_INVALID',
                          ]
                          const SPEC_VALIDATORS = [
                            'TEST_RESILIENCE_CHECK', 'NO_DECORATIVE_TESTS', 'TEST_HAS_ASSERTIONS',
                            'TEST_COVERS_HAPPY_AND_SAD_PATH', 'TEST_INTENT_ALIGNMENT', 'TEST_SYNTAX_VALID',
                            'IMPORT_REALITY_CHECK', 'MANIFEST_FILE_LOCK',
                          ]
                          const failed = (runResults?.validatorResults ?? [])
                            .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
                            .map((v: ValidatorResult) => v.validatorCode)
                          const needsPlan = failed.some((v: string) => PLAN_VALIDATORS.includes(v))
                          const needsSpec = failed.some((v: string) => SPEC_VALIDATORS.includes(v))

                          if (needsPlan && needsSpec) {
                            return (
                              <>
                                <Button onClick={() => handleFix("plan")} disabled={loading} variant="outline">
                                  {loading ? "Corrigindo..." : "Corrigir Plano"}
                                </Button>
                                <Button onClick={() => handleFix("spec")} disabled={loading} variant="outline">
                                  {loading ? "Corrigindo..." : "Corrigir Testes"}
                                </Button>
                              </>
                            )
                          }
                          if (needsSpec) {
                            return (
                              <Button onClick={() => handleFix("spec")} disabled={loading} variant="outline" className="flex-1">
                                {loading ? "Corrigindo..." : "Corrigir Testes (auto-detectado)"}
                              </Button>
                            )
                          }
                          // Default to plan (includes needsPlan only, or unknown validators)
                          return (
                            <Button onClick={() => handleFix("plan")} disabled={loading} variant="outline" className="flex-1">
                              {loading ? "Corrigindo..." : "Corrigir Plano (auto-detectado)"}
                            </Button>
                          )
                        })()}
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/runs/${runId}/v2`)} className="ml-auto text-xs text-muted-foreground">
                          Ver run completa →
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ─── Step 4: Execute result + Post-execution validation ───── */}
          {step === 4 && (
            <div className="space-y-4">
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
                </CardContent>
              </Card>

              {/* Post-execution validation (Gates 2-3) */}
              {validationStatus === "RUNNING" && (
                <Card className="border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400">⏳ Validação Pós-Execução (Gates 2-3)</CardTitle>
                    <CardDescription>Verificando compilação, testes, escopo de diff e integridade...</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(runResults?.validatorResults ?? []).map((v: ValidatorResult) => (
                        <div key={v.validatorCode} className="flex items-center gap-2 text-xs">
                          <span className={v.passed ? "text-green-400" : v.bypassed ? "text-yellow-400" : "text-muted-foreground"}>
                            {v.passed ? "✓" : v.bypassed ? "⊘" : "…"}
                          </span>
                          <span className="font-mono">{v.validatorCode}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {validationStatus === "PASSED" && (
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400">✅ Pipeline Completo</CardTitle>
                    <CardDescription>Todas as 4 gates passaram. Código validado e pronto.</CardDescription>
                  </CardHeader>
                </Card>
              )}

              {validationStatus === "FAILED" && runResults && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">Gates 2-3 Falharam</CardTitle>
                    <CardDescription>A implementação não passou na validação de integridade.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(runResults.validatorResults ?? [])
                      .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
                      .map((v: ValidatorResult) => (
                        <div key={v.validatorCode} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-destructive">{v.validatorCode}</span>
                            <span className="text-xs text-muted-foreground">{v.validatorName}</span>
                          </div>
                          {v.message && <p className="text-xs text-foreground">{v.message}</p>}
                          {v.details && (
                            <pre className="text-[11px] font-mono text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                              {typeof v.details === "string" ? v.details : JSON.stringify(v.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    {runId && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/runs/${runId}/v2`)} className="text-xs text-muted-foreground">
                        Ver detalhes da run →
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={handleReset}>
                  Nova Tarefa
                </Button>
                {runId && (
                  <Button variant="outline" onClick={() => navigate(`/runs/${runId}/v2`)}>
                    Ver Run
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Log panel */}
          <LogPanel logs={logs} />
        </>
      )}
    </div>
  )
}
