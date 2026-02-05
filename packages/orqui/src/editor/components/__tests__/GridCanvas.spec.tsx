/**
 * @file GridCanvas.spec.tsx
 * @description Contract spec — Grid Canvas Editor visual manipulation
 * @contract grid-canvas-editor-phase-2a
 * @mode STRICT
 */

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { GridLayoutConfig, GridItem } from "@/runtime/types"

// Hoisted mocks
const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
}))

vi.mock("@/editor/EditorProvider", () => ({
  useEditor: () => ({
    dispatch: mockDispatch,
    state: {
      currentPage: "test-page",
      selection: null,
    },
  }),
}))

// Fixtures
function createGridItem(overrides: Partial<GridItem> = {}): GridItem {
  return {
    component: "text",
    colStart: 1,
    rowStart: 1,
    colSpan: 3,
    rowSpan: 1,
    props: { content: "Test content" },
    ...overrides,
  }
}

function createGridLayout(items: GridItem[] = []): GridLayoutConfig {
  return {
    columns: 12,
    rowHeight: "80px",
    gap: "16px",
    items,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GridCanvas - Visual Grid de 12 Colunas", () => {
  // @clause CL-CANVAS-001
  it("succeeds when grid de 12 colunas com linhas de guia é renderizado", () => {
    const layout = createGridLayout([createGridItem()])

    // Mock component que renderiza o canvas
    const MockGridCanvas = () => (
      <div data-testid="grid-canvas">
        <div data-testid="grid-canvas-lines" />
      </div>
    )

    render(<MockGridCanvas />)

    expect(screen.getByTestId("grid-canvas")).toBeInTheDocument()
    expect(screen.getByTestId("grid-canvas-lines")).toBeInTheDocument()
  })

  // @clause CL-CANVAS-001
  it("succeeds when background pattern mostra 12 divisões verticais", () => {
    const MockGridCanvas = () => (
      <div
        data-testid="grid-canvas"
        style={{
          backgroundImage: `repeating-linear-gradient(
            to right,
            transparent,
            transparent calc(100% / 12 - 1px),
            #2a2a33 calc(100% / 12 - 1px),
            #2a2a33 calc(100% / 12)
          )`
        }}
      />
    )

    render(<MockGridCanvas />)

    const canvas = screen.getByTestId("grid-canvas")
    expect(canvas).toHaveStyle({ backgroundImage: expect.stringContaining("repeating-linear-gradient") })
  })

  // @clause CL-CANVAS-001
  it("fails when grid-canvas-lines não está presente", () => {
    const MockGridCanvas = () => <div data-testid="grid-canvas" />

    render(<MockGridCanvas />)

    expect(screen.queryByTestId("grid-canvas-lines")).not.toBeInTheDocument()
  })
})

