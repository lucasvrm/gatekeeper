import { useState, useCallback, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api, API_BASE } from "@/lib/api"
import type { Project, RunWithResults, ValidatorResult, GateResult, ArtifactFolder, LLMPlanOutput, ManifestFile, AgentPhaseConfig, ProviderInfo, ProviderModel } from "@/lib/types"
import { useEffect } from "react"
import { useOrchestratorEvents, type OrchestratorEvent } from "@/hooks/useOrchestratorEvents"
import { usePipelineReconciliation } from "@/hooks/usePipelineReconciliation"
import { useRunEvents } from "@/hooks/useRunEvents"
import { usePageShell } from "@/hooks/use-page-shell"
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
import { Copy, MessageSquare, Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { FixInstructionsDialog } from "@/components/fix-instructions-dialog"
import type {
  ParsedArtifact,
  StepResult,
  LogEntry,
  WizardStep,
  PageTab,
  StepLLMConfig,
  OrchestratorSession,
  PlannerSubstep,
} from "./orchestrator/types"
import {
  SESSION_TTL_MS,
  SESSION_KEY_PREFIX,
  ACTIVE_KEY,
  STEPS,
} from "./orchestrator/types"
import { StepIndicator } from "./orchestrator/step-indicator"
import { ArtifactViewer } from "./orchestrator/artifact-viewer"
import { ContextPanel } from "./orchestrator/context-panel"
import { OrchestratorHeader } from "./orchestrator/orchestrator-header"
import { LogsDrawer } from "./orchestrator/logs-drawer"

// ─────────────────────────────────────────────────────────────────────────────
// Session persistence
// ─────────────────────────────────────────────────────────────────────────────

function sessionKey(id: string): string {
  return `${SESSION_KEY_PREFIX}${id}`
}

function saveSession(session: OrchestratorSession) {
  try {
    if (session.outputId) {
      localStorage.setItem(sessionKey(session.outputId), JSON.stringify(session))
      localStorage.setItem(ACTIVE_KEY, session.outputId)
    }
  } catch { /* localStorage full or unavailable */ }
}

function loadSession(outputId?: string, intentToRestore: boolean = false): OrchestratorSession | null {
  try {
    // 1. Try to load by explicit outputId or active pointer
    // Fix Bug #2: Only restore from ACTIVE_KEY if user explicitly intends to restore
    const targetId = outputId || (intentToRestore ? localStorage.getItem(ACTIVE_KEY) : null)
    if (targetId) {
      const raw = localStorage.getItem(sessionKey(targetId))
      if (raw) {
        const session = JSON.parse(raw) as OrchestratorSession
        if (Date.now() - session.savedAt > SESSION_TTL_MS) {
          localStorage.removeItem(sessionKey(targetId))
          if (localStorage.getItem(ACTIVE_KEY) === targetId) localStorage.removeItem(ACTIVE_KEY)
          return null
        }

        // Validate: Don't restore step 3+ without specArtifacts (prevents stuck state from previous bugs)
        if (session.step >= 3 && (!session.specArtifacts || session.specArtifacts.length === 0)) {
          console.warn('[loadSession] Session has step 3+ but no specArtifacts - resetting to step 2')
          session.step = 2
        }

        return session
      }
    }

    // 2. Backward compat: migrate from old sessionStorage format
    const legacyRaw = sessionStorage.getItem("gk-orchestrator-session")
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw)
      if (Date.now() - legacy.savedAt > SESSION_TTL_MS) {
        sessionStorage.removeItem("gk-orchestrator-session")
        return null
      }
      const migrated: OrchestratorSession = {
        ...legacy,
        lastEventId: 0,
        lastSeq: 0,
        pipelineStatus: null,
        pipelineStage: null,
        pipelineProgress: 0,
      }
      if (migrated.outputId) {
        localStorage.setItem(sessionKey(migrated.outputId), JSON.stringify(migrated))
        localStorage.setItem(ACTIVE_KEY, migrated.outputId)
      }
      sessionStorage.removeItem("gk-orchestrator-session")
      return migrated
    }

    return null
  } catch {
    return null
  }
}

function clearSession(outputId?: string) {
  if (outputId) {
    localStorage.removeItem(sessionKey(outputId))
    if (localStorage.getItem(ACTIVE_KEY) === outputId) localStorage.removeItem(ACTIVE_KEY)
  } else {
    const activeId = localStorage.getItem(ACTIVE_KEY)
    if (activeId) localStorage.removeItem(sessionKey(activeId))
    localStorage.removeItem(ACTIVE_KEY)
  }
  sessionStorage.removeItem("gk-orchestrator-session")
}

/**
 * Frontend artifact validation (defensive check before advancing steps)
 */
function validateStepArtifacts(
  step: WizardStep,
  artifacts: ParsedArtifact[]
): { valid: boolean; message: string } {
  if (step === 1) {
    if (artifacts.length === 0) {
      return { valid: false, message: 'Nenhum artefato gerado no step 1' }
    }
    const hasMicroplans = artifacts.some(a => a.filename === 'microplans.json')
    if (!hasMicroplans) {
      return { valid: false, message: 'Artefato crítico ausente: microplans.json' }
    }
    const microplansArtifact = artifacts.find(a => a.filename === 'microplans.json')
    if (microplansArtifact) {
      try {
        const parsed = JSON.parse(microplansArtifact.content)
        if (!parsed.task || typeof parsed.task !== 'string' || parsed.task.trim() === '') {
          return { valid: false, message: 'microplans.json malformado: campo task ausente ou vazio' }
        }
        if (!Array.isArray(parsed.microplans) || parsed.microplans.length === 0) {
          return { valid: false, message: 'microplans.json malformado: campo microplans ausente ou vazio' }
        }
      } catch {
        return { valid: false, message: 'microplans.json inválido: JSON não parseável' }
      }
    }
    return { valid: true, message: 'Artefatos do step 1 válidos' }
  }
  if (step === 2) {
    if (artifacts.length === 0) {
      return { valid: false, message: 'Nenhum artefato de teste gerado no step 2' }
    }
    const hasTestFile = artifacts.some(a => /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(a.filename))
    if (!hasTestFile) {
      return { valid: false, message: 'Nenhum arquivo de teste encontrado (*.spec.ts)' }
    }
    return { valid: true, message: 'Artefatos do step 2 válidos' }
  }
  return { valid: true, message: '' }
}


// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function OrchestratorPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Restore session from localStorage or URL params ─────────────────
  // Fix Bug #2: Don't auto-restore from ACTIVE_KEY without explicit intent
  const saved = useRef(loadSession(searchParams.get("outputId") ?? undefined, false)).current
  const resumeOutputId = searchParams.get("outputId")
  const resumeStep = searchParams.get("step") ? Number(searchParams.get("step")) : undefined

  // ── Tab state (kept for type safety, but we only have pipeline now) ────
  const [tab] = useState<PageTab>("pipeline")

  // ── Pipeline state (initialized from saved session) ────────────────────
  const [step, setStep] = useState<WizardStep>(() =>
    (resumeStep ?? saved?.step ?? 0) as WizardStep
  )
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() =>
    new Set(saved?.completedSteps ?? [])
  )

  // Ref to avoid stale closure in handleSSE
  const stepRef = useRef(step)

  // Keep stepRef in sync with step
  useEffect(() => {
    stepRef.current = step
  }, [step])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [resuming, setResuming] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const debugModeRef = useRef(debugMode)
  debugModeRef.current = debugMode
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(() => {
    const saved = localStorage.getItem('gk-logs-drawer-open')
    return saved === 'true'
  })

  // Persist logs drawer state
  useEffect(() => {
    localStorage.setItem('gk-logs-drawer-open', String(logsDrawerOpen))
  }, [logsDrawerOpen])

  // Rerun — existing artifact folders on disk
  const [diskArtifacts, setDiskArtifacts] = useState<ArtifactFolder[]>([])
  const [showRerunPicker, setShowRerunPicker] = useState(false)
  const [rerunLoading, setRerunLoading] = useState(false)

  // ── Dynamic provider catalog + phase defaults ────────────────────────
  const [providerCatalog, setProviderCatalog] = useState<Record<string, { label: string; models: { value: string; label: string }[] }>>({})
  const [phaseDefaults, setPhaseDefaults] = useState<AgentPhaseConfig[]>([])

  useEffect(() => {
    Promise.all([
      api.mcp.providers.list(),
      api.mcp.models.list(),
      api.mcp.phases.list(),
    ]).then(([providers, models, phases]) => {
      // Build catalog from API data
      const catalog: Record<string, { label: string; models: { value: string; label: string }[] }> = {}
      for (const prov of providers) {
        catalog[prov.name] = { label: prov.label, models: [] }
      }
      for (const m of models.filter(m => m.isActive)) {
        if (!catalog[m.provider]) catalog[m.provider] = { label: m.provider, models: [] }
        catalog[m.provider].models.push({ value: m.modelId, label: m.label || m.modelId })
      }
      setProviderCatalog(catalog)
      setPhaseDefaults(phases)
    }).catch(err => {
      console.error('Failed to load provider catalog:', err)
    })
  }, [])

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

  const [stepLLMs, setStepLLMs] = useState<Record<number, StepLLMConfig>>(
    saved?.stepLLMs ?? {}
  )

  // Fill in defaults from phase configs when they load
  useEffect(() => {
    if (phaseDefaults.length > 0) {
      setStepLLMs(prev => {
        // If session had values, keep them
        if (Object.keys(prev).length > 0) return prev
        const defaults: Record<number, StepLLMConfig> = {}
        for (const phase of phaseDefaults) {
          defaults[phase.step] = { provider: phase.provider, model: phase.model }
        }
        return defaults
      })
    }
  }, [phaseDefaults])

  // Helper: get default provider/model for a step from phase configs
  const getDefault = (s: number): StepLLMConfig => {
    const phase = phaseDefaults.find(p => p.step === s)
    return { provider: phase?.provider ?? 'claude-code', model: phase?.model ?? 'sonnet' }
  }

  // Dynamic PROVIDER_MODELS — falls back to a minimal static catalog when API hasn't loaded yet
  const PROVIDER_MODELS: Record<string, { label: string; models: { value: string; label: string }[] }> =
    Object.keys(providerCatalog).length > 0
      ? providerCatalog
      : {
          "claude-code": { label: "Claude Code CLI", models: [{ value: "sonnet", label: "Sonnet" }, { value: "opus", label: "Opus" }, { value: "haiku", label: "Haiku" }] },
          "codex-cli": { label: "Codex CLI", models: [{ value: "o3-mini", label: "o3-mini" }] },
          "anthropic": { label: "Anthropic (API Key)", models: [{ value: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" }] },
          "openai": { label: "OpenAI (API Key)", models: [{ value: "gpt-4.1", label: "GPT-4.1" }] },
          "mistral": { label: "Mistral (API Key)", models: [{ value: "mistral-large-latest", label: "Mistral Large" }] },
        }

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
  const provider = stepLLMs[1]?.provider ?? getDefault(1).provider
  const model = stepLLMs[1]?.model ?? getDefault(1).model

  // Step 1 result
  const [outputId, setOutputId] = useState<string | undefined>(resumeOutputId ?? saved?.outputId)
  const [planArtifacts, setPlanArtifacts] = useState<ParsedArtifact[]>(
    Array.isArray(saved?.planArtifacts) ? saved.planArtifacts : []
  )

  // Step 2 result
  const [specArtifacts, setSpecArtifacts] = useState<ParsedArtifact[]>(
    Array.isArray(saved?.specArtifacts) ? saved.specArtifacts : []
  )

  // Step results (tracking additional metadata per step)
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({})

  // Step 3 result
  const [runId, setRunId] = useState<string | null>(saved?.runId ?? null)
  const [validationStatus, setValidationStatus] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<RunWithResults | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  // Discovery substep state
  const [plannerSubstep, setPlannerSubstep] = useState<PlannerSubstep>(saved?.plannerSubstep ?? null)
  const [discoveryReportContent, setDiscoveryReportContent] = useState<string | null>(saved?.discoveryReportContent ?? null)
  const [discoveryArtifacts, setDiscoveryArtifacts] = useState<ParsedArtifact[]>(saved?.discoveryArtifacts ?? [])

  // Fix instructions dialog
  const [fixDialogOpen, setFixDialogOpen] = useState(false)
  const [fixDialogTarget, setFixDialogTarget] = useState<"plan" | "spec">("plan")
  const [fixDialogValidators, setFixDialogValidators] = useState<string[]>([])

  // Provider error retry state
  const [retryState, setRetryState] = useState<{
    canRetry: boolean
    availableProviders: string[]
    failedStep: number
    selectedProvider: string
    selectedModel: string
  } | null>(null)

  // Step 4 result
  const [executeResult, setExecuteResult] = useState<{ mode: string; command?: string; tokensUsed?: { inputTokens: number; outputTokens: number } } | null>(null)

  // Execution phase tracking (WRITING = LLM working, null = idle)
  const [executionPhase, setExecutionPhase] = useState<"WRITING" | null>(null)
  const executionPhaseRef = useRef<"WRITING" | null>(null)
  executionPhaseRef.current = executionPhase

  // Nonce to ignore SSE events from stale/previous executions
  const executionNonceRef = useRef(0)
  const currentExecutionNonceRef = useRef<number | null>(null)

  // Pipeline reconciliation tracking refs (persisted to session)
  const lastEventIdRef = useRef(saved?.lastEventId ?? 0)
  const lastSeqRef = useRef(saved?.lastSeq ?? 0)
  const pipelineStatusRef = useRef<string | null>(saved?.pipelineStatus ?? null)
  const pipelineStageRef = useRef<string | null>(saved?.pipelineStage ?? null)
  const pipelineProgressRef = useRef(saved?.pipelineProgress ?? 0)

  const [executionProgress, setExecutionProgress] = useState<{
    provider: string
    model: string
    iteration: number
    inputTokens: number
    outputTokens: number
    lastTool: string | null
    thinkingSeconds: number
    startedAt: number       // Date.now() when execution started
    lastToolTime: number    // Date.now() when last tool_call/iteration arrived
  } | null>(null)

  // Force re-render every 5s during WRITING to update elapsed timers
  const [, setTick] = useState(0)

  // Header portal (page key + header content injection)
  const headerPortals = usePageShell({
    page: "orchestrator",
    headerRight: outputId ? (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Step {step}/4
        </Badge>
        <span className="text-xs text-muted-foreground font-mono">
          {outputId.slice(-8)}
        </span>
      </div>
    ) : null,
  })

  useEffect(() => {
    if (executionPhase !== "WRITING") return
    const interval = setInterval(() => setTick(t => t + 1), 5000)
    return () => clearInterval(interval)
  }, [executionPhase])

  // Trigger for auto-validation after execute_done (avoids stale closures in SSE handler)
  const [executeDoneData, setExecuteDoneData] = useState<any>(null)

  // Git commit phase
  const [commitMessage, setCommitMessage] = useState("")
  const [commitMode, setCommitMode] = useState<"all" | "manifest">("manifest")
  const [gitChangedFiles, setGitChangedFiles] = useState<Array<{ path: string; status: string }>>([])
  const [commitResult, setCommitResult] = useState<{ commitHash: string; message: string } | null>(null)
  const [pushResult, setPushResult] = useState<{ branch: string; commitHash: string } | null>(null)
  const [gitLoading, setGitLoading] = useState(false)

  // Attachments (ad-hoc files for plan generation context)
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; content: string; size: number }>>([])
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false)  // Tarefa 9.1

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
      lastEventId: lastEventIdRef.current,
      lastSeq: lastSeqRef.current,
      pipelineStatus: pipelineStatusRef.current,
      pipelineStage: pipelineStageRef.current,
      pipelineProgress: pipelineProgressRef.current,
      plannerSubstep,
      discoveryReportContent,
      discoveryArtifacts,
    })
  }, [outputId, step, completedSteps, taskDescription, taskType, selectedProjectId, provider, model, stepLLMs, planArtifacts, specArtifacts, runId, plannerSubstep, discoveryReportContent, discoveryArtifacts])

  // ── Load available artifact folders from disk ──────────────────────────
  useEffect(() => {
    if (!selectedProjectId) { setDiskArtifacts([]); return }
    api.artifacts.list(selectedProjectId)
      .then((folders) => setDiskArtifacts(folders.filter((f) => f.hasPlan && f.hasSpec).sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setDiskArtifacts([]))
  }, [selectedProjectId])

  // ── Resume from URL ?outputId=xxx — reload artifacts from disk ─────────
  useEffect(() => {
    if (!resumeOutputId || planArtifacts.length > 0) return
    // Clean URL params after reading
    setSearchParams({}, { replace: true })

    setResuming(true)
    const projectPath = projects.find((p) => p.id === selectedProjectId)?.workspace?.rootPath

    api.bridgeArtifacts.readAll(resumeOutputId, projectPath).then((artifacts) => {
      const plan = artifacts.filter((a) =>
        ["microplans.json", "task_prompt.md"].includes(a.filename)
      )
      const specs = artifacts.filter((a) =>
        a.filename.endsWith(".spec.ts") || a.filename.endsWith(".spec.tsx") || a.filename.endsWith(".test.ts") || a.filename.endsWith(".test.tsx")
      )

      if (plan.length > 0) {
        setPlanArtifacts(plan)
        // Restore taskDescription from task_prompt.md if available
        const taskPromptArtifact = plan.find((a) => a.filename === "task_prompt.md")
        if (taskPromptArtifact) {
          // task_prompt.md format: "# Task Prompt\n\n<description>"
          const content = taskPromptArtifact.content.replace(/^# Task Prompt\n\n/, '')
          if (content) setTaskDescription(content)
        }
      }
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
    clearSession(outputId)
    setStep(0)
    setCompletedSteps(new Set())
    setOutputId(undefined)
    setPlanArtifacts([])
    setSpecArtifacts([])
    setRunId(null)
    setValidationStatus(null)
    setRunResults(null)
    setExecuteResult(null)
    setExecutionPhase(null)
    setExecutionProgress(null)
    setExecuteDoneData(null)
    setCommitMessage("")
    setCommitResult(null)
    setPushResult(null)
    setGitChangedFiles([])
    setGitLoading(false)
    setError(null)
    setLogs([])
    setTaskDescription("")
    setTaskType(undefined)
    lastEventIdRef.current = 0
    lastSeqRef.current = 0
    pipelineStatusRef.current = null
    pipelineStageRef.current = null
    pipelineProgressRef.current = 0
    toast.success("Sessão resetada")
  }, [outputId])

  // ── Navigate to a completed step ──────────────────────────────────────
  const handleStepClick = useCallback((targetStep: WizardStep) => {
    if (!completedSteps.has(targetStep)) return
    // Reset transient state when navigating back
    setValidationStatus(null)
    setRunResults(null)
    setError(null)
    setLoading(false)
    setStep(targetStep)
    addLog("info", `Navegou para step ${targetStep}`)
  }, [completedSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load projects ──────────────────────────────────────────────────────
  useEffect(() => {
    api.projects.list(1, 100).then((res) => {
      if (!res) return
      // Support both array and paginated response (for testing compatibility)
      const projectList = Array.isArray(res) ? res : res.data
      setProjects(projectList)
      const active = projectList.filter((p) => p.isActive)
      if (active.length > 0) {
        setSelectedProjectId((prev) => prev ?? active[0].id)
      }
    })
  }, [])

  // ── Debug: Monitor specArtifacts state changes ─────────────────────────
  useEffect(() => {
    console.log('[DEBUG] specArtifacts state changed:', specArtifacts.length, 'artifacts')
    if (specArtifacts.length > 0) {
      console.log('[DEBUG] specArtifacts filenames:', specArtifacts.map(a => a.filename))
    }
  }, [specArtifacts])

  // ── SSE events ─────────────────────────────────────────────────────────
  const addLog = useCallback((type: string, text: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    setLogs((prev) => [...prev, { time, type, text }])
  }, [])

  const handleSSE = useCallback(
    (event: OrchestratorEvent) => {
      const debug = debugModeRef.current

      // ── Track execution progress during WRITING phase ──
      if (executionPhaseRef.current === "WRITING") {
        const now = Date.now()
        if (event.type === "agent:start") {
          // Record the current nonce — only events from THIS execution matter
          const myNonce = executionNonceRef.current
          setExecutionProgress(prev => ({
            ...(prev || { iteration: 0, inputTokens: 0, outputTokens: 0, lastTool: null, thinkingSeconds: 0, startedAt: now, lastToolTime: now }),
            provider: String(event.provider ?? ""),
            model: String(event.model ?? ""),
            startedAt: prev?.startedAt || now,
            lastToolTime: now,
            _nonce: myNonce,
          } as any))
        } else if (event.type === "agent:iteration") {
          setExecutionProgress(prev => prev ? {
            ...prev,
            iteration: Number(event.iteration ?? prev.iteration),
            inputTokens: Number((event.tokensUsed as any)?.inputTokens ?? prev.inputTokens),
            outputTokens: Number((event.tokensUsed as any)?.outputTokens ?? prev.outputTokens),
            thinkingSeconds: 0,
            lastToolTime: now,
          } : prev)
        } else if (event.type === "agent:tool_call") {
          setExecutionProgress(prev => prev ? { ...prev, lastTool: String(event.tool ?? prev.lastTool), thinkingSeconds: 0, lastToolTime: now } : prev)
        } else if (event.type === "agent:thinking") {
          setExecutionProgress(prev => prev ? {
            ...prev,
            thinkingSeconds: Math.round(((event as any).elapsedMs ?? 0) / 1000),
            iteration: (event as any).iteration ?? prev.iteration,
          } : prev)
        }
      }

      switch (event.type) {
        case "agent:bridge_start":
          addLog("info", `Iniciando etapa ${event.step}...`)
          break
        case "agent:start":
          addLog("info", `LLM ${event.provider}/${event.model} conectado (step ${event.step})`)
          break
        case "agent:text":
          if (debug) {
            const preview = typeof event.text === "string" ? event.text.slice(0, 500) : ""
            if (preview.trim()) addLog("debug", `💬 LLM: ${preview}${event.text && event.text.length > 500 ? "…" : ""}`)
          }
          break
        case "agent:thinking": {
          const elapsed = Math.round(((event as any).elapsedMs ?? 0) / 1000)
          const iter = (event as any).iteration ?? "?"
          if (debug) {
            addLog("debug", `⏳ LLM pensando... ${elapsed}s (iteração ${iter})`)
          } else {
            // Em modo normal, atualizar o último log se já era um thinking
            setLogs((prev) => {
              const last = prev[prev.length - 1]
              const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              const entry = { time, type: "info", text: `⏳ LLM pensando... ${elapsed}s` }
              if (last?.text.startsWith("⏳ LLM pensando")) {
                return [...prev.slice(0, -1), entry]
              }
              return [...prev, entry]
            })
          }
          break
        }
        case "agent:iteration":
          addLog("info", `Iteração ${event.iteration} — ${(event.tokensUsed as any)?.inputTokens?.toLocaleString() ?? "?"} in / ${(event.tokensUsed as any)?.outputTokens?.toLocaleString() ?? "?"} out tokens`)
          break
        case "agent:tool_call": {
          const input = (event as any).input as Record<string, unknown> | undefined
          if (debug && input) {
            const tool = event.tool
            if (tool === "bash" || tool === "execute_bash") {
              addLog("debug", `🔧 ${tool}  ➜  ${String(input.command ?? input.cmd ?? JSON.stringify(input)).slice(0, 500)}`)
            } else if (tool === "save_artifact") {
              const contentLen = typeof input.content === "string" ? input.content.length : 0
              addLog("debug", `🔧 ${tool}("${input.filename}", ${contentLen} chars)`)
            } else if (tool === "read_file" || tool === "write_file") {
              addLog("debug", `🔧 ${tool}("${input.path ?? input.file_path ?? ""}")`)
            } else {
              addLog("debug", `🔧 ${tool}(${JSON.stringify(input).slice(0, 300)})`)
            }
          } else {
            addLog("info", `🔧 ${event.tool}`)
          }
          break
        }
        case "agent:tool_result":
          if (debug) {
            addLog(event.isError ? "error" : "debug", `↩ ${event.tool} → ${event.isError ? "ERROR" : "ok"} (${event.durationMs}ms)`)
          } else {
            addLog(event.isError ? "error" : "info", `${event.tool} (${event.durationMs}ms)`)
          }
          break
        case "agent:budget_warning":
          addLog("warning", `⚠️ Budget ${event.percentUsed}% usado (${event.usedTokens}/${event.budgetTokens})`)
          break
        case "agent:budget_exceeded":
          addLog("error", `🚫 Budget excedido: ${(event as any).usedTokens}/${(event as any).budgetTokens}`)
          break
        case "agent:fallback":
          addLog("warning", `🔄 Fallback: ${(event as any).from} → ${(event as any).to} (${(event as any).reason})`)
          break
        case "agent:complete": {
          const r = (event as any).result
          if (debug && r) {
            addLog("debug", `✅ LLM finalizado — ${r.iterations} iterações, ${r.tokensUsed?.inputTokens?.toLocaleString() ?? "?"}in/${r.tokensUsed?.outputTokens?.toLocaleString() ?? "?"}out`)
          } else {
            addLog("info", `LLM finalizado`)
          }
          break
        }
        case "agent:bridge_discovery_done": {
          const artifacts = (event.artifacts ?? []) as ParsedArtifact[]
          const reportArtifact = artifacts.find(a => a.filename === 'discovery_report.md')

          if (reportArtifact) {
            setDiscoveryReportContent(reportArtifact.content)
            setDiscoveryArtifacts(artifacts)
            // Mantém plannerSubstep como 'discovery' para mostrar card de revisão
            addLog("success", "Discovery report gerado com sucesso")
            toast.success("Discovery concluído - revise o report e continue para o plano")
          } else {
            setError("Discovery não gerou discovery_report.md")
            addLog("error", "Discovery report não encontrado nos artifacts")
          }
          setLoading(false)
          break
        }
        case "agent:bridge_plan_done": {
          const artifacts = (event.artifacts ?? []) as ParsedArtifact[]
          const tokens = event.tokensUsed as { inputTokens: number; outputTokens: number } | undefined

          // ✅ VALIDATE before advancing
          const validation = validateStepArtifacts(1, artifacts)
          if (!validation.valid) {
            console.error('[SSE:agent:bridge_plan_done] ❌ Validation failed:', validation.message)
            setError(`Plano inválido: ${validation.message}`)
            addLog("error", validation.message)
            toast.error(validation.message)
            setLoading(false)
            break
          }

          setPlanArtifacts(Array.isArray(artifacts) ? artifacts : [])

          // Detectar presença de microplans.json
          const microplansArtifact = artifacts.find(a => a.filename === 'microplans.json')
          const hasMicroplans = !!microplansArtifact

          // Atualizar stepResults com info de microplans
          setStepResults(prev => ({
            ...prev,
            [1]: {
              ...prev[1],
              artifacts,
              tokensUsed: tokens,
              microplansArtifact,
              hasMicroplans,
            }
          }))

          markComplete(0)
          markComplete(1)
          // Only advance to step 2 if we're currently before it (prevent reverting from later steps during reconciliation)
          setStep((prev) => (prev < 2 ? 2 : prev))
          setLoading(false)
          pipelineStageRef.current = "spec"
          pipelineProgressRef.current = 25
          addLog("success", `Plano gerado: ${event.outputId} (${artifacts.length} artefatos${tokens ? `, ${tokens.inputTokens.toLocaleString()} tokens` : ""})`)
          toast.success("Plano gerado com sucesso")
          break
        }
        case "agent:bridge_spec_done": {
          const artifacts = (event.artifacts ?? []) as ParsedArtifact[]
          const tokens = event.tokensUsed as { inputTokens: number; outputTokens: number } | undefined

          console.log('[SSE:agent:bridge_spec_done] Received - artifacts:', artifacts)
          console.log('[SSE:agent:bridge_spec_done] Event full:', JSON.stringify(event, null, 2))

          // Validate: artifacts must be array AND not empty
          if (!Array.isArray(artifacts) || artifacts.length === 0) {
            const errMsg = event.artifacts === undefined
              ? "Erro interno: evento SSE sem campo 'artifacts' (possível bug de replay)"
              : "Geração de testes falhou: nenhum artefato foi gerado"

            console.error('[SSE:agent:bridge_spec_done] ❌ Invalid artifacts:', {
              isArray: Array.isArray(artifacts),
              length: artifacts?.length,
              raw: event.artifacts
            })

            setError(errMsg)
            addLog("error", errMsg)
            toast.error(errMsg)
            setLoading(false)
            setIsGeneratingSpec(false)
            break
          }

          // ✅ VALIDATE structure
          const validation = validateStepArtifacts(2, artifacts)
          if (!validation.valid) {
            console.error('[SSE:agent:bridge_spec_done] ❌ Validation failed:', validation.message)
            setError(`Testes inválidos: ${validation.message}`)
            addLog("error", validation.message)
            toast.error(validation.message)
            setLoading(false)
            setIsGeneratingSpec(false)
            break
          }

          console.log('[SSE:agent:bridge_spec_done] ✅ Artifacts OK - advancing to step 3')
          setSpecArtifacts(artifacts)
          console.log('[SSE:agent:bridge_spec_done] setSpecArtifacts called with:', artifacts.length, 'artifacts')
          console.log('[SSE:agent:bridge_spec_done] Artifact filenames:', artifacts.map(a => a.filename))
          markComplete(2)
          // Only advance to step 3 if we're currently before it (prevent reverting from later steps during reconciliation)
          setStep((prev) => (prev < 3 ? 3 : prev))
          setLoading(false)
          setIsGeneratingSpec(false)  // Tarefa 9.3 - Clear loading state on success
          pipelineStageRef.current = "validation"
          pipelineProgressRef.current = 50
          addLog("success", `Testes gerados: ${artifacts.map((a) => a.filename).join(", ")}${tokens ? ` (${tokens.inputTokens.toLocaleString()} tokens)` : ""}`)
          toast.success("✅ Testes gerados com sucesso!")  // Tarefa 9.3 - Toast only after completion
          break
        }
        case "agent:bridge_execute_done":
        case "agent:bridge_complete": {
          // Only handle if we're in WRITING phase
          if (executionPhaseRef.current !== "WRITING") {
            if (debug) addLog("debug", `[${event.type}] ignorado — não estamos em WRITING`)
            break
          }

          // ✅ Nonce validation: prevent stale events from previous executions
          const currentNonce = currentExecutionNonceRef.current
          const latestNonce = executionNonceRef.current
          if (currentNonce !== null && currentNonce !== latestNonce) {
            if (debug) {
              addLog("debug", `[${event.type}] STALE EVENT — nonce mismatch (event=${currentNonce}, current=${latestNonce})`)
            }
            console.warn(`[SSE:${event.type}] Ignoring stale event from previous execution (nonce ${currentNonce} vs ${latestNonce})`)
            break
          }

          // Guard: if event has iteration count that's way below our current progress, it's stale
          // (e.g. old execution finishing while new one is already at iteration 2)
          const tokens = (event as any).tokensUsed as { inputTokens: number; outputTokens: number } | undefined

          // ✅ Defensive check: validate specArtifacts exist before marking complete
          if (!specArtifacts || specArtifacts.length === 0) {
            console.warn('[SSE:agent:bridge_execute_done] ⚠️ Execução concluída mas specArtifacts vazio — possível race condition')
            addLog("warning", "Execução concluída sem artefatos de teste (possível estado inconsistente)")
          }

          // Clear current execution nonce (execution completed)
          currentExecutionNonceRef.current = null
          setExecutionPhase(null)
          setExecutionProgress(null)
          markComplete(4)
          setExecuteResult({
            mode: String((event as any).mode || "agent"),
            tokensUsed: tokens,
          })
          setLoading(false)
          pipelineStageRef.current = "complete"
          pipelineProgressRef.current = 100
          pipelineStatusRef.current = "completed"
          addLog("success", `Execução concluída — ${tokens?.inputTokens?.toLocaleString() ?? "?"}in / ${tokens?.outputTokens?.toLocaleString() ?? "?"}out`)
          toast.success("Execução concluída — validando integridade...")
          setExecuteDoneData(event) // trigger auto-validation via useEffect
          break
        }
        case "agent:fallback_unavailable": {
          const available = (event as any).availableProviders as string[] ?? []
          addLog("warning", `⚠️ Fallback indisponível: ${(event as any).to} — providers disponíveis: ${available.join(", ") || "nenhum"}`)
          break
        }
        case "agent:error": {
          const availableProviders = (event as any).availableProviders as string[] | undefined
          const canRetry = (event as any).canRetry as boolean | undefined
          const errorMsg = String(event.error)

          // Only log if not a duplicate of the previous error
          addLog("error", errorMsg)

          // Detect terminal errors: timeout, provider not configured, fallback unavailable
          const isTerminalError = errorMsg.includes("timed out") ||
            errorMsg.includes("not configured") ||
            errorMsg.includes("not available") ||
            errorMsg.includes("Fallback") ||
            (canRetry && availableProviders && availableProviders.length > 0)

          if (executionPhaseRef.current === "WRITING" && !isTerminalError) {
            // Non-fatal: LLM may still be running. Show error but don't reset UI.
            toast.error(`Erro durante execução: ${errorMsg}`, { duration: 6000 })
          } else {
            // Fatal: process stopped, reset UI and show retry options.
            pipelineStatusRef.current = "failed"
            setError(errorMsg)
            setLoading(false)
            setIsGeneratingSpec(false)  // Tarefa 9.3 - Clear loading state on error
            setExecutionPhase(null)
            setExecutionProgress(null)

            // If we have available providers, allow retry with different provider
            if (canRetry && availableProviders && availableProviders.length > 0) {
              const stepDefault = getDefault(stepRef.current)
              const defaultProvider = availableProviders.includes(stepDefault.provider)
                ? stepDefault.provider
                : availableProviders[0]
              const defaultModel = PROVIDER_MODELS[defaultProvider]?.models[0]?.value ?? stepDefault.model
              setRetryState({
                canRetry: true,
                availableProviders,
                failedStep: stepRef.current,
                selectedProvider: defaultProvider,
                selectedModel: defaultModel,
              })
              toast.error(`Provider falhou — selecione outro para continuar`, { duration: 8000 })
            } else {
              // Don't clear retryState if it was already set by a previous event
              // (BridgeController re-emits agent:error without retry info after AgentRunnerService)
              if (!retryState) {
                toast.error(errorMsg)
              }
            }
          }
          break
        }
        default:
          if (debug) {
            addLog("debug", `[${event.type}] ${typeof event.text === "string" ? event.text : JSON.stringify(event)}`)
          } else {
            addLog(event.type, typeof event.text === "string" ? event.text : JSON.stringify(event))
          }
      }
    },
    [addLog]
  )

  // ── Pipeline reconciliation (fetch remote state + backfill missed events) ──
  const reconciliation = usePipelineReconciliation(
    resumeOutputId ?? saved?.outputId,
    saved ? {
      outputId: saved.outputId,
      step: saved.step,
      completedSteps: saved.completedSteps,
      lastEventId: saved.lastEventId ?? 0,
      lastSeq: saved.lastSeq ?? 0,
      pipelineStatus: saved.pipelineStatus ?? null,
      pipelineStage: saved.pipelineStage ?? null,
      pipelineProgress: saved.pipelineProgress ?? 0,
    } : null,
  )

  // Track if we've already applied reconciliation (avoid replaying events multiple times)
  const reconciliationAppliedRef = useRef(false)

  // Apply reconciliation results when done
  useEffect(() => {
    // Guard: only run once when reconciliation finishes loading
    if (reconciliation.isLoading) return
    if (reconciliationAppliedRef.current) return
    reconciliationAppliedRef.current = true

    console.log('[Reconciliation] Applying reconciliation results (ONE TIME ONLY)')

    // Update step/completedSteps from reconciled state
    if (reconciliation.remoteStep !== null && reconciliation.remoteStep > step) {
      console.log('[Reconciliation] Advancing step from', step, 'to', reconciliation.remoteStep)
      setStep(reconciliation.remoteStep as WizardStep)
    }
    if (reconciliation.remoteCompletedSteps !== null && reconciliation.remoteCompletedSteps.length > completedSteps.size) {
      setCompletedSteps(new Set(reconciliation.remoteCompletedSteps))
    }

    // Update tracking refs
    lastEventIdRef.current = reconciliation.lastEventId
    lastSeqRef.current = reconciliation.lastSeq
    pipelineStatusRef.current = reconciliation.pipelineStatus
    pipelineStageRef.current = reconciliation.pipelineStage
    pipelineProgressRef.current = reconciliation.pipelineProgress

    // Wait for state to settle before replaying events (ensures stepRef.current is updated)
    setTimeout(() => {
      console.log('[Reconciliation] Replaying', reconciliation.missedEvents.length, 'events (ONE TIME ONLY)')
      console.log('[Reconciliation] Current step before replay:', stepRef.current)

      // Replay missed events through handleSSE to rebuild artifacts/logs
      for (const evt of reconciliation.missedEvents) {
        if (evt.payload) {
          try {
            handleSSE(JSON.parse(evt.payload))
          } catch { /* skip unparseable */ }
        }
      }

      console.log('[Reconciliation] ✅ Replay complete')
    }, 0) // Next tick ensures stepRef.current is updated

    // If pipeline already terminated, ensure UI reflects final state
    if (reconciliation.isTerminal) {
      setLoading(false)
      if (reconciliation.pipelineStatus === 'failed') {
        setError('Pipeline falhou (recuperado da sessão)')
      }
    }

    if (reconciliation.missedEvents.length > 0) {
      addLog("info", `Reconciliação: ${reconciliation.missedEvents.length} evento(s) recuperado(s)`)
    }
  }, [reconciliation.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build dedup set from reconciliation backfill (DB event IDs → "db-{id}")
  const processedIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (reconciliation.isLoading) return
    for (const evt of reconciliation.missedEvents) {
      processedIdsRef.current.add(`db-${evt.id}`)
    }
  }, [reconciliation.isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // SSE with deduplication
  const { lastSeqRef: sseLastSeqRef } = useOrchestratorEvents(
    outputId,
    handleSSE,
    'orchestrator',
    processedIdsRef.current,
  )

  // Sync SSE seq into our tracking ref periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (sseLastSeqRef.current > lastSeqRef.current) {
        lastSeqRef.current = sseLastSeqRef.current
      }
    }, 5000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-reload artifacts from disk when missing (e.g., after error that cleared state) ───
  const autoReloadTriedRef = useRef(false)

  useEffect(() => {
    // Only run if:
    // 1. We have an outputId (active session)
    // 2. Reconciliation has finished (not loading)
    // 3. We're missing artifacts (planArtifacts is empty)
    // 4. We're not already resuming
    // 5. We don't have resumeOutputId (that's handled by the useEffect above)
    // 6. We haven't already tried auto-reload (prevents infinite loop on failure)
    // 7. We're not actively generating/executing (loading=false)
    // 8. We're not in Discovery substep (discoveryArtifacts handles that separately)
    if (!outputId || reconciliation.isLoading || planArtifacts.length > 0 || discoveryArtifacts.length > 0 || resuming || resumeOutputId || autoReloadTriedRef.current || loading) {
      return
    }

    console.log('[Auto-reload] Detected missing artifacts for outputId:', outputId)
    console.log('[Auto-reload] Current planArtifacts:', planArtifacts.length, 'specArtifacts:', specArtifacts.length)

    const projectPath = projects.find((p) => p.id === selectedProjectId)?.workspace?.rootPath
    if (!projectPath) {
      console.warn('[Auto-reload] No project path found, cannot reload artifacts')
      return
    }

    console.log('[Auto-reload] Attempting to reload artifacts from disk...')
    setResuming(true)
    autoReloadTriedRef.current = true  // Mark as tried to prevent retry on failure

    api.bridgeArtifacts.readAll(outputId, projectPath).then((artifacts) => {
      console.log('[Auto-reload] Loaded', artifacts.length, 'artifacts from disk')

      const plan = artifacts.filter((a) =>
        ["microplans.json", "task_prompt.md"].includes(a.filename)
      )
      const specs = artifacts.filter((a) =>
        a.filename.endsWith(".spec.ts") || a.filename.endsWith(".spec.tsx") || a.filename.endsWith(".test.ts") || a.filename.endsWith(".test.tsx")
      )

      console.log('[Auto-reload] Found', plan.length, 'plan artifacts,', specs.length, 'spec artifacts')

      if (plan.length > 0) {
        setPlanArtifacts(plan)
        console.log('[Auto-reload] Restored planArtifacts:', plan.map(a => a.filename))

        // Restore taskDescription from plan.json if available
        const planJsonArtifact = plan.find((a) => a.filename === "plan.json")
        if (planJsonArtifact) {
          try {
            const parsed = JSON.parse(planJsonArtifact.content)
            if (parsed.taskPrompt) setTaskDescription(parsed.taskPrompt)
          } catch { /* plan.json parse failed — keep current taskDescription */ }
        }
      }

      if (specs.length > 0) {
        setSpecArtifacts(specs)
        console.log('[Auto-reload] Restored specArtifacts:', specs.map(a => a.filename))
      }

      // Log silently (no toast to avoid interference with SSE event toasts)
      if (artifacts.length > 0) {
        addLog("info", `Artefatos recuperados automaticamente: ${artifacts.length} arquivo(s)`)
        console.log('[Auto-reload] Successfully restored artifacts from disk')
      } else {
        console.log('[Auto-reload] No artifacts found on disk (expected during initial generation)')
      }
    }).catch((err) => {
      console.error('[Auto-reload] Failed to reload artifacts:', err)
      addLog("error", `Falha ao recarregar artefatos: ${err.message}`)
      toast.error("Não foi possível recarregar artefatos")
    }).finally(() => {
      setResuming(false)
    })
  }, [outputId, reconciliation.isLoading, planArtifacts.length, resuming, resumeOutputId, projects, selectedProjectId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run validation SSE — polls run status inline ──────────────────────
  const validationResolvedRef = useRef(false)

  const handleRunEvent = useCallback(async () => {
    if (!runId || validationResolvedRef.current) return
    try {
      const results = await api.runs.getWithResults(runId)
      setRunResults(results)

      const status = results.status
      if (status === "PASSED" || status === "FAILED") {
        // Guard: only process terminal status once
        if (validationResolvedRef.current) return
        validationResolvedRef.current = true

        const passed = results.gateResults?.every((g: GateResult) => g.passed) ?? false
        setValidationStatus(passed ? "PASSED" : "FAILED")
        setLoading(false)

        if (passed) {
          // Determine if this is a CONTRACT (Gates 0-1) or EXECUTION (Gates 2-3) run
          const isExecutionRun = results.runType === "EXECUTION" ||
            results.gateResults?.some((g: GateResult) => g.gateNumber >= 2)
          
          if (isExecutionRun) {
            markComplete(4)
            // Ensure we're on step 4 (don't regress if we're already ahead)
            setStep((prev) => prev < 4 ? 4 : prev)
            addLog("success", "✅ Gates 2-3 aprovados — implementação validada!")
            toast.success("Validação de execução aprovada!")
          } else {
            markComplete(3)
            addLog("success", "✅ Gates 0-1 aprovados — avançando para execução...")
            toast.success("Validação aprovada! Avançando para execução...")
            // Auto-advance to step 4 after a brief pause so user can see the result
            // Reset validationStatus so Step 4 doesn't think EXECUTION already passed
            setTimeout(() => {
              setValidationStatus(null)
              setStep(prev => Math.max(prev, 4)) // Never regress
            }, 1500)
          }
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

  // Load run data on mount if runId exists (e.g., after navigating back from logs page)
  useEffect(() => {
    if (!runId || runResults) return // Already loaded

    const loadRunData = async () => {
      try {
        const results = await api.runs.getWithResults(runId)
        setRunResults(results)
        setValidationStatus(results.status)

        // If run is still running, let SSE handle updates
        if (results.status === "RUNNING") {
          setLoading(true)
        }
      } catch (err) {
        console.error("[orchestrator-page] Failed to load run data:", err)
      }
    }

    loadRunData()
  }, [runId]) // Only run when runId changes

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

  // ── Extract manifest from plan.json (supports both LLMPlanOutput and planner-core formats) ──
  const extractManifest = (plan: Record<string, any>, fallbackTestFile?: string) => {
    // 1. Native manifest format: { manifest: { files: [...], testFile } }
    if (plan.manifest?.files?.length) {
      return {
        files: plan.manifest.files as ManifestFile[],
        testFile: plan.manifest.testFile || fallbackTestFile || "spec.test.ts",
      }
    }

    // 2. Flat format: { files: [...] } (already ManifestFile[])
    if (Array.isArray(plan.files) && plan.files.length > 0 && plan.files[0]?.path) {
      return {
        files: plan.files as ManifestFile[],
        testFile: plan.testFile || fallbackTestFile || "spec.test.ts",
      }
    }

    // 3. Planner-core format: { files_to_create, files_to_modify, test_files }
    const mapped: ManifestFile[] = []
    for (const p of plan.files_to_create || []) {
      mapped.push({ path: p, action: "CREATE" })
    }
    for (const p of plan.files_to_modify || []) {
      mapped.push({ path: p, action: "MODIFY" })
    }

    const testFile =
      plan.test_files?.[0] ||
      fallbackTestFile ||
      specArtifacts[0]?.filename ||
      "spec.test.ts"

    // Add test file to manifest if not already present
    if (testFile && !mapped.some((f) => f.path === testFile)) {
      mapped.push({ path: testFile, action: "CREATE" })
    }

    return { files: mapped, testFile }
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
            headers: { "Content-Type": "application/json", ...(() => { const t = localStorage.getItem("token"); return t ? { Authorization: `Bearer ${t}` } : {} })() },
            body: JSON.stringify(body),
            signal: controller.signal,
          })
          clearTimeout(timer)
          // Pick up renewed token from grace period
          const renewedToken = res.headers.get("X-Renewed-Token")
          if (renewedToken) localStorage.setItem("token", renewedToken)
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
    // Fix Bug #2: Clear any previous session before creating new one
    clearSession(outputId)

    // Reset all React states to prevent stale data
    setPlanArtifacts([])
    setSpecArtifacts([])
    setRunId(null)
    setRunResults(null)
    setValidationStatus(null)
    setError(null)
    setRetryState(null)
    setLoading(true)
    addLog("info", "Gerando plano...")

    try {
      // POST returns 202 immediately with outputId — plan runs in background
      const payload: Record<string, unknown> = {
        taskDescription,
        taskType,
        provider: stepLLMs[1]?.provider ?? getDefault(1).provider,
        model: stepLLMs[1]?.model ?? getDefault(1).model,
        projectPath: getProjectPath(),
      }

      // Include outputId if already exists (from Discovery)
      if (outputId) {
        payload.outputId = outputId
        addLog("info", `Reutilizando outputId do Discovery: ${outputId}`)
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

      // Include discovery report if available
      if (discoveryReportContent) {
        payload.discoveryReportContent = discoveryReportContent
        addLog("info", "Discovery report incluído no contexto")
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

  // ── Discovery Substep ───────────────────────────────────────────────────
  const handleGenerateDiscovery = async () => {
    setError(null)
    setLoading(true)
    setPlannerSubstep('discovery')
    addLog("info", "Gerando discovery report...")

    try {
      const payload: Record<string, unknown> = {
        taskDescription,
        provider: stepLLMs[1]?.provider ?? getDefault(1).provider,
        model: stepLLMs[1]?.model ?? getDefault(1).model,
        projectPath: getProjectPath(),
      }

      const result = await apiPost("discovery", payload)
      setOutputId(result.outputId)
      addLog("info", `Discovery iniciado: ${result.outputId}`)

      // Completion is handled by handleSSE when it receives 'agent:bridge_discovery_done'
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar discovery"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
      setLoading(false)
      setPlannerSubstep(null)
    }
  }

  const handleSkipDiscovery = () => {
    setPlannerSubstep('planner')
    handleGeneratePlan()
  }

  // ── Step 2: Generate Spec ──────────────────────────────────────────────
  const handleGenerateSpec = async () => {
    if (!outputId) return
    setError(null)
    setRetryState(null)
    setLoading(true)
    setIsGeneratingSpec(true)  // Tarefa 9.2 - Set loading state
    addLog("info", "Gerando testes...")

    try {
      // POST returns 202 immediately — spec generation runs in background
      // Completion is handled by handleSSE when it receives 'agent:bridge_spec_done'
      await apiPost("spec", { outputId, provider: stepLLMs[2]?.provider ?? getDefault(2).provider, model: stepLLMs[2]?.model ?? getDefault(2).model, projectPath: getProjectPath() })
      addLog("info", "LLM iniciou geração de testes — aguarde...")
      // Note: loading stays true, setLoading(false) happens in SSE handler
      // Note: NO toast.success here - wait for SSE event (Tarefa 9.2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar testes"
      setError(msg)
      addLog("error", msg)
      toast.error(msg)
      setLoading(false)
      setIsGeneratingSpec(false)  // Tarefa 9.2 - Clear loading state on error
    }
  }

  // ── Rerun from disk — zero tokens ──────────────────────────────────────
  const handleRerunFromDisk = async (targetOutputId?: string) => {
    const oid = targetOutputId || outputId
    if (!oid || !selectedProjectId) return

    setError(null)
    setLoading(true)
    addLog("info", `Carregando artefatos do disco: ${oid}`)

    try {
      // 1. Read artifacts from disk via API
      const contents = await api.artifacts.getContents(selectedProjectId, oid)

      if (!contents.planJson) throw new Error("plan.json não encontrado no disco")
      if (!contents.specContent || !contents.specFileName) throw new Error("Spec file não encontrado no disco")

      const plan = contents.planJson as LLMPlanOutput

      // 2. Restore state
      setOutputId(oid)
      setPlanArtifacts([
        { filename: "plan.json", content: JSON.stringify(plan, null, 2) },
      ])
      setSpecArtifacts([
        { filename: contents.specFileName, content: contents.specContent },
      ])
      setTaskDescription(plan.taskPrompt || taskDescription)

      const completed = new Set([0, 1, 2])
      setCompletedSteps(completed)
      console.log('[handleRerunFromDisk] Advancing to step 3 after loading artifacts')
      setStep(prev => Math.max(prev, 3)) // Never regress

      addLog("success", `Artefatos carregados: plan.json + ${contents.specFileName}`)

      // 3. Extract manifest/contract and create run
      const manifest = extractManifest(plan, contents.specFileName)
      const contract = plan.contract || undefined

      if (manifest.files.length === 0) throw new Error("plan.json não contém arquivos (manifest.files, files_to_create, ou files_to_modify)")

      setValidationStatus("RUNNING")
      setRunResults(null)
      validationResolvedRef.current = false

      const response = await api.runs.create({
        projectId: selectedProjectId,
        outputId: oid,
        taskPrompt: plan.taskPrompt || taskDescription,
        manifest,
        contract,
        dangerMode: plan.dangerMode || false,
        runType: "CONTRACT",
      })

      setRunId(response.runId)
      addLog("info", `Run criada: ${response.runId}`)

      // 4. Upload files (empty FormData triggers filesystem fallback on backend)
      const formData = new FormData()
      const planBlob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })
      formData.append("planJson", planBlob, "plan.json")
      const specBlob = new Blob([contents.specContent], { type: "text/plain" })
      formData.append("specFile", specBlob, contents.specFileName)

      await api.runs.uploadFiles(response.runId, formData)
      addLog("success", `Upload concluído — validando gates 0-1...`)
      toast.success("Rerun iniciado — validando artefatos do disco")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao rerun"
      setError(msg)
      setValidationStatus(null)
      addLog("error", msg)
      toast.error(msg)
      setLoading(false)
    }
  }

  // ── Step 3: Validate ───────────────────────────────────────────────────
  const handleValidate = async () => {
    console.log('[handleValidate] Called - step:', stepRef.current, 'outputId:', outputId)
    if (!outputId || !selectedProjectId) return
    setError(null)
    setLoading(true)
    setValidationStatus("RUNNING")
    setRunResults(null)
    validationResolvedRef.current = false
    addLog("info", "Iniciando validação Gatekeeper (Gates 0-1)...")

    try {
      if (!Array.isArray(planArtifacts)) {
        throw new Error("Artefatos do plano corrompidos. Reinicie o fluxo.")
      }
      const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
      if (!planArtifact) throw new Error("plan.json não encontrado")

      const plan = JSON.parse(planArtifact.content)

      const manifest = extractManifest(plan)

      if (manifest.files.length === 0) {
        throw new Error(
          "plan.json não contém arquivos. " +
          "Verifique se o plano inclui 'manifest.files', 'files_to_create', ou 'files_to_modify'."
        )
      }

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
        try {
          addLog("info", `Fazendo upload de ${specArtifacts.length} arquivo(s) para run...`)
          toast.info("Fazendo upload de arquivos...")
          const formData = new FormData()
          const planBlob = new Blob([planArtifact.content], { type: "application/json" })
          formData.append("planJson", planBlob, "plan.json")
          const specBlob = new Blob([specArtifacts[0].content], { type: "text/plain" })
          formData.append("specFile", specBlob, specArtifacts[0].filename)
          
          await api.runs.uploadFiles(response.runId, formData)
          addLog("success", `Upload concluído — aguardando validação...`)
          toast.success("Upload concluído")
        } catch (uploadErr) {
          const uploadMsg = uploadErr instanceof Error ? uploadErr.message : "Erro no upload de arquivos"
          addLog("error", `Falha no upload: ${uploadMsg}`)
          toast.error(`Upload falhou: ${uploadMsg}`)
          throw new Error(`Upload falhou: ${uploadMsg}`)
        }
      } else {
        addLog("warning", "Nenhum spec artifact para upload — validação pode falhar")
        toast.warning("Sem arquivos para upload")
      }

      addLog("success", `Run ${response.runId} processando — aguardando resultado...`)
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

  // Opens the fix dialog so user can optionally add custom instructions
  const openFixDialog = (target: "plan" | "spec") => {
    const isSchemaFix = validationStatus === "SCHEMA_ERROR" && !!schemaError
    let failedVCodes: string[]
    if (isSchemaFix) {
      failedVCodes = ["CONTRACT_SCHEMA_INVALID"]
    } else {
      const failedVs = (runResults?.validatorResults ?? [])
        .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
      failedVCodes = failedVs.map((v: ValidatorResult) => v.validatorCode)
      if (failedVCodes.length === 0) failedVCodes.push("unknown")
    }
    setFixDialogTarget(target)
    setFixDialogValidators(failedVCodes)
    setFixDialogOpen(true)
  }

  // Called when user confirms fix dialog
  const handleFixWithInstructions = (customInstructions: string) => {
    handleFix(fixDialogTarget, customInstructions)
  }

  const handleFix = async (target: "plan" | "spec", customInstructions?: string) => {
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

    if (customInstructions) {
      addLog("info", `Instruções customizadas: ${customInstructions.slice(0, 100)}${customInstructions.length > 100 ? "..." : ""}`)
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
        customInstructions: customInstructions || undefined,
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
    setRetryState(null)
    setLoading(true)
    setExecuteResult(null)
    setCommitResult(null)
    setPushResult(null)
    executionNonceRef.current += 1 // invalidate any in-flight SSE events from previous execution
    const myNonce = executionNonceRef.current
    currentExecutionNonceRef.current = myNonce // save current execution nonce
    setExecutionPhase("WRITING")
    setExecutionProgress(null)
    setValidationStatus(null)
    setRunResults(null)
    addLog("info", `Executando implementação... (${stepLLMs[4]?.provider ?? getDefault(4).provider}/${stepLLMs[4]?.model ?? getDefault(4).model}) [nonce=${myNonce}]`)

    try {
      // 202 — LLM starts in background. Completion comes via SSE: agent:bridge_execute_done
      await apiPost("execute", { outputId, projectPath, provider: stepLLMs[4]?.provider ?? getDefault(4).provider, model: stepLLMs[4]?.model ?? getDefault(4).model }, 1)
      markComplete(3)
      setStep(prev => Math.max(prev, 4)) // Never regress
      addLog("info", "LLM iniciou — acompanhe o progresso abaixo")
      // Note: loading stays true, setLoading(false) happens in SSE handler
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro na execução"
      const isNetwork = raw === "Failed to fetch" || raw.includes("NetworkError")
      const msg = isNetwork
        ? `Erro de rede ao chamar /agent/bridge/execute — verifique se o servidor está rodando em ${API_BASE}`
        : raw
      setError(msg)
      setExecutionPhase(null)
      setExecutionProgress(null)
      addLog("error", msg)
      toast.error(isNetwork ? "Servidor inacessível" : msg)
      setLoading(false)
    }
  }

  // ── Auto-trigger Gates 2-3 after execute_done (via useEffect to avoid stale closures) ──
  const startExecutionValidation = async () => {
    console.log('[startExecutionValidation] Called - step:', stepRef.current, 'executeDoneData:', !!executeDoneData)
    if (!outputId || !selectedProjectId) return

    setValidationStatus("RUNNING")
    setRunResults(null)
    validationResolvedRef.current = false
    addLog("info", "Iniciando validação pós-execução (Gates 2-3)...")

    try {
      if (!Array.isArray(planArtifacts)) {
        throw new Error("Artefatos do plano corrompidos. Reinicie o fluxo.")
      }
      const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
      if (!planArtifact) throw new Error("plan.json não encontrado")

      const plan = JSON.parse(planArtifact.content)
      const files = plan.manifest?.files || plan.files || []
      const testFile = plan.manifest?.testFile || plan.testFile || specArtifacts[0]?.filename || "spec.test.ts"
      const contract = plan.contract || undefined

      const response = await api.runs.create({
        projectId: selectedProjectId,
        outputId,
        taskPrompt: taskDescription,
        manifest: { files, testFile },
        contract,
        dangerMode: plan.dangerMode || false,
        runType: "EXECUTION",
      })

      setRunId(response.runId)
      addLog("success", `Run EXECUTION: ${response.runId}`)

      if (specArtifacts.length > 0) {
        const formData = new FormData()
        formData.append("planJson", new Blob([planArtifact.content], { type: "application/json" }), "plan.json")
        formData.append("specFile", new Blob([specArtifacts[0].content], { type: "text/plain" }), specArtifacts[0].filename)
        await api.runs.uploadFiles(response.runId, formData)
        addLog("success", "Upload concluído — validando gates 2-3...")
      }
    } catch (err) {
      addLog("warning", `Validação pós-execução falhou: ${err instanceof Error ? err.message : String(err)}`)
      setValidationStatus(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!executeDoneData) return
    setExecuteDoneData(null) // consume once
    startExecutionValidation()
  }, [executeDoneData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-load git status when Gates 2-3 pass ──
  useEffect(() => {
    if (step === 4 && validationStatus === "PASSED" && selectedProjectId) {
      // Filter changed files to only show files from the manifest
      api.git.changedFiles(selectedProjectId).then((allChangedFiles) => {
        // Get manifest files from plan.json
        const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
        if (planArtifact) {
          try {
            const plan = JSON.parse(planArtifact.content)
            const manifestFiles = (plan.manifest?.files || []).map((f: any) => f.path)

            // Only show files that are BOTH in manifest AND modified
            const relevantChanges = allChangedFiles.filter(f =>
              manifestFiles.includes(f.path)
            )

            console.log('[Git] All changed files:', allChangedFiles.length)
            console.log('[Git] Manifest files:', manifestFiles.length)
            console.log('[Git] Relevant changes (manifest ∩ changed):', relevantChanges.length)

            setGitChangedFiles(relevantChanges)
          } catch {
            // If plan.json parsing fails, show all changed files as fallback
            console.warn('[Git] Failed to parse plan.json, showing all changed files')
            setGitChangedFiles(allChangedFiles)
          }
        } else {
          // If no plan.json, show all changed files as fallback
          console.warn('[Git] No plan.json found, showing all changed files')
          setGitChangedFiles(allChangedFiles)
        }
      }).catch(() => setGitChangedFiles([]))

      const prov = stepLLMs[4]?.provider ?? "unknown"
      setCommitMessage(`${prov}_${outputId || "unknown"}`)
    }
  }, [step, validationStatus, planArtifacts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Git commit ────────────────────────────────────────────────────────
  const handleGitCommit = async () => {
    if (!selectedProjectId || !commitMessage.trim()) return
    setGitLoading(true)

    try {
      // Stage files
      if (commitMode === "all") {
        await api.git.add(selectedProjectId)
      } else if (Array.isArray(planArtifacts)) {
        const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
        if (planArtifact) {
          const plan = JSON.parse(planArtifact.content)
          const manifestFiles = (plan.manifest?.files || []).map((f: any) => f.path)
          if (manifestFiles.length > 0) {
            await api.git.addFiles(selectedProjectId, manifestFiles)
          }
        }
      }

      const result = await api.git.commit(selectedProjectId, commitMessage, runId || undefined)
      setCommitResult(result)
      addLog("success", `Commit: ${result.commitHash.slice(0, 7)} ${result.message}`)
      toast.success("🎉 Commit realizado!")

      // Refresh changed files (filtered by manifest)
      api.git.changedFiles(selectedProjectId).then((allChangedFiles) => {
        const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
        if (planArtifact) {
          try {
            const plan = JSON.parse(planArtifact.content)
            const manifestFiles = (plan.manifest?.files || []).map((f: any) => f.path)
            const relevantChanges = allChangedFiles.filter(f => manifestFiles.includes(f.path))
            setGitChangedFiles(relevantChanges)
          } catch {
            setGitChangedFiles(allChangedFiles)
          }
        } else {
          setGitChangedFiles(allChangedFiles)
        }
      }).catch(() => {})
    } catch (err: any) {
      const msg = err?.message || "Erro no commit"
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setGitLoading(false)
    }
  }

  const handleGitPush = async () => {
    if (!selectedProjectId) return
    setGitLoading(true)

    try {
      const result = await api.git.push(selectedProjectId)
      setPushResult(result)
      addLog("success", `Push: ${result.branch} → ${result.commitHash.slice(0, 7)}`)
      toast.success("Push realizado!")
    } catch (err: any) {
      const msg = err?.message || "Erro no push"
      addLog("error", msg)
      toast.error(msg)
    } finally {
      setGitLoading(false)
    }
  }

  // ── LLM name formatter for display ────────────────────────────────────
  const formatLLMName = (progress: { provider: string; model: string } | null): string => {
    if (!progress) return "LLM"
    const providerInfo = PROVIDER_MODELS[progress.provider]
    const modelInfo = providerInfo?.models.find((m) => m.value === progress.model)
    if (modelInfo) {
      const shortProvider = providerInfo.label.split(" (")[0]
      return `${shortProvider} ${modelInfo.label}`
    }
    return `${progress.provider}/${progress.model}`
  }

  // ── Manifest file paths (for commit mode comparison) ──────────────────
  const manifestFilePaths: string[] = (() => {
    if (!Array.isArray(planArtifacts)) return []
    const planArtifact = planArtifacts.find((a) => a.filename === "plan.json")
    if (!planArtifact) return []
    try {
      const plan = JSON.parse(planArtifact.content)
      return (plan.manifest?.files || []).map((f: any) => f.path)
    } catch { return [] }
  })()

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {headerPortals}

      {/* Sticky orchestrator header */}
      <OrchestratorHeader
        step={step}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
        taskDescription={taskDescription}
        outputId={outputId}
        onReset={handleReset}
        loading={loading}
        plannerSubstep={plannerSubstep}
      />

      {/* Session controls (resume only — reset moved to header) */}
      {!outputId && saved?.outputId && (
        <div className="flex items-center gap-3 mt-6">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
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
        </div>
      )}

      {/* ─── Pipeline content ────────────────────────────────────────── */}
      <div className="page-gap">
          {/* Resuming indicator */}
          {resuming && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-400 flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Restaurando sessão...
            </div>
          )}

          {/* Error banner with retry options */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={() => { handleReset(); setRetryState(null) }} className="h-6 text-xs">
                  Resetar
                </Button>
              </div>

              {/* Retry with different provider */}
              {retryState?.canRetry && retryState.availableProviders?.length > 0 && (
                <div className="border-t border-destructive/20 pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Selecione outro provider para tentar novamente:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={retryState.selectedProvider}
                      onValueChange={(v) => {
                        const models = PROVIDER_MODELS[v]?.models
                        setRetryState((prev) => prev ? {
                          ...prev,
                          selectedProvider: v,
                          selectedModel: models?.[0]?.value ?? getDefault(retryState.failedStep).model,
                        } : null)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {retryState.availableProviders.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PROVIDER_MODELS[p]?.label ?? p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={retryState.selectedModel}
                      onValueChange={(v) => setRetryState((prev) => prev ? { ...prev, selectedModel: v } : null)}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(PROVIDER_MODELS[retryState.selectedProvider]?.models || []).map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={loading}
                      onClick={() => {
                        // Update the step LLM config and retry
                        const failedStep = retryState.failedStep
                        setStepLLM(failedStep, "provider", retryState.selectedProvider)
                        setStepLLM(failedStep, "model", retryState.selectedModel)
                        setError(null)
                        setRetryState(null)

                        // Re-trigger the appropriate action based on which step failed
                        addLog("info", `Tentando novamente com ${retryState.selectedProvider}/${retryState.selectedModel}...`)
                        if (failedStep === 1) {
                          handleGeneratePlan()
                        } else if (failedStep === 2) {
                          handleGenerateSpec()
                        } else if (failedStep === 4) {
                          handleExecute()
                        }
                      }}
                    >
                      Tentar novamente →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── 2-panel layout ────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%', minHeight: 'calc(100vh - 200px)' }}>
            {/* Main panel: cresce naturalmente, sem scroll próprio */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* ─── Step 0: Task input ─────────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-4">
                  {/* Fix Bug #2: Prompt to restore saved session or start fresh */}
                  {saved && !resumeOutputId && (
                    <Card className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
                      <CardHeader>
                        <CardTitle className="text-blue-700 dark:text-blue-300">
                          Sessão Anterior Encontrada
                        </CardTitle>
                        <CardDescription>
                          Detectamos uma sessão salva de{" "}
                          {new Date(saved.savedAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="font-medium">Step:</span>{" "}
                            <Badge variant="outline">
                              {STEPS.find((s) => s.num === saved.step)?.label ?? `Step ${saved.step}`}
                            </Badge>
                          </div>
                          {saved.taskDescription && (
                            <div>
                              <span className="font-medium">Tarefa:</span>
                              <p className="text-muted-foreground mt-1 line-clamp-2">
                                {saved.taskDescription}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              // Restore session with explicit intent
                              const restored = loadSession(saved.outputId, true)
                              if (restored) {
                                setOutputId(restored.outputId)
                                setStep(restored.step as WizardStep)
                                setCompletedSteps(new Set(restored.completedSteps))
                                setTaskDescription(restored.taskDescription)
                                setTaskType(restored.taskType ?? "feature")
                                setSelectedProjectId(restored.selectedProjectId)
                                setPlanArtifacts(restored.planArtifacts ?? [])
                                setSpecArtifacts(restored.specArtifacts ?? [])
                                setRunId(restored.runId)
                                if (restored.stepLLMs) setStepLLMs(restored.stepLLMs)
                                if (restored.microplansArtifact) setMicroplansArtifact(restored.microplansArtifact)
                                if (restored.hasMicroplans !== undefined) setHasMicroplans(restored.hasMicroplans)
                                addLog("info", "Sessão anterior restaurada")
                                toast.success("Sessão restaurada com sucesso")
                              }
                            }}
                            variant="default"
                            className="flex-1"
                          >
                            Continuar Sessão
                          </Button>
                          <Button
                            onClick={() => {
                              clearSession(saved.outputId)
                              addLog("info", "Sessão anterior descartada")
                              toast.info("Iniciando nova sessão")
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Nova Sessão
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                <CardHeader>
                  <CardTitle>Descreva a Tarefa</CardTitle>
                  <CardDescription>
                    Descreva o que precisa ser implementado. O LLM vai gerar o plano, contrato e especificação.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-description-textarea">Descrição da tarefa</Label>
                  <Textarea
                    id="task-description-textarea"
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
                  onClick={() => {
                    setPlannerSubstep(null)
                    setStep(1)
                  }}
                  disabled={loading || taskDescription.length < 10 || !selectedProjectId}
                  className="w-full"
                >
                  Prosseguir →
                </Button>
              </CardContent>
            </Card>
                </div>
              )}

              {/* ─── Step 1: Discovery/Planner substeps ──────────────────── */}
              {step === 1 && (
                <div className="space-y-4">
                  {plannerSubstep === null && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Escolha o Modo de Planejamento</CardTitle>
                        <CardDescription>
                          Discovery explora o codebase primeiro para gerar microplans mais precisos.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          onClick={handleGenerateDiscovery}
                          disabled={loading}
                          className="w-full"
                          variant="default"
                        >
                          🔍 Gerar Discovery (Recomendado)
                        </Button>
                        <Button
                          onClick={handleSkipDiscovery}
                          disabled={loading}
                          className="w-full"
                          variant="outline"
                        >
                          Ir Direto ao Plano →
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {plannerSubstep === 'discovery' && discoveryReportContent && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Discovery Report</CardTitle>
                        <CardDescription>
                          Análise do codebase concluída. Revise o report e continue para o plano.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <ArtifactViewer
                          artifacts={discoveryArtifacts}
                          defaultOpen="discovery_report.md"
                        />
                        <Button
                          onClick={() => {
                            setPlannerSubstep('planner')
                            handleGeneratePlan()
                          }}
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? "Gerando plano..." : "Continuar para Plano →"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {plannerSubstep === 'discovery' && !discoveryReportContent && loading && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Gerando Discovery Report...</CardTitle>
                        <CardDescription>
                          O agente está explorando o codebase. Aguarde...
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}

                  {plannerSubstep === 'planner' && loading && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Gerando Plano...</CardTitle>
                        <CardDescription>
                          O agente está gerando microplans. Aguarde...
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                </div>
              )}

              {/* ─── Step 2: Plan review + generate spec ─────────────────── */}
              {step === 2 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                  <CardTitle>Artefatos do Plano</CardTitle>
                  <CardDescription>
                    microplans.json gerado pelo LLM. Revise antes de prosseguir.
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
                  <Button onClick={handleGenerateSpec} disabled={isGeneratingSpec || loading} className="w-full">
                    {isGeneratingSpec ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Gerando testes...
                      </>
                    ) : (
                      "Gerar Testes →"
                    )}
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
                  {(() => {
                    // Try multiple sources for task prompt (Tarefas 7.2 + 7.3)
                    const taskPromptArtifact = planArtifacts?.find(a => a.filename === 'task_prompt.md')
                    const taskPromptContent = taskPromptArtifact?.content?.replace(/^# Task Prompt\n\n/, '') || ''
                    const displayTaskPrompt =
                      taskPromptContent ||                          // New format (from task_prompt.md)
                      taskDescription ||                            // Current session
                      'Prompt original não disponível (run antiga)' // Fallback

                    return (
                      <>
                        {/* Task Prompt - Always visible (Tarefa 7.2) */}
                        <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare size={16} className="text-muted-foreground" />
                              <span className="text-sm font-medium">Tarefa Original</span>
                            </div>
                            {/* Copy button (Tarefa 7.4) */}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(displayTaskPrompt)
                                toast.success('Prompt copiado!')
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              title="Copiar prompt"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {displayTaskPrompt}
                          </p>
                        </div>

                        {/* Separator */}
                        <Separator className="mb-4" />

                        {/* Rest of artifacts (plan, contract, spec) */}
                        <ArtifactViewer artifacts={[
                          ...(Array.isArray(planArtifacts) ? planArtifacts.filter(a => a.filename !== 'task_prompt.md') : []),
                          ...(Array.isArray(specArtifacts) ? specArtifacts : [])
                        ]} />
                      </>
                    )
                  })()}
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
                  <CardContent className="space-y-2">
                    <Button
                      onClick={handleValidate}
                      disabled={loading || !selectedProjectId || validationStatus === "RUNNING"}
                      className="w-full"
                    >
                      {validationStatus === "RUNNING" ? "Validando..." : validationStatus === "FAILED" ? "Re-validar →" : "Validar →"}
                    </Button>
                    {outputId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        disabled={loading || validationStatus === "RUNNING"}
                        onClick={() => handleRerunFromDisk()}
                      >
                        ↻ Revalidar do disco (0 tokens)
                      </Button>
                    )}
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
                          openFixDialog("plan")
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
                      <div className="flex gap-2">
                        {(() => {
                          // Auto-detect fix target based on failed validators
                          // PLAN_VALIDATORS: Validate plan.json, contract.md, manifest, or taskPrompt
                          const PLAN_VALIDATORS = [
                            // Gate 0 validators (all validate plan/manifest/prompt)
                            'TOKEN_BUDGET_FIT', 'TASK_SCOPE_SIZE', 'TASK_CLARITY_CHECK',
                            'SENSITIVE_FILES_LOCK', 'DANGER_MODE_EXPLICIT',
                            'PATH_CONVENTION', 'DELETE_DEPENDENCY_CHECK',
                            // Gate 1 validators (plan-related)
                            'NO_IMPLICIT_FILES', 'MANIFEST_FILE_LOCK',
                            // Pseudo-validators
                            'CONTRACT_SCHEMA_INVALID',
                          ]
                          // SPEC_VALIDATORS: Validate the spec file (test file)
                          const SPEC_VALIDATORS = [
                            'TEST_CLAUSE_MAPPING_VALID', 'TEST_RESILIENCE_CHECK',
                            'NO_DECORATIVE_TESTS', 'TEST_HAS_ASSERTIONS',
                            'TEST_COVERS_HAPPY_AND_SAD_PATH', 'TEST_INTENT_ALIGNMENT',
                            'TEST_SYNTAX_VALID', 'IMPORT_REALITY_CHECK',
                            'TEST_FAILS_BEFORE_IMPLEMENTATION',
                          ]
                          const failed = (runResults?.validatorResults ?? [])
                            .filter((v: ValidatorResult) => !v.passed && !v.bypassed)
                            .map((v: ValidatorResult) => v.validatorCode)
                          const needsPlan = failed.some((v: string) => PLAN_VALIDATORS.includes(v))
                          const needsSpec = failed.some((v: string) => SPEC_VALIDATORS.includes(v))

                          // ALWAYS show both buttons — one as auto-detected suggestion (⭐), other as manual override
                          // This prevents user from being stuck when auto-detection is wrong
                          const autoTarget = needsSpec ? "spec" : "plan"
                          const altTarget = needsSpec ? "plan" : "spec"
                          
                          return (
                            <>
                              <Button
                                onClick={() => openFixDialog(autoTarget)}
                                disabled={loading}
                                variant="default"
                                className="flex-1"
                              >
                                {loading ? "Corrigindo..." : `Corrigir ${autoTarget === "plan" ? "Plano" : "Testes"} ⭐`}
                              </Button>
                              <Button
                                onClick={() => openFixDialog(altTarget)}
                                disabled={loading}
                                variant="outline"
                                className="flex-1"
                              >
                                {loading ? "Corrigindo..." : `Corrigir ${altTarget === "plan" ? "Plano" : "Testes"}`}
                              </Button>
                            </>
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

              {/* ─── Step 4: Execute + Validate + Commit ───── */}
              {step === 4 && (
                <div className="space-y-4">
              {/* ── Main execution card ── */}
              <Card>
                <CardHeader>
                  <CardTitle className={executeResult && !executionPhase ? "text-green-400" : ""}>
                    {executionPhase === "WRITING" ? "Execução em Andamento"
                      : executeResult ? "Execução Concluída"
                      : "Execução"}
                  </CardTitle>
                  {!executionPhase && !executeResult && !validationStatus && !loading && (
                    <CardDescription>
                      Gates 0-1 aprovados. Pronto para executar a implementação.
                    </CardDescription>
                  )}
                </CardHeader>

                {/* IDLE — execute button */}
                {!executionPhase && !executeResult && !validationStatus && !loading && (
                  <CardContent className="space-y-3">
                    <Button onClick={handleExecute} disabled={loading} className="w-full">
                      {loading ? "Executando..." : "Executar Implementação →"}
                    </Button>
                  </CardContent>
                )}

                {/* WRITING — LLM progress */}
                {executionPhase === "WRITING" && (() => {
                  const now = Date.now()
                  const totalElapsed = executionProgress?.startedAt ? Math.round((now - executionProgress.startedAt) / 1000) : 0
                  const sinceTool = executionProgress?.lastToolTime ? Math.round((now - executionProgress.lastToolTime) / 1000) : 0
                  const isStale = sinceTool > 120 // 2min sem atividade real
                  const isVeryStale = sinceTool > 300 // 5min sem atividade
                  const formatElapsed = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, "0")}s` : `${s}s`

                  return (
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm">
                            🤫 Silêncio. <span className="font-medium text-foreground">{formatLLMName(executionProgress)}</span> escrevendo código...
                          </p>
                          {totalElapsed > 0 && (
                            <span className="text-xs text-muted-foreground font-mono">{formatElapsed(totalElapsed)}</span>
                          )}
                        </div>

                        {executionProgress && (
                          <div className={`text-xs text-muted-foreground space-y-1 font-mono p-3 rounded ${isStale ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/30"}`}>
                            <div>
                              Iteração {executionProgress.iteration}
                              {executionProgress.inputTokens > 0 || executionProgress.outputTokens > 0
                                ? ` • ${executionProgress.inputTokens.toLocaleString()} in / ${executionProgress.outputTokens.toLocaleString()} out`
                                : executionProgress.iteration > 0 ? " • tokens ao final" : ""}
                            </div>
                            {executionProgress.lastTool && <div className="text-foreground/70">🔧 {executionProgress.lastTool}</div>}
                            {executionProgress.thinkingSeconds > 0 && (
                              <div className={executionProgress.thinkingSeconds > 120 ? "text-amber-400" : ""}>
                                ⏳ Pensando... {formatElapsed(executionProgress.thinkingSeconds)}
                              </div>
                            )}
                          </div>
                        )}

                        {!executionProgress && (
                          <div className="text-xs text-muted-foreground animate-pulse">Conectando ao LLM...</div>
                        )}

                        {/* Stall warning */}
                        {isStale && !isVeryStale && (
                          <div className="text-xs text-amber-400 flex items-center gap-1">
                            ⚠️ Sem atividade há {formatElapsed(sinceTool)} — LLM pode estar travado
                          </div>
                        )}

                        {/* Very stale — show fallback actions */}
                        {isVeryStale && (
                          <div className="space-y-2 p-3 rounded border border-amber-500/30 bg-amber-500/5">
                            <div className="text-xs text-amber-400 font-medium">
                              ⚠️ Sem atividade há {formatElapsed(sinceTool)} — possível travamento
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => {
                                  setExecutionPhase(null)
                                  setExecutionProgress(null)
                                  setLoading(false)
                                  addLog("warning", "Execução abandonada pelo usuário — use Revalidar para verificar o estado do disco")
                                  toast.warning("Execução abandonada")
                                }}
                              >
                                Abandonar e Revalidar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs"
                                onClick={() => {
                                  setExecutionProgress(prev => prev ? { ...prev, lastToolTime: Date.now() } : prev)
                                  addLog("info", "Timer de stall resetado — aguardando mais...")
                                }}
                              >
                                Continuar Aguardando
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )
                })()}

                {/* Execution summary (after WRITING completes) */}
                {executeResult && !executionPhase && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Implementação via {executeResult.mode}
                      {executeResult.tokensUsed && ` — ${executeResult.tokensUsed.inputTokens.toLocaleString()} in / ${executeResult.tokensUsed.outputTokens.toLocaleString()} out`}
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* ── Gates 2-3 RUNNING ── */}
              {validationStatus === "RUNNING" && (
                <Card className="border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                      Validação Pós-Execução (Gates 2-3)
                    </CardTitle>
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

              {/* ── Gates 2-3 PASSED — Commit phase ── */}
              {validationStatus === "PASSED" && !commitResult && (
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400">✅ Pipeline Completo</CardTitle>
                    <CardDescription>Todas as gates passaram. Pronto para commit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Commit message</Label>
                      <Textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        rows={2}
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Arquivos</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="commitMode" value="manifest" checked={commitMode === "manifest"} onChange={() => setCommitMode("manifest")} className="accent-green-500" />
                          Apenas manifest ({manifestFilePaths.length} arquivos)
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="radio" name="commitMode" value="all" checked={commitMode === "all"} onChange={() => setCommitMode("all")} className="accent-green-500" />
                          Todos os alterados (git add -A)
                        </label>
                      </div>
                    </div>

                    {gitChangedFiles.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-auto rounded border p-2">
                        {gitChangedFiles.map((f) => {
                          const inManifest = manifestFilePaths.includes(f.path)
                          const included = commitMode === "all" || inManifest
                          return (
                            <div key={f.path} className={`flex items-center gap-2 text-xs font-mono ${included ? "" : "opacity-30"}`}>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${f.status === "untracked" ? "border-green-500/40 text-green-400" : f.status === "deleted" ? "border-red-500/40 text-red-400" : ""}`}>
                                {f.status.slice(0, 3).toUpperCase()}
                              </Badge>
                              <span className="truncate">{f.path}</span>
                              {inManifest && <Badge variant="secondary" className="text-[10px] shrink-0">manifest</Badge>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <Button onClick={handleGitCommit} disabled={gitLoading || !commitMessage.trim()} className="w-full">
                      {gitLoading ? "Commitando..." : "🎉 Git Commit"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* ── COMMITTED — result + push ── */}
              {commitResult && (
                <Card className="border-green-500/30">
                  <CardHeader>
                    <CardTitle className="text-green-400">✅ Commit Realizado!</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm font-mono bg-muted/30 p-3 rounded">
                      <span className="text-amber-400">{commitResult.commitHash.slice(0, 7)}</span>{" "}
                      {commitResult.message}
                    </div>

                    {!pushResult ? (
                      <Button onClick={handleGitPush} disabled={gitLoading} variant="outline" className="w-full">
                        {gitLoading ? "Pushing..." : "Push →"}
                      </Button>
                    ) : (
                      <div className="text-sm text-green-400 font-medium">
                        ✓ Pushed to {pushResult.branch}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Gates 2-3 FAILED ── */}
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

              {/* ── Footer ── */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={handleReset}>
                  Nova Tarefa
                </Button>
                <div className="flex gap-2">
                  {validationStatus === "FAILED" && outputId && (
                    <Button variant="secondary" size="sm" disabled={loading} onClick={() => startExecutionValidation()}>
                      ↻ Revalidar Gates 2-3 (0 tokens)
                    </Button>
                  )}
                  {(validationStatus === "FAILED" || (!executionPhase && executeResult && validationStatus !== "RUNNING")) && outputId && (
                    <Button variant="secondary" size="sm" disabled={loading || executionPhase === "WRITING"} onClick={handleExecute}>
                      Executar Novamente (LLM)
                    </Button>
                  )}
                  {outputId && !executionPhase && validationStatus !== "RUNNING" && (
                    <Button variant="secondary" size="sm" disabled={loading} onClick={() => handleRerunFromDisk()}>
                      ↻ Revalidar do disco (0 tokens)
                    </Button>
                  )}
                  {runId && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/runs/${runId}/v2`)}>
                      Ver Run
                    </Button>
                  )}
                </div>
                  </div>
                </div>
              )}
            </div>

            {/* Context panel: sticky, cola na viewport (desktop only) */}
            <div
              className="context-panel-desktop"
              style={{
                width: '320px',
                flexShrink: 0,
                position: 'sticky',
                top: '80px',  // Altura do OrchestratorHeader + gap
                alignSelf: 'flex-start',
                zIndex: 5,
              }}
            >
              <ContextPanel
                projects={projects}
                selectedProjectId={selectedProjectId}
                onProjectChange={setSelectedProjectId}
                taskType={taskType}
                onTaskTypeChange={setTaskType}
                stepLLMs={stepLLMs}
                onStepLLMChange={setStepLLM}
                providerModels={PROVIDER_MODELS}
                getDefault={getDefault}
                diskArtifacts={diskArtifacts}
                showRerunPicker={showRerunPicker}
                onToggleRerunPicker={() => setShowRerunPicker(!showRerunPicker)}
                onRerunFromDisk={handleRerunFromDisk}
                rerunLoading={rerunLoading}
                loading={loading}
                logs={logs}
                logsCount={logs.length}
                debugMode={debugMode}
                onToggleDebug={() => setDebugMode(!debugMode)}
                onOpenLogs={() => setLogsDrawerOpen(true)}
              />
            </div>
          </div>

      {/* Fix instructions dialog */}
      <FixInstructionsDialog
        open={fixDialogOpen}
        onOpenChange={setFixDialogOpen}
        target={fixDialogTarget}
        failedValidators={fixDialogValidators}
        onConfirm={handleFixWithInstructions}
      />

      {/* Logs Drawer */}
      {outputId && (
        <LogsDrawer
          isOpen={logsDrawerOpen}
          onClose={() => setLogsDrawerOpen(false)}
          pipelineId={outputId}
        />
      )}
      </div>
    </div>
  )
}

export default OrchestratorPage
