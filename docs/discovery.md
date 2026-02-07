# Discovery Report - Implementação do Discovery Step

<task_summary>
Implementar o Discovery Step como substep interno do Step 1 (Planner). O Discovery mapeia o codebase antes do planejamento, gerando discovery_report.md com tags XML contendo arquivos a modificar/criar, snippets de código, padrões arquiteturais e hipóteses confirmadas/não-confirmadas. O Planner então usa esse contexto para gerar microplans.json mais precisos, reduzindo alucinações e iterações de Fix.

Abordagem: usar name prefix pattern (discovery-*, planner-*) sem migration de schema. Frontend adiciona substeps internos (discovery/planner/null) com opção de bypass para usuários que já têm discovery_report.md pronto.
</task_summary>

<files_to_modify>
<file path="packages/gatekeeper-api/src/services/AgentPromptAssembler.ts" status="existing">
  <current_state>345 linhas, assembleForStep() concatena prompts do DB, assembleAll() retorna Map</current_state>
  <reason>Adicionar método assembleForSubstep(step, prefix) que filtra por name.startsWith()</reason>
  <evidence>
    - Linha 54-76: assembleForStep() query com where: { step, role: 'system', isActive: true }
    - Linha 84: assembleAll() const steps = [1, 2, 4] (ignora step 3)
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts" status="existing">
  <current_state>2237 linhas, generatePlan/Spec/Fix/Execute métodos, usa AgentRunnerService</current_state>
  <reason>Adicionar generateDiscovery() e modificar generatePlan() para aceitar discoveryReportContent</reason>
  <evidence>
    - Método generatePlan() existe (lido parcialmente, usa assembleForStep, READ_TOOLS + SAVE_ARTIFACT_TOOL)
    - Método generateSpec() existe (similar pattern)
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/api/controllers/BridgeController.ts" status="existing">
  <current_state>798 linhas, endpoints /plan, /spec, /fix, /execute, retorna 202 + SSE</current_state>
  <reason>Adicionar endpoint generateDiscovery() e modificar generatePlan() para aceitar discoveryReportContent</reason>
  <evidence>
    - Método generatePlan() existe (lido parcialmente, retorna 202, roda bridge.generatePlan() em background)
    - makeEmitter() helper existe para SSE events
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/api/routes/agent.routes.ts" status="existing">
  <current_state>438 linhas, define rotas POST /bridge/plan, /spec, /fix, /execute, /pipeline, GET /artifacts</current_state>
  <reason>Adicionar rota POST /bridge/discovery</reason>
  <evidence>
    - Linha 261-267: router.post('/bridge/plan', async (req, res, next) => { await bridgeCtrl.generatePlan(req, res) })
    - Linha 269-275: router.post('/bridge/spec', ...)
    - Linha 277-283: router.post('/bridge/fix', ...)
    - Linha 285-291: router.post('/bridge/execute', ...)
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/types/agent.types.ts" status="existing">
  <current_state>164 linhas, define PhaseConfig, AgentEvent, LLMProvider, etc</current_state>
  <reason>Adicionar interfaces DiscoveryReport, BridgeDiscoveryInput, BridgeDiscoveryOutput</reason>
  <evidence>
    - Linha 38-60: BridgePlanInput/Output já existem
    - Linha 144-152: AgentResult interface (reusar pattern)
  </evidence>
</file>

<file path="packages/gatekeeper-api/prisma/seed-prompt-content.ts" status="existing">
  <current_state>800 linhas, constantes PLANNER_PLAYBOOK_CONTENT, CONTRACT_QUESTIONNAIRES_CONTENT, etc</current_state>
  <reason>Adicionar DISCOVERY_PLAYBOOK_CONTENT e DISCOVERY_REPORT_TEMPLATE</reason>
  <evidence>
    - Linha 13-113: PLANNER_PLAYBOOK_CONTENT (pattern similar para Discovery)
  </evidence>
</file>

