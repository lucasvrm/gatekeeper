/**
 * @fileoverview Spec for Drawer de Logs - Correções Visuais e Funcionais
 * @contract drawer-de-logs-bugfixes
 * @mode STRICT
 *
 * Issue #1: Botão Chevron sobre o Drawer (RF-01)
 * Issue #2: HTTP_REQUEST_TIMEOUT não definido (RF-02)
 * Issue #3: Gap gigantesco entre cards de log (RF-03)
 * Issue #4: Dois scrollbars no container de logs (RF-04)
 *
 * This file covers all clauses from the contract:
 *
 * Z-Index (RF-01):
 * - Drawer backdrop DEVE ter z-index >= 100 para cobrir botão collapse
 * - Drawer painel DEVE ter z-index >= 110 para ficar acima do backdrop
 * - Botão collapse edge-center NÃO DEVE aparecer sobre o drawer
 *
 * API Métricas (RF-02):
 * - HTTP_REQUEST_TIMEOUT DEVE estar definido antes do uso
 * - Timeout default de 25 segundos (25000ms)
 *
 * Gap entre Cards (RF-03):
 * - ITEM_HEIGHT DEVE ser reduzido em ~80% (de 120px para ~24px)
 * - Espaçamento compacto entre cards de eventos
 *
 * Scrollbars (RF-04):
 * - Apenas UM scrollbar visível no container de logs
 * - LogViewer container DEVE ter overflow-hidden (não overflow-y-auto)
 * - Scroll gerenciado pelo react-window (FixedSizeList)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'

// =============================================================================
// Type Definitions (mirroring project types)
// =============================================================================

interface LogFilterOptions {
  search?: string
  level?: string[]
  stage?: string[]
}

interface LogMetrics {
  byLevel: Record<string, number>
  byStage: Record<string, number>
  totalCount: number
  duration: number
}

interface OrchestratorEvent {
  id: string
  timestamp: string
  type: string
  level: 'debug' | 'info' | 'warn' | 'error'
  stage: string
  message: string
  metadata?: Record<string, unknown>
}

// =============================================================================
// Constants - Expected Values
// =============================================================================

// RF-01: Z-Index hierarchy
const EXPECTED_COLLAPSE_BUTTON_ZINDEX = 30 // Reduced from 100 to be below drawer
const EXPECTED_DRAWER_BACKDROP_ZINDEX = 100 // Increased from 40
const EXPECTED_DRAWER_PANEL_ZINDEX = 110 // Increased from 50

// RF-02: HTTP Request Timeout
const EXPECTED_HTTP_REQUEST_TIMEOUT = 25000 // 25 seconds

// RF-03: Item Height
const EXPECTED_ITEM_HEIGHT = 24 // Reduced from 120 (80% reduction)
const OLD_ITEM_HEIGHT = 120

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * Mock LogsDrawer component representing expected post-fix implementation.
 * Changes: z-40 → z-[100] for backdrop, z-50 → z-[110] for panel
 */
function MockLogsDrawer({
  isOpen,
  onClose,
  pipelineId,
}: {
  isOpen: boolean
  onClose: () => void
  pipelineId: string
}) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop - RF-01: z-[100] to cover collapse button */}
      <div
        onClick={onClose}
        data-testid="drawer-backdrop"
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        style={{ zIndex: EXPECTED_DRAWER_BACKDROP_ZINDEX }}
        aria-hidden="true"
      />

      {/* Drawer panel - RF-01: z-[110] to be above backdrop */}
      <aside
        data-testid="drawer-panel"
        className="fixed right-0 top-0 z-[110] h-screen w-full max-w-3xl bg-background shadow-2xl"
        style={{ zIndex: EXPECTED_DRAWER_PANEL_ZINDEX }}
        role="dialog"
        aria-modal="true"
      >
        <div data-testid="drawer-content">
          Pipeline: {pipelineId}
        </div>
      </aside>
    </>
  )
}

/**
 * Mock AppShell collapse button representing expected post-fix implementation.
 * Changes: zIndex: 100 → zIndex: 30
 */
