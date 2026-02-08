# Discovery Report: Sistema de Validação de Artifacts

> Gerado automaticamente pelo agente Discovery
> Data: 2026-02-08
> Investigação: Erros de validação prematura e inconsistências arquiteturais

---

## Resumo

O sistema possui **validações de artifacts em momentos inconsistentes**: Steps 0, 1, 2 validam outputs após geração (correto), mas **Step 3 (Fix) não valida outputs** antes de persistir. Validações preventivas (inputs) usam abordagens diferentes: Step 2 usa check hardcoded, Step 4 apenas verifica existência. Frontend duplica validações do backend. Resultado: artifacts inválidos podem ser persistidos após fix, e usuário vê erros confusos quando LLM não gera exatamente o formato esperado.

---

## Arquivos Relevantes

### 1. `packages/gatekeeper-api/src/services/ArtifactValidationService.ts`

**Contexto:** Service centralizado que define regras de validação por step. Step 2 exige pelo menos 1 arquivo `*.spec.ts` ou `*.test.ts`.

**Evidência:**
```typescript
} else if (step === 2) {
  // Step 2: Spec/test artifacts
  let hasTestFile = false

  for (const [filename, content] of artifacts.entries()) {
    // Check if this is a test file
    if (/\.(spec|test)\.(ts|js|tsx|jsx)$/.test(filename)) {
      hasTestFile = true
      results.push(this.validateTestFile(filename, content))
    }
  }

  if (!hasTestFile) {
    results.push({
      valid: false,
      severity: 'error',
      message: 'Nenhum arquivo de teste encontrado (*.spec.ts ou *.test.ts)',
```

**Observação:** Este é o erro reportado pelo usuário. Validação bloqueia (severity: 'error') se nenhum test file for encontrado, mesmo que LLM tenha executado mas não salvou com naming correto.

---

### 2. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts` (Step 0 - Discovery)

**Contexto:** Método `generateDiscovery()` valida outputs APÓS agent executar e ANTES de persistir (padrão correto).

**Evidência:**
```typescript
// ✅ VALIDATE discovery artifacts (NÃO exige microplans.json)
const validation = this.validator.validateDiscoveryArtifacts(memoryArtifacts)
if (!validation.valid) {
  const errorDetails = validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  console.error('[Bridge:generateDiscovery] ❌ Artifact validation failed:', {
    errorCount: validation.results.filter(r => r.severity === 'error').length,
    errors: validation.results.filter(r => r.severity === 'error').map(r => ({
      file: r.details.filename,
      issues: r.details.issues
```

**Observação:** Usa `validateDiscoveryArtifacts()` especializado para Step 0. Lança `BridgeError` se inválido, impedindo persistência de artifacts quebrados.

---

### 3. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts` (Step 1 - Plan)

**Contexto:** Método `generatePlan()` valida outputs APÓS agent executar (padrão correto).

**Evidência:**
```typescript
// ✅ VALIDATE artifacts before persisting
const validation = this.validator.validateStepArtifacts(1, memoryArtifacts)
if (!validation.valid) {
  const errorDetails = validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  console.error('[Bridge:generatePlan] ❌ Artifact validation failed:', {
    errorCount: validation.results.filter(r => r.severity === 'error').length,
    errors: validation.results.filter(r => r.severity === 'error').map(r => ({
      file: r.details.filename,
      issues: r.details.issues
    }))
  })

  throw new BridgeError(
    `Plan artifacts validation failed: ${errorDetails}`,
```

**Observação:** Valida `microplans.json` + `task_prompt.md`. Bloqueia se inválido. Padrão consistente com Step 0 e Step 2.

---

### 4. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts` (Step 2 - Spec)

**Contexto:** Método `generateSpec()` valida outputs APÓS agent executar (correto) E valida inputs ANTES (hardcoded - inconsistente).

**Evidência (validação de input - linha 478):**
```typescript
const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)

// Validate that microplans.json exists
if (!existingArtifacts['microplans.json']) {
  throw new BridgeError(
    `Missing step 1 artifacts: microplans.json`,
    'MISSING_ARTIFACTS',
    { missing: ['microplans.json'], outputId: input.outputId },
  )
}

const phase = await this.resolvePhaseConfig(2, input.provider, input.model)
```

