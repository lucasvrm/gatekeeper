# Microplans: UI/UX Refactoring — /orchestrator

> Decomposicao atomica da refatoracao de UI/UX da rota `/orchestrator`.
> Cada microplan toca no maximo 3 arquivos e e independentemente commitavel.
> **Nenhuma funcionalidade e removida** — apenas layout, posicao e organizacao mudam.

---

## Contexto: AppShell Constraints

O AppShell (`packages/orqui/src/runtime/components/AppShell.tsx`) fornece:
- **Sidebar esquerda** (collapsible, nav, footer) — **NAO TOCADA**
- **Header** (zones: sidebar-zone + content-zone, portals `#orqui-header-left` / `#orqui-header-right`) — **NAO TOCADO**
- **Main** (`<main>` com flex column, padding, overflow auto) — **AREA DE TRABALHO**

Todas as mudancas acontecem **dentro do `<main>`** do AppShell.

O hook `usePageShell()` (`src/hooks/use-page-shell.tsx`) permite injetar conteudo nos portals do header via `createPortal`.

---

## Dependency Graph

```
MP-UI-01 (types + constants)
    |
    v
MP-UI-02 (StepIndicator extract)
    |
    v
MP-UI-03 (ArtifactViewer extract)
    |
    v
MP-UI-04 (LogPanel extract)
    |
    v
MP-UI-05 (LLM config + context panel)
    |
    v
MP-UI-06 (orchestrator header sticky)
    |
    v
MP-UI-07 (2-panel layout + Step 0 cleanup)
    |
    v
MP-UI-08 (Steps 2-3 adapt to 2-panel)
    |
    v
MP-UI-09 (Step 4 adapt to 2-panel)
    |
    v
MP-UI-10 (responsive: collapsible context panel)
    |
    v
MP-UI-11 (header portal injection)
    |
    v
MP-UI-12 (test adjustments)
```

---

## Inventory: Current File

`src/components/orchestrator-page.tsx` — **2671 linhas**, contem:

| Bloco | Linhas | O que faz |
|-------|--------|-----------|
| Session persistence | 28-70 | save/load/clear sessionStorage |
| Types | 76-95 | ParsedArtifact, StepResult, LogEntry, WizardStep, PageTab |
| STEPS constant | 101-107 | Array de 5 steps |
| StepIndicator | 109-139 | Componente de indicador de step |
| ArtifactViewer | 145-258 | Viewer com tabs, copy, save, save-all |
| LogPanel | 264-300 | Log com auto-scroll, debug mode |
| OrchestratorPage | 306-2668 | Componente principal (2362 linhas!) |
| - State declarations | 306-496 | ~40 useState + refs |
| - Effects | 497-572 | Session persist, disk artifacts, resume |
| - Handlers | 575-1580 | reset, SSE, API calls, git |
| - Render | 1582-2668 | JSX de todos os 5 steps |

---

## MP-UI-01: Types, constants and shared config extraction

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/types.ts` | Move: `ParsedArtifact`, `StepResult`, `LogEntry`, `WizardStep`, `PageTab`, `OrchestratorSession`, `STEPS`, `PROVIDER_MODELS`, `StepLLMConfig` |
| MODIFY | `src/components/orchestrator-page.tsx` | Replace inline types/constants with imports from `./orchestrator/types` |

**Contract:**
- Todos os types e constants extraidos compilam
- `PROVIDER_MODELS` exportado como const (nao dentro do componente)
- `orchestrator-page.tsx` compila com os imports
- Zero mudanca visual

**Depends on:** nenhum

---

## MP-UI-02: Extract StepIndicator component

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/step-indicator.tsx` | Move `StepIndicator` (linhas 109-139) para arquivo proprio, importando `STEPS` e `WizardStep` de `./types` |
| MODIFY | `src/components/orchestrator-page.tsx` | Replace inline StepIndicator com import de `./orchestrator/step-indicator` |

**Contract:**
- StepIndicator renderiza identico ao atual
- Props: `{ current: WizardStep; completed: Set<number>; onStepClick?: (step: WizardStep) => void }`
- Zero mudanca visual

