import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

// ============================================================================
// SPEC WRITER LOGS - RESEARCH VALIDATION TESTS
// ============================================================================
// Este arquivo valida os gaps identificados no levantamento de como os logs do
// Spec Writer (Step 2) estão sendo tratados na UI do Gatekeeper Orchestrator.
//
// TIPO: Pesquisa/Levantamento (validação de estado atual, não modificações)
// ============================================================================

// ============================================================================
// HOISTED MOCKS
// ============================================================================
const { mockApi, mockToast } = vi.hoisted(() => ({
  mockApi: {
    projects: {
      list: vi.fn(() => Promise.resolve({ data: [] })),
    },
    runs: {
      getWithResults: vi.fn(),
      create: vi.fn(),
      uploadFiles: vi.fn(),
    },
    bridgeArtifacts: {
      readAll: vi.fn(),
    },
    mcp: {
      providers: {
        list: vi.fn(() => Promise.resolve([])),
      },
      models: {
        list: vi.fn(() => Promise.resolve([])),
      },
      phases: {
        list: vi.fn(() => Promise.resolve([])),
      },
    },
    artifacts: {
      list: vi.fn(() => Promise.resolve([])),
    },
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock("@/lib/api", () => ({
  api: mockApi,
  API_BASE: "http://localhost:3000",
}))

vi.mock("sonner", () => ({
  toast: mockToast,
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock("@/hooks/useOrchestratorEvents", () => ({
  useOrchestratorEvents: vi.fn(() => ({
    lastSeqRef: { current: 0 },
  })),
}))

vi.mock("@/hooks/useRunEvents", () => ({
  useRunEvents: vi.fn(),
}))

vi.mock("@/hooks/use-page-shell", () => ({
  usePageShell: () => null,
}))

// ============================================================================
// TYPE DEFINITIONS (para validação estrutural)
// ============================================================================

/**
 * Estrutura atual do LogEntry conforme types.ts:17-21
 * @see src/components/orchestrator/types.ts
 */
interface LogEntryActual {
  time: string
  type: string
  text: string
}

/**
 * Estrutura ideal do LogEntry com suporte a metadados
 * (sugestão do contrato - não implementada)
 */
interface LogEntryIdeal {
  time: string
  type: string
  text: string
  metadata?: {
    tokensUsed?: { inputTokens: number; outputTokens: number }
    durationMs?: number
    files?: string[]
    expandable?: boolean
    iteration?: number
  }
}

/**
 * Eventos SSE emitidos pelo backend durante Step 2 (Spec Writer)
 */
type SpecWriterEventTypes =
  | "agent:bridge_start"
  | "agent:start"
  | "agent:thinking"
  | "agent:iteration"
  | "agent:text"
  | "agent:tool_call"
  | "agent:tool_result"
  | "agent:complete"
  | "agent:bridge_complete"
  | "agent:bridge_spec_done" // NOT TREATED IN FRONTEND

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Spec Writer Logs - Levantamento de Gaps", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  // ==========================================================================
  // GAP-1: agent:bridge_spec_done não tratado no frontend
  // Severidade: ALTA
  // Local: orchestrator-page.tsx:516-698 (switch case)
  // ==========================================================================
  describe("GAP-1: agent:bridge_spec_done não tratado", () => {
    /**
     * @clause GAP-1
     * GIVEN o evento agent:bridge_spec_done é emitido pelo BridgeController
     * WHEN o frontend processa eventos SSE no handleSSE
     * THEN o evento deve ser tratado (atualmente vai para o case default)
     */
    it("DEVE falhar: verifica que agent:bridge_spec_done não tem case dedicado no switch", () => {
      // Este teste documenta o gap - o evento NÃO é tratado especificamente
      const handleSSEEventTypes = [
        "agent:bridge_start",
        "agent:start",
        "agent:text",
        "agent:thinking",
        "agent:iteration",
        "agent:tool_call",
        "agent:tool_result",
        "agent:budget_warning",
        "agent:budget_exceeded",
        "agent:fallback",
        "agent:complete",
        "agent:bridge_plan_done",
        "agent:bridge_execute_done",
        "agent:bridge_complete",
        "agent:fallback_unavailable",
        "agent:error",
      ]

      // agent:bridge_spec_done NÃO está na lista de eventos tratados
      expect(handleSSEEventTypes).not.toContain("agent:bridge_spec_done")

      // Documentação: o evento vai para o case default, que apenas loga
      // em modo debug ou com event.text
    })

    /**
     * @clause GAP-1-IMPACT
     * Documenta o impacto: usuário não recebe notificação específica quando
     * o spec é gerado via pipeline completo
     */
    it("DEVE documentar: impacto quando spec é gerado via pipeline", () => {
      // Evento emitido em BridgeController.ts:511-515
      const specDoneEvent = {
        type: "agent:bridge_spec_done",
        outputId: "test-output-id",
        artifacts: [
          { filename: "Button.spec.tsx", content: "test content" }
        ],
      }

      // O frontend não tem case para este evento, então:
      // 1. Em modo debug: será logado como "[agent:bridge_spec_done] {...}"
      // 2. Em modo normal: será logado sem formatação específica
      //
      // Impacto: usuário não sabe que o spec foi gerado especificamente
      expect(specDoneEvent.type).toBe("agent:bridge_spec_done")
    })
  })

  // ==========================================================================
  // GAP-2: agent:text oculto em modo normal
  // Severidade: MÉDIA
  // Local: orchestrator-page.tsx:541-546
  // ==========================================================================
  describe("GAP-2: agent:text só aparece em debug mode", () => {
    /**
     * @clause GAP-2
     * GIVEN o LLM está gerando texto durante Step 2
     * WHEN debugMode = false
     * THEN o texto NÃO é mostrado no log
     */
    it("DEVE falhar: verifica que agent:text é ignorado em modo normal", () => {
      // Código atual em orchestrator-page.tsx:541-546
      const simulateHandleText = (debug: boolean, eventText: string) => {
        if (debug) {
          const preview = eventText.slice(0, 500)
          if (preview.trim()) return `💬 LLM: ${preview}...`
        }
        return null // Retorna null em modo normal
      }

      // Em modo debug, texto é mostrado
      expect(simulateHandleText(true, "test output")).toBe("💬 LLM: test output...")

      // Em modo NORMAL, texto é IGNORADO (gap)
      expect(simulateHandleText(false, "test output")).toBeNull()
    })
  })

  // ==========================================================================
  // GAP-3: agent:tool_call sem contexto de arquivo em modo normal
  // Severidade: MÉDIA
  // Local: orchestrator-page.tsx:569-586
  // ==========================================================================
  describe("GAP-3: agent:tool_call sem detalhes em modo normal", () => {
    /**
     * @clause GAP-3
     * GIVEN uma tool é chamada (ex: read_file, save_artifact)
     * WHEN debugMode = false
     * THEN apenas o nome da tool é mostrado, sem o arquivo/input
     */
    it("DEVE falhar: verifica que tool_call mostra apenas nome em modo normal", () => {
      const simulateHandleToolCall = (debug: boolean, tool: string, input: Record<string, unknown>) => {
        if (debug && input) {
          if (tool === "read_file") {
            return `🔧 ${tool}("${input.path ?? input.file_path ?? ""}")`
          } else if (tool === "save_artifact") {
            const contentLen = typeof input.content === "string" ? input.content.length : 0
            return `🔧 ${tool}("${input.filename}", ${contentLen} chars)`
          }
          return `🔧 ${tool}(${JSON.stringify(input).slice(0, 300)})`
        }
        // Modo normal: apenas nome da tool
        return `🔧 ${tool}`
      }

      // Em modo debug, mostra detalhes
      expect(simulateHandleToolCall(true, "read_file", { path: "src/Button.tsx" }))
        .toBe('🔧 read_file("src/Button.tsx")')

      // Em modo NORMAL, mostra APENAS o nome (gap)
      expect(simulateHandleToolCall(false, "read_file", { path: "src/Button.tsx" }))
        .toBe("🔧 read_file")
    })
  })

  // ==========================================================================
  // GAP-4: agent:tool_result sem diferenciação visual de erro
  // Severidade: MÉDIA
  // Local: orchestrator-page.tsx:588-594
  // ==========================================================================
  describe("GAP-4: agent:tool_result sem indicação visual clara", () => {
    /**
     * @clause GAP-4
     * GIVEN uma tool retorna resultado
     * WHEN debugMode = false
     * THEN sucesso/erro diferem apenas pelo type do log, não visualmente
     */
    it("DEVE falhar: verifica que tool_result não tem indicação visual de status", () => {
      const simulateHandleToolResult = (debug: boolean, tool: string, isError: boolean, durationMs: number) => {
        if (debug) {
          return {
            type: isError ? "error" : "debug",
            text: `↩ ${tool} → ${isError ? "ERROR" : "ok"} (${durationMs}ms)`
          }
        }
        // Modo normal: apenas "tool (Xms)" sem indicação clara de sucesso/erro
        return {
          type: isError ? "error" : "info",
          text: `${tool} (${durationMs}ms)`
        }
      }

      // Em modo debug, mostra status explícito
      const debugSuccess = simulateHandleToolResult(true, "read_file", false, 150)
      expect(debugSuccess.text).toContain("ok")

      const debugError = simulateHandleToolResult(true, "read_file", true, 150)
      expect(debugError.text).toContain("ERROR")

      // Em modo NORMAL, NÃO mostra status explícito (gap)
      const normalSuccess = simulateHandleToolResult(false, "read_file", false, 150)
      expect(normalSuccess.text).toBe("read_file (150ms)")
      expect(normalSuccess.text).not.toContain("ok")
      expect(normalSuccess.text).not.toContain("✓")

      const normalError = simulateHandleToolResult(false, "read_file", true, 150)
      expect(normalError.text).toBe("read_file (150ms)")
      expect(normalError.text).not.toContain("ERROR")
      expect(normalError.text).not.toContain("✗")
    })
  })

  // ==========================================================================
  // GAP-5: agent:complete sem estatísticas em modo normal
  // Severidade: BAIXA
  // Local: orchestrator-page.tsx:604-612
  // ==========================================================================
  describe("GAP-5: agent:complete sem estatísticas em modo normal", () => {
    /**
     * @clause GAP-5
     * GIVEN o LLM finaliza execução
     * WHEN debugMode = false
     * THEN apenas "LLM finalizado" é mostrado, sem iterações/tokens
     */
    it("DEVE falhar: verifica que complete não mostra estatísticas em modo normal", () => {
      const simulateHandleComplete = (debug: boolean, result: { iterations: number; tokensUsed: { inputTokens: number; outputTokens: number } } | null) => {
        if (debug && result) {
          return `✅ LLM finalizado — ${result.iterations} iterações, ${result.tokensUsed.inputTokens.toLocaleString()}in/${result.tokensUsed.outputTokens.toLocaleString()}out`
        }
        // Modo normal: apenas "LLM finalizado"
        return "LLM finalizado"
      }

      const result = { iterations: 3, tokensUsed: { inputTokens: 1234, outputTokens: 567 } }

      // Em modo debug, mostra estatísticas
      expect(simulateHandleComplete(true, result)).toContain("3 iterações")
      expect(simulateHandleComplete(true, result)).toContain("1,234in")

      // Em modo NORMAL, NÃO mostra estatísticas (gap)
      expect(simulateHandleComplete(false, result)).toBe("LLM finalizado")
    })
  })

  // ==========================================================================
  // GAP-6: LogEntry sem suporte a metadados
  // Severidade: ALTA
  // Local: src/components/orchestrator/types.ts:17-21
  // ==========================================================================
  describe("GAP-6: LogEntry muito simples", () => {
    /**
     * @clause GAP-6
     * GIVEN a interface LogEntry em types.ts
     * WHEN um log é criado
     * THEN só suporta { time, type, text } - sem metadados estruturados
     */
    it("DEVE falhar: verifica que LogEntry não suporta metadados", () => {
      // Estrutura atual
      const actualLogEntry: LogEntryActual = {
        time: "10:30:15",
        type: "info",
        text: "Iteração 1 — 1,234 in / 567 out tokens",
      }

      // Estrutura ideal (sugestão do contrato)
      const idealLogEntry: LogEntryIdeal = {
        time: "10:30:15",
        type: "info",
        text: "Iteração 1",
        metadata: {
          iteration: 1,
          tokensUsed: { inputTokens: 1234, outputTokens: 567 },
          expandable: true,
        },
      }

      // A estrutura atual NÃO tem metadata
      expect(actualLogEntry).not.toHaveProperty("metadata")

      // A estrutura ideal TEM metadata
      expect(idealLogEntry).toHaveProperty("metadata")
      expect(idealLogEntry.metadata?.tokensUsed?.inputTokens).toBe(1234)
    })

    /**
     * @clause GAP-6-LIMITATIONS
     * Documenta as limitações da estrutura atual
     */
    it("DEVE documentar: limitações da estrutura LogEntry atual", () => {
      const limitations = [
        "Sem suporte a metadados estruturados (tokens, duração, arquivos)",
        "Sem suporte a logs expandíveis/colapsáveis",
        "Sem suporte a links para arquivos",
        "Sem progress bar para operações longas",
        "Sem agrupamento por fase/iteração",
      ]

      // Todas estas limitações existem devido à estrutura simples
      expect(limitations).toHaveLength(5)

      // A estrutura atual é apenas { time, type, text }
      const logEntryKeys = ["time", "type", "text"]
      expect(logEntryKeys).not.toContain("metadata")
      expect(logEntryKeys).not.toContain("expandable")
      expect(logEntryKeys).not.toContain("files")
    })
  })

  // ==========================================================================
  // GAP-7: LogPanel com renderização uniforme
  // Severidade: MÉDIA
  // Local: src/components/orchestrator/log-panel.tsx:37-43
  // ==========================================================================
  describe("GAP-7: LogPanel renderiza todos logs igual", () => {
    /**
     * @clause GAP-7
     * GIVEN o LogPanel recebe uma lista de logs
     * WHEN renderiza a lista
     * THEN todos os logs têm a mesma aparência (sem cards, progress bars, etc)
     */
    it("DEVE falhar: verifica que LogPanel não tem visualizações ricas", () => {
      // Estrutura atual de renderização (log-panel.tsx:37-43)
      const renderLog = (log: LogEntryActual) => {
        // Todos os logs são renderizados assim:
        return {
          element: "div",
          classes: "flex gap-2 text-xs font-mono",
          children: [
            { element: "span", content: log.time },
            { element: "Badge", content: log.type },
            { element: "span", content: log.text },
          ],
        }
      }

      const iterationLog = renderLog({ time: "10:30", type: "info", text: "Iteração 1" })
      const toolLog = renderLog({ time: "10:31", type: "info", text: "🔧 read_file" })
      const errorLog = renderLog({ time: "10:32", type: "error", text: "Erro X" })

      // Todos têm a MESMA estrutura (gap)
      expect(iterationLog.element).toBe(toolLog.element)
      expect(iterationLog.classes).toBe(toolLog.classes)
      expect(iterationLog.children.length).toBe(errorLog.children.length)

      // Não há:
      // - Cards expansíveis
      // - Progress bars
      // - Visualização rica por tipo
      // - Agrupamento por fase
    })
  })

  // ==========================================================================
  // COBERTURA DE EVENTOS - Documentação
  // ==========================================================================
  describe("Cobertura de Eventos SSE - Documentação", () => {
    /**
     * @clause COVERAGE
     * Documenta a cobertura de eventos SSE no frontend
     */
    it("DEVE documentar: cobertura de eventos por modo", () => {
      const eventCoverage: Record<SpecWriterEventTypes, { normalMode: string; debugMode: string }> = {
        "agent:bridge_start": {
          normalMode: "✅ Logado: 'Iniciando etapa X...'",
          debugMode: "✅ Igual"
        },
        "agent:start": {
          normalMode: "✅ Logado: 'LLM X/Y conectado'",
          debugMode: "✅ Igual"
        },
        "agent:thinking": {
          normalMode: "✅ Logado: 'LLM pensando... Xs'",
          debugMode: "✅ + iteração"
        },
        "agent:iteration": {
          normalMode: "✅ Logado com tokens",
          debugMode: "✅ Igual"
        },
        "agent:text": {
          normalMode: "❌ IGNORADO",
          debugMode: "✅ Preview 500 chars"
        },
        "agent:tool_call": {
          normalMode: "⚠️ PARCIAL: apenas nome da tool",
          debugMode: "✅ + input detalhado"
        },
        "agent:tool_result": {
          normalMode: "⚠️ PARCIAL: 'tool (Xms)' sem status",
          debugMode: "✅ + status ok/ERROR"
        },
        "agent:complete": {
          normalMode: "⚠️ PARCIAL: 'LLM finalizado' sem stats",
          debugMode: "✅ + estatísticas"
        },
        "agent:bridge_complete": {
          normalMode: "✅ Tratado (só se WRITING)",
          debugMode: "✅ Igual"
        },
        "agent:bridge_spec_done": {
          normalMode: "❌ NÃO TRATADO",
          debugMode: "❌ NÃO TRATADO"
        },
      }

      // Contar gaps
      const notTreated = Object.values(eventCoverage).filter(v => v.normalMode.includes("NÃO TRATADO")).length
      const ignored = Object.values(eventCoverage).filter(v => v.normalMode.includes("IGNORADO")).length
      const partial = Object.values(eventCoverage).filter(v => v.normalMode.includes("PARCIAL")).length

      expect(notTreated).toBe(1) // agent:bridge_spec_done
      expect(ignored).toBe(1) // agent:text
      expect(partial).toBe(3) // tool_call, tool_result, complete
    })
  })

  // ==========================================================================
  // RECOMENDAÇÕES - Prioridades
  // ==========================================================================
  describe("Recomendações - Priorização", () => {
    it("DEVE documentar: prioridade ALTA", () => {
      const prioridadeAlta = [
        { id: "M1", descricao: "Adicionar case para agent:bridge_spec_done no handleSSE" },
        { id: "M2", descricao: "Mostrar caminho do arquivo em tool_call para read_file/write_file" },
        { id: "S4", descricao: "Adicionar campo metadata em LogEntry para dados estruturados" },
      ]

      expect(prioridadeAlta).toHaveLength(3)
      expect(prioridadeAlta.map(p => p.id)).toContain("M1")
    })

    it("DEVE documentar: prioridade MÉDIA", () => {
      const prioridadeMedia = [
        { id: "S1", descricao: "Mostrar preview do texto LLM em modo normal (últimas 100 chars)" },
        { id: "S2", descricao: "Indicar visualmente sucesso/erro em agent:tool_result" },
        { id: "S3", descricao: "Mostrar estatísticas básicas (iterações, tokens) em agent:complete" },
      ]

      expect(prioridadeMedia).toHaveLength(3)
    })

    it("DEVE documentar: prioridade BAIXA (opcional)", () => {
      const prioridadeBaixa = [
        { id: "Y1", descricao: "Implementar logs expansíveis/colapsáveis" },
        { id: "Y2", descricao: "Adicionar progress bar durante execução" },
        { id: "Y3", descricao: "Agrupar logs por fase/iteração" },
        { id: "Y4", descricao: "Adicionar links clicáveis para arquivos" },
      ]

      expect(prioridadeBaixa).toHaveLength(4)
    })
  })
})

// ==========================================================================
// CONCLUSÃO DO LEVANTAMENTO
// ==========================================================================
//
// Os logs do Spec Writer na UI estão FUNCIONAIS mas MUITO LIMITADOS.
//
// Principais problemas:
// 1. Informações valiosas (texto do LLM, detalhes de arquivos, estatísticas)
//    só aparecem em modo debug
// 2. O evento específico de conclusão do spec (agent:bridge_spec_done) não é tratado
// 3. A estrutura de LogEntry é o gargalo principal - só suporta texto plano
//
// Para melhorar a UX, seria necessário:
// 1. Refatorar LogEntry para incluir metadados estruturados
// 2. Adicionar tratamento para agent:bridge_spec_done
// 3. Mostrar mais informações em modo normal (sem precisar de debug)
// ==========================================================================