**Observação:** Validação preventiva (input) hardcoded - não usa `ArtifactValidationService`. Inconsistente com arquitetura proposta (deveria usar `validateStepArtifacts(1)` para verificar estrutura de microplans.json).

**Evidência (validação de output - linha 655):**
```typescript
// ✅ VALIDATE spec artifacts before persisting
const validation = this.validator.validateStepArtifacts(2, memoryArtifacts)
if (!validation.valid) {
  const errorDetails = validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  console.error('[Bridge:generateSpec] ❌ Artifact validation failed:', {
    errorCount: validation.results.filter(r => r.severity === 'error').length,
    errors: validation.results.filter(r => r.severity === 'error').map(r => ({
      file: r.details.filename,
      issues: r.details.issues
    }))
  })

  throw new BridgeError(
    `Spec artifacts validation failed: ${errorDetails}`,
```

**Observação:** Validação de output correta (usa service). Este é o ponto onde erro "Nenhum arquivo de teste encontrado" é lançado ao usuário.

---

### 5. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts` (Step 3 - Fix)

**Contexto:** Método `fixArtifacts()` **NÃO valida outputs** antes de persistir. **PROBLEMA CRÍTICO**.

**Evidência (linha 1175):**
```typescript
for (const [name, c] of savedArtifacts) {
  console.log(`[Bridge:Fix]   POST ${name}: ${c.length} chars`)
}

const artifacts = await this.persistArtifacts(
  savedArtifacts,
  input.outputId,
  input.projectPath,
)

console.log('[Bridge:Fix] persistArtifacts result:', artifacts.length, 'files')
// Compare pre vs post
for (const art of artifacts) {
```

**Observação:** Persiste direto sem validar. Agent pode "corrigir" `microplans.json` inválido e gerar outro `microplans.json` inválido que será persistido. Frontend avança para próximo step com artifacts quebrados. **Único step sem validação de output**.

---

### 6. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts` (Step 4 - Execute)

**Contexto:** Método `execute()` valida inputs de forma **rudimentar** (apenas verifica que não está vazio).

**Evidência (linha 722):**
```typescript
const existingArtifacts = await this.readArtifactsFromDisk(input.outputId, input.projectPath)

if (Object.keys(existingArtifacts).length === 0) {
  throw new BridgeError(
    `No artifacts found for ${input.outputId}`,
    'MISSING_ARTIFACTS',
    { outputId: input.outputId },
  )
}

// ✅ NEW: Individual microplan execution (default behavior)
if (input.individualExecution !== false) {
  const microplansJson = existingArtifacts['microplans.json']
```

**Observação:** Não valida ESTRUTURA de artifacts (pode ter artifacts mas inválidos). Não usa `ArtifactValidationService`. Se `microplans.json` for JSON inválido, falha tarde (dentro do agent loop) ao invés de early-return.

---

### 7. `packages/gatekeeper-api/src/api/controllers/BridgeController.ts`

**Contexto:** Controller `generateSpec()` faz validação EXTRA após agent completar (redundante com validação do Bridge).

**Evidência (linha 273):**
```typescript
// Validate that we have artifacts before emitting success
if (!result.artifacts || result.artifacts.length === 0) {
  console.error('[Bridge] Spec generation completed but no artifacts were produced')
  OrchestratorEventService.emitOrchestratorEvent(outputId, {
    type: 'agent:error',
    error: 'Spec generation completed but no artifacts were produced. Check LLM output.',
  })
  return
}

// Emit completion with full result
console.log(`[Bridge] Spec done: ${result.artifacts.length} artifact(s)`)
```

**Observação:** Controller duplica validação do Bridge (linha 655 já valida). Se LLM não gerou artifacts, Bridge já lançou `BridgeError`. Controller não deveria fazer validação adicional (separação de responsabilidades).

---

### 8. `src/components/orchestrator-page.tsx`

**Contexto:** Frontend valida artifacts **depois** que backend já validou (SSE handler duplica validação).

**Evidência (linha 935):**
```typescript
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
```

**Observação:** Frontend valida no SSE handler após receber evento `agent:bridge_plan_done`. Backend já validou (linha 408 do Bridge). Validação duplicada pode causar race condition se regras divergirem.

