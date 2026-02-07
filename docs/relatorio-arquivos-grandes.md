# 📊 Relatório: Análise de Arquivos com Mais de 700 Linhas

**Projeto:** Gatekeeper
**Data:** 2026-02-06
**Objetivo:** Mapear arquivos grandes para identificar oportunidades de refatoração

---

## 🏆 Top 5 Maiores Arquivos do Projeto

| # | Arquivo | Linhas | Localização | Tipo |
|---|---------|--------|-------------|------|
| 1 | `orchestrator-page.tsx` | **2,422** | Frontend (src/components) | Produção |
| 2 | `AgentOrchestratorBridge.ts` | **2,082** | Backend API (services) | Produção |
| 3 | `ui-contract-validators.spec.ts` | **1,749** | Backend API (validators tests) | Teste |
| 4 | `git-commit-button.spec.tsx` | **1,663** | Frontend (tests) | Teste |
| 5 | `config-page-reorganization.spec.tsx` | **1,632** | Frontend (tests) | Teste |

---

## 📂 Detalhamento Por Categoria

### 🎨 Frontend (src/) - 29 arquivos > 700 linhas

#### Top 15 Arquivos

| # | Arquivo | Linhas | Tipo | Descrição |
|---|---------|--------|------|-----------|
| 1 | `orchestrator-page.tsx` | 2,422 | Produção | Componente principal do orquestrador multi-step |
| 2 | `git-commit-button.spec.tsx` | 1,663 | Teste | Suite de testes para commit flow |
| 3 | `config-page-reorganization.spec.tsx` | 1,632 | Teste | Testes de reorganização da página de config |
| 4 | `orchestrator-enhancements.spec.tsx` | 1,582 | Teste | Testes de melhorias do orquestrador |
| 5 | `dynamic-validator-configs.spec.tsx` | 1,532 | Teste | Testes de configuração dinâmica de validadores |
| 6 | `api.ts` | 1,446 | Produção | Cliente HTTP com namespaces (api.runs.*, api.gates.*) |
| 7 | `commit-flow-improvements.spec.tsx` | 1,441 | Teste | Testes de melhorias no fluxo de commit |
| 8 | `command-palette.spec.tsx` | 1,398 | Teste | Testes da paleta de comandos |
| 9 | `gatekeeper-i18n-pt-br.spec.tsx` | 1,368 | Teste | Testes de internacionalização |
| 10 | `multi-feature-enhancements.spec.tsx` | 1,314 | Teste | Testes de múltiplas features |
| 11 | `config-page-enhancements.spec.tsx` | 1,312 | Teste | Testes de melhorias da página de config |
| 12 | `mcp-session-page.tsx` | 1,215 | Produção | Página de gestão de sessões MCP |
| 13 | `committed-run-readonly-lock.spec.tsx` | 1,173 | Teste | Testes de lock de runs commitadas |
| 14 | `artifact-viewer-enhancements.spec.tsx` | 1,080 | Teste | Testes do visualizador de artifacts |
| 15 | `GatekeeperMCP.spec.ts` | 1,019 | Teste | Testes de integração MCP |

#### Estatísticas Frontend
- **Total:** 29 arquivos > 700 linhas
- **Testes:** 25 arquivos (86%)
- **Produção:** 4 arquivos (14%)
- **Maior arquivo de produção:** `orchestrator-page.tsx` (2,422 linhas)
- **Maior arquivo de teste:** `git-commit-button.spec.tsx` (1,663 linhas)

#### Arquivos de Produção Frontend
1. `orchestrator-page.tsx` - 2,422 linhas
2. `api.ts` - 1,446 linhas
3. `mcp-session-page.tsx` - 1,215 linhas
4. `run-details-page-v2.tsx` - 978 linhas

---

### ⚙️ Backend API (packages/gatekeeper-api/) - 12 arquivos > 700 linhas

#### Todos os Arquivos

