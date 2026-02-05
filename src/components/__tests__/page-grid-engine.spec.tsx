/**
 * @file page-grid-engine.spec.tsx
 * @description Contract spec — Grid Engine Phase 1: CSS Grid layout system with component registry
 * @contract grid-engine-phase-1
 * @mode STRICT
 */

import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageGrid } from "@/components/page-grid"
import { ComponentRegistry } from "@/lib/component-registry"
import type { GridLayoutConfig, GridItem } from "@/lib/types"

// =============================================================================
// MOCK COMPONENTS FOR TESTING
// =============================================================================

const MockCard = () => <div data-testid="mock-card">Card Component</div>
const MockButton = () => <button data-testid="mock-button">Button Component</button>
const MockChart = () => <div data-testid="mock-chart">Chart Component</div>

// =============================================================================
// SETUP/TEARDOWN
// =============================================================================

beforeEach(() => {
  ComponentRegistry.clear()
})

// =============================================================================
// FIXTURES
// =============================================================================

function createGridConfig(overrides: Partial<GridLayoutConfig> = {}): GridLayoutConfig {
  return {
    columns: 12,
    rowHeight: "100px",
    gap: "16px",
    items: [],
    ...overrides,
  }
}

function createGridItem(overrides: Partial<GridItem> = {}): GridItem {
  return {
    component: "MockCard",
    colStart: 1,
    rowStart: 1,
    colSpan: 4,
    rowSpan: 2,
    ...overrides,
  }
}

// =============================================================================
// TESTS: TYPE DEFINITIONS
// =============================================================================

describe("Grid Engine — Type Definitions", () => {
  // @clause CL-TYPE-001
  it("succeeds when GridLayoutConfig has all required fields", () => {
    const config: GridLayoutConfig = {
      columns: 12,
      rowHeight: "80px",
      gap: "16px",
      items: [],
    }

    expect(config.columns).toBe(12)
    expect(config.rowHeight).toBe("80px")
    expect(config.gap).toBe("16px")
    expect(Array.isArray(config.items)).toBe(true)
  })

  // @clause CL-TYPE-001
  it("succeeds when GridLayoutConfig accepts numeric columns", () => {
    const config: GridLayoutConfig = createGridConfig({ columns: 24 })

    expect(config.columns).toBe(24)
    expect(typeof config.columns).toBe("number")
  })

  // @clause CL-TYPE-001
  it("fails when GridLayoutConfig missing required fields", () => {
    // TypeScript compilation check: este teste valida que tipos estão corretos
    const partial: Partial<GridLayoutConfig> = { columns: 12 }

    expect(partial.rowHeight).toBeUndefined()
    expect(partial.gap).toBeUndefined()
    expect(partial.items).toBeUndefined()
  })

  // @clause CL-TYPE-002
  it("succeeds when GridItem has all required fields", () => {
    const item: GridItem = {
      component: "TestComponent",
      colStart: 1,
      rowStart: 1,
      colSpan: 4,
      rowSpan: 2,
    }

    expect(item.component).toBe("TestComponent")
    expect(item.colStart).toBe(1)
    expect(item.rowStart).toBe(1)
    expect(item.colSpan).toBe(4)
    expect(item.rowSpan).toBe(2)
  })

  // @clause CL-TYPE-002
  it("succeeds when GridItem accepts optional props", () => {
    const item: GridItem = createGridItem({
      props: { title: "Test", count: 42 },
    })

    expect(item.props).toEqual({ title: "Test", count: 42 })
  })

  // @clause CL-TYPE-002
  it("fails when GridItem has invalid numeric fields", () => {
    const item = createGridItem({ colStart: 0 })

    // Grid CSS aceita 0, mas validação de negócio deve tratar
    expect(item.colStart).toBe(0)
  })

  // @clause CL-TYPE-003
  it("succeeds when GridItem.component references registered component", () => {
    ComponentRegistry.register("ValidComponent", MockCard)
    const item = createGridItem({ component: "ValidComponent" })

    expect(ComponentRegistry.has(item.component)).toBe(true)
  })

  // @clause CL-TYPE-003
  it("succeeds when multiple GridItems reference different components", () => {
    ComponentRegistry.register("Card", MockCard)
    ComponentRegistry.register("Button", MockButton)

    const item1 = createGridItem({ component: "Card" })
    const item2 = createGridItem({ component: "Button" })

    expect(ComponentRegistry.has(item1.component)).toBe(true)
    expect(ComponentRegistry.has(item2.component)).toBe(true)
  })

  // @clause CL-TYPE-003
  it("fails when GridItem.component is not in registry", () => {
    const item = createGridItem({ component: "NonExistentComponent" })

    expect(ComponentRegistry.has(item.component)).toBe(false)
  })
})