**Depends on:** MP-UI-01

---

## MP-UI-03: Extract ArtifactViewer component

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/artifact-viewer.tsx` | Move `ArtifactViewer` (linhas 145-258) para arquivo proprio, importando `ParsedArtifact` de `./types` |
| MODIFY | `src/components/orchestrator-page.tsx` | Replace inline ArtifactViewer com import de `./orchestrator/artifact-viewer` |

**Contract:**
- ArtifactViewer renderiza identico: tabs, copy, save, save-all, line numbers
- Props: `{ artifacts: ParsedArtifact[] }`
- Zero mudanca visual

**Depends on:** MP-UI-01

---

## MP-UI-04: Extract LogPanel component

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/log-panel.tsx` | Move `LogPanel` (linhas 264-300) para arquivo proprio, importando `LogEntry` de `./types` |
| MODIFY | `src/components/orchestrator-page.tsx` | Replace inline LogPanel com import de `./orchestrator/log-panel` |

**Contract:**
- LogPanel renderiza identico: auto-scroll, debug mode toggle, badges
- Props: `{ logs: LogEntry[]; debugMode: boolean; onToggleDebug: () => void }`
- Zero mudanca visual

**Depends on:** MP-UI-01

---

## MP-UI-05: Extract LLM Config panel + Context Panel shell

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/context-panel.tsx` | Novo componente que agrupa: LLM config por etapa (extraido do Step 0 linhas 1780-1831), rerun picker (extraido do Step 0 linhas 1909-1954), e slot para LogPanel |
| MODIFY | `src/components/orchestrator-page.tsx` | Remove LLM config grid e rerun picker do Step 0 JSX, importa ContextPanel |

**Props do ContextPanel:**
```typescript
interface ContextPanelProps {
  // Project & Type
  projects: Project[]
  selectedProjectId: string | null
  onProjectChange: (id: string | null) => void
  taskType?: string
  onTaskTypeChange: (type?: string) => void
  // LLM config
  stepLLMs: Record<number, StepLLMConfig>
  onStepLLMChange: (step: number, field: "provider" | "model", value: string) => void
  providerModels: typeof PROVIDER_MODELS
  // Rerun
  diskArtifacts: ArtifactFolder[]
  showRerunPicker: boolean
  onToggleRerunPicker: () => void
  onRerunFromDisk: (outputId: string) => Promise<void>
  rerunLoading: boolean
  loading: boolean
  // Log
  logs: LogEntry[]
  debugMode: boolean
  onToggleDebug: () => void
}
```

**Contract:**
- Toda a config de LLM (Projeto, Tipo, LLMs por etapa) fica no ContextPanel
- Rerun picker fica no ContextPanel
- LogPanel renderiza dentro do ContextPanel
- Step 0 fica limpo: so textarea + anexos + botao
- LLM selectors inline dos Steps 3 e 4 sao **removidos** (ContextPanel e visivel em todos os steps)
- Zero funcionalidade perdida — tudo acessivel via ContextPanel

**Depends on:** MP-UI-01, MP-UI-04

---

## MP-UI-06: Orchestrator sticky header (dentro do main)

**Files (2):**
| Action | File | Change |
|--------|------|--------|
| CREATE | `src/components/orchestrator/orchestrator-header.tsx` | Novo componente: barra sticky no topo do main com StepIndicator + prompt truncado (1 linha) + outputId + botao Reset |
| MODIFY | `src/components/orchestrator-page.tsx` | Remove prompt card (linhas 1703-1727) e StepIndicator de dentro de cada Card. Renderiza OrchestratorHeader no topo |

**Props:**
```typescript
interface OrchestratorHeaderProps {
  step: WizardStep
  completedSteps: Set<number>
  onStepClick: (step: WizardStep) => void
  taskDescription: string
  outputId?: string
  onReset: () => void
  loading: boolean
}
```

**Contract:**
- `position: sticky; top: 0; z-index: 10` dentro do main scroll
- StepIndicator visivel em todas as etapas (nao mais escondido dentro dos Cards)
- Prompt truncado em 1 linha com ellipsis
- outputId em font-mono
- Botao Reset sempre visivel quando outputId existe
- Altura fixa ~48px, nao cresce
- Zero funcionalidade perdida — prompt card e StepIndicator continuam existindo, so mudaram de lugar

**Depends on:** MP-UI-02

---

## MP-UI-07: 2-panel layout + Step 0 cleanup

**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator-page.tsx` | Reestrutura o render: layout 2 paineis (main panel flex-1 + context panel ~320px) usando flex row. Step 0 fica so com textarea + anexos + "Gerar Plano" |