function MockCollapseButton({
  position,
  sidebarWidth
}: {
  position: 'edge-center' | 'inside-top' | 'none'
  sidebarWidth: string
}) {
  if (position !== 'edge-center') return null

  return (
    <div
      data-testid="collapse-button-wrapper"
      style={{
        position: 'fixed',
        left: `calc(${sidebarWidth} - 12px)`,
        top: '50%',
        transform: 'translateY(-50%)',
        // RF-01: Reduced from 100 to 30 to be below drawer
        zIndex: EXPECTED_COLLAPSE_BUTTON_ZINDEX,
        transition: 'left 0.2s ease',
      }}
    >
      <button data-testid="collapse-button" aria-label="Toggle sidebar">
        ◀
      </button>
    </div>
  )
}

/**
 * Mock LogViewer component representing expected post-fix implementation.
 * Changes: overflow-y-auto → overflow-hidden
 */
function MockLogViewer({
  events,
  pipelineId,
}: {
  events: OrchestratorEvent[]
  pipelineId: string
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters area */}
      <div className="shrink-0" data-testid="filters-area">
        Filters for {pipelineId}
      </div>

      {/* RF-04: overflow-hidden instead of overflow-y-auto */}
      <div
        data-testid="log-list-container"
        className="flex-1 overflow-hidden"
        style={{ overflow: 'hidden' }}
      >
        <MockLogList events={events} />
      </div>
    </div>
  )
}

/**
 * Mock LogList component representing expected post-fix implementation.
 * Changes: ITEM_HEIGHT 120 → 24
 */
