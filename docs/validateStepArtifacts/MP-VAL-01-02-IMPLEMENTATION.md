# Implementação MP-VAL-01 e MP-VAL-02

**Data**: 2026-02-08
**Status**: ✅ CONCLUÍDO

## Contexto

Durante a investigação de validação de artifacts (ver `discovery_validateStepArtifacts.md`), identificamos que o Step 3 (Fix) tinha 2 falhas críticas de validação:

1. **MP-VAL-01**: Falta validação de OUTPUT antes de persistir artifacts
2. **MP-VAL-02**: Falta validação de INPUT no início do método

Esses microplans foram aprovados pelo usuário e agora estão implementados.

## Mudanças Implementadas

### 1. MP-VAL-01: Output Validation no Step 3 (Fix)

**Arquivo**: `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas**: ~1170-1198

**Antes** (problemático):
```typescript
const artifacts = await this.persistArtifacts(
  savedArtifacts,
  input.outputId,
  input.projectPath,
)
// ❌ Artifacts persistidos SEM validação
```

**Depois** (corrigido):
```typescript
// MP-VAL-01: Validate outputs before persisting
const stepNumber = input.target === 'plan' ? 1 : 2
const validation = this.validator.validateStepArtifacts(stepNumber, savedArtifacts)

if (!validation.valid) {
  const errorDetails = validation.results
    .filter((r) => !r.valid)
    .map((r) => `${r.details.filename}: ${r.message}`)
    .join(', ')

  console.error('[Bridge:Fix] ❌ Output validation failed:', errorDetails)
  console.error('[Bridge:Fix] Validation results:', JSON.stringify(validation.results, null, 2))

  throw new BridgeError(
    `Fix artifacts validation failed: ${errorDetails}`,
    'INVALID_ARTIFACTS',
    { validation: validation.results },
  )
}

console.log('[Bridge:Fix] ✅ Output validation passed')

const artifacts = await this.persistArtifacts(
  savedArtifacts,
  input.outputId,
  input.projectPath,
)
// ✅ Artifacts validados ANTES de persistir
```

**Comportamento**:
- Valida artifacts usando `ArtifactValidationService.validateStepArtifacts()`
- Determina step correto baseado em `input.target` ('plan' → step 1, 'spec' → step 2)
- Lança `BridgeError` com código `INVALID_ARTIFACTS` se validação falhar
- Inclui detalhes completos de validação no error payload
- Logs de debug para troubleshooting

### 2. MP-VAL-02: Input Validation no Step 3 (Fix)

**Arquivo**: `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
**Linhas**: ~833-867

**Antes** (problemático):
```typescript
async fixArtifacts(
  input: BridgeFixInput,
  callbacks: BridgeCallbacks = {},
): Promise<BridgeFixOutput> {
  const emit = callbacks.onEvent ?? (() => {})

  console.log('[Bridge:Fix] === START ===')
  // ... logs ...

  emit({ type: 'agent:bridge_start', step: 3, outputId: input.outputId } as AgentEvent)
  // ❌ Nenhuma validação de inputs
```

**Depois** (corrigido):
```typescript
async fixArtifacts(
  input: BridgeFixInput,
  callbacks: BridgeCallbacks = {},
): Promise<BridgeFixOutput> {
  const emit = callbacks.onEvent ?? (() => {})

  console.log('[Bridge:Fix] === START ===')
  // ... logs ...

  // MP-VAL-02: Validate inputs before proceeding
  if (!input.outputId || !input.target || !input.failedValidators?.length) {
    throw new BridgeError(
      'Invalid fix input: missing required fields (outputId, target, or failedValidators)',
      'INVALID_INPUT',
      { input: { outputId: input.outputId, target: input.target, failedValidatorsCount: input.failedValidators?.length ?? 0 } },
    )
  }

  if (input.target !== 'plan' && input.target !== 'spec') {
    throw new BridgeError(
      `Invalid fix target: expected 'plan' or 'spec', got '${input.target}'`,
      'INVALID_INPUT',
      { input: { target: input.target } },
    )
  }

  console.log('[Bridge:Fix] ✅ Input validation passed')

  emit({ type: 'agent:bridge_start', step: 3, outputId: input.outputId } as AgentEvent)
  // ✅ Inputs validados ANTES de prosseguir
```

**Comportamento**:
- Valida presença de `outputId`, `target`, e `failedValidators`
- Valida que `failedValidators` não está vazio
- Valida que `target` é 'plan' ou 'spec' (valores permitidos)
- Lança `BridgeError` com código `INVALID_INPUT` se validação falhar
- Early return: falha rápido antes de iniciar processamento caro