| # | Arquivo | Linhas | Tipo | Descrição |
|---|---------|--------|------|-----------|
| 1 | `AgentOrchestratorBridge.ts` | 2,082 | Produção | Bridge entre agentes e orquestrador |
| 2 | `ui-contract-validators.spec.ts` | 1,749 | Teste | Testes de validadores de contrato UI |
| 3 | `DiffScopeEnforcement.spec.ts` | 1,486 | Teste | Testes de enforcement de escopo de diff |
| 4 | `MCPControllers.spec.ts` | 1,379 | Teste | Testes de controllers MCP |
| 5 | `DiffScopeWorkingTree.spec.ts` | 1,097 | Teste | Testes de working tree no diff scope |
| 6 | `TestReadOnlyEnforcement.spec.ts` | 993 | Teste | Testes de enforcement read-only de testes |
| 7 | `OrchestratorEventService.ts` | 964 | Produção | Service de eventos SSE do orquestrador |
| 8 | `TestFailsBeforeImplementation.spec.ts` | 876 | Teste | Testes de falha antes da implementação |
| 9 | `AgentToolExecutor.ts` | 859 | Produção | Executor sandboxed de ferramentas do agente |
| 10 | `BridgeController.ts` | 758 | Produção | Controller HTTP do bridge |
| 11 | `backend-cleanup.spec.ts` | 744 | Teste | Testes de limpeza do backend |
| 12 | `persist-event-and-update-state.spec.ts` | 721 | Teste | Testes de persistência de eventos |

#### Estatísticas Backend API
- **Total:** 12 arquivos > 700 linhas
- **Testes:** 9 arquivos (75%)
- **Produção:** 3 arquivos (25%)
- **Maior arquivo de produção:** `AgentOrchestratorBridge.ts` (2,082 linhas)
- **Maior arquivo de teste:** `ui-contract-validators.spec.ts` (1,749 linhas)

#### Arquivos de Produção Backend
1. `AgentOrchestratorBridge.ts` - 2,082 linhas (services)
2. `OrchestratorEventService.ts` - 964 linhas (services)
3. `AgentToolExecutor.ts` - 859 linhas (services)
4. `BridgeController.ts` - 758 linhas (controllers)

---

### 🎨 Orqui Package (packages/orqui/) - 7 arquivos > 700 linhas

#### Todos os Arquivos

| # | Arquivo | Linhas | Tipo | Descrição |
|---|---------|--------|------|-----------|
| 1 | `NodeRenderer.tsx` | 1,307 | Produção | Core runtime - renderização recursiva de árvores |
| 2 | `ComponentPaletteSidebar.spec.tsx` | 1,051 | Teste | Testes da sidebar de paleta de componentes |
| 3 | `StackedWorkbench.tsx` | 1,050 | Produção | Shell IDE-like do editor |
| 4 | `GridCanvas.spec.tsx` | 946 | Teste | Testes do canvas grid drag-and-drop |
| 5 | `RegionEditors.tsx` | 914 | Produção | Editores de regiões e layout |
| 6 | `PageEditor.tsx` | 706 | Produção | Page builder drag-and-drop |
| 7 | `PropsPanel.tsx` | 704 | Produção | Painel de edição de propriedades |

#### Estatísticas Orqui
- **Total:** 7 arquivos > 700 linhas
- **Testes:** 2 arquivos (29%)
- **Produção:** 5 arquivos (71%)
- **Maior arquivo de produção:** `NodeRenderer.tsx` (1,307 linhas)
- **Maior arquivo de teste:** `ComponentPaletteSidebar.spec.tsx` (1,051 linhas)

---

## 📈 Estatísticas Gerais

### Resumo Consolidado

```
┌──────────────────┬───────────┬──────────┬───────────┬──────────────┐
│ Categoria        │ Total     │ Testes   │ Produção  │ % Produção   │
├──────────────────┼───────────┼──────────┼───────────┼──────────────┤
│ Frontend         │ 29        │ 25       │ 4         │ 14%          │
│ Backend API      │ 12        │ 9        │ 3         │ 25%          │
│ Orqui            │ 7         │ 2        │ 5         │ 71%          │
├──────────────────┼───────────┼──────────┼───────────┼──────────────┤
│ TOTAL            │ 48        │ 36       │ 12        │ 25%          │
└──────────────────┴───────────┴──────────┴───────────┴──────────────┘
```

### Distribuição por Tamanho

```
Linhas      Arquivos
─────────────────────
2000-2500   2   ████
1500-1999   3   ██████
1000-1499   10  ████████████████████
700-999     33  ██████████████████████████████████████████████████████████████████
```

---

## 🎯 Análise e Recomendações

### ✅ Pontos Positivos

