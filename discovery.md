# Discovery Report - Implementação do Discovery Step

<task_summary>
Implementar o Discovery Step como substep interno do Step 1 (Planner). O Discovery mapeia o codebase antes do planejamento, gerando discovery_report.md com tags XML contendo arquivos a modificar/criar, snippets de código, padrões arquiteturais e hipóteses confirmadas/não-confirmadas. O Planner então usa esse contexto para gerar microplans.json mais precisos, reduzindo alucinações e iterações de Fix.

Abordagem: usar name prefix pattern (discovery-*, planner-*) sem migration de schema. Frontend adiciona substeps internos (discovery/planner/null) com opção de bypass para usuários que já têm discovery_report.md pronto.
</task_summary>

<files_to_modify>
<file path="packages/gatekeeper-api/src/services/AgentPromptAssembler.ts" status="existing">
  <current_state>130 linhas, assembleForStep() concatena prompts do DB, assembleAll() retorna Map</current_state>
  <reason>Adicionar método assembleForSubstep(step, prefix) que filtra por name.startsWith()</reason>
  <evidence>
    - Linha 54-76: assembleForStep() query com where: { step, role: 'system', isActive: true }
    - Linha 83-92: assembleAll() itera steps [1, 2, 4]
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts" status="existing">
  <current_state>850 linhas, generatePlan/Spec/Fix/Execute métodos, usa AgentRunnerService</current_state>
  <reason>Adicionar generateDiscovery() e modificar generatePlan() para aceitar discoveryReportContent</reason>
  <evidence>
    - Linha 137-297: generatePlan() atual usa assembleForStep(1), READ_TOOLS + SAVE_ARTIFACT_TOOL
    - Linha 299-400: generateSpec() similar pattern, step 2
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/api/controllers/BridgeController.ts" status="existing">
  <current_state>450 linhas, endpoints /plan, /spec, /fix, /execute, retorna 202 + SSE</current_state>
  <reason>Adicionar endpoint generateDiscovery() e modificar generatePlan() para aceitar discoveryReportContent</reason>
  <evidence>
    - Linha 96-146: generatePlan() retorna 202, roda bridge.generatePlan() em background
    - Linha 62-66: makeEmitter() helper para SSE events
  </evidence>
</file>

<file path="packages/gatekeeper-api/src/api/routes/agent.routes.ts" status="existing">
  <current_state>30 linhas, define rotas POST /bridge/plan, /spec, /fix, /execute</current_state>
  <reason>Adicionar rota POST /bridge/discovery</reason>
  <evidence>
    - Linha 15: router.post('/bridge/plan', (req, res) => controller.generatePlan(req, res))
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
  <current_state>200 linhas, seed de PromptInstruction, AgentPhaseConfig, etc</current_state>
  <reason>Renomear prompts existentes (adicionar prefixo planner-) e seed novos prompts Discovery</reason>
  <evidence>
    - Linha 50-80: await prisma.promptInstruction.createMany() pattern
  </evidence>
</file>

<file path="src/components/orchestrator/types.ts" status="existing">
  <current_state>150 linhas, define WizardStep, OrchestratorSession, PageTab, etc</current_state>
  <reason>Adicionar PlannerSubstep type e campos em OrchestratorSession</reason>
  <evidence>
    - Linha 20-30: export type WizardStep = 0 | 1 | 2 | 3 | 4
    - Linha 40-60: export interface OrchestratorSession
  </evidence>
</file>

<file path="src/components/orchestrator-page.tsx" status="existing">
  <current_state>2500 linhas, main orchestrator UI, handleGeneratePlan, useOrchestratorEvents, etc</current_state>
  <reason>Adicionar substeps (discovery/planner/null), handlers (handleGenerateDiscovery, handleSkipDiscovery, handleUploadDiscovery), UI condicional</reason>
  <evidence>
    - Linha 400-420: handleGeneratePlan() atual
    - Linha 600-650: useOrchestratorEvents hook com handleSSE callback
    - Linha 1000-1200: UI condicional por step
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
  <current_state>80 linhas, visual indicator de steps 0-4 com badges</current_state>
  <reason>Opcional: adicionar indicador de substep (Discovery → Planner)</reason>
  <evidence>
    - Linha 20-40: STEPS array com labels
  </evidence>
</file>
</files_to_modify>

<files_to_create>
<file path="packages/gatekeeper-api/src/utils/discoveryParser.ts" status="new">
  <reason>Opcional: parser XML → objeto para discovery_report.md (cheerio ou fast-xml-parser)</reason>
  <pattern>Similar a ArtifactValidationService pattern (parsing + validation)</pattern>
</file>
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