## Testes Criados

**Arquivo**: `packages/gatekeeper-api/test/unit/AgentOrchestratorBridge-validation.spec.ts`

- **13 testes unitários** validando as correções
- 100% dos testes passaram ✅

### Cobertura de Testes

**MP-VAL-02: Input Validation**:
- ❌ Missing outputId
- ❌ Missing target
- ❌ Empty failedValidators array
- ❌ Invalid target (not 'plan' or 'spec')
- ✅ Valid inputs (plan target)
- ✅ Valid inputs (spec target)

**MP-VAL-01: Output Validation**:
- ❌ Invalid plan artifacts (malformed JSON)
- ❌ Invalid spec artifacts (wrong filename pattern)
- ✅ Valid plan artifacts (microplans.json + task_prompt.md)
- ✅ Valid spec artifacts (.spec.ts file)

**Error Messages**:
- Clear error for invalid inputs
- Clear error for invalid target
- Clear error for invalid artifacts

## Impacto

### Before (Problemático)

```
User → Controller → Bridge.fixArtifacts() →
  ❌ No input validation
  → LLM runs (expensive!)
  → Artifacts collected
  ❌ No output validation
  → persistArtifacts() → DB
  → Return to user
```

**Problemas**:
- LLM rodava mesmo com inputs inválidos (desperdício de tokens/tempo)
- Artifacts inválidos eram persistidos no DB
- Erros só detectados em steps posteriores (tarde demais)
- Dados inconsistentes no sistema

### After (Corrigido)

```
User → Controller → Bridge.fixArtifacts() →
  ✅ Input validation (fail fast)
  → LLM runs (only if inputs valid)
  → Artifacts collected
  ✅ Output validation (fail before persist)
  → persistArtifacts() → DB (only if valid)
  → Return to user
```

**Benefícios**:
- Early return: economiza tokens/tempo se inputs inválidos
- Artifacts validados ANTES de persistir
- Erros claros e acionáveis para o usuário
- Dados consistentes garantidos

## Alinhamento com Arquitetura de Validação

Agora o Step 3 (Fix) segue o padrão dos Steps 1 e 2:

| Step | Input Validation | Output Validation | Status |
|------|------------------|-------------------|--------|
| 1 (Plan) | ✅ Controller | ✅ Bridge | OK |
| 2 (Spec) | ✅ Bridge | ✅ Bridge | OK |
| 3 (Fix) | ✅ Bridge (MP-VAL-02) | ✅ Bridge (MP-VAL-01) | ✅ FIXED |
| 4 (Execute) | ⚠️ Rudimentary | ⚠️ None | TODO (MP-VAL-04) |

## Backward Compatibility

✅ **Zero breaking changes**:
- Validações são apenas mais rigorosas, mas os tipos de input/output não mudaram
- Código antigo que já funcionava continua funcionando
- Código bugado que passava antes agora é corretamente rejeitado

## Próximos Passos (Opcionais)

Conforme documentado em `discovery_validateStepArtifacts.md`:

- **MP-VAL-03**: Remover validação hardcoded de Step 2 no controller (move para Bridge)
- **MP-VAL-04**: Melhorar validação de Step 4 (Execute) com verificações mais rigorosas

Essas melhorias são **opcionais** e focam em consistência arquitetural, não em correção de bugs críticos.

## Evidências

### Typecheck: ✅ PASS
```bash
$ npm run typecheck -w gatekeeper-api
> tsc --noEmit
# Zero errors
```

### Testes: ✅ 13/13 PASS
```bash
$ npm run test:unit -w gatekeeper-api -- AgentOrchestratorBridge-validation.spec.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### Arquivos Modificados

1. `packages/gatekeeper-api/src/services/AgentOrchestratorBridge.ts`
   - Linha ~847: Input validation (MP-VAL-02)
   - Linha ~1177: Output validation (MP-VAL-01)

2. `packages/gatekeeper-api/test/unit/AgentOrchestratorBridge-validation.spec.ts` (novo)
   - 13 testes para MP-VAL-01 e MP-VAL-02

3. `docs/validateStepArtifacts/MP-VAL-01-02-IMPLEMENTATION.md` (este arquivo)

## Conclusão

✅ **MP-VAL-01 e MP-VAL-02 implementados com sucesso**:
- Input validation no início de `fixArtifacts()` previne processamento inválido
- Output validation antes de `persistArtifacts()` garante consistência de dados
- 100% dos testes passando
- Zero breaking changes
- Código mais robusto e previsível
