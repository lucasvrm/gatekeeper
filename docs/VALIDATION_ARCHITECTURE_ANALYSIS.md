# Análise Arquitetural: Sistema de Validação de Artifacts

**Data:** 2026-02-08
**Status:** Análise completa - Aguardando implementação
**Prioridade:** CRÍTICA

---

## Executive Summary

O sistema atual valida artifacts em momentos inadequados, resultando em:
- ❌ Erros falsos positivos durante geração inicial ("Nenhum arquivo de teste encontrado")
- ❌ Validações duplicadas (backend + frontend)
- ❌ Step 3 (Fix) NÃO valida outputs (artifacts corrigidos podem ser inválidos)
- ❌ Validações preventivas inconsistentes (hardcoded vs service-based)

**Impacto:** Usuário vê erros confusos quando tenta gerar artifacts válidos.

---

## Problema Reportado pelo Usuário

### Erro 1: "Spec artifacts validation failed: *.spec.ts: Nenhum arquivo de teste encontrado"

**Cenário:**
1. Usuário clica em "Gerar Testes" (Step 2)
2. Agent executa (LLM roda)
3. Sistema valida artifacts gerados
4. Validação falha: nenhum arquivo `*.spec.ts` encontrado
5. Toast de erro aparece

**Por que ocorre:**
- Agent não chamou `save_artifact` com filename correto
- OU LLM outputou apenas texto (não código estruturado)
- OU smart recovery falhou ao extrair código
- Validação BLOQUEIA e DESCARTA todo trabalho do agent

**Arquivo:** `ArtifactValidationService.ts:307`
```typescript
if (!hasTestFile) {
  results.push({
    valid: false,
    severity: 'error',
    message: 'Nenhum arquivo de teste encontrado (*.spec.ts ou *.test.ts)',
  })
}
```

---

## Problemas Arquiteturais Identificados

### 🔴 CRÍTICO 1: Step 3 (Fix) não valida outputs

**Arquivo:** `AgentOrchestratorBridge.ts:1178`

**Problema:**
```typescript
// ❌ Persiste direto sem validar
const artifacts = await this.persistArtifacts(
  savedArtifacts,
  input.outputId,
  input.projectPath,
)
```

**Impacto:**
- Agent pode "corrigir" `microplans.json` inválido → gerar outro `microplans.json` inválido
- Frontend avança para step seguinte com artifacts quebrados
- Usuário descobre problema tarde demais

**Solução:**
```typescript
// ✅ Validar ANTES de persistir
const memoryArtifacts = new Map(savedArtifacts)
const step = input.target === 'plan' ? 1 : 2
const validation = this.validator.validateStepArtifacts(step, memoryArtifacts)

if (!validation.valid) {
  const errorDetails = validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  throw new BridgeError(
    `Fixed artifacts still invalid: ${errorDetails}`,
    'INVALID_FIXED_ARTIFACTS',
    { validation: validation.results }
  )
}

const artifacts = await this.persistArtifacts(...)
```

---

### 🔴 CRÍTICO 2: Step 3 (Fix) não valida inputs

**Arquivo:** `AgentOrchestratorBridge.ts:849`

**Problema:**
```typescript
// ❌ Não valida que existingArtifacts estão corretos
const existingArtifacts = await this.readArtifactsFromDisk(...)
```

**Impacto:**
- Agent tenta corrigir artifacts já corrompidos
- Prompt do fix fica inútil (GIGO)

**Solução:**
```typescript
const existingArtifacts = await this.readArtifactsFromDisk(...)

// ✅ Validar antes de passar pro agent
const memoryArtifacts = new Map(Object.entries(existingArtifacts))
const step = input.target === 'plan' ? 1 : 2
const validation = this.validator.validateStepArtifacts(step, memoryArtifacts)

if (!validation.valid) {
  console.warn('[Bridge:Fix] Input artifacts are invalid:', validation.results)
  // Continua (agent vai tentar corrigir), mas log warning
}
```

---

### 🟡 MÉDIO 1: Step 2 (Spec) valida input hardcoded

**Arquivo:** `AgentOrchestratorBridge.ts:478-484`