---

### 9. `packages/gatekeeper-api/src/services/ArtifactValidationService.ts` (validateTestFile)

**Contexto:** Método que valida conteúdo de arquivos de teste (usado por Step 2).

**Evidência (linha 151):**
```typescript
validateTestFile(filename: string, content: string): ValidationResult {
  const issues: ValidationIssue[] = []

  // 1. Filename pattern
  if (!/\.(spec|test)\.(ts|js|tsx|jsx)$/.test(filename)) {
    issues.push({
      field: 'filename',
      expected: '*.spec.ts, *.test.ts, *.spec.tsx, *.test.tsx, *.spec.js, *.test.js',
      actual: filename,
      severity: 'error'
    })
  }

  // 2. Content length (min 20 chars to avoid empty/stub files)
  if (content.length < 20) {
    issues.push({
      field: 'content',
```

**Observação:** Validação DURA (severity: 'error'). Se filename não match pattern exato ou conteúdo < 20 chars, test file é rejeitado. Explica por que LLM pode ter gerado teste mas validação falhou (ex: salvou como `test.ts` ao invés de `test.spec.ts`).

---

### 10. `packages/gatekeeper-api/src/services/ArtifactValidationService.ts` (validateMicroplansJson)

**Contexto:** Método que valida estrutura de `microplans.json` (usado por Step 1).

**Evidência (linha 45):**
```typescript
validateMicroplansJson(jsonString: string): ValidationResult {
  const issues: ValidationIssue[] = []

  // 1. JSON parseability
  let parsed: any
  try {
    parsed = JSON.parse(jsonString)
  } catch (error) {
    return {
      valid: false,
      severity: 'error',
      message: 'JSON não parseável',
      details: { filename: 'microplans.json', issues: [{ field: 'format', expected: 'Valid JSON', actual: 'Parse error', severity: 'error' }] }
    }
  }

  // 2. Task field
  if (!parsed.task || typeof parsed.task !== 'string' || parsed.task.trim().length === 0) {
    issues.push({
      field: 'task',
```

**Observação:** Validações DURAS bloqueiam: JSON inválido, campo `task` ausente/vazio, campo `microplans` não-array ou vazio. Se Step 3 (Fix) não validar outputs, pode persistir microplans.json com esses erros.

---

## Estrutura de Dependências

```
ArtifactValidationService.ts
  ← importado por: AgentOrchestratorBridge.ts
  → não importa outros services (standalone)

AgentOrchestratorBridge.ts
  ← importado por: BridgeController.ts
  → importa: ArtifactValidationService, AgentRunnerService, AgentToolExecutor

BridgeController.ts
  ← importado por: agent.routes.ts
  → importa: AgentOrchestratorBridge, OrchestratorEventService

orchestrator-page.tsx
  ← não importado (página raiz)
  → importa: validateStepArtifacts (função local), api.bridgeArtifacts
```

---

## Padrões Identificados

- **Naming:**
  - Services: `PascalCase` + `Service` suffix
  - Methods: `camelCase` (ex: `validateStepArtifacts`, `generatePlan`)
  - Types: `PascalCase` (ex: `ValidationResult`, `BridgeError`)

- **Imports:**
  - Backend usa paths relativos: `../services/`, `../../types/`
  - Frontend usa alias `@/` para `src/`
  - Tipos compartilhados: `@/types/` (ex: `ValidationResult`)

- **Validação:**
  - **Output validation:** APÓS `runner.run()`, ANTES `persistArtifacts()`
  - **Input validation:** APÓS `readArtifactsFromDisk()`, ANTES `runner.run()`
  - **Service-based:** Steps 0, 1, 2 usam `ArtifactValidationService`
  - **Hardcoded:** Step 2 (input), Step 4 (input), Step 3 (AUSENTE)

- **Error handling:**
  - Backend lança `BridgeError` com código (ex: `INVALID_ARTIFACTS`)
  - Controller captura e emite SSE `agent:error`
  - Frontend SSE handler mostra toast + log