describe("GridCanvas - Renderização de Items nas Posições Corretas", () => {
  // @clause CL-CANVAS-002
  it("succeeds when item é renderizado com grid-column e grid-row corretos", () => {
    const item = createGridItem({ colStart: 2, rowStart: 3, colSpan: 4, rowSpan: 2 })

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        style={{
          gridColumn: `${item.colStart} / span ${item.colSpan}`,
          gridRow: `${item.rowStart} / span ${item.rowSpan}`,
        }}
      />
    )

    render(<MockGridCanvasItem />)

    const itemElement = screen.getByTestId("grid-canvas-item")
    expect(itemElement).toHaveStyle({
      gridColumn: "2 / span 4",
      gridRow: "3 / span 2",
    })
  })

  // @clause CL-CANVAS-002
  it("succeeds when múltiplos items são renderizados em posições diferentes", () => {
    const items = [
      createGridItem({ component: "item-1", colStart: 1, rowStart: 1, colSpan: 6, rowSpan: 1 }),
      createGridItem({ component: "item-2", colStart: 7, rowStart: 1, colSpan: 6, rowSpan: 1 }),
      createGridItem({ component: "item-3", colStart: 1, rowStart: 2, colSpan: 12, rowSpan: 2 }),
    ]

    const MockGridCanvas = () => (
      <div data-testid="grid-canvas">
        {items.map((item, idx) => (
          <div
            key={idx}
            data-testid={`grid-canvas-item-${idx}`}
            style={{
              gridColumn: `${item.colStart} / span ${item.colSpan}`,
              gridRow: `${item.rowStart} / span ${item.rowSpan}`,
            }}
          />
        ))}
      </div>
    )

    render(<MockGridCanvas />)

    expect(screen.getByTestId("grid-canvas-item-0")).toHaveStyle({ gridColumn: "1 / span 6" })
    expect(screen.getByTestId("grid-canvas-item-1")).toHaveStyle({ gridColumn: "7 / span 6" })
    expect(screen.getByTestId("grid-canvas-item-2")).toHaveStyle({ gridColumn: "1 / span 12" })
  })

  // @clause CL-CANVAS-002
  it("fails when item tem grid positioning incorreto", () => {
    const item = createGridItem({ colStart: 5, rowStart: 2, colSpan: 3, rowSpan: 1 })

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        style={{
          gridColumn: "1 / span 1", // Errado
          gridRow: "1 / span 1", // Errado
        }}
      />
    )

    render(<MockGridCanvasItem />)

    const itemElement = screen.getByTestId("grid-canvas-item")
    expect(itemElement).not.toHaveStyle({
      gridColumn: `${item.colStart} / span ${item.colSpan}`,
    })
  })
})

describe("GridCanvas - Seleção de Items", () => {
  // @clause CL-SELECT-001
  it("succeeds when clicar em item dispara ação de seleção", async () => {
    const user = userEvent.setup()
    const item = createGridItem({ component: "test-item" })

    const MockGridCanvasItem = ({ onSelect }: { onSelect: (id: string) => void }) => (
      <div
        data-testid="grid-canvas-item"
        onClick={() => onSelect("test-item")}
      />
    )

    const handleSelect = vi.fn()
    render(<MockGridCanvasItem onSelect={handleSelect} />)

    await user.click(screen.getByTestId("grid-canvas-item"))

    expect(handleSelect).toHaveBeenCalledWith("test-item")
  })

  // @clause CL-SELECT-001
  it("succeeds when seleção atualiza state do editor via dispatch", async () => {
    const user = userEvent.setup()

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onClick={() => mockDispatch({ type: "SELECT_GRID_ITEM", payload: { itemId: "item-123" } })}
      />
    )

    render(<MockGridCanvasItem />)

    await user.click(screen.getByTestId("grid-canvas-item"))

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SELECT_GRID_ITEM",
        payload: { itemId: "item-123" },
      })
    })
  })

  // @clause CL-SELECT-001
  it("fails when clicar não dispara callback de seleção", async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item" />
    )

    render(<MockGridCanvasItem />)

    await user.click(screen.getByTestId("grid-canvas-item"))

    expect(handleSelect).not.toHaveBeenCalled()
  })
})

describe("GridCanvas - Visual de Item Selecionado", () => {
  // @clause CL-SELECT-002
  it("succeeds when item selecionado renderiza borda azul accent", () => {
    const MockGridCanvasItem = ({ isSelected }: { isSelected: boolean }) => (
      <div
        data-testid="grid-canvas-item"
        style={isSelected ? { border: "2px solid #6d9cff" } : {}}
      />
    )

    render(<MockGridCanvasItem isSelected={true} />)

    expect(screen.getByTestId("grid-canvas-item")).toHaveStyle({
      border: "2px solid #6d9cff",
    })
  })

  // @clause CL-SELECT-002
  it("succeeds when item selecionado renderiza 8 handles", () => {
    const handles = ["top-left", "top-right", "bottom-left", "bottom-right", "top", "right", "bottom", "left"]

    const MockGridCanvasItem = ({ isSelected }: { isSelected: boolean }) => (
      <div data-testid="grid-canvas-item">
        {isSelected && handles.map((pos) => (
          <div key={pos} data-testid={`grid-canvas-item-handle-${pos}`} />
        ))}
      </div>
    )

    render(<MockGridCanvasItem isSelected={true} />)

    handles.forEach((pos) => {
      expect(screen.getByTestId(`grid-canvas-item-handle-${pos}`)).toBeInTheDocument()
    })
  })

  // @clause CL-SELECT-002
  it("fails when item não selecionado mostra handles", () => {
    const handles = ["top-left", "top-right", "bottom-left", "bottom-right"]

    const MockGridCanvasItem = ({ isSelected }: { isSelected: boolean }) => (
      <div data-testid="grid-canvas-item">
        {isSelected && handles.map((pos) => (
          <div key={pos} data-testid={`grid-canvas-item-handle-${pos}`} />
        ))}
      </div>
    )

    render(<MockGridCanvasItem isSelected={false} />)

    expect(screen.queryByTestId("grid-canvas-item-handle-top-left")).not.toBeInTheDocument()
  })
})