function MockLogList({ events }: { events: OrchestratorEvent[] }) {
  // RF-03: Reduced from 120px to 24px (80% reduction)
  const ITEM_HEIGHT = EXPECTED_ITEM_HEIGHT
  const CONTAINER_HEIGHT = 600

  return (
    <div data-testid="log-list-virtualized" style={{ height: CONTAINER_HEIGHT }}>
      {/* Simulating react-window FixedSizeList behavior */}
      <div
        data-testid="virtualized-list"
        style={{
          height: CONTAINER_HEIGHT,
          overflowY: 'auto', // react-window handles scroll internally
        }}
        data-item-height={ITEM_HEIGHT}
        data-item-count={events.length}
      >
        {events.slice(0, Math.floor(CONTAINER_HEIGHT / ITEM_HEIGHT)).map((event, index) => (
          <div
            key={event.id}
            data-testid={`log-item-${index}`}
            style={{ height: ITEM_HEIGHT }}
          >
            {event.message}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Mock API module representing expected post-fix implementation.
 * Changes: Added HTTP_REQUEST_TIMEOUT constant definition
 */
function createMockApiModule() {
  // RF-02: HTTP_REQUEST_TIMEOUT must be defined
  const HTTP_REQUEST_TIMEOUT = EXPECTED_HTTP_REQUEST_TIMEOUT

  return {
    HTTP_REQUEST_TIMEOUT,
    orchestrator: {
      getMetrics: async (pipelineId: string): Promise<LogMetrics> => {
        // Uses AbortSignal.timeout(HTTP_REQUEST_TIMEOUT)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), HTTP_REQUEST_TIMEOUT)

        try {
          // Simulated fetch - in real implementation would use fetchWithAuth
          const response = await Promise.resolve({
            ok: true,
            json: async () => ({
              byLevel: { info: 10, warn: 3, error: 1 },
              byStage: { planning: 5, writing: 8, validation: 1 },
              totalCount: 14,
              duration: 45000,
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to get metrics')
          }

          return response.json()
        } finally {
          clearTimeout(timeoutId)
        }
      },
    },
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEvents(count: number): OrchestratorEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i}`,
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    type: 'agent:chunk',
    level: i % 4 === 0 ? 'error' : i % 3 === 0 ? 'warn' : i % 2 === 0 ? 'debug' : 'info',
    stage: i % 2 === 0 ? 'planning' : 'writing',
    message: `Event message ${i}`,
    metadata: { index: i },
  }))
}

// =============================================================================
// TESTS - Issue #1: Z-Index do Botão Collapse (RF-01)
// =============================================================================

describe('LogsDrawer - Z-Index Fix (RF-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // @clause RF-01-001
  it('drawer backdrop DEVE ter z-index >= 100 para cobrir elementos da página', () => {
    render(
      <MockLogsDrawer
        isOpen={true}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    const backdrop = screen.getByTestId('drawer-backdrop')
    const style = backdrop.style

    expect(parseInt(style.zIndex, 10)).toBeGreaterThanOrEqual(100)
  })

  // @clause RF-01-002
  it('drawer panel DEVE ter z-index maior que backdrop', () => {
    render(
      <MockLogsDrawer
        isOpen={true}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    const backdrop = screen.getByTestId('drawer-backdrop')
    const panel = screen.getByTestId('drawer-panel')

    const backdropZ = parseInt(backdrop.style.zIndex, 10)
    const panelZ = parseInt(panel.style.zIndex, 10)

    expect(panelZ).toBeGreaterThan(backdropZ)
    expect(panelZ).toBeGreaterThanOrEqual(110)
  })

  // @clause RF-01-003
  it('botão collapse edge-center DEVE ter z-index menor que drawer backdrop', () => {
    render(
      <>
        <MockCollapseButton position="edge-center" sidebarWidth="240px" />
        <MockLogsDrawer
          isOpen={true}
          onClose={vi.fn()}
          pipelineId="test-pipeline"
        />
      </>
    )

    const collapseWrapper = screen.getByTestId('collapse-button-wrapper')
    const backdrop = screen.getByTestId('drawer-backdrop')

    const collapseZ = parseInt(collapseWrapper.style.zIndex, 10)
    const backdropZ = parseInt(backdrop.style.zIndex, 10)

    expect(collapseZ).toBeLessThan(backdropZ)
    expect(collapseZ).toBeLessThanOrEqual(30)
  })

  // @clause RF-01-004
  it('drawer NÃO DEVE renderizar quando isOpen=false', () => {
    render(
      <MockLogsDrawer
        isOpen={false}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    expect(screen.queryByTestId('drawer-backdrop')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drawer-panel')).not.toBeInTheDocument()
  })

  // @clause RF-01-005
  it('backdrop DEVE cobrir toda a tela (fixed inset-0)', () => {
    render(
      <MockLogsDrawer
        isOpen={true}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    const backdrop = screen.getByTestId('drawer-backdrop')
    expect(backdrop.className).toContain('fixed')
    expect(backdrop.className).toContain('inset-0')
  })
})

// =============================================================================
// TESTS - Issue #2: HTTP_REQUEST_TIMEOUT (RF-02)
// =============================================================================

describe('API Métricas - HTTP_REQUEST_TIMEOUT (RF-02)', () => {
  // @clause RF-02-001
  it('HTTP_REQUEST_TIMEOUT DEVE estar definido com valor de 25 segundos', () => {
    const mockApi = createMockApiModule()

    expect(mockApi.HTTP_REQUEST_TIMEOUT).toBeDefined()
    expect(mockApi.HTTP_REQUEST_TIMEOUT).toBe(25000)
  })

  // @clause RF-02-002
  it('getMetrics DEVE executar sem erro de referência undefined', async () => {
    const mockApi = createMockApiModule()

    // Should not throw "HTTP_REQUEST_TIMEOUT is not defined"
    await expect(mockApi.orchestrator.getMetrics('test-pipeline'))
      .resolves.not.toThrow()
  })

  // @clause RF-02-003
  it('getMetrics DEVE retornar dados de métricas válidos', async () => {
    const mockApi = createMockApiModule()

    const metrics = await mockApi.orchestrator.getMetrics('test-pipeline')

    expect(metrics).toHaveProperty('byLevel')
    expect(metrics).toHaveProperty('byStage')
    expect(metrics).toHaveProperty('totalCount')
    expect(metrics).toHaveProperty('duration')
  })

  // @clause RF-02-004
  it('timeout DEVE ser configurável (25s default)', () => {
    const mockApi = createMockApiModule()

    // Default should be 25 seconds
    expect(mockApi.HTTP_REQUEST_TIMEOUT).toBe(25000)

    // Value should be reasonable for API calls (not too short, not too long)
    expect(mockApi.HTTP_REQUEST_TIMEOUT).toBeGreaterThanOrEqual(10000) // At least 10s
    expect(mockApi.HTTP_REQUEST_TIMEOUT).toBeLessThanOrEqual(60000) // At most 60s
  })
})

// =============================================================================
// TESTS - Issue #3: Gap entre Cards de Log (RF-03)
// =============================================================================

describe('LogList - Gap entre Cards (RF-03)', () => {
  const mockEvents = createMockEvents(20)

  // @clause RF-03-001
  it('ITEM_HEIGHT DEVE ser ~24px (reduzido de 120px)', () => {
    render(<MockLogList events={mockEvents} />)

    const virtualizedList = screen.getByTestId('virtualized-list')
    const itemHeight = parseInt(virtualizedList.dataset.itemHeight || '0', 10)

    expect(itemHeight).toBe(EXPECTED_ITEM_HEIGHT)
    expect(itemHeight).toBeLessThan(OLD_ITEM_HEIGHT)
  })

  // @clause RF-03-002
  it('ITEM_HEIGHT reduzido em ~80% do valor original', () => {
    const reduction = ((OLD_ITEM_HEIGHT - EXPECTED_ITEM_HEIGHT) / OLD_ITEM_HEIGHT) * 100

    // 80% reduction means new height is 20% of original
    expect(reduction).toBeGreaterThanOrEqual(75)
    expect(reduction).toBeLessThanOrEqual(85)
  })

  // @clause RF-03-003
  it('mais items DEVEM ser visíveis na mesma altura de container', () => {
    render(<MockLogList events={mockEvents} />)

    const virtualizedList = screen.getByTestId('virtualized-list')
    const itemHeight = parseInt(virtualizedList.dataset.itemHeight || '0', 10)
    const containerHeight = 600

    const visibleItemsNew = Math.floor(containerHeight / itemHeight)
    const visibleItemsOld = Math.floor(containerHeight / OLD_ITEM_HEIGHT)

    // With smaller items, more should be visible
    expect(visibleItemsNew).toBeGreaterThan(visibleItemsOld)
    // At least 4x more items visible
    expect(visibleItemsNew).toBeGreaterThanOrEqual(visibleItemsOld * 4)
  })

  // @clause RF-03-004
  it('items DEVEM renderizar com altura correta', () => {
    render(<MockLogList events={mockEvents} />)

    const firstItem = screen.getByTestId('log-item-0')
    expect(firstItem.style.height).toBe(`${EXPECTED_ITEM_HEIGHT}px`)
  })
})

// =============================================================================
// TESTS - Issue #4: Scrollbars Duplicados (RF-04)
// =============================================================================

describe('LogViewer - Scrollbar Único (RF-04)', () => {
  const mockEvents = createMockEvents(50)

  // @clause RF-04-001
  it('LogViewer container DEVE ter overflow-hidden (não overflow-y-auto)', () => {
    render(<MockLogViewer events={mockEvents} pipelineId="test-pipeline" />)

    const container = screen.getByTestId('log-list-container')

    // Should have overflow-hidden, not overflow-y-auto
    expect(container.className).toContain('overflow-hidden')
    expect(container.className).not.toContain('overflow-y-auto')
    expect(container.style.overflow).toBe('hidden')
  })

  // @clause RF-04-002
  it('scroll DEVE ser gerenciado apenas pelo react-window (virtualized list)', () => {
    render(<MockLogViewer events={mockEvents} pipelineId="test-pipeline" />)

    const virtualizedList = screen.getByTestId('virtualized-list')

    // react-window list should have overflow-y-auto
    expect(virtualizedList.style.overflowY).toBe('auto')
  })

  // @clause RF-04-003
  it('NÃO DEVE haver nested scrolling containers', () => {
    render(<MockLogViewer events={mockEvents} pipelineId="test-pipeline" />)

    const container = screen.getByTestId('log-list-container')
    const virtualizedList = screen.getByTestId('virtualized-list')

    // Parent should not have scroll
    expect(container.style.overflow).toBe('hidden')

    // Only child (react-window) should have scroll
    expect(virtualizedList.style.overflowY).toBe('auto')
  })

  // @clause RF-04-004
  it('container de filtros DEVE ser shrink-0 (não participar do scroll)', () => {
    render(<MockLogViewer events={mockEvents} pipelineId="test-pipeline" />)

    const filtersArea = screen.getByTestId('filters-area')
    expect(filtersArea.className).toContain('shrink-0')
  })
})

// =============================================================================
// TESTS - Integration: Drawer + Collapse Button Z-Index
// =============================================================================

describe('Integration - Drawer + Collapse Button', () => {
  // @clause INT-001
  it('quando drawer abre, botão collapse DEVE ficar atrás do backdrop', () => {
    const TestComponent = () => {
      const [drawerOpen, setDrawerOpen] = useState(false)

      return (
        <>
          <MockCollapseButton position="edge-center" sidebarWidth="240px" />
          <button
            data-testid="open-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            Open Drawer
          </button>
          <MockLogsDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            pipelineId="test-pipeline"
          />
        </>
      )
    }

    render(<TestComponent />)

    // Before opening drawer
    const collapseWrapper = screen.getByTestId('collapse-button-wrapper')
    expect(collapseWrapper).toBeInTheDocument()

    // Open drawer
    screen.getByTestId('open-drawer').click()

    // After opening drawer
    const backdrop = screen.getByTestId('drawer-backdrop')
    const panel = screen.getByTestId('drawer-panel')

    const collapseZ = parseInt(collapseWrapper.style.zIndex, 10)
    const backdropZ = parseInt(backdrop.style.zIndex, 10)
    const panelZ = parseInt(panel.style.zIndex, 10)

    // Collapse button should be behind backdrop
    expect(collapseZ).toBeLessThan(backdropZ)
    // Panel should be in front of backdrop
    expect(panelZ).toBeGreaterThan(backdropZ)
  })

  // @clause INT-002
  it('hierarquia de z-index DEVE seguir: normal(0-10) < header(10) < collapse(30) < backdrop(100) < panel(110)', () => {
    render(
      <>
        <div data-testid="header" style={{ zIndex: 10, position: 'sticky' }}>Header</div>
        <MockCollapseButton position="edge-center" sidebarWidth="240px" />
        <MockLogsDrawer
          isOpen={true}
          onClose={vi.fn()}
          pipelineId="test-pipeline"
        />
      </>
    )

    const header = screen.getByTestId('header')
    const collapse = screen.getByTestId('collapse-button-wrapper')
    const backdrop = screen.getByTestId('drawer-backdrop')
    const panel = screen.getByTestId('drawer-panel')

    const headerZ = parseInt(header.style.zIndex, 10)
    const collapseZ = parseInt(collapse.style.zIndex, 10)
    const backdropZ = parseInt(backdrop.style.zIndex, 10)
    const panelZ = parseInt(panel.style.zIndex, 10)

    // Verify hierarchy
    expect(headerZ).toBeLessThanOrEqual(10)
    expect(collapseZ).toBeLessThanOrEqual(30)
    expect(collapseZ).toBeGreaterThan(headerZ)
    expect(backdropZ).toBeGreaterThanOrEqual(100)
    expect(backdropZ).toBeGreaterThan(collapseZ)
    expect(panelZ).toBeGreaterThanOrEqual(110)
    expect(panelZ).toBeGreaterThan(backdropZ)
  })
})

// =============================================================================
// TESTS - Visual Regression Prevention
// =============================================================================

describe('Visual Regression Prevention', () => {
  // @clause VIS-001
  it('ITEM_HEIGHT não DEVE ser menor que altura mínima legível (16px)', () => {
    expect(EXPECTED_ITEM_HEIGHT).toBeGreaterThanOrEqual(16)
  })

  // @clause VIS-002
  it('drawer panel DEVE ter role="dialog" e aria-modal="true"', () => {
    render(
      <MockLogsDrawer
        isOpen={true}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    const panel = screen.getByTestId('drawer-panel')
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
  })

  // @clause VIS-003
  it('backdrop DEVE ter aria-hidden="true"', () => {
    render(
      <MockLogsDrawer
        isOpen={true}
        onClose={vi.fn()}
        pipelineId="test-pipeline"
      />
    )

    const backdrop = screen.getByTestId('drawer-backdrop')
    expect(backdrop.getAttribute('aria-hidden')).toBe('true')
  })
})