**Layout:**
```
<div style="display: flex; gap: 16px; height: calc(100vh - headerHeight - stickyHeaderHeight)">
  <!-- Main panel: scroll independente -->
  <div style="flex: 1; overflow-y: auto; min-width: 0">
    {step content}
  </div>
  <!-- Context panel: scroll independente -->
  <div style="width: 320px; flex-shrink: 0; overflow-y: auto">
    <ContextPanel ... />
  </div>
</div>
```

**Contract:**
- Main panel e context panel tem scroll independente
- Step 0: so textarea + anexos + "Gerar Plano" (config foi pro ContextPanel)
- Context panel visivel em todos os steps
- Session resume banner fica acima do layout 2-panel
- Error banner fica acima do layout 2-panel

**Depends on:** MP-UI-05, MP-UI-06

---

## MP-UI-08: Steps 2-3 adapt to 2-panel layout

**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator-page.tsx` | Adapta Steps 2 e 3: remove StepIndicator de dentro dos Cards (ja esta no header), remove LLM selectors inline (ja estao no ContextPanel), ajusta largura dos Cards para usar 100% do main panel |

**Contract:**
- Step 2 (Plan Review): Card com ArtifactViewer + botao "Gerar Testes" — sem StepIndicator
- Step 3 (Validation): Cards de validar/executar + resultados — sem StepIndicator, sem LLM selectors inline
- LLM selectors inline nas linhas 2049-2067 (Executar Direto), 2173-2191 (Validacao Aprovada), 2249-2267 (Validacao Falhou) sao **removidos** — ContextPanel ja tem tudo
- Zero funcionalidade perdida

**Depends on:** MP-UI-07

---

## MP-UI-09: Step 4 adapt to 2-panel layout

**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator-page.tsx` | Adapta Step 4: remove StepIndicator do Card, remove LLM selector inline (linhas 2359-2376), ajusta execucao card para usar 100% do main panel |

**Contract:**
- Step 4: Cards de execucao, validacao pos-execucao, commit, push — sem StepIndicator, sem LLM selector inline
- Footer actions (Nova Tarefa, Revalidar, Executar Novamente, Revalidar do disco, Ver Run) continuam
- Zero funcionalidade perdida

**Depends on:** MP-UI-07

---

## MP-UI-10: Responsive — collapsible context panel

**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator/context-panel.tsx` | Adiciona responsive behavior: em telas < 1024px, context panel vira collapsible drawer (bottom sheet ou sidebar direita com toggle). Em desktop, fica fixo |

**Contract:**
- Desktop (>=1024px): context panel fixo a direita, 320px
- Tablet/mobile (<1024px): context panel colapsa, toggle button visivel
- Toggle abre/fecha como sheet ou drawer animado
- Zero funcionalidade perdida em qualquer breakpoint

**Depends on:** MP-UI-07

---

## MP-UI-11: Header portal injection

**Files (1):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator-page.tsx` | Usa `usePageShell()` para injetar no `#orqui-header-right`: badge com step atual + outputId truncado. Seta `page: "orchestrator"` para breadcrumbs |

**Contract:**
- Header do AppShell mostra badge "Step N/4" no header-right
- outputId truncado visivel no header
- Breadcrumbs do AppShell mostram "Home / Orchestrator"
- Zero mudanca no AppShell — usa portal injection existente

**Depends on:** MP-UI-07

---

## MP-UI-12: Test adjustments