<file path="packages/gatekeeper-api/prisma/seed.ts" status="existing">
  <current_state>Arquivo muito grande (não consegui ler completo), seed de workspace, sensitiveFileRules, ambiguousTerms, validationConfigs, etc</current_state>
  <reason>Renomear prompts existentes (adicionar prefixo planner-) e seed novos prompts Discovery</reason>
  <evidence>
    - Linha 1-150: seed de workspace, project, sensitiveFileRules, ambiguousTerms, validationConfigs
    - Pattern: await prisma.[model].upsert() com where unique keys
  </evidence>
</file>

<file path="src/components/orchestrator/types.ts" status="existing">
  <current_state>72 linhas, define WizardStep, OrchestratorSession, ParsedArtifact, LogEntry, StepLLMConfig, constants STEPS</current_state>
  <reason>Adicionar PlannerSubstep type e campos em OrchestratorSession</reason>
  <evidence>
    - Linha 25: export type WizardStep = 0 | 1 | 2 | 3 | 4
    - Linha 33-55: export interface OrchestratorSession (com 17 campos)
    - Linha 65-71: export const STEPS array com labels: Tarefa, Plano, Testes, Validação, Execução
  </evidence>
</file>

<file path="src/components/orchestrator-page.tsx" status="existing">
  <current_state>2926 linhas, main orchestrator UI, handleGeneratePlan, useOrchestratorEvents, SSE, session persistence</current_state>
  <reason>Adicionar substeps (discovery/planner/null), handlers (handleGenerateDiscovery, handleSkipDiscovery, handleUploadDiscovery), UI condicional</reason>
  <evidence>
    - Linha 1310-1330: handleGeneratePlan() - clearSession, reset states, POST /bridge/plan com taskDescription + stepLLMs
    - useOrchestratorEvents hook existe (não localizei linha exata)
    - UI condicional por step existe (não localizei linhas exatas - arquivo muito grande)
  </evidence>
</file>

<file path="src/lib/types.ts" status="existing">
  <current_state>300 linhas, define tipos do frontend (Project, Run, ValidatorResult, etc)</current_state>
  <reason>Adicionar evento SSE agent:bridge_discovery_done</reason>
  <evidence>
    - Linha 150-180: type OrchestratorEvent union com agent:bridge_plan_done, etc
  </evidence>
</file>

<file path="src/components/orchestrator/step-indicator.tsx" status="existing">
  <current_state>40 linhas, visual indicator de steps 0-4 com badges, click handler, completed state</current_state>
  <reason>Opcional: adicionar indicador de substep (Discovery → Planner)</reason>
  <evidence>
    - Linha 1: import STEPS from types.ts
    - Linha 12: STEPS.map(({ num, label }) - itera steps e renderiza badges com current/completed states
  </evidence>
</file>
</files_to_modify>

<files_to_create>
<none>Nenhum arquivo novo será criado no MVP (H9: discovery report como string, sem parser)</none>
</files_to_create>

<code_snippets>
<snippet file="packages/gatekeeper-api/src/services/AgentPromptAssembler.ts" lines="54-76">
```typescript
async assembleForStep(step: number): Promise<string> {
  const contents = await this.prisma.promptInstruction.findMany({
    where: { step, role: 'system', isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  if (!contents || contents.length === 0) {
    throw new Error(
      `No prompt content configured for pipeline step ${step}. ` +
        `Run 'npm run db:seed' or create entries via the /api/agent/content CRUD API.`,
    )
  }

  const assembled = contents.map((c) => c.content).join('\n\n')

  if (!assembled) {
    throw new Error(
      `Prompt content for step ${step} exists but assembled to empty string. ` +
        `Check that entries have non-empty 'content' fields.`,
    )
  }

  return assembled
}
```
</snippet>

<snippet file="packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts" lines="137-160">
```typescript
async generatePlan(
  input: BridgePlanInput,
  callbacks: BridgeCallbacks = {},
): Promise<BridgePlanOutput> {
  const outputId = input.outputId || this.generateOutputId(input.taskDescription)
  const emit = callbacks.onEvent ?? (() => {})

  emit({ type: 'agent:bridge_start', step: 1, outputId } as AgentEvent)

  // Resolve phase config
  const phase = await this.resolvePhaseConfig(1, input.provider, input.model)

  // Build system prompt from DB + session context
  const sessionContext = await this.fetchSessionContext(input.profileId)
  const systemPrompt = await this.assembler.assembleForStep(1)

  // User message
  let userMessage = `# Task\n\n${input.taskDescription}\n\n`
  // ...
}
```
</snippet>

<snippet file="packages/gatekeeper-api/src/api/controllers/BridgeController.ts" lines="96-116">
```typescript
async generatePlan(req: Request, res: Response): Promise<void> {
  const { taskDescription, projectPath, taskType, profileId, model, attachments } = req.body
  const provider = asProvider(req.body.provider)

  if (!taskDescription || !projectPath) {
    res.status(400).json({ error: 'taskDescription and projectPath are required' })
    return
  }

  const bridge = getBridge()

  // Generate outputId early so the client can connect SSE before work starts
  const outputId = generateOutputId(taskDescription)

  const emit = makeEmitter(outputId)

  // Return immediately so the client can connect SSE
  res.status(202).json({
    outputId,
    eventsUrl: `/api/orchestrator/events/${outputId}`,
  })
```
</snippet>

<snippet file="src/components/orchestrator-page.tsx" lines="1310-1330">
```typescript
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
      // ... resto do payload
    }