- **Testes:**
  - Backend: `vitest`, arquivos em `test/unit/`, `test/integration/`
  - Naming: `*.spec.ts`
  - Frontend: `vitest`, arquivos em `src/components/__tests__/`
  - Naming: `*.spec.tsx`

---

## Estado Atual vs Desejado

| Aspecto | Atual | Desejado |
|---------|-------|----------|
| **Step 0 (Discovery) - Output** | ✅ Valida com `validateDiscoveryArtifacts()` | ✅ Mantém |
| **Step 1 (Plan) - Output** | ✅ Valida com `validateStepArtifacts(1)` | ✅ Mantém |
| **Step 2 (Spec) - Input** | ⚠️ Check hardcoded `microplans.json` | ✅ Usar `validateStepArtifacts(1)` |
| **Step 2 (Spec) - Output** | ✅ Valida com `validateStepArtifacts(2)` | ✅ Mantém |
| **Step 3 (Fix) - Input** | ❌ Não valida inputs | ✅ Validar com `validateStepArtifacts(1 ou 2)` |
| **Step 3 (Fix) - Output** | ❌ Não valida outputs | ✅ Validar com `validateStepArtifacts(1 ou 2)` |
| **Step 4 (Execute) - Input** | ⚠️ Apenas verifica se vazio | ✅ Validar estrutura com `validateStepArtifacts(1)` |
| **Controller** | ⚠️ Valida duplicado (linha 273) | ✅ Remover (Bridge já valida) |
| **Frontend SSE** | ⚠️ Valida duplicado (linha 935) | ✅ Remover (Backend já valida) |

---

## Riscos

- **Step 3 sem validação de output:** Artifacts inválidos podem ser persistidos após "correção", propagando erros para steps seguintes. Frontend avança com estado corrompido.

- **Validações inconsistentes:** Steps usam abordagens diferentes (service vs hardcoded vs none). Dificulta manutenção e adiciona pontos de falha.

- **Validação duplicada (Controller + Frontend):** Se regras divergirem, pode causar race condition ou estados inconsistentes. Backend valida, frontend rejeita (ou vice-versa).

- **Step 4 validação rudimentar:** Se `microplans.json` for JSON inválido, falha tarde (dentro do agent loop). Desperdiça tokens LLM e tempo de execução.

- **Error messages genéricos:** Usuário vê "Nenhum arquivo de teste encontrado" sem contexto de POR QUE (LLM não chamou tool? Salvou com filename errado? Output foi texto puro?).

- **Arquivo grande:** `AgentOrchestratorBridge.ts` tem 1500+ linhas. Mudanças em validação afetam múltiplos métodos (generateDiscovery, generatePlan, generateSpec, fixArtifacts, execute).

---

## Arquivos NÃO Relevantes (descartados)

- `packages/gatekeeper-api/src/api/routes/agent.routes.ts` — Apenas routing, não contém lógica de validação
- `packages/gatekeeper-api/src/services/AgentRunnerService.ts` — Executa LLM mas não valida artifacts
- `packages/gatekeeper-api/src/services/AgentToolExecutor.ts` — Gerencia tools mas não valida outputs
- `packages/gatekeeper-api/src/types/agent.types.ts` — Apenas type definitions
- `src/lib/api.ts` — HTTP client, não valida
- `src/hooks/useRunEvents.ts` — SSE consumer, não valida
- `packages/gatekeeper-api/src/services/OrchestratorEventService.ts` — Emite eventos SSE, não valida
- `packages/gatekeeper-api/src/api/middlewares/errorHandler.ts` — Generic error handling, não específico de artifacts
- `packages/gatekeeper-api/test/unit/ArtifactValidationService.spec.ts` — Testes do service (não implementação)

---

## Conclusão Técnica

Sistema possui **gap crítico no Step 3** (não valida outputs) e **inconsistências arquiteturais** (validações preventivas hardcoded vs service-based). Padrão correto está implementado nos Steps 0, 1, 2 (validar outputs com `ArtifactValidationService` antes de persistir), mas Step 3 persiste direto e Step 4 valida de forma rudimentar. Validações duplicadas no Controller e Frontend criam overhead e risco de divergência.

**Prioridade de correção:** Step 3 (Fix) > Step 2/4 (padronizar inputs) > Controller/Frontend (remover duplicatas).