**Files (3):**
| Action | File | Change |
|--------|------|--------|
| MODIFY | `src/components/orchestrator-page.spec.tsx` | Ajusta imports e seletores para nova estrutura (sub-componentes extraidos) |
| MODIFY | `src/components/__tests__/orchestrator-spacing.spec.tsx` | Ajusta seletores para nova estrutura de layout |
| MODIFY | `src/components/__tests__/orchestrator-task-prompt-display.spec.tsx` | Ajusta seletores para prompt card (agora no orchestrator-header) |

**Contract:**
- Todos os testes existentes continuam passando
- Seletores atualizados para nova estrutura DOM
- Nenhum teste removido
- Se necessario, mais test files serao ajustados em MPs adicionais

**Depends on:** MP-UI-08, MP-UI-09, MP-UI-10, MP-UI-11

---

## Resumo

| MP | O que faz | Files | Depends on |
|----|-----------|-------|------------|
| MP-UI-01 | Types, constants, PROVIDER_MODELS extraction | 2 | — |
| MP-UI-02 | Extract StepIndicator | 2 | 01 |
| MP-UI-03 | Extract ArtifactViewer | 2 | 01 |
| MP-UI-04 | Extract LogPanel | 2 | 01 |
| MP-UI-05 | Extract LLM config + ContextPanel | 2 | 01, 04 |
| MP-UI-06 | Orchestrator sticky header | 2 | 02 |
| MP-UI-07 | 2-panel layout + Step 0 cleanup | 1 | 05, 06 |
| MP-UI-08 | Steps 2-3 adapt | 1 | 07 |
| MP-UI-09 | Step 4 adapt | 1 | 07 |
| MP-UI-10 | Responsive collapsible | 1 | 07 |
| MP-UI-11 | Header portal injection | 1 | 07 |
| MP-UI-12 | Test adjustments | 3 | 08, 09, 10, 11 |

**Total:** 12 microplans, ~20 file operations (7 CREATE, 13 MODIFY)

**Execucao paralela possivel:**
- MP-UI-02, MP-UI-03, MP-UI-04 podem rodar em paralelo (todos dependem so de MP-UI-01)
- MP-UI-08, MP-UI-09, MP-UI-10, MP-UI-11 podem rodar em paralelo (todos dependem so de MP-UI-07)

---

## Validacao por MP

Para cada MP:
1. `npm run lint` — sem erros novos
2. `npm run typecheck` — compila
3. Verificacao visual no browser (localhost:5175)
4. Commit atomico

## Funcionalidades Preservadas (checklist)

- [ ] 5 wizard steps (Tarefa, Plano, Testes, Validacao, Execucao)
- [ ] StepIndicator com navegacao por steps completos
- [ ] Selecao de Projeto
- [ ] Selecao de Tipo (Feature/Bugfix/Refactor)
- [ ] LLM config por etapa (Plan, Test, Execute, Fix) com provider + model
- [ ] Textarea de descricao da tarefa
- [ ] Anexos (drag & drop, file picker)
- [ ] Gerar Plano (SSE)
- [ ] ArtifactViewer (tabs, copy, save, save-all ZIP)
- [ ] Gerar Testes (SSE)
- [ ] Validar com Gatekeeper (Gates 0-1)
- [ ] Executar Direto (skip validation)
- [ ] Resultados de validacao (RUNNING, PASSED, FAILED, SCHEMA_ERROR)
- [ ] Fix plan / Fix spec com dialog de instrucoes
- [ ] Auto-detect fix target (plan vs spec validators)
- [ ] Revalidar do disco (0 tokens)
- [ ] Executar Implementacao (SSE + progress tracking)
- [ ] Stall detection (2min warning, 5min abandon)
- [ ] Validacao pos-execucao (Gates 2-3)
- [ ] Git Commit (manifest only ou all)
- [ ] Git Push
- [ ] Error banner com retry de provider
- [ ] Session persistence (sessionStorage)
- [ ] Resume from URL (?outputId=xxx)
- [ ] Resume from saved session
- [ ] LogPanel com debug mode
- [ ] Rerun picker (artefatos existentes no disco)
- [ ] FixInstructionsDialog (custom instructions)
- [ ] Ver Run link (navega para /runs/:id/v2)