<snippet file="src/components/orchestrator-page.tsx" lines="400-420">
```typescript
const handleGeneratePlan = async () => {
  setIsWorking(true)
  try {
    const res = await api.post('/agent/bridge/plan', {
      taskDescription,
      projectPath: selectedProject.rootPath,
      provider: stepLLMs[1].provider,
      model: stepLLMs[1].model,
    })
    setOutputId(res.outputId)
    setStep(1) // Mostra loading do planner
  } catch (err) {
    toast.error('Falha ao iniciar planner')
  }
}
```
</snippet>

<snippet file="src/components/orchestrator/types.ts" lines="20-30">
```typescript
export type WizardStep = 0 | 1 | 2 | 3 | 4
//  0 = input
//  1 = planner
//  2 = spec
//  3 = validation/fix
//  4 = execution

export const STEPS: Record<WizardStep, string> = {
  0: 'Input',
  1: 'Planner',
  2: 'Spec',
  3: 'Validation',
  4: 'Execution',
}
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
</confirmed_hypotheses>

<unconfirmed_hypotheses>
<hypothesis id="H7" status="unconfirmed">
  <question>Discovery deve ter maxIterations menor que Planner (20 vs 30)?</question>
  <option id="A">Sim, 20 iterações (Discovery é mais focado, menos complexo)</option>
  <option id="B">Não, 30 iterações (Discovery pode precisar explorar muito)</option>
  <option id="C">Configurável via AgentPhaseConfig (usuário decide)</option>
  <recommendation>A</recommendation>
  <reasoning>Discovery faz read-only operations (glob, grep, read_file), menos iterações que Planner que gera microplans complexos</reasoning>
</hypothesis>

<hypothesis id="H8" status="unconfirmed">
  <question>Discovery deve usar modelo mais barato (haiku) ou mesmo modelo (sonnet)?</question>
  <option id="A">Modelo mais barato (haiku ou gpt-4o-mini) - Discovery é task simples</option>
  <option id="B">Mesmo modelo (sonnet) - manter consistência de qualidade</option>
  <option id="C">Configurável via AgentPhaseConfig (usuário decide)</option>
  <recommendation>C</recommendation>
  <reasoning>AgentPhaseConfig já permite step 1 ter provider/model diferentes, usuário escolhe trade-off custo vs qualidade</reasoning>
</hypothesis>

<hypothesis id="H9" status="unconfirmed">
  <question>Parsing XML do discovery_report.md deve ser implementado ou deixar como string?</question>
  <option id="A">Implementar parser (cheerio ou fast-xml-parser) com validação</option>
  <option id="B">Deixar como string, Planner processa direto</option>
  <option id="C">Parser opcional, default string (simplificar MVP)</option>
  <recommendation>C</recommendation>
  <reasoning>MVP pode passar discovery_report.md como string no prompt do Planner, parser pode vir depois se necessário</reasoning>
</hypothesis>

<hypothesis id="H10" status="unconfirmed">
  <question>UI deve mostrar preview do discovery_report.md ou apenas botão "Continuar"?</question>
  <option id="A">Preview completo com ArtifactViewer (usuário revisa antes de continuar)</option>
  <option id="B">Apenas botão "Continuar" (auto-avança, mais rápido)</option>
  <option id="C">Preview colapsável (default collapsed, usuário expande se quiser)</option>
  <recommendation>A</recommendation>
  <reasoning>Transparência é key benefit do Discovery, usuário deve poder revisar mapeamento antes do Planner</reasoning>
</hypothesis>
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
  <dep name="cheerio" optional="true">Parser XML para discovery_report.md (se implementar parsing estruturado)</dep>
  <dep name="fast-xml-parser" optional="true">Alternativa ao cheerio para parsing XML (mais leve)</dep>
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
  <detail>MP-8: Parser XML opcional (backend - nice-to-have)</detail>
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
  <detail>MP-8: utils/discoveryParser.ts</detail>
</step>

<step n="3">
  <title>Dependencies between microplans</title>
  <detail>MP-1 → MP-2 (seed antes de usar assembleForSubstep)</detail>
  <detail>MP-2 → MP-3 (assembleForSubstep usado por generateDiscovery)</detail>
  <detail>MP-3 → MP-4 (Bridge method chamado por Controller)</detail>
  <detail>MP-4 → MP-5 (Backend API pronto antes de frontend consumir)</detail>
  <detail>MP-5 → MP-6 (Types definidos antes de UI usar)</detail>
  <detail>MP-7 independente (pode rodar em paralelo após MP-4)</detail>
  <detail>MP-8 independente (nice-to-have, não bloqueia outros)</detail>
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
  <title>User questions to resolve before implementation</title>
  <detail>H7: maxIterations Discovery = 20 ou 30? (Recomendação: 20)</detail>
  <detail>H8: Modelo Discovery = haiku ou sonnet? (Recomendação: configurável)</detail>
  <detail>H9: Parser XML ou string raw? (Recomendação: string no MVP, parser opcional depois)</detail>
  <detail>H10: Preview discovery_report.md ou auto-avança? (Recomendação: preview)</detail>
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
