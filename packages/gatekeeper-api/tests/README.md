# Gatekeeper API - Suite de Testes

Suite completa de testes para o sistema de validação Gatekeeper.

## 📁 Estrutura

```
tests/
├── services/              # Fase 1: Backend Services (7 testes)
│   ├── test-path-resolver.mjs
│   ├── test-ensure-path.mjs
│   ├── test-recheck.mjs
│   ├── test-git-stash.mjs
│   ├── test-test-runner.mjs
│   ├── test-compiler.mjs
│   └── test-lint.mjs
│
├── validators/
│   ├── gate0/             # Fase 2: SANITIZATION (6 testes)
│   │   ├── test-token-budget.mjs
│   │   ├── test-task-scope.mjs
│   │   ├── test-task-clarity.mjs
│   │   ├── test-sensitive-files.mjs
│   │   ├── test-danger-mode.mjs
│   │   └── test-path-convention-validator.mjs
│   │
│   ├── gate1/             # Fase 3: CONTRACT (10 testes)
│   │   ├── test-manifest-file-lock.mjs
│   │   ├── test-gate1-batch1.mjs
│   │   ├── test-gate1-batch2.mjs
│   │   └── test-gate1-batch3.mjs
│   │
│   ├── gate2/             # Fase 4: EXECUTION (5 testes)
│   │   └── test-gate2-all.mjs
│   │
│   └── gate3/             # Fase 5: INTEGRITY (2 testes)
│       └── test-gate3-all.mjs
│
├── flows/                 # Fase 6: Validation Flows (5 testes)
│   └── test-phase6-validation-flows.mjs
│
├── integration/           # Fase 7: Integration & Schemas (5 testes)
│   └── test-phase7-integration.mjs
│
├── edge-cases/            # Fase 8: Edge Cases (7 testes)
│   └── test-phase8-edge-cases.mjs
│
└── workspaces/            # Fase 9: Multi-Workspace (4 testes)
    └── test-phase9-integrations.mjs
```

## 🎯 Cobertura

**Total: 51 testes - 100% de cobertura**

- ✅ 23 Validators testados
- ✅ 7 Services testados
- ✅ 4 Gates testados
- ✅ Multi-workspace architecture validada
- ✅ Edge cases cobertos
- ✅ Integrações verificadas

## 🚀 Como Executar

### Executar todos os testes de uma categoria:

```bash
# Services (Fase 1)
npx tsx tests/services/*.mjs

# Gate 0 Validators (Fase 2)
npx tsx tests/validators/gate0/*.mjs

# Gate 1 Validators (Fase 3)
npx tsx tests/validators/gate1/*.mjs

# Gate 2 Validators (Fase 4)
npx tsx tests/validators/gate2/*.mjs

# Gate 3 Validators (Fase 5)
npx tsx tests/validators/gate3/*.mjs

# Flows (Fase 6)
npx tsx tests/flows/*.mjs

# Integration (Fase 7)
npx tsx tests/integration/*.mjs

# Edge Cases (Fase 8)
npx tsx tests/edge-cases/*.mjs

# Workspaces (Fase 9)
npx tsx tests/workspaces/*.mjs
```

### Executar teste específico:

```bash
npx tsx tests/services/test-path-resolver.mjs
npx tsx tests/validators/gate0/test-token-budget.mjs
npx tsx tests/workspaces/test-phase9-integrations.mjs
```

### Executar TODOS os testes:

```bash
# Services
for file in tests/services/*.mjs; do npx tsx "$file"; done

# Validators
for file in tests/validators/gate*/*.mjs; do npx tsx "$file"; done

# Outros
for file in tests/{flows,integration,edge-cases,workspaces}/*.mjs; do npx tsx "$file"; done
```

## 📋 Detalhamento por Fase

### Fase 1: Backend Services (7 testes)
- PathResolverService: Detecção de tipo de teste
- PathResolverService: ensureCorrectPath()
- PathResolverService: recheckAndCopy()
- GitService: stash/stashPop
- TestRunnerService: runSingleTest()
- CompilerService: compile()
- LintService: lint()

### Fase 2: Gate 0 - SANITIZATION (6 validators)
- TokenBudgetFit
- TaskScopeSize
- TaskClarityCheck
- SensitiveFilesLock
- DangerModeExplicit
- PathConvention

### Fase 3: Gate 1 - CONTRACT (10 validators)
- ManifestFileLock
- NoDecorativeTests
- NoImplicitFiles
- TestHasAssertions
- TestSyntaxValid
- TestCoversHappyAndSadPath
- TestIntentAlignment (soft block)
- TestClauseMappingValid
- ImportRealityCheck
- TestFailsBeforeImplementation (CLÁUSULA PÉTREA)

### Fase 4: Gate 2 - EXECUTION (5 validators)
- DiffScopeEnforcement
- TestReadOnlyEnforcement
- TaskTestPasses
- StrictCompilation
- StyleConsistencyLint

### Fase 5: Gate 3 - INTEGRITY (2 validators)
- FullRegressionPass
- ProductionBuildPass

### Fase 6: Validation Flows (5 testes)
- Estrutura de gates
- Ordem de execução
- Filtros de run type
- Validators estrutura
- ValidationOrchestrator

### Fase 7: Integration & Schemas (5 testes)
- Schema validation com Zod
- PathResolverService integration
- Config management
- Error handling
- Integration points

### Fase 8: Edge Cases (7 testes)
- Spec sem tipo detectável
- Convention ausente
- Git operations failure
- Test runner timeout
- Multiple reruns
- Bypass + rerun
- Arquivo deletado (recheckAndCopy)

### Fase 9: Multi-Workspace (4 testes)
- Workspaces + Projects
- Path conventions por workspace
- Sensitive files (global)
- Config global vs workspace

## ⚠️ Erros Esperados

Alguns testes validam comportamentos de erro, que são **intencionais**:

- **Fase 7 - Test 36**: Schema rejeita action 'UPDATE' (esperado)
- **Fase 8 - Test 44**: Simulação de timeout (esperado)

## 🔧 Manutenção

Ao adicionar novos testes:
- Services → `tests/services/`
- Gate 0 validators → `tests/validators/gate0/`
- Gate 1 validators → `tests/validators/gate1/`
- Gate 2 validators → `tests/validators/gate2/`
- Gate 3 validators → `tests/validators/gate3/`
- Flows → `tests/flows/`
- Integration → `tests/integration/`
- Edge cases → `tests/edge-cases/`
- Workspace features → `tests/workspaces/`

**Importante**: Ajustar imports relativos baseado na profundidade:
- `tests/services/` → `../../src/`
- `tests/validators/gate*/` → `../../../src/`
- `tests/flows/`, `integration/`, etc. → `../../src/`