**Problema:**
```typescript
// ❌ Hardcoded - inconsistente com outros steps
if (!existingArtifacts['microplans.json']) {
  throw new BridgeError(
    `Missing step 1 artifacts: microplans.json`,
    'MISSING_ARTIFACTS',
  )
}
```

**Solução:**
```typescript
// ✅ Usar ArtifactValidationService para consistência
const memoryArtifacts = new Map(Object.entries(existingArtifacts))
const validation = this.validator.validateStepArtifacts(1, memoryArtifacts)

if (!validation.valid) {
  throw new BridgeError(
    `Invalid step 1 artifacts: ${errorDetails}`,
    'INVALID_INPUT_ARTIFACTS',
    { validation: validation.results }
  )
}
```

---

### 🟡 MÉDIO 2: Step 4 (Execute) valida input rudimentar

**Arquivo:** `AgentOrchestratorBridge.ts:722-728`

**Problema:**
```typescript
// ❌ Apenas verifica que NÃO está vazio
if (Object.keys(existingArtifacts).length === 0) {
  throw new BridgeError(...)
}
```

**Solução:**
```typescript
// ✅ Validar estrutura de step 1 artifacts (obrigatório)
const memoryArtifacts = new Map(Object.entries(existingArtifacts))

const step1Validation = this.validator.validateStepArtifacts(1, memoryArtifacts)
if (!step1Validation.valid) {
  throw new BridgeError(
    `Invalid plan artifacts: ${errorDetails}`,
    'INVALID_PLAN_ARTIFACTS',
  )
}

// Step 2 artifacts (spec) - opcional, apenas warning
const step2Validation = this.validator.validateStepArtifacts(2, memoryArtifacts)
if (!step2Validation.valid) {
  console.warn('[Execute] Spec artifacts invalid (proceeding anyway):', step2Validation.results)
}
```

---

### 🟢 LOW PRIORITY: Frontend valida duplicado

**Arquivo:** `orchestrator-page.tsx:934-943, 986-1015`

**Problema:**
- Frontend valida artifacts DEPOIS que backend já validou
- SSE handler tem validação redundante

**Solução (futuro):**
- Remover validação frontend (confiar no backend)
- Backend retorna `validation.results` detalhado

---

## Arquitetura de Validação Proposta