```
</snippet>

<snippet file="src/components/orchestrator/types.ts" lines="25-71">
```typescript
export type WizardStep = 0 | 1 | 2 | 3 | 4
export type PageTab = "pipeline"

export interface StepLLMConfig {
  provider: string
  model: string
}

export interface OrchestratorSession {
  outputId?: string
  step: number
  completedSteps: number[]
  taskDescription: string
  taskType?: string
  selectedProjectId: string | null
  provider: string
  model: string
  stepLLMs?: Record<number, StepLLMConfig>
  planArtifacts: ParsedArtifact[]
  specArtifacts: ParsedArtifact[]
  runId: string | null
  savedAt: number
  lastEventId: number
  lastSeq: number
  pipelineStatus: string | null
  pipelineStage: string | null
  pipelineProgress: number
  microplansArtifact?: ParsedArtifact
  hasMicroplans?: boolean
}

// Constants
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
export const SESSION_KEY_PREFIX = "gk-pipeline-"
export const ACTIVE_KEY = "gk-active-pipeline"

export const STEPS = [
  { num: 0, label: "Tarefa" },
  { num: 1, label: "Plano" },
  { num: 2, label: "Testes" },
  { num: 3, label: "Validação" },
  { num: 4, label: "Execução" },
] as const
```
</snippet>

<snippet file="packages/gatekeeper-api/prisma/schema.prisma" lines="322-337">
```prisma
model PromptInstruction {
  id        String   @id @default(cuid())
  name      String   @unique
  content   String
  step      Int?              // null = generic/MCP prompt, 1-4 = pipeline step
  kind      String?           // null = generic, 'instruction' | 'doc' | 'prompt' = pipeline
  role      String   @default("system")  // 'system' | 'user' — system prompts vs user message templates
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  profiles SessionProfilePrompt[]

  @@index([step, kind, role, isActive])
}
```
</snippet>
</code_snippets>

<architecture_patterns>
<pattern name="backend_structure">Express + TypeScript strict mode + Prisma ORM + SQLite</pattern>
<pattern name="agent_pipeline">AgentOrchestratorBridge → AgentRunnerService → LLMProvider (multi-provider)</pattern>
<pattern name="prompt_assembly">DB-driven via PromptInstruction table, assembled by AgentPromptAssembler</pattern>
<pattern name="sse_events">202 immediate return + background execution + SSE via OrchestratorEventService</pattern>
<pattern name="frontend_structure">React 19 + Vite 7 + Radix UI + Tailwind 4 + TypeScript</pattern>
<pattern name="state_management">useState + useCallback + localStorage session persistence</pattern>
<pattern name="api_client">Fetch-based client in lib/api.ts, SSE via EventSource hook</pattern>
<pattern name="naming_convention">camelCase (TypeScript), snake_case (SQL), kebab-case (file names)</pattern>
</architecture_patterns>

<confirmed_hypotheses>
<hypothesis id="H1" status="confirmed">
  <statement>Sistema usa name pattern em PromptInstruction para organização sem campo adicional</statement>
  <evidence>
    - seed-prompt-content.ts usa nomes como "planner-system-v3", "planner-mandatory-v3"
    - Padrão existente permite filtro por prefix sem migration
  </evidence>
</hypothesis>

<hypothesis id="H2" status="confirmed">
  <statement>AgentPhaseConfig step field mantém Int sem mudança (steps 1-4)</statement>
  <evidence>
    - schema.prisma linha 410: step Int @id @default(autoincrement())
    - assembleAll() linha 84 usa steps [1, 2, 4] (ignora 3=fix)
  </evidence>
</hypothesis>

<hypothesis id="H3" status="confirmed">
  <statement>Frontend usa WizardStep 0-4 sem renumeração (substeps internos via state)</statement>
  <evidence>
    - orchestrator/types.ts linha 20: export type WizardStep = 0 | 1 | 2 | 3 | 4
    - orchestrator-page.tsx usa setStep(1) para planner
  </evidence>
</hypothesis>

<hypothesis id="H4" status="confirmed">
  <statement>SSE events usam pattern agent:bridge_* com type union em AgentEvent</statement>
  <evidence>
    - agent.types.ts linha 126-142: type AgentEvent union com agent:bridge_start, agent:bridge_complete, etc
    - BridgeController linha 127: emit({ type: 'agent:bridge_plan_done' })
  </evidence>
</hypothesis>

<hypothesis id="H5" status="confirmed">
  <statement>Tools disponíveis: READ_TOOLS (read_file, glob_pattern, grep_pattern) + SAVE_ARTIFACT_TOOL</statement>
  <evidence>
    - AgentToolExecutor.ts exporta READ_TOOLS, WRITE_TOOLS, SAVE_ARTIFACT_TOOL
    - AgentOrchestratorBridge linha 184 usa [...readTools, saveArtifactTool]
  </evidence>
</hypothesis>

<hypothesis id="H6" status="confirmed">
  <statement>Microplans.json é output do Planner (MP-1=teste, MP-2+=código), contract.md removido</statement>
  <evidence>
    - User feedback: "não existe mais contract.md"
    - Fluxo: Planner → microplans.json → Orquestrador extrai MP-1 → Spec Writer
  </evidence>
</hypothesis>

<hypothesis id="H7" status="confirmed">
  <statement>Discovery maxIterations = 30 (mesmo que Planner)</statement>
  <evidence>User decision: H7: b) - 30 iterations</evidence>
</hypothesis>

<hypothesis id="H8" status="confirmed">
  <statement>Discovery provider/model configurável via AgentPhaseConfig (usuário decide depois)</statement>
  <evidence>User decision: H8: c) - configurável</evidence>
</hypothesis>

<hypothesis id="H9" status="confirmed">
  <statement>Discovery report como string (sem parser XML→objeto no MVP)</statement>
  <evidence>User decision: H9: b) - Planner processa string direto</evidence>
</hypothesis>

<hypothesis id="H10" status="confirmed">
  <statement>UI mostra preview completo do discovery_report.md com ArtifactViewer</statement>
  <evidence>User decision: H10: a) - preview completo antes de continuar</evidence>
</hypothesis>
</confirmed_hypotheses>

<unconfirmed_hypotheses>
<none>Todas as decisões de design foram confirmadas pelo usuário (ver confirmed_hypotheses H7-H10)</none>
</unconfirmed_hypotheses>

<dependencies>
<existing>
  <dep>@prisma/client (DB ORM)</dep>
  <dep>express (HTTP server)</dep>
  <dep>nanoid (outputId generation)</dep>
  <dep>react (frontend)</dep>
  <dep>sonner (toast notifications)</dep>
  <dep>lucide-react (icons)</dep>
</existing>
<new>
  <none>Nenhuma dependência nova (H9: sem parser XML no MVP)</none>
</new>
</dependencies>

<next_steps_for_planner>
<step n="1">
  <title>Microplans.json structure</title>
  <detail>MP-1: Seed prompts Discovery (backend - low risk)</detail>
  <detail>MP-2: Método assembleForSubstep (backend - core)</detail>
  <detail>MP-3: Método generateDiscovery no Bridge (backend - core)</detail>
  <detail>MP-4: Endpoint /discovery no Controller (backend - core)</detail>
  <detail>MP-5: Types e substeps no frontend (frontend - core)</detail>
  <detail>MP-6: UI substeps + bypass no orchestrator-page (frontend - core)</detail>
  <detail>MP-7: Testes unitários + integration (backend)</detail>
</step>

<step n="2">
  <title>File manifest per microplan</title>
  <detail>MP-1: seed-prompt-content.ts, seed.ts</detail>
  <detail>MP-2: AgentPromptAssembler.ts</detail>
  <detail>MP-3: AgentOrchestratorBridge.ts, agent.types.ts</detail>
  <detail>MP-4: BridgeController.ts, agent.routes.ts</detail>
  <detail>MP-5: orchestrator/types.ts</detail>
  <detail>MP-6: orchestrator-page.tsx, lib/types.ts</detail>
  <detail>MP-7: test files (*.spec.ts)</detail>
</step>

<step n="3">
  <title>Dependencies between microplans</title>
  <detail>MP-1 → MP-2 (seed antes de usar assembleForSubstep)</detail>
  <detail>MP-2 → MP-3 (assembleForSubstep usado por generateDiscovery)</detail>
  <detail>MP-3 → MP-4 (Bridge method chamado por Controller)</detail>
  <detail>MP-4 → MP-5 (Backend API pronto antes de frontend consumir)</detail>
  <detail>MP-5 → MP-6 (Types definidos antes de UI usar)</detail>
  <detail>MP-7 independente (pode rodar em paralelo após MP-4)</detail>
</step>

<step n="4">
  <title>Test strategy</title>
  <detail>Unit: assembleForSubstep() filtra por prefix corretamente</detail>
  <detail>Unit: generateDiscovery() valida que discovery_report.md foi gerado</detail>
  <detail>Integration: POST /bridge/discovery → SSE events → discovery_report.md no disk</detail>
  <detail>Integration: POST /bridge/plan com discoveryReportContent → Planner usa contexto</detail>
  <detail>E2E: Fluxo completo Discovery → Review → Planner → Spec → Gates</detail>
  <detail>E2E: Bypass Discovery → Planner direto (sem discoveryReportContent)</detail>
</step>

<step n="5">
  <title>Implementation decisions (confirmed)</title>
  <detail>H7: maxIterations = 30 (mesmo que Planner) ✅</detail>
  <detail>H8: provider/model configurável via AgentPhaseConfig ✅</detail>
  <detail>H9: discovery_report.md como string (sem parser XML no MVP) ✅</detail>
  <detail>H10: preview completo com ArtifactViewer ✅</detail>
</step>

<step n="6">
  <title>Risk mitigation</title>
  <detail>Zero migration = zero risco de downtime ou rollback complexo</detail>
  <detail>Backwards compatibility = assembleForStep(1) continua funcionando</detail>
  <detail>Feature flag opcional = ENABLE_DISCOVERY_BYPASS para rollout gradual</detail>
  <detail>Fallback = se Discovery falhar, usuário pode fazer bypass e ir direto ao Planner</detail>
  <detail>Testing = E2E coverage garante que bypass path funciona (se Discovery não disponível)</detail>
</step>
</next_steps_for_planner>