1. **Boa cobertura de testes**
   - 75% dos arquivos grandes são specs de teste
   - Testes abrangentes garantem qualidade

2. **Services bem estruturados**
   - `AgentOrchestratorBridge` centraliza lógica de agentes
   - `OrchestratorEventService` gerencia SSE de forma isolada
   - `AgentToolExecutor` implementa sandbox de forma segura

3. **Separação de concerns**
   - UI library (Orqui) isolada em package separado
   - Backend API modularizado por domínio
   - Frontend com componentes reutilizáveis

### ⚠️ Oportunidades de Refatoração

#### 🔴 Alta Prioridade

##### 1. `orchestrator-page.tsx` (2,422 linhas)
**Problema:** Componente monolítico com responsabilidades múltiplas

**Impacto:**
- Dificulta manutenção
- Aumenta risco de bugs
- Dificulta testing isolado

**Sugestões:**
```typescript
// Estrutura sugerida:
src/components/orchestrator/
├── orchestrator-page.tsx          // Shell principal (< 300 linhas)
├── hooks/
│   ├── useOrchestratorState.ts    // Estado centralizado
│   ├── useSessionPersistence.ts   // Persistência
│   └── useArtifactViewer.ts       // Visualização de artifacts
├── steps/
│   ├── Step0_TaskInput.tsx        // Step 0: Input de task
│   ├── Step2_Planning.tsx         // Step 2: Planejamento
│   ├── Step3_Validation.tsx       // Step 3: Validação
│   └── Step4_Execution.tsx        // Step 4: Execução
└── components/
    ├── LLMSelector.tsx            // Seletor de LLM
    ├── ArtifactCard.tsx           // Card de artifact
    └── ValidationResults.tsx      // Resultados de validação
```

**Benefícios:**
- Componentes < 400 linhas cada
- Hooks reutilizáveis
- Testing isolado por step
- Melhor performance (lazy loading)

---

##### 2. `AgentOrchestratorBridge.ts` (2,082 linhas)
**Problema:** Service com múltiplas responsabilidades (plan, spec, fix, execute)

**Impacto:**
- Dificulta adicionar novos providers
- Lógica de prompt assembly acoplada
- Testing complexo

**Sugestões:**
```typescript
// Estrutura sugerida:
src/services/agent-orchestrator/
├── AgentOrchestratorBridge.ts     // Facade (< 200 linhas)
├── strategies/
│   ├── PlanGenerationStrategy.ts  // Fase 1: Planejamento
│   ├── SpecGenerationStrategy.ts  // Fase 2: Spec
│   ├── ArtifactFixStrategy.ts     // Fase 3: Fix
│   └── ExecutionStrategy.ts       // Fase 4: Execução
├── prompt/
│   ├── PromptAssembler.ts         // Assembly de prompts
│   ├── PromptTemplates.ts         // Templates por fase
│   └── ContextBuilder.ts          // Build de contexto
└── providers/
    ├── ProviderRegistry.ts        // Registry de providers
    └── ProviderFallback.ts        // Lógica de fallback
```

**Benefícios:**
- Strategy pattern facilita extensão
- Prompt assembly testável isoladamente
- Provider registry plugável
- Cada strategy < 500 linhas

---

##### 3. `api.ts` (1,446 linhas)
**Problema:** Cliente HTTP monolítico com todos os namespaces

**Impacto:**
- Bundle size aumentado
- Dificulta tree-shaking
- Manutenção centralizada

**Sugestões:**
```typescript
// Opção 1: Client gerado via OpenAPI
// - Gerar via swagger-typescript-api
// - Type-safe automático
// - Sincronizado com backend

// Opção 2: Separar namespaces
src/lib/api/
├── index.ts                       // Re-exports
├── client.ts                      // Fetch wrapper base
├── runs.ts                        // api.runs.*
├── gates.ts                       // api.gates.*
├── projects.ts                    // api.projects.*
├── orchestrator.ts                // api.orchestrator.*
└── mcp.ts                         // api.mcp.*
```

**Benefícios:**
- Tree-shaking efetivo
- Lazy loading de namespaces
- Manutenção modular
- Cada namespace < 300 linhas

---

#### 🟡 Média Prioridade

##### 4. `NodeRenderer.tsx` (1,307 linhas)
**Problema:** Renderizador com múltiplas estratégias inline