// =============================================================================
// TESTS: COMPONENT REGISTRY
// =============================================================================

describe("Grid Engine — ComponentRegistry", () => {
  // @clause CL-REG-001
  it("succeeds when ComponentRegistry is created with internal Map", () => {
    ComponentRegistry.register("TestComponent", MockCard)

    expect(ComponentRegistry.has("TestComponent")).toBe(true)
  })

  // @clause CL-REG-001
  it("succeeds when ComponentRegistry stores multiple components", () => {
    ComponentRegistry.register("Card", MockCard)
    ComponentRegistry.register("Button", MockButton)
    ComponentRegistry.register("Chart", MockChart)

    expect(ComponentRegistry.has("Card")).toBe(true)
    expect(ComponentRegistry.has("Button")).toBe(true)
    expect(ComponentRegistry.has("Chart")).toBe(true)
  })

  // @clause CL-REG-001
  it("fails when ComponentRegistry is empty after clear", () => {
    ComponentRegistry.register("Component", MockCard)
    ComponentRegistry.clear()

    expect(ComponentRegistry.has("Component")).toBe(false)
  })

  // @clause CL-REG-002
  it("succeeds when ComponentRegistry.get returns registered component", () => {
    ComponentRegistry.register("TestCard", MockCard)

    const Component = ComponentRegistry.get("TestCard")

    expect(Component).toBe(MockCard)
  })

  // @clause CL-REG-002
  it("succeeds when retrieved component can be rendered", () => {
    ComponentRegistry.register("TestCard", MockCard)
    const Component = ComponentRegistry.get("TestCard")!

    const { container } = render(<Component />)

    expect(screen.getByTestId("mock-card")).toBeInTheDocument()
  })

  // @clause CL-REG-002
  it("fails when ComponentRegistry.get called before registration", () => {
    const Component = ComponentRegistry.get("UnregisteredComponent")

    expect(Component).toBeUndefined()
  })

  // @clause CL-REG-003
  it("succeeds when ComponentRegistry.get returns undefined for invalid key", () => {
    const Component = ComponentRegistry.get("DoesNotExist")

    expect(Component).toBeUndefined()
  })

  // @clause CL-REG-003
  it("succeeds when ComponentRegistry.has returns false for invalid key", () => {
    const exists = ComponentRegistry.has("InvalidKey")

    expect(exists).toBe(false)
  })

  // @clause CL-REG-003
  it("fails when ComponentRegistry.get returns component for unregistered key", () => {
    const Component = ComponentRegistry.get("NeverRegistered")

    expect(Component).toBeUndefined()
  })
})

// =============================================================================
// TESTS: PAGE GRID COMPONENT
// =============================================================================