### 3 Layers de Validação

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣  INPUT VALIDATION (pré-geração)                    │
│      - Validar inputs do usuário (taskDescription, etc)│
│      - Validar pré-condições (artifacts de steps anteriores) │
│      - Usar Zod schemas para request validation        │
│      - NÃO usar ArtifactValidationService              │
├─────────────────────────────────────────────────────────┤
│  2️⃣  OUTPUT VALIDATION (pós-geração)                   │
│      - Validar artifacts gerados pelo agent            │
│      - Usar ArtifactValidationService.validateStepArtifacts │
│      - SEMPRE validar antes de persistArtifacts()      │
│      - Bloquear se validation.valid === false          │
├─────────────────────────────────────────────────────────┤
│  3️⃣  EXISTENCE VALIDATION (carregamento)               │
│      - Validar artifacts ao carregar do disco          │
│      - Verificar que arquivos esperados existem        │
│      - Validar estrutura básica (parseável)            │
│      - Usar ArtifactValidationService                  │
└─────────────────────────────────────────────────────────┘
```

### Regras de Ouro

**LAYER 1 (Preventiva):**
- ✅ QUANDO: Antes de `runner.run()`
- ✅ O QUE: Inputs do usuário, configuração
- ✅ FERRAMENTA: Zod schemas + validações manuais
- ❌ NÃO USAR: ArtifactValidationService (é pra outputs)

**LAYER 2 (Verificação):**
- ✅ QUANDO: APÓS `runner.run()`, ANTES `persistArtifacts()`
- ✅ O QUE: Artifacts gerados (memoryArtifacts Map)
- ✅ FERRAMENTA: `ArtifactValidationService.validateStepArtifacts()`
- ❌ NÃO FAZER: Persistir artifacts inválidos

**LAYER 3 (Carregamento):**
- ✅ QUANDO: Ao chamar `readArtifactsFromDisk()`
- ✅ O QUE: Verificar artifacts esperados existem
- ✅ FERRAMENTA: ArtifactValidationService + checks manuais
- ❌ NÃO FAZER: Assumir que artifacts existem

---

## Mapeamento de Validações Atual vs Proposto

| Step | Fase | Atual | Proposto | Prioridade |
|------|------|-------|----------|------------|
| **0 (Discovery)** | Input | ❌ Ausente | ✅ Validar taskDescription | 🟢 Low |
| **0 (Discovery)** | Output | ✅ Linha 241 | ✅ Mantém | - |
| **1 (Plan)** | Input | ❌ Ausente | ✅ Validar taskDescription | 🟢 Low |
| **1 (Plan)** | Output | ✅ Linha 408 | ✅ Mantém | - |
| **2 (Spec)** | Input | ⚠️ Hardcoded 478 | ✅ Use validateStepArtifacts(1) | 🟡 Médio |
| **2 (Spec)** | Output | ✅ Linha 655 | ✅ Mantém | - |
| **3 (Fix)** | Input | ❌ Ausente | ✅ Validar artifacts existentes | 🔴 Crítico |
| **3 (Fix)** | Output | ❌ Ausente | ✅ Validar artifacts corrigidos | 🔴 Crítico |
| **4 (Execute)** | Input | ⚠️ Rudimentar 722 | ✅ Validar step 1+2 artifacts | 🟡 Médio |
| **4 (Execute)** | Output | ❌ Ausente | 🟢 Opcional | 🟢 Low |

---

## Microplans de Implementação

### MP-VAL-01: Adicionar validação de output no Step 3 (Fix) - CRÍTICO

**Arquivo:** `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas:** 1178 (inserir ANTES de persistArtifacts)

**Mudanças:**
1. Converter `savedArtifacts` para Map
2. Validar usando `validateStepArtifacts(input.target === 'plan' ? 1 : 2, ...)`
3. Se inválido, lançar `BridgeError` com detalhes
4. Persistir apenas se válido

**Código:**
```typescript
// ANTES de linha 1178
const memoryArtifacts = new Map(
  savedArtifacts.map(a => [a.filename, a.content])
)

const step = input.target === 'plan' ? 1 : 2
const validation = this.validator.validateStepArtifacts(step, memoryArtifacts)

if (!validation.valid) {
  const errorDetails = validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  emit({
    type: 'agent:error',
    error: `Fixed artifacts still invalid: ${errorDetails}`,
    code: 'INVALID_FIXED_ARTIFACTS',
    validation: validation.results,
  })

  throw new BridgeError(
    `Fixed artifacts still invalid: ${errorDetails}`,
    'INVALID_FIXED_ARTIFACTS',
    { validation: validation.results, target: input.target }
  )
}

// Warnings não bloqueiam
const warnings = validation.results.filter(r => r.severity === 'warning')
if (warnings.length > 0) {
  console.warn(`[Bridge:Fix] ⚠️ Validation warnings:`, warnings.map(w => w.message))
  emit({
    type: 'agent:validation_warning',
    step: 3,
    target: input.target,
    warnings: warnings.map(w => w.message),
  })
}

// Agora sim: persiste
const artifacts = await this.persistArtifacts(...)
```

---

### MP-VAL-02: Adicionar validação de input no Step 3 (Fix) - CRÍTICO

**Arquivo:** `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas:** 849 (inserir APÓS readArtifactsFromDisk)

**Mudanças:**
1. Converter `existingArtifacts` para Map
2. Validar usando `validateStepArtifacts(input.target === 'plan' ? 1 : 2, ...)`
3. Se inválido, log WARNING (não bloqueia - agent pode corrigir)

**Código:**
```typescript
// APÓS linha 849
const memoryArtifacts = new Map(Object.entries(existingArtifacts))
const step = input.target === 'plan' ? 1 : 2
const inputValidation = this.validator.validateStepArtifacts(step, memoryArtifacts)