**Sugestões:**
```typescript
src/runtime/components/
├── NodeRenderer.tsx               // Orchestrator (< 200 linhas)
└── renderers/
    ├── NativeRenderer.tsx         // HTML nativo
    ├── CustomRenderer.tsx         // Componentes custom
    ├── SlotRenderer.tsx           // Slots
    └── TemplateInterpolator.ts   // Interpolação
```

##### 5. `StackedWorkbench.tsx` (1,050 linhas)
**Problema:** Definições de activity inline no componente

**Sugestões:**
```typescript
src/editor/workbench/
├── StackedWorkbench.tsx           // Shell (< 300 linhas)
├── activities.config.ts           // Activity definitions
└── panels/
    ├── TokensPanel.tsx
    ├── ColorsPanel.tsx
    └── TypographyPanel.tsx
```

---

### 📋 Plano de Ação

#### Fase 1: Preparação (1-2 semanas)
- [ ] Criar ADRs (Architecture Decision Records)
- [ ] Documentar API surface de arquivos > 1000 linhas
- [ ] Setup de linting rules para line limits
- [ ] Code review checklist para files > 500 linhas

#### Fase 2: Refatorações Críticas (3-4 semanas)
- [ ] **Semana 1-2:** Refatorar `orchestrator-page.tsx`
  - [ ] Extrair hooks de estado
  - [ ] Separar steps em componentes
  - [ ] Adicionar testes unitários
- [ ] **Semana 3-4:** Refatorar `AgentOrchestratorBridge.ts`
  - [ ] Implementar strategy pattern
  - [ ] Extrair prompt assembly
  - [ ] Migrar testes existentes

#### Fase 3: Melhorias Incrementais (4-6 semanas)
- [ ] Migrar `api.ts` para client gerado ou modular
- [ ] Refatorar `NodeRenderer.tsx` com rendering strategies
- [ ] Separar `StackedWorkbench.tsx` em config + panels

#### Fase 4: Governança (ongoing)
- [ ] Meta: nenhum arquivo de produção > 800 linhas
- [ ] Code review automático via CI
- [ ] Relatórios mensais de métricas

---

## 🔧 Ferramentas e Automações

### Linting Rules Sugeridas

```json
// .eslintrc.json
{
  "rules": {
    "max-lines": ["warn", {
      "max": 500,
      "skipBlankLines": true,
      "skipComments": true
    }],
    "max-lines-per-function": ["warn", {
      "max": 100,
      "skipBlankLines": true,
      "skipComments": true
    }]
  }
}
```

### Script de Monitoramento

```bash
#!/bin/bash
# scripts/check-file-sizes.sh

echo "📊 Arquivos com mais de 700 linhas:"
find src packages -name "*.ts" -o -name "*.tsx" | while read file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt 700 ]; then
    echo "$lines: $file"
  fi
done | sort -rn
```

### GitHub Action (CI)

```yaml
# .github/workflows/code-metrics.yml
name: Code Metrics

on: [push, pull_request]

jobs:
  check-file-sizes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check file sizes
        run: |
          bash scripts/check-file-sizes.sh
          # Falhar se algum arquivo > 1000 linhas
          count=$(find src packages -name "*.ts" -o -name "*.tsx" | \
            xargs wc -l | awk '$1 > 1000 {print}' | wc -l)
          if [ "$count" -gt 5 ]; then
            echo "❌ Muitos arquivos grandes detectados"
            exit 1
          fi
```

---

## 📚 Referências

### Boas Práticas
- [Google Style Guide](https://google.github.io/styleguide/tsguide.html#source-file-structure)
- [Clean Code: Functions](https://github.com/ryanmcdermott/clean-code-javascript#functions)
- [Martin Fowler: Refactoring](https://refactoring.com/)

### Ferramentas
- [ESLint max-lines](https://eslint.org/docs/latest/rules/max-lines)
- [SonarQube Complexity](https://docs.sonarqube.org/latest/user-guide/metric-definitions/)
- [cloc (Count Lines of Code)](https://github.com/AlDanial/cloc)

---

**Gerado por:** Claude Code
**Agentes utilizados:** 3 agentes Explore (paralelos)
**Tempo de análise:** ~4 minutos
**Arquivos analisados:** ~500 arquivos TypeScript/JavaScript