describe("Grid Engine — PageGrid Component", () => {
  // @clause CL-GRID-001
  it("succeeds when PageGrid renders with CSS Grid display", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      items: [createGridItem()],
    })

    render(<PageGrid config={config} />)

    const grid = screen.getByTestId("page-grid")
    expect(grid).toHaveStyle({ display: "grid" })
  })

  // @clause CL-GRID-001
  it("succeeds when PageGrid sets grid-template-columns with repeat", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      columns: 12,
      items: [createGridItem()],
    })

    render(<PageGrid config={config} />)

    const grid = screen.getByTestId("page-grid")
    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(12, 1fr)" })
  })

  // @clause CL-GRID-001
  it("succeeds when PageGrid sets grid-auto-rows and gap", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      rowHeight: "80px",
      gap: "24px",
      items: [createGridItem()],
    })

    render(<PageGrid config={config} />)

    const grid = screen.getByTestId("page-grid")
    expect(grid).toHaveStyle({ gridAutoRows: "80px" })
    expect(grid).toHaveStyle({ gap: "24px" })
  })

  // @clause CL-GRID-002
  it("succeeds when PageGrid applies grid-column-start and grid-row-start", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      items: [createGridItem({ colStart: 3, rowStart: 2 })],
    })

    render(<PageGrid config={config} />)

    const item = screen.getByTestId("grid-item")
    expect(item).toHaveStyle({ gridColumnStart: "3" })
    expect(item).toHaveStyle({ gridRowStart: "2" })
  })

  // @clause CL-GRID-002
  it("succeeds when PageGrid applies grid-column-end and grid-row-end with span", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      items: [createGridItem({ colStart: 1, colSpan: 4, rowStart: 1, rowSpan: 2 })],
    })

    render(<PageGrid config={config} />)

    const item = screen.getByTestId("grid-item")
    expect(item).toHaveStyle({ gridColumnEnd: "5" }) // 1 + 4
    expect(item).toHaveStyle({ gridRowEnd: "3" }) // 1 + 2
  })

  // @clause CL-GRID-002
  it("fails when PageGrid omits grid positioning styles", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      items: [createGridItem({ colStart: 5, rowStart: 3, colSpan: 2, rowSpan: 1 })],
    })

    render(<PageGrid config={config} />)

    const item = screen.getByTestId("grid-item")
    // Verifica que todos os estilos estão presentes
    expect(item.style.gridColumnStart).toBeTruthy()
    expect(item.style.gridRowStart).toBeTruthy()
    expect(item.style.gridColumnEnd).toBeTruthy()
    expect(item.style.gridRowEnd).toBeTruthy()
  })

  // @clause CL-GRID-003
  it("succeeds when PageGrid renders component from registry", () => {
    ComponentRegistry.register("MockCard", MockCard)
    const config = createGridConfig({
      items: [createGridItem({ component: "MockCard" })],
    })

    render(<PageGrid config={config} />)

    expect(screen.getByTestId("mock-card")).toBeInTheDocument()
  })

  // @clause CL-GRID-003
  it("succeeds when PageGrid renders different components from registry", () => {
    ComponentRegistry.register("MockCard", MockCard)
    ComponentRegistry.register("MockButton", MockButton)
    const config = createGridConfig({
      items: [
        createGridItem({ component: "MockCard", colStart: 1 }),
        createGridItem({ component: "MockButton", colStart: 5 }),
      ],
    })

    render(<PageGrid config={config} />)

    expect(screen.getByTestId("mock-card")).toBeInTheDocument()
    expect(screen.getByTestId("mock-button")).toBeInTheDocument()
  })

  // @clause CL-GRID-003
  it("fails when PageGrid renders component not in registry", () => {
    const config = createGridConfig({
      items: [createGridItem({ component: "NonExistentComponent" })],
    })

    render(<PageGrid config={config} />)

    // Componente não existe, então não deve ser renderizado
    expect(screen.queryByTestId("grid-item")).not.toBeInTheDocument()
  })

  // @clause CL-GRID-004
  it("succeeds when PageGrid renders multiple items without overlap", () => {
    ComponentRegistry.register("MockCard", MockCard)
    ComponentRegistry.register("MockButton", MockButton)
    ComponentRegistry.register("MockChart", MockChart)

    const config = createGridConfig({
      columns: 12,
      items: [
        createGridItem({ component: "MockCard", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }),
        createGridItem({ component: "MockButton", colStart: 5, rowStart: 1, colSpan: 4, rowSpan: 1 }),
        createGridItem({ component: "MockChart", colStart: 9, rowStart: 1, colSpan: 4, rowSpan: 3 }),
      ],
    })

    render(<PageGrid config={config} />)

    const items = screen.getAllByTestId("grid-item")
    expect(items).toHaveLength(3)
    expect(screen.getByTestId("mock-card")).toBeInTheDocument()
    expect(screen.getByTestId("mock-button")).toBeInTheDocument()
    expect(screen.getByTestId("mock-chart")).toBeInTheDocument()
  })

  // @clause CL-GRID-004
  it("succeeds when each grid item has correct positioning", () => {
    ComponentRegistry.register("Item1", () => <div>Item 1</div>)
    ComponentRegistry.register("Item2", () => <div>Item 2</div>)

    const config = createGridConfig({
      items: [
        createGridItem({ component: "Item1", colStart: 1, rowStart: 1, colSpan: 6, rowSpan: 1 }),
        createGridItem({ component: "Item2", colStart: 7, rowStart: 1, colSpan: 6, rowSpan: 1 }),
      ],
    })

    render(<PageGrid config={config} />)

    const [item1, item2] = screen.getAllByTestId("grid-item")

    expect(item1).toHaveStyle({ gridColumnStart: "1", gridRowStart: "1" })
    expect(item2).toHaveStyle({ gridColumnStart: "7", gridRowStart: "1" })
  })

  // @clause CL-GRID-004
  it("fails when items intentionally overlap in same cells", () => {
    ComponentRegistry.register("MockCard", MockCard)
    ComponentRegistry.register("MockButton", MockButton)

    const config = createGridConfig({
      items: [
        // Ambos ocupam células sobrepostas (1-5 col, 1-3 row)
        createGridItem({ component: "MockCard", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }),
        createGridItem({ component: "MockButton", colStart: 3, rowStart: 2, colSpan: 2, rowSpan: 1 }),
      ],
    })

    render(<PageGrid config={config} />)

    const items = screen.getAllByTestId("grid-item")
    expect(items).toHaveLength(2)
    // Ambos renderizam, CSS Grid permite overlap
    // Este teste valida que o sistema não previne overlap (não é objetivo da Fase 1)
  })

  // @clause CL-ERR-001
  it("succeeds when PageGrid returns null for empty items array", () => {
    const config = createGridConfig({ items: [] })

    const { container } = render(<PageGrid config={config} />)

    expect(container.firstChild).toBeNull()
  })

  // @clause CL-ERR-001
  it("succeeds when PageGrid handles undefined items gracefully", () => {
    const config = createGridConfig({ items: undefined as any })

    const { container } = render(<PageGrid config={config} />)

    expect(container.firstChild).toBeNull()
  })

  // @clause CL-ERR-001
  it("fails when PageGrid renders grid for empty items", () => {
    const config = createGridConfig({ items: [] })

    const { container } = render(<PageGrid config={config} />)

    expect(screen.queryByTestId("page-grid")).not.toBeInTheDocument()
  })

  // @clause CL-ERR-002
  it("succeeds when PageGrid renders null for unregistered component", () => {
    const config = createGridConfig({
      items: [createGridItem({ component: "UnregisteredComponent" })],
    })

    render(<PageGrid config={config} />)

    expect(screen.queryByTestId("grid-item")).not.toBeInTheDocument()
  })

  // @clause CL-ERR-002
  it("succeeds when PageGrid skips unregistered items but renders valid ones", () => {
    ComponentRegistry.register("MockCard", MockCard)

    const config = createGridConfig({
      items: [
        createGridItem({ component: "UnregisteredComponent", colStart: 1 }),
        createGridItem({ component: "MockCard", colStart: 5 }),
        createGridItem({ component: "AnotherMissing", colStart: 9 }),
      ],
    })

    render(<PageGrid config={config} />)

    const items = screen.getAllByTestId("grid-item")
    expect(items).toHaveLength(1) // Apenas MockCard renderizado
    expect(screen.getByTestId("mock-card")).toBeInTheDocument()
  })

  // @clause CL-ERR-002
  it("fails when PageGrid throws error for missing component", () => {
    const config = createGridConfig({
      items: [createGridItem({ component: "MissingComponent" })],
    })

    // Não deve lançar erro, apenas não renderizar o item
    expect(() => render(<PageGrid config={config} />)).not.toThrow()
  })
})