if (!inputValidation.valid) {
  console.warn(
    `[Bridge:Fix] ⚠️ Input artifacts are invalid (agent will attempt to fix):`,
    inputValidation.results
  )
  emit({
    type: 'agent:info',
    message: `Attempting to fix invalid ${input.target} artifacts`,
    inputValidation: inputValidation.results,
  })
}
```

---

### MP-VAL-03: Melhorar validação de input no Step 2 (Spec) - MÉDIO

**Arquivo:** `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas:** 478-484 (substituir)

**Mudanças:**
1. Remover check hardcoded `if (!existingArtifacts['microplans.json'])`
2. Substituir por `validateStepArtifacts(1, ...)`

**Código:**
```typescript
// SUBSTITUIR linhas 478-484
const memoryArtifacts = new Map(Object.entries(existingArtifacts))
const step1Validation = this.validator.validateStepArtifacts(1, memoryArtifacts)

if (!step1Validation.valid) {
  const errorDetails = step1Validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  throw new BridgeError(
    `Invalid step 1 artifacts (required for spec generation): ${errorDetails}`,
    'INVALID_INPUT_ARTIFACTS',
    { validation: step1Validation.results, outputId: input.outputId }
  )
}
```

---

### MP-VAL-04: Melhorar validação de input no Step 4 (Execute) - MÉDIO

**Arquivo:** `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas:** 722-728 (expandir)

**Mudanças:**
1. Manter check de `Object.keys(...).length === 0`
2. Adicionar validação de step 1 (obrigatório)
3. Adicionar validação de step 2 (warning apenas)

**Código:**
```typescript
// APÓS linha 728 (após o if de empty artifacts)

// ✅ Validate step 1 artifacts (plan) - OBRIGATÓRIO
const memoryArtifacts = new Map(Object.entries(existingArtifacts))
const step1Validation = this.validator.validateStepArtifacts(1, memoryArtifacts)

if (!step1Validation.valid) {
  const errorDetails = step1Validation.results
    .filter(r => r.severity === 'error')
    .map(r => `${r.details.filename}: ${r.message}`)
    .join('; ')

  throw new BridgeError(
    `Invalid plan artifacts (required for execution): ${errorDetails}`,
    'INVALID_PLAN_ARTIFACTS',
    { validation: step1Validation.results, outputId: input.outputId }
  )
}

// ✅ Validate step 2 artifacts (spec) - WARNING apenas
const step2Validation = this.validator.validateStepArtifacts(2, memoryArtifacts)
if (!step2Validation.valid) {
  console.warn(
    `[Bridge:Execute] ⚠️ Spec artifacts validation failed (will proceed anyway):`,
    step2Validation.results
  )
  emit({
    type: 'agent:validation_warning',
    step: 4,
    message: 'Spec artifacts invalid (execution will proceed)',
    validation: step2Validation.results,
  })
}
```

---

## Priorização

### 🔴 CRÍTICO (implementar AGORA):
1. MP-VAL-01: Validar outputs do Step 3 (Fix)
2. MP-VAL-02: Validar inputs do Step 3 (Fix)

### 🟡 MÉDIO (próxima sprint):
3. MP-VAL-03: Melhorar validação Step 2 (Spec)
4. MP-VAL-04: Melhorar validação Step 4 (Execute)

### 🟢 LOW (futuro):
5. Adicionar Zod schemas para request validation
6. Remover validação duplicada no frontend
7. Documentar arquitetura no CLAUDE.md

---

## Impacto Esperado

**Após implementação:**
- ✅ Step 3 (Fix) não persiste artifacts inválidos
- ✅ Validações consistentes (todas usam ArtifactValidationService)
- ✅ Menos erros falsos positivos
- ✅ Mensagens de erro mais detalhadas ao usuário
- ✅ Recovery automático melhorado (smart retry baseado em validation.results)

---

## Referências

- **Relatório Agent 1:** Mapeamento do erro "Nenhum arquivo de teste encontrado"
- **Relatório Agent 2:** Listagem de validações prematuras
- **Relatório Agent 3:** Análise arquitetural completa

**Autores:** 3 agentes especializados (Explore + General Purpose)
**Revisão:** 2026-02-08