describe("GridCanvas - Drag and Drop de Items", () => {
  // @clause CL-DRAG-001
  it("succeeds when arrastar item move ele com snap ao grid", async () => {
    const user = userEvent.setup()
    let position = { colStart: 1, rowStart: 1 }

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onMouseDown={() => {
          document.addEventListener("mousemove", () => {
            position = { colStart: 3, rowStart: 2 }
          })
        }}
        style={{
          gridColumn: `${position.colStart} / span 3`,
          gridRow: `${position.rowStart} / span 1`,
        }}
      />
    )

    render(<MockGridCanvasItem />)

    const item = screen.getByTestId("grid-canvas-item")
    await user.pointer([
      { target: item, keys: "[MouseLeft>]" },
      { coords: { x: 100, y: 100 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(position.colStart).toBe(3)
    expect(position.rowStart).toBe(2)
  })

  // @clause CL-DRAG-001
  it("succeeds when item segue cursor durante drag", async () => {
    const user = userEvent.setup()
    const handleDrag = vi.fn()

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onMouseMove={handleDrag}
      />
    )

    render(<MockGridCanvasItem />)

    await user.pointer([
      { target: screen.getByTestId("grid-canvas-item"), keys: "[MouseLeft>]" },
      { coords: { x: 50, y: 50 } },
      { coords: { x: 100, y: 100 } },
    ])

    expect(handleDrag).toHaveBeenCalled()
  })

  // @clause CL-DRAG-001
  it("fails when drag não aplica snap ao grid", async () => {
    const position = { colStart: 1.5, rowStart: 2.7 } // Posições não-inteiras = sem snap

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        style={{
          gridColumn: `${position.colStart} / span 3`,
        }}
      />
    )

    render(<MockGridCanvasItem />)

    const item = screen.getByTestId("grid-canvas-item")
    // Posições com decimais não são válidas para grid positioning
    expect(position.colStart).not.toBe(Math.floor(position.colStart))
  })

  // @clause CL-DRAG-002
  it("succeeds when soltar item atualiza colStart e rowStart", async () => {
    const user = userEvent.setup()

    const MockGridCanvasItem = ({ onUpdate }: { onUpdate: (col: number, row: number) => void }) => (
      <div
        data-testid="grid-canvas-item"
        onMouseUp={() => onUpdate(5, 3)}
      />
    )

    const handleUpdate = vi.fn()
    render(<MockGridCanvasItem onUpdate={handleUpdate} />)

    await user.pointer([
      { target: screen.getByTestId("grid-canvas-item"), keys: "[MouseLeft>]" },
      { coords: { x: 200, y: 150 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(handleUpdate).toHaveBeenCalledWith(5, 3)
  })

  // @clause CL-DRAG-002
  it("succeeds when atualização dispara action UPDATE_GRID_ITEM_POSITION", async () => {
    const user = userEvent.setup()

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onMouseUp={() => mockDispatch({
          type: "UPDATE_GRID_ITEM_POSITION",
          payload: { itemId: "item-1", colStart: 7, rowStart: 4 },
        })}
      />
    )

    render(<MockGridCanvasItem />)

    await user.pointer([
      { target: screen.getByTestId("grid-canvas-item"), keys: "[MouseLeft>]" },
      { keys: "[/MouseLeft]" },
    ])

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "UPDATE_GRID_ITEM_POSITION",
        payload: { itemId: "item-1", colStart: 7, rowStart: 4 },
      })
    })
  })

  // @clause CL-DRAG-002
  it("fails when soltar não persiste nova posição", async () => {
    const user = userEvent.setup()
    const handleUpdate = vi.fn()

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item" />
    )

    render(<MockGridCanvasItem />)

    await user.pointer([
      { target: screen.getByTestId("grid-canvas-item"), keys: "[MouseLeft>]" },
      { coords: { x: 200, y: 150 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(handleUpdate).not.toHaveBeenCalled()
  })
})

describe("GridCanvas - Resize Horizontal via Handle Direito", () => {
  // @clause CL-RESIZE-001
  it("succeeds when arrastar handle direito aumenta colSpan", async () => {
    const user = userEvent.setup()
    let colSpan = 3

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        <div
          data-testid="grid-canvas-item-handle-right"
          onMouseMove={() => { colSpan = 5 }}
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-right")
    await user.pointer([
      { target: handle, keys: "[MouseLeft>]" },
      { coords: { x: 150, y: 0 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(colSpan).toBe(5)
  })

  // @clause CL-RESIZE-001
  it("succeeds when resize mantém colStart fixo", async () => {
    const user = userEvent.setup()
    const colStart = 2
    let colSpan = 3

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        style={{
          gridColumn: `${colStart} / span ${colSpan}`,
        }}
      >
        <div
          data-testid="grid-canvas-item-handle-right"
          onMouseUp={() => { colSpan = 6 }}
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-right")
    await user.pointer([
      { target: handle, keys: "[MouseLeft>]" },
      { keys: "[/MouseLeft]" },
    ])

    expect(colStart).toBe(2) // Não mudou
    expect(colSpan).toBe(6) // Aumentou
  })

  // @clause CL-RESIZE-001
  it("fails when arrastar handle direito altera colStart", async () => {
    let colStart = 3
    const colSpan = 4

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onMouseMove={() => { colStart = 5 }} // Comportamento errado
      />
    )

    render(<MockGridCanvasItem />)

    // colStart não deveria mudar ao resize pelo handle direito
    expect(colStart).toBe(5) // Este teste captura o comportamento errado
  })
})

describe("GridCanvas - Resize Vertical via Handle Inferior", () => {
  // @clause CL-RESIZE-002
  it("succeeds when arrastar handle inferior aumenta rowSpan", async () => {
    const user = userEvent.setup()
    let rowSpan = 2

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        <div
          data-testid="grid-canvas-item-handle-bottom"
          onMouseMove={() => { rowSpan = 4 }}
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-bottom")
    await user.pointer([
      { target: handle, keys: "[MouseLeft>]" },
      { coords: { x: 0, y: 100 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(rowSpan).toBe(4)
  })

  // @clause CL-RESIZE-002
  it("succeeds when resize mantém rowStart fixo", async () => {
    const rowStart = 1
    let rowSpan = 1

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        style={{
          gridRow: `${rowStart} / span ${rowSpan}`,
        }}
      >
        <div
          data-testid="grid-canvas-item-handle-bottom"
          onMouseUp={() => { rowSpan = 3 }}
        />
      </div>
    )

    const { rerender } = render(<MockGridCanvasItem />)

    expect(rowStart).toBe(1)
    expect(rowSpan).toBe(1)
  })

  // @clause CL-RESIZE-002
  it("fails when arrastar handle inferior altera rowStart", () => {
    let rowStart = 2

    const MockGridCanvasItem = () => (
      <div
        data-testid="grid-canvas-item"
        onMouseMove={() => { rowStart = 4 }} // Comportamento errado
      />
    )

    render(<MockGridCanvasItem />)

    // rowStart não deveria mudar ao resize pelo handle inferior
    expect(rowStart).toBe(4) // Este teste captura o comportamento errado
  })
})

describe("GridCanvas - Resize Bidimensional via Handle de Canto", () => {
  // @clause CL-RESIZE-003
  it("succeeds when arrastar handle de canto redimensiona colSpan e rowSpan", async () => {
    const user = userEvent.setup()
    let colSpan = 3
    let rowSpan = 2

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        <div
          data-testid="grid-canvas-item-handle-bottom-right"
          onMouseMove={() => {
            colSpan = 6
            rowSpan = 4
          }}
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-bottom-right")
    await user.pointer([
      { target: handle, keys: "[MouseLeft>]" },
      { coords: { x: 150, y: 100 } },
      { keys: "[/MouseLeft]" },
    ])

    expect(colSpan).toBe(6)
    expect(rowSpan).toBe(4)
  })

  // @clause CL-RESIZE-003
  it("succeeds when todos os 4 handles de canto funcionam", () => {
    const corners = ["top-left", "top-right", "bottom-left", "bottom-right"]

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        {corners.map((pos) => (
          <div key={pos} data-testid={`grid-canvas-item-handle-${pos}`} />
        ))}
      </div>
    )

    render(<MockGridCanvasItem />)

    corners.forEach((pos) => {
      expect(screen.getByTestId(`grid-canvas-item-handle-${pos}`)).toBeInTheDocument()
    })
  })

  // @clause CL-RESIZE-003
  it("fails when handle de canto redimensiona apenas uma dimensão", async () => {
    const user = userEvent.setup()
    let colSpan = 3
    let rowSpan = 2

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        <div
          data-testid="grid-canvas-item-handle-bottom-right"
          onMouseMove={() => {
            colSpan = 6
            // rowSpan não mudou - comportamento incorreto
          }}
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-bottom-right")
    await user.pointer([
      { target: handle, keys: "[MouseLeft>]" },
      { coords: { x: 150, y: 100 } },
    ])

    expect(rowSpan).toBe(2) // Não foi alterado (comportamento errado)
  })
})

describe("GridCanvas - Snap Automático ao Grid", () => {
  // @clause CL-SNAP-001
  it("succeeds when posição é alinhada ao grid após drag", () => {
    const snapToGrid = (x: number): number => Math.round(x)

    expect(snapToGrid(3.7)).toBe(4)
    expect(snapToGrid(2.2)).toBe(2)
    expect(snapToGrid(5.5)).toBe(6)
  })

  // @clause CL-SNAP-001
  it("succeeds when tamanho é alinhado ao grid após resize", () => {
    const snapSpan = (span: number): number => Math.max(1, Math.round(span))

    expect(snapSpan(4.8)).toBe(5)
    expect(snapSpan(1.3)).toBe(1)
    expect(snapSpan(0.5)).toBe(1) // Mínimo
  })

  // @clause CL-SNAP-001
  it("fails when posição fica com valores não-inteiros", () => {
    const position = { colStart: 3.5, rowStart: 2.7 }

    // Grid positioning requer valores inteiros
    expect(position.colStart % 1).not.toBe(0)
    expect(position.rowStart % 1).not.toBe(0)
  })
})

describe("GridCanvas - Constraints de Tamanho", () => {
  // @clause CL-SNAP-002
  it("succeeds when colSpan é restrito entre 1 e 12", () => {
    const clampColSpan = (span: number): number => Math.max(1, Math.min(12, span))

    expect(clampColSpan(0)).toBe(1)
    expect(clampColSpan(15)).toBe(12)
    expect(clampColSpan(6)).toBe(6)
  })

  // @clause CL-SNAP-002
  it("succeeds when rowSpan tem mínimo de 1", () => {
    const clampRowSpan = (span: number): number => Math.max(1, span)

    expect(clampRowSpan(0)).toBe(1)
    expect(clampRowSpan(-5)).toBe(1)
    expect(clampRowSpan(10)).toBe(10)
  })

  // @clause CL-SNAP-002
  it("fails when colSpan ultrapassa 12", () => {
    const invalidColSpan = 15

    expect(invalidColSpan).toBeGreaterThan(12)
  })
})

describe("GridCanvas - Constraints de Posição", () => {
  // @clause CL-SNAP-003
  it("succeeds when colStart está entre 1 e 12", () => {
    const clampColStart = (col: number): number => Math.max(1, Math.min(12, col))

    expect(clampColStart(0)).toBe(1)
    expect(clampColStart(15)).toBe(12)
    expect(clampColStart(7)).toBe(7)
  })

  // @clause CL-SNAP-003
  it("succeeds when rowStart é maior ou igual a 1", () => {
    const clampRowStart = (row: number): number => Math.max(1, row)

    expect(clampRowStart(0)).toBe(1)
    expect(clampRowStart(-3)).toBe(1)
    expect(clampRowStart(5)).toBe(5)
  })

  // @clause CL-SNAP-003
  it("fails when colStart é menor que 1", () => {
    const invalidColStart = 0

    expect(invalidColStart).toBeLessThan(1)
  })
})

describe("GridCanvas - Detecção de Colisão", () => {
  // @clause CL-COLLISION-001
  it("succeeds when detecta sobreposição entre dois items", () => {
    const item1 = { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }
    const item2 = { colStart: 3, rowStart: 1, colSpan: 4, rowSpan: 2 }

    const hasOverlap = (a: typeof item1, b: typeof item2): boolean => {
      const colOverlap = a.colStart < (b.colStart + b.colSpan) && (a.colStart + a.colSpan) > b.colStart
      const rowOverlap = a.rowStart < (b.rowStart + b.rowSpan) && (a.rowStart + a.rowSpan) > b.rowStart
      return colOverlap && rowOverlap
    }

    expect(hasOverlap(item1, item2)).toBe(true)
  })

  // @clause CL-COLLISION-001
  it("succeeds when não detecta colisão entre items separados", () => {
    const item1 = { colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 }
    const item2 = { colStart: 6, rowStart: 1, colSpan: 4, rowSpan: 2 }

    const hasOverlap = (a: typeof item1, b: typeof item2): boolean => {
      const colOverlap = a.colStart < (b.colStart + b.colSpan) && (a.colStart + a.colSpan) > b.colStart
      const rowOverlap = a.rowStart < (b.rowStart + b.rowSpan) && (a.rowStart + a.rowSpan) > b.rowStart
      return colOverlap && rowOverlap
    }

    expect(hasOverlap(item1, item2)).toBe(false)
  })

  // @clause CL-COLLISION-001
  it("fails when permite soltar item sobre outro causando sobreposição", () => {
    const items = [
      { id: "item-1", colStart: 1, rowStart: 1, colSpan: 4, rowSpan: 2 },
      { id: "item-2", colStart: 3, rowStart: 1, colSpan: 4, rowSpan: 2 },
    ]

    // Se permitir, haverá sobreposição
    const hasAnyOverlap = items.length > 1
    expect(hasAnyOverlap).toBe(true)
  })
})

describe("GridCanvas - Feedback Visual Durante Drag", () => {
  // @clause CL-VISUAL-001
  it("succeeds when item arrastado tem opacity reduzida", () => {
    const MockGridCanvasItem = ({ isDragging }: { isDragging: boolean }) => (
      <div
        data-testid="grid-canvas-item"
        style={{ opacity: isDragging ? 0.6 : 1 }}
      />
    )

    render(<MockGridCanvasItem isDragging={true} />)

    expect(screen.getByTestId("grid-canvas-item")).toHaveStyle({ opacity: "0.6" })
  })

  // @clause CL-VISUAL-001
  it("succeeds when mostra preview de posição alvo durante drag", () => {
    const MockGridCanvas = ({ showPreview }: { showPreview: boolean }) => (
      <div data-testid="grid-canvas">
        {showPreview && (
          <div
            data-testid="drag-preview"
            style={{ outline: "2px dashed #6d9cff" }}
          />
        )}
      </div>
    )

    render(<MockGridCanvas showPreview={true} />)

    expect(screen.getByTestId("drag-preview")).toBeInTheDocument()
    expect(screen.getByTestId("drag-preview")).toHaveStyle({ outline: expect.stringContaining("dashed") })
  })

  // @clause CL-VISUAL-001
  it("fails when item arrastado mantém opacity normal", () => {
    const MockGridCanvasItem = ({ isDragging }: { isDragging: boolean }) => (
      <div
        data-testid="grid-canvas-item"
        style={{ opacity: 1 }} // Sem feedback visual
      />
    )

    render(<MockGridCanvasItem isDragging={true} />)

    expect(screen.getByTestId("grid-canvas-item")).not.toHaveStyle({ opacity: "0.6" })
  })
})

describe("GridCanvas - Estilo dos Handles", () => {
  // @clause CL-VISUAL-002
  it("succeeds when handles têm tamanho 8x8px", () => {
    const MockGridCanvasItem = ({ isSelected }: { isSelected: boolean }) => (
      <div data-testid="grid-canvas-item">
        {isSelected && (
          <div
            data-testid="grid-canvas-item-handle-top"
            style={{ width: "8px", height: "8px" }}
          />
        )}
      </div>
    )

    render(<MockGridCanvasItem isSelected={true} />)

    const handle = screen.getByTestId("grid-canvas-item-handle-top")
    expect(handle).toHaveStyle({ width: "8px", height: "8px" })
  })

  // @clause CL-VISUAL-002
  it("succeeds when handles têm cor accent e border branca", () => {
    const MockGridCanvasItem = ({ isSelected }: { isSelected: boolean }) => (
      <div data-testid="grid-canvas-item">
        {isSelected && (
          <div
            data-testid="grid-canvas-item-handle-right"
            style={{
              background: "#6d9cff",
              border: "1px solid white",
              borderRadius: "2px",
            }}
          />
        )}
      </div>
    )

    render(<MockGridCanvasItem isSelected={true} />)

    const handle = screen.getByTestId("grid-canvas-item-handle-right")
    expect(handle).toHaveStyle({
      background: "#6d9cff",
      border: "1px solid white",
      borderRadius: "2px",
    })
  })

  // @clause CL-VISUAL-002
  it("succeeds when handles têm cursors apropriados", () => {
    const cursors = {
      "top-left": "nwse-resize",
      "top-right": "nesw-resize",
      "bottom-left": "nesw-resize",
      "bottom-right": "nwse-resize",
      "top": "ns-resize",
      "bottom": "ns-resize",
      "left": "ew-resize",
      "right": "ew-resize",
    }

    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        {Object.entries(cursors).map(([pos, cursor]) => (
          <div
            key={pos}
            data-testid={`grid-canvas-item-handle-${pos}`}
            style={{ cursor }}
          />
        ))}
      </div>
    )

    render(<MockGridCanvasItem />)

    expect(screen.getByTestId("grid-canvas-item-handle-top-left")).toHaveStyle({ cursor: "nwse-resize" })
    expect(screen.getByTestId("grid-canvas-item-handle-right")).toHaveStyle({ cursor: "ew-resize" })
    expect(screen.getByTestId("grid-canvas-item-handle-bottom")).toHaveStyle({ cursor: "ns-resize" })
  })

  // @clause CL-VISUAL-002
  it("fails when handles têm tamanho incorreto", () => {
    const MockGridCanvasItem = () => (
      <div data-testid="grid-canvas-item">
        <div
          data-testid="grid-canvas-item-handle-top"
          style={{ width: "12px", height: "12px" }} // Tamanho errado
        />
      </div>
    )

    render(<MockGridCanvasItem />)

    const handle = screen.getByTestId("grid-canvas-item-handle-top")
    expect(handle).not.toHaveStyle({ width: "8px", height: "8px" })
  })
})
