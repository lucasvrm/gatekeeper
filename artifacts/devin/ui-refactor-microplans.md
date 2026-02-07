 ✅ PLANO REVISADO — OPÇÃO 1 (CORRIGIDO)

 Decisões Arquiteturais Aprovadas

 1. Scroll: Híbrido — main scroll (AppShell) + Context Panel com position: sticky
 2. Responsive: Bottom sheet (slide from bottom) para mobile/tablet
 3. LLM Config: Remover completamente selectors inline (só ContextPanel)
 4. Step Indicator: Apenas no header sticky (remover de dentro dos Cards)

 ---
 Microplans Revisados (MPs)

 MP-UI-01: Types, Constants, and Shared Config Extraction

 Arquivos (2):
 - CREATE → src/components/orchestrator/types.ts
 - MODIFY → src/components/orchestrator-page.tsx

 O que extrair:

 ✅ Types (podem ser extraídos):
 // orchestrator-page.tsx linhas 131-150
 interface ParsedArtifact { filename: string; content: string }
 interface StepResult { outputId?: string; artifacts?: ParsedArtifact[]; ... }
 interface LogEntry { time: string; type: string; text: string }
 type WizardStep = 0 | 1 | 2 | 3 | 4
 type PageTab = "pipeline"

 // linha 433
 interface StepLLMConfig { provider: string; model: string }

 // linhas 33-53
 interface OrchestratorSession { ... } // Toda a interface

 ✅ Constants (podem ser extraídos):
 // linhas 29-31
 const SESSION_TTL_MS = 24 * 60 * 60 * 1000
 const SESSION_KEY_PREFIX = "gk-pipeline-"
 const ACTIVE_KEY = "gk-active-pipeline"

 // linhas 156-162
 const STEPS = [
   { num: 0, label: "Tarefa" },
   { num: 1, label: "Plano" },
   { num: 2, label: "Testes" },
   { num: 3, label: "Validação" },
   { num: 4, label: "Execução" },
 ] as const

 ❌ NÃO extrair (dinâmico):
 // linha 461 - Construído em runtime via API
 const PROVIDER_MODELS = Object.keys(providerCatalog).length > 0 ? ...

 Alterações:
 // types.ts (NOVO)
 export interface ParsedArtifact { ... }
 export interface StepResult { ... }
 export interface LogEntry { ... }
 export interface StepLLMConfig { ... }
 export interface OrchestratorSession { ... }
 export type WizardStep = 0 | 1 | 2 | 3 | 4
 export type PageTab = "pipeline"

 export const SESSION_TTL_MS = 24 * 60 * 60 * 1000
 export const SESSION_KEY_PREFIX = "gk-pipeline-"
 export const ACTIVE_KEY = "gk-active-pipeline"

 export const STEPS = [ ... ] as const

 // orchestrator-page.tsx
 import type { ParsedArtifact, StepResult, LogEntry, ... } from './orchestrator/types'
 import { STEPS, SESSION_TTL_MS, ... } from './orchestrator/types'

 Contrato:
 - PROVIDER_MODELS permanece dentro do componente (dinâmico)
 - Todos os types/constants extraídos compilam
 - orchestrator-page.tsx compila com os imports
 - Zero mudança visual

 ---
 MP-UI-02: Extract StepIndicator Component

 Arquivos (2):
 - CREATE → src/components/orchestrator/step-indicator.tsx
 - MODIFY → src/components/orchestrator-page.tsx

 Código atual (linhas 164-194):
 function StepIndicator({ current, completed, onStepClick }: {
   current: WizardStep;
   completed: Set<number>;
   onStepClick?: (step: WizardStep) => void
 }) {
   return (
     <div className="flex items-center gap-1">
       {STEPS.map(({ num, label }, i) => {
         const canClick = onStepClick && completed.has(num) && num !== current
         return (
           <div key={num} className="flex items-center">
             <button
               type="button"
               disabled={!canClick}
               onClick={() => canClick && onStepClick(num as WizardStep)}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                 num === current
                   ? "bg-primary text-primary-foreground"
                   : completed.has(num)
                   ? "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 cursor-pointer"
                   : "bg-muted text-muted-foreground"
               } ${!canClick ? "cursor-default" : ""}`}
             >
               <span>{completed.has(num) ? "✓" : num}</span>
               <span className="hidden sm:inline">{label}</span>
             </button>
             {i < STEPS.length - 1 && (
               <div className={`w-6 h-px mx-1 ${completed.has(num) ? "bg-green-500/40" : "bg-border"}`} />
             )}
           </div>
         )
       })}
     </div>
   )
 }

 Extração:
 // step-indicator.tsx
 import { STEPS, type WizardStep } from './types'

 interface StepIndicatorProps {
   current: WizardStep
   completed: Set<number>
   onStepClick?: (step: WizardStep) => void
 }

 export function StepIndicator({ current, completed, onStepClick }: StepIndicatorProps) {
   // ... mesmo código
 }

 // orchestrator-page.tsx
 import { StepIndicator } from './orchestrator/step-indicator'

 Ocorrências a remover (4x):
 - Linha 1904: Step 0 CardHeader
 - Linha 2134: Step 2 CardHeader
 - Linha 2168: Step 3 CardHeader
 - Linha 2513: Step 4 CardHeader

 Contrato:
 - StepIndicator renderiza identicamente
 - Props inalteradas
 - 4 ocorrências inline serão removidas em MP-UI-06
 - Zero mudança visual

 ---
 MP-UI-03: Extract ArtifactViewer Component

 Arquivos (2):
 - CREATE → src/components/orchestrator/artifact-viewer.tsx
 - MODIFY → src/components/orchestrator-page.tsx

 Código atual (linhas 200-309):
 Componente completo com tabs, copy, save, save-all, line numbers

 Extração:
 // artifact-viewer.tsx
 import type { ParsedArtifact } from './types'

 interface ArtifactViewerProps {
   artifacts: ParsedArtifact[]
 }

 export function ArtifactViewer({ artifacts }: ArtifactViewerProps) {
   // ... código completo (200-309)
 }

 data-testid preservados:
 - artifact-viewer
 - artifact-tab-{i}
 - artifact-copy-btn
 - artifact-save-btn
 - artifact-save-all-btn
 - artifact-content (adicionar se missing)

 Contrato:
 - Tabs, copy, save, save-all, line numbers funcionam identicamente
 - Props inalteradas
 - data-testid preservados (orchestrator-enhancements.spec.tsx depende)
 - Zero mudança visual

 ---
 MP-UI-04: Extract LogPanel Component

 Arquivos (2):
 - CREATE → src/components/orchestrator/log-panel.tsx
 - MODIFY → src/components/orchestrator-page.tsx

 Código atual (linhas 319-355):

 Extração:
 // log-panel.tsx
 import type { LogEntry } from './types'

 interface LogPanelProps {
   logs: LogEntry[]
   debugMode: boolean
   onToggleDebug: () => void
 }

 export function LogPanel({ logs, debugMode, onToggleDebug }: LogPanelProps) {
   // ... código completo (319-355)
 }

 Contrato:
 - Auto-scroll, debug toggle, badges funcionam identicamente
 - Props inalteradas
 - Zero mudança visual

 ---
 MP-UI-05: Extract Context Panel Component

 Arquivos (2):
 - CREATE → src/components/orchestrator/context-panel.tsx
 - MODIFY → src/components/orchestrator-page.tsx

 O que agrupa:
 1. Projeto + Tipo (Step 0, linhas 1911-1945)
 2. LLM Config por etapa (Step 0, linhas 1947-1997)
 3. Rerun picker (Step 0, linhas — buscar showRerunPicker)
 4. LogPanel (renderizado no final, linha ~2822)

 Props interface:
 interface ContextPanelProps {
   // Project & Type
   projects: Project[]
   selectedProjectId: string | null
   onProjectChange: (id: string | null) => void
   taskType?: string
   onTaskTypeChange: (type?: string) => void

   // LLM config (Steps 1, 2, 4)
   stepLLMs: Record<number, StepLLMConfig>
   onStepLLMChange: (step: number, field: "provider" | "model", value: string) => void
   providerModels: Record<string, { label: string; models: { value: string; label: string }[] }>
   getDefault: (step: number) => StepLLMConfig

   // Rerun
   diskArtifacts: ArtifactFolder[]
   showRerunPicker: boolean
   onToggleRerunPicker: () => void
   onRerunFromDisk: (outputId: string) => Promise<void>
   rerunLoading: boolean

   // State
   loading: boolean

   // Log
   logs: LogEntry[]
   debugMode: boolean
   onToggleDebug: () => void
 }

 Comportamento:
 - Desktop (>= 1024px): Painel fixo position: sticky, width: 320px
 - Mobile (< 1024px): Bottom sheet colapsável (slide from bottom)
 - Renderiza LogPanel internamente no final

 Contrato:
 - Toda config de LLM fica no Context Panel (nenhum selector inline)
 - stepLLMs state permanece no OrchestratorPage (não move)
 - Session persistence funciona (stepLLMs salvo/restaurado)
 - Zero funcionalidade perdida

 ---
 MP-UI-06: Orchestrator Sticky Header

 Arquivos (3):
 - CREATE → src/components/orchestrator/orchestrator-header.tsx
 - MODIFY → src/components/orchestrator-page.tsx
 - MODIFY → contracts/layout-contract.json

 Novo componente:
 // orchestrator-header.tsx
 interface OrchestratorHeaderProps {
   step: WizardStep
   completedSteps: Set<number>
   onStepClick: (step: WizardStep) => void
   taskDescription: string
   outputId?: string
   onReset: () => void
   loading: boolean
 }

 export function OrchestratorHeader({ ... }: OrchestratorHeaderProps) {
   return (
     <div style={{
       position: 'sticky',
       top: 0,
       zIndex: 20,  // Acima de AppShell header (z-index: 10)
       background: 'var(--background)',
       borderBottom: '1px solid var(--border)',
       padding: '12px 16px',
       display: 'flex',
       alignItems: 'center',
       justifyContent: 'space-between',
       gap: '16px',
       height: '48px',
       minHeight: '48px',
     }}>
       <StepIndicator current={step} completed={completedSteps} onStepClick={onStepClick} />

       {outputId && (
         <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
           <span className="truncate max-w-[200px]" title={taskDescription}>
             {taskDescription}
           </span>
           <span className="text-primary">{outputId.slice(-8)}</span>
         </div>
       )}

       {outputId && !loading && (
         <Button variant="ghost" size="sm" onClick={onReset}>
           Reset
         </Button>
       )}
     </div>
   )
 }

 Layout contract override (para remover padding do main):
 // contracts/layout-contract.json
 "pages": {
   "orchestrator": {
     "label": "Orchestrator",
     "route": "/orchestrator",
     "overrides": {
       "main": {
         "padding": { "top": "0", "right": "28px", "bottom": "28px", "left": "28px" }
       }
     }
   }
 }

 Alterações em orchestrator-page.tsx:
 - Renderizar OrchestratorHeader no topo (após headerPortals, antes de session controls)
 - Remover prompt card (linhas 1871-1894)
 - Remover 4 ocorrências de StepIndicator inline (1904, 2134, 2168, 2513)

 Z-index safety:
 - OrchestratorHeader: 20 (acima de AppShell header: 10)
 - Collapsed nav tooltip: 1000 (ainda visível)
 - Toasts: 9999 (sempre no topo)

 Contrato:
 - Sticky header sempre visível durante scroll
 - StepIndicator centralizado (não mais redundante)
 - Prompt truncado em 1 linha
 - outputId visível
 - Botão Reset sempre acessível
 - Zero funcionalidade perdida

 ---
 MP-UI-07: 2-Panel Layout (Híbrido: Main Scroll + Context Sticky)

 Arquivos (1):
 - MODIFY → src/components/orchestrator-page.tsx

 Layout escolhido: Híbrido
 - AppShell main mantém overflow: auto (scroll principal)
 - Main panel: Cresce naturalmente, scroll junto com AppShell
 - Context panel: position: sticky; top: 48px (cola abaixo do orchestrator header)

 Estrutura (após linha 1778):
 <div className="page-gap">
   {/* OrchestratorHeader sticky (z-index: 20) */}
   <OrchestratorHeader ... />

   {/* Session controls, error banner (não afetados) */}
   {!outputId && saved?.outputId && <SessionResumeButton />}
   {error && retryState && <ErrorBanner />}

   {/* 2-panel layout */}
   <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
     {/* Main panel: cresce naturalmente, sem scroll próprio */}
     <div style={{ flex: 1, minWidth: 0 }}>
       {/* Step 0 content */}
       {step === 0 && <Step0Content />}

       {/* Step 2 content */}
       {step === 2 && <Step2Content />}

       {/* Step 3 content */}
       {step === 3 && <Step3Content />}

       {/* Step 4 content */}
       {step === 4 && <Step4Content />}
     </div>

     {/* Context panel: sticky, cola na viewport */}
     <div style={{
       width: '320px',
       flexShrink: 0,
       position: 'sticky',
       top: '64px',  // 48px (orchestrator header) + 16px gap
       alignSelf: 'flex-start',
     }}>
       <ContextPanel ... />
     </div>
   </div>
 </div>

 Responsive (< 1024px):
 - Context panel vira bottom sheet (MP-UI-10)
 - Main panel ocupa 100% width

 Contrato:
 - Scroll funciona no AppShell main (como hoje)
 - Context panel sticky (sempre visível durante scroll)
 - Sem nested scrolling containers
 - Zero conflito de scroll

 ---
 MP-UI-08: Adapt Steps 2-3 to 2-Panel Layout

 Arquivos (1):
 - MODIFY → src/components/orchestrator-page.tsx

 Alterações:
 - Step 2 (linhas 2128-2159): Remover StepIndicator de CardHeader (linha 2134)
 - Step 3 (linhas 2162-2500):
   - Remover StepIndicator de CardHeader (linha 2168)
   - Remover todos os LLM selectors inline (10 pares = 20 Select components):
       - Linhas 1804-1838: Error retry selectors
     - Linhas 2215-2234: "Executar Direto"
     - Linhas 2340-2357: "Validação Aprovada"
     - Linhas 2419-2433: "Validação Falhou" (fix LLM)

 Contrato:
 - Cards usam 100% do main panel width
 - LLM config acessível via Context Panel (sempre visível)
 - Zero funcionalidade perdida

 ---
 MP-UI-09: Adapt Step 4 to 2-Panel Layout

 Arquivos (1):
 - MODIFY → src/components/orchestrator-page.tsx

 Alterações:
 - Step 4 (linhas 2502-2820):
   - Remover StepIndicator de CardHeader (linha 2513)
   - Remover LLM selector inline (linhas 2525-2542: "Idle Execution")

 Contrato:
 - Cards usam 100% do main panel width
 - LLM config acessível via Context Panel
 - Footer actions continuam (Nova Tarefa, Revalidar, etc)
 - Zero funcionalidade perdida

 ---
 MP-UI-10: Responsive Context Panel (Bottom Sheet)

 Arquivos (1):
 - MODIFY → src/components/orchestrator/context-panel.tsx

 Comportamento:
 - Desktop (>= 1024px): Sticky panel fixo (já implementado em MP-UI-05)
 - Mobile/Tablet (< 1024px): Bottom sheet colapsável

 Implementação (bottom sheet):
 // context-panel.tsx
 import { useState, useEffect } from 'react'

 export function ContextPanel(props: ContextPanelProps) {
   const [isOpen, setIsOpen] = useState(false)
   const [isMobile, setIsMobile] = useState(false)

   useEffect(() => {
     const checkMobile = () => setIsMobile(window.innerWidth < 1024)
     checkMobile()
     window.addEventListener('resize', checkMobile)
     return () => window.removeEventListener('resize', checkMobile)
   }, [])

   if (isMobile) {
     return (
       <>
         {/* Toggle button (floating) */}
         <button
           onClick={() => setIsOpen(!isOpen)}
           style={{
             position: 'fixed',
             bottom: '16px',
             right: '16px',
             zIndex: 50,
             width: '56px',
             height: '56px',
             borderRadius: '50%',
             background: 'var(--primary)',
             color: 'var(--primary-foreground)',
             boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
           }}
         >
           ⚙️
         </button>

         {/* Bottom sheet */}
         {isOpen && (
           <div
             style={{
               position: 'fixed',
               inset: 0,
               zIndex: 100,
               background: 'rgba(0,0,0,0.5)',
             }}
             onClick={() => setIsOpen(false)}
           >
             <div
               style={{
                 position: 'absolute',
                 bottom: 0,
                 left: 0,
                 right: 0,
                 maxHeight: '80vh',
                 background: 'var(--background)',
                 borderTopLeftRadius: '16px',
                 borderTopRightRadius: '16px',
                 padding: '24px',
                 overflowY: 'auto',
                 animation: 'slideUp 0.3s ease-out',
               }}
               onClick={(e) => e.stopPropagation()}
             >
               {/* Panel content */}
               <PanelContent {...props} />
             </div>
           </div>
         )}
       </>
     )
   }

   // Desktop: sticky panel
   return <PanelContent {...props} />
 }

 Contrato:
 - Desktop: sticky panel (como MP-UI-05)
 - Mobile: bottom sheet com toggle FAB
 - Animação suave (slideUp)
 - Zero funcionalidade perdida em qualquer breakpoint

 ---
 MP-UI-11: Header Portal Injection (Expandir Uso Existente)

 Arquivos (1):
 - MODIFY → src/components/orchestrator-page.tsx

 Código atual (linha 382):
 const headerPortals = usePageShell({ page: "orchestrator" })

 Expandir para injetar conteúdo:
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

 Portal targets (AppShell):
 - #orqui-header-left: Vazio (não usado)
 - #orqui-header-right: Badge + outputId

 Contrato:
 - Breadcrumbs do AppShell mostram "Home / Orchestrator"
 - Header right mostra step + outputId
 - Portal renderiza via createPortal (já implementado em usePageShell)
 - Zero mudança no AppShell

 ---
 MP-UI-12: Test Adjustments

 Arquivos (4):
 - MODIFY → src/components/orchestrator-page.spec.tsx
 - MODIFY → src/components/__tests__/orchestrator-enhancements.spec.tsx
 - MODIFY → src/components/__tests__/orchestrator-spacing.spec.tsx
 - MODIFY → src/components/__tests__/orchestrator-task-prompt-display.spec.tsx

 Alterações necessárias:

 1. orchestrator-page.spec.tsx

 - ✅ Atualizar imports para componentes extraídos
 - ✅ Manter session storage format intacto
 - ✅ Manter button visibility logic (loading, isAborted)

 2. orchestrator-enhancements.spec.tsx

 - ✅ Atualizar imports: ArtifactViewer, StepIndicator de ./orchestrator/...
 - ✅ CRÍTICO: Manter todos os data-testid:
   - artifact-copy-btn, artifact-save-btn, artifact-save-all-btn
   - artifact-content, artifact-tab-{i}
   - orchestrator-abort-btn
   - validator-bypass-btn-{code}
   - validators-count-badge
 - ✅ Manter estrutura DOM esperada (button visibility based on artifacts.length > 1)

 3. orchestrator-spacing.spec.tsx

 - ✅ CRÍTICO: Garantir que wrapper NÃO tem space-y-6 class
 - ✅ Verificar DOM nesting: wrapper → headerPortals
 - ✅ Gap controlado por orchestrator header padding (não space-y-*)

 4. orchestrator-task-prompt-display.spec.tsx

 - ✅ Atualizar seletores se prompt card foi refatorado
 - ✅ CRÍTICO: Manter data-testid="task-prompt-display-card" e "task-prompt-content"
 - ✅ Preservar class whitespace-pre-wrap em task-prompt-content
 - ✅ Manter reatividade: textarea → taskDescription → display card

 Contrato:
 - Todos os testes existentes continuam passando
 - Seletores atualizados para nova estrutura
 - data-testid preservados
 - Lógica de session/visibility/reatividade intacta

 ---
 Ordem de Execução (com Dependências Resolvidas)

 MP-UI-01 (types + constants)
     ↓
 MP-UI-02 (StepIndicator extract)
     ↓
 MP-UI-03 (ArtifactViewer extract)
     ↓
 MP-UI-04 (LogPanel extract)
     ↓
 MP-UI-05 (Context Panel)
     ↓
 MP-UI-06 (Orchestrator Header + contract override)
     ↓
 MP-UI-07 (2-panel layout híbrido)
     ↓
 MP-UI-08 (Steps 2-3 adapt + remove inline LLM)
     ↓
 MP-UI-09 (Step 4 adapt + remove inline LLM)
     ↓
 MP-UI-10 (Responsive bottom sheet)
     ↓
 MP-UI-11 (Header portal injection)
     ↓
 MP-UI-12 (Test adjustments)

 Verificação Final

 Após implementação de todos os MPs:

 1. Compilação:
 npm run typecheck:all
 2. Testes:
 npm test  # Todos os testes devem passar
 3. Manual:
   - ✅ StepIndicator aparece apenas no header sticky (não nos Cards)
   - ✅ Context Panel visível e sticky (desktop)
   - ✅ Context Panel vira bottom sheet (< 1024px)
   - ✅ LLM config centralizada (sem selectors inline)
   - ✅ Scroll funciona suavemente (AppShell main)
   - ✅ Session save/restore funciona (localStorage)
   - ✅ Header portal mostra step + outputId
 4. Regressão:
   - ✅ Navegação entre steps funciona (click em StepIndicator)
   - ✅ Retry após erro funciona (Context Panel)
   - ✅ Artifacts copy/save/save-all funcionam
   - ✅ Logs auto-scroll + debug toggle funcionam
   - ✅ Git commit/push flow funciona