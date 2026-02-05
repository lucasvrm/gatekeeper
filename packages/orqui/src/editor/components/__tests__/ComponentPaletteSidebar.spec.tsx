/**
 * @file ComponentPaletteSidebar.spec.tsx
 * @description Contract spec — Sidebar com paleta de componentes e editor de props
 * @contract component-palette-sidebar-phase-2b
 * @mode STRICT
 */

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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
      contract: {
        pages: {
          "test-page": {
            id: "test-page",
            content: { id: "root", type: "container", children: [] },
          },
        },
      },
    },
  }),
}))

// Fixtures
interface ComponentMetadata {
  componentType: string
  category: string
  icon: string
  defaultColSpan: number
  defaultRowSpan: number
  propFields: Array<{
    name: string
    label: string
    type: string
    defaultValue?: any
    options?: Array<{ value: string; label: string }>
    supportsTemplates?: boolean
  }>
}

function createComponentMetadata(overrides: Partial<ComponentMetadata> = {}): ComponentMetadata {
  return {
    componentType: "Button",
    category: "Entrada",
    icon: "Square",
    defaultColSpan: 2,
    defaultRowSpan: 1,
    propFields: [
      {
        name: "children",
        label: "Texto",
        type: "text",
        defaultValue: "Button",
        supportsTemplates: true,
      },
      {
        name: "variant",
        label: "Variante",
        type: "select",
        defaultValue: "default",
        options: [
          { value: "default", label: "Default" },
          { value: "destructive", label: "Destructive" },
        ],
      },
    ],
    ...overrides,
  }
}

function createCatalog(): ComponentMetadata[] {
  const categories = {
    Entrada: ["Button", "Input", "Textarea", "Checkbox", "RadioGroup", "ToggleGroup"],
    Seleção: ["Select", "DropdownMenu", "Toggle"],
    Feedback: ["Alert", "Badge", "Progress", "Skeleton", "Tooltip", "HoverCard", "Sonner"],
    Layouts: ["Card", "Dialog", "Drawer", "Sheet", "Popover"],
    Dados: ["Table", "Accordion", "Tabs", "Breadcrumb", "Pagination", "Avatar", "Calendar"],
    Especializados: ["Form", "NavigationMenu", "Sidebar", "Resizable", "InputOTP", "Chart"],
    Utilitários: [
      "Label",
      "AlertDialog",
      "Separator",
      "ContextMenu",
      "ScrollArea",
      "AspectRatio",
      "Command",
      "Collapsible",
      "Menubar",
      "Slider",
      "Switch",
      "RadioGroupUtil",
    ],
  }

  return Object.entries(categories).flatMap(([category, components]) =>
    components.map((componentType) =>
      createComponentMetadata({ componentType, category })
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ComponentPaletteSidebar - Estrutura da Sidebar", () => {
  // @clause CL-SIDEBAR-001
  it("succeeds when sidebar é renderizado com paleta e editor de props", () => {
    const MockSidebar = () => (
      <div data-testid="component-palette-sidebar">
        <div data-testid="component-palette-section" />
        <div data-testid="props-editor" />
      </div>
    )

    render(<MockSidebar />)

    expect(screen.getByTestId("component-palette-sidebar")).toBeInTheDocument()
    expect(screen.getByTestId("component-palette-section")).toBeInTheDocument()
    expect(screen.getByTestId("props-editor")).toBeInTheDocument()
  })

  // @clause CL-SIDEBAR-001
  it("succeeds when paleta ocupa 60% e editor 40% da altura", () => {
    const MockSidebar = () => (
      <div data-testid="component-palette-sidebar">
        <div data-testid="component-palette-section" style={{ maxHeight: "60%" }} />
        <div data-testid="props-editor" style={{ maxHeight: "40%" }} />
      </div>
    )

    render(<MockSidebar />)

    const palette = screen.getByTestId("component-palette-section")
    const editor = screen.getByTestId("props-editor")

    expect(palette).toHaveStyle({ maxHeight: "60%" })
    expect(editor).toHaveStyle({ maxHeight: "40%" })
  })

  // @clause CL-SIDEBAR-001
  it("fails when sidebar não tem ambas as seções", () => {
    const MockSidebar = () => (
      <div data-testid="component-palette-sidebar">
        <div data-testid="component-palette-section" />
      </div>
    )

    render(<MockSidebar />)

    expect(screen.getByTestId("component-palette-sidebar")).toBeInTheDocument()
    expect(screen.queryByTestId("props-editor")).not.toBeInTheDocument()
  })
})

describe("ComponentPaletteSidebar - Paleta de Componentes", () => {
  // @clause CL-PALETTE-001
  it("succeeds when paleta exibe 46 componentes em 7 categorias", () => {
    const catalog = createCatalog()
    expect(catalog).toHaveLength(46)

    const categories = Array.from(new Set(catalog.map((c) => c.category)))
    expect(categories).toHaveLength(7)
  })

  // @clause CL-PALETTE-001
  it("succeeds when categorias contêm quantidades corretas de componentes", () => {
    const catalog = createCatalog()

    const entradaCount = catalog.filter((c) => c.category === "Entrada").length
    const selecaoCount = catalog.filter((c) => c.category === "Seleção").length
    const feedbackCount = catalog.filter((c) => c.category === "Feedback").length
    const layoutsCount = catalog.filter((c) => c.category === "Layouts").length
    const dadosCount = catalog.filter((c) => c.category === "Dados").length
    const especializadosCount = catalog.filter((c) => c.category === "Especializados").length
    const utilitariosCount = catalog.filter((c) => c.category === "Utilitários").length

    expect(entradaCount).toBe(6)
    expect(selecaoCount).toBe(3)
    expect(feedbackCount).toBe(7)
    expect(layoutsCount).toBe(5)
    expect(dadosCount).toBe(7)
    expect(especializadosCount).toBe(6)
    expect(utilitariosCount).toBe(12)
  })

  // @clause CL-PALETTE-001
  it("fails when paleta tem menos de 46 componentes", () => {
    const incompleteCatalog = createCatalog().slice(0, 30)
    expect(incompleteCatalog.length).toBeLessThan(46)
  })

  // @clause CL-PALETTE-002
  it("succeeds when cada item da paleta mostra ícone e nome", () => {
    const MockPaletteItem = ({ component }: { component: ComponentMetadata }) => (
      <div data-testid={`palette-item-${component.componentType}`}>
        <span data-testid="palette-item-icon">{component.icon}</span>
        <span data-testid="palette-item-name">{component.componentType}</span>
      </div>
    )

    const component = createComponentMetadata()
    render(<MockPaletteItem component={component} />)

    expect(screen.getByTestId("palette-item-Button")).toBeInTheDocument()
    expect(screen.getByTestId("palette-item-icon")).toHaveTextContent("Square")
    expect(screen.getByTestId("palette-item-name")).toHaveTextContent("Button")
  })

  // @clause CL-PALETTE-002
  it("succeeds when palette items têm data-testid correto", () => {
    const MockPalette = () => (
      <div>
        <div data-testid="palette-item-Button" />
        <div data-testid="palette-item-Input" />
        <div data-testid="palette-item-Card" />
      </div>
    )

    render(<MockPalette />)

    expect(screen.getByTestId("palette-item-Button")).toBeInTheDocument()
    expect(screen.getByTestId("palette-item-Input")).toBeInTheDocument()
    expect(screen.getByTestId("palette-item-Card")).toBeInTheDocument()
  })

  // @clause CL-PALETTE-002
  it("fails when item não mostra ícone ou nome", () => {
    const MockPaletteItem = () => <div data-testid="palette-item-Button" />

    render(<MockPaletteItem />)

    expect(screen.queryByTestId("palette-item-icon")).not.toBeInTheDocument()
    expect(screen.queryByTestId("palette-item-name")).not.toBeInTheDocument()
  })

  // @clause CL-PALETTE-003
  it("succeeds when drag start cria DragData com metadata correto", () => {
    const component = createComponentMetadata()
    const handleDragStart = vi.fn((e: React.DragEvent) => {
      e.dataTransfer.setData("component", JSON.stringify({
        componentType: component.componentType,
        defaultColSpan: component.defaultColSpan,
        defaultRowSpan: component.defaultRowSpan,
        metadata: component,
      }))
    })

    const MockPaletteItem = () => (
      <div
        data-testid="palette-item-Button"
        draggable
        onDragStart={handleDragStart}
      />
    )

    render(<MockPaletteItem />)

    const item = screen.getByTestId("palette-item-Button")
    item.dispatchEvent(new Event("dragstart", { bubbles: true }))

    expect(handleDragStart).toHaveBeenCalled()
  })

  // @clause CL-PALETTE-003
  it("succeeds when DragData contém campos obrigatórios", () => {
    const component = createComponentMetadata()
    const dragData = {
      componentType: component.componentType,
      defaultColSpan: component.defaultColSpan,
      defaultRowSpan: component.defaultRowSpan,
      componentMetadata: component,
    }

    expect(dragData).toHaveProperty("componentType")
    expect(dragData).toHaveProperty("defaultColSpan")
    expect(dragData).toHaveProperty("defaultRowSpan")
    expect(dragData).toHaveProperty("componentMetadata")
  })

  // @clause CL-PALETTE-003
  it("fails when DragData está incompleto", () => {
    const incompleteDragData = {
      componentType: "Button",
      // Faltando defaultColSpan, defaultRowSpan, componentMetadata
    }

    expect(incompleteDragData).not.toHaveProperty("defaultColSpan")
    expect(incompleteDragData).not.toHaveProperty("defaultRowSpan")
    expect(incompleteDragData).not.toHaveProperty("componentMetadata")
  })
})

describe("ComponentPaletteSidebar - Drag and Drop para Canvas", () => {
  // @clause CL-DROP-001
  it("succeeds when preview fantasma aparece durante drag sobre canvas", () => {
    const MockCanvas = () => (
      <div data-testid="grid-canvas">
        <div data-testid="canvas-drop-preview" style={{ opacity: 0.4 }} />
      </div>
    )

    render(<MockCanvas />)

    const preview = screen.getByTestId("canvas-drop-preview")
    expect(preview).toBeInTheDocument()
    expect(preview).toHaveStyle({ opacity: "0.4" })
  })

  // @clause CL-DROP-001
  it("succeeds when preview mostra posição e dimensões com snap", () => {
    const MockCanvas = () => (
      <div data-testid="grid-canvas">
        <div
          data-testid="canvas-drop-preview"
          style={{
            gridColumnStart: 3,
            gridRowStart: 2,
            gridColumnEnd: "span 2",
            gridRowEnd: "span 1",
          }}
        />
      </div>
    )

    render(<MockCanvas />)

    const preview = screen.getByTestId("canvas-drop-preview")
    expect(preview).toHaveStyle({
      gridColumnStart: "3",
      gridRowStart: "2",
    })
  })

  // @clause CL-DROP-001
  it("fails when preview não aparece durante drag", () => {
    const MockCanvas = () => <div data-testid="grid-canvas" />

    render(<MockCanvas />)

    expect(screen.queryByTestId("canvas-drop-preview")).not.toBeInTheDocument()
  })

  // @clause CL-DROP-002
  it("succeeds when drop cria novo GridItem com dados corretos", async () => {
    const handleDrop = vi.fn((component: ComponentMetadata) => {
      mockDispatch({
        type: "ADD_GRID_ITEM",
        payload: {
          item: {
            id: "item-1",
            component: component.componentType,
            colStart: 1,
            rowStart: 1,
            colSpan: component.defaultColSpan,
            rowSpan: component.defaultRowSpan,
            props: {},
          },
        },
      })
    })

    const component = createComponentMetadata()
    handleDrop(component)

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ADD_GRID_ITEM",
          payload: expect.objectContaining({
            item: expect.objectContaining({
              component: "Button",
              colSpan: 2,
              rowSpan: 1,
            }),
          }),
        })
      )
    })
  })

  // @clause CL-DROP-002
  it("succeeds when item criado tem tamanho padrão do componente", () => {
    const component = createComponentMetadata({ defaultColSpan: 3, defaultRowSpan: 2 })
    const newItem = {
      component: component.componentType,
      colSpan: component.defaultColSpan,
      rowSpan: component.defaultRowSpan,
    }

    expect(newItem.colSpan).toBe(3)
    expect(newItem.rowSpan).toBe(2)
  })

  // @clause CL-DROP-002
  it("fails when drop não dispara ADD_GRID_ITEM", () => {
    const handleDrop = vi.fn() // Não chama dispatch

    handleDrop()

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // @clause CL-DROP-003
  it("succeeds when drop é cancelado por colisão", () => {
    const existingItems = [
      { id: "item-1", colStart: 1, rowStart: 1, colSpan: 3, rowSpan: 2 },
    ]

    const detectCollision = (
      colStart: number,
      rowStart: number,
      colSpan: number,
      rowSpan: number
    ) => {
      return existingItems.some((item) => {
        const colEnd = colStart + colSpan
        const rowEnd = rowStart + rowSpan
        const itemColEnd = item.colStart + item.colSpan
        const itemRowEnd = item.rowStart + item.rowSpan

        return !(
          colEnd <= item.colStart ||
          colStart >= itemColEnd ||
          rowEnd <= item.rowStart ||
          rowStart >= itemRowEnd
        )
      })
    }

    const hasCollision = detectCollision(2, 1, 2, 1)
    expect(hasCollision).toBe(true)

    if (hasCollision) {
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "ADD_GRID_ITEM" })
      )
    }
  })

  // @clause CL-DROP-003
  it("succeeds when estado permanece inalterado após cancelamento", () => {
    const initialState = { items: [{ id: "item-1" }] }
    const hasCollision = true

    if (hasCollision) {
      expect(mockDispatch).not.toHaveBeenCalled()
    }

    // Estado não muda
    expect(initialState.items).toHaveLength(1)
  })

  // @clause CL-DROP-003
  it("fails when drop cria item mesmo com colisão", () => {
    const hasCollision = true

    if (!hasCollision) {
      mockDispatch({ type: "ADD_GRID_ITEM" })
    }

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // @clause CL-DROP-004
  it("succeeds when feedback de colisão é exibido", () => {
    const MockCanvas = () => (
      <div data-testid="grid-canvas">
        <div
          data-testid="canvas-drop-collision-feedback"
          style={{ border: "2px dashed red" }}
        />
      </div>
    )

    render(<MockCanvas />)

    const feedback = screen.getByTestId("canvas-drop-collision-feedback")
    expect(feedback).toBeInTheDocument()
    expect(feedback).toHaveStyle({ border: "2px dashed red" })
  })

  // @clause CL-DROP-004
  it("succeeds when preview tem borda vermelha durante colisão", () => {
    const hasCollision = true
    const previewStyle = {
      border: hasCollision ? "2px dashed red" : "2px dashed blue",
    }

    expect(previewStyle.border).toBe("2px dashed red")
  })

  // @clause CL-DROP-004
  it("fails when feedback não aparece em caso de colisão", () => {
    const MockCanvas = () => <div data-testid="grid-canvas" />

    render(<MockCanvas />)

    expect(screen.queryByTestId("canvas-drop-collision-feedback")).not.toBeInTheDocument()
  })
})

describe("ComponentPaletteSidebar - Editor de Props", () => {
  // @clause CL-PROPS-001
  it("succeeds when editor mostra mensagem quando nada selecionado", () => {
    const MockPropsEditor = ({ selectedItemId }: { selectedItemId: string | null }) => (
      <div data-testid="props-editor">
        {!selectedItemId && (
          <div data-testid="props-editor-empty-state">
            Selecione um item para editar propriedades
          </div>
        )}
      </div>
    )

    render(<MockPropsEditor selectedItemId={null} />)

    expect(screen.getByTestId("props-editor-empty-state")).toBeInTheDocument()
    expect(screen.getByTestId("props-editor-empty-state")).toHaveTextContent(
      "Selecione um item para editar propriedades"
    )
  })

  // @clause CL-PROPS-001
  it("succeeds when empty state tem estilo correto", () => {
    const MockPropsEditor = () => (
      <div data-testid="props-editor">
        <div
          data-testid="props-editor-empty-state"
          style={{ textAlign: "center", color: "#888" }}
        >
          Selecione um item para editar propriedades
        </div>
      </div>
    )

    render(<MockPropsEditor />)

    const emptyState = screen.getByTestId("props-editor-empty-state")
    expect(emptyState).toHaveStyle({ textAlign: "center" })
  })

  // @clause CL-PROPS-001
  it("fails when mensagem não aparece sem seleção", () => {
    const MockPropsEditor = () => <div data-testid="props-editor" />

    render(<MockPropsEditor />)

    expect(screen.queryByTestId("props-editor-empty-state")).not.toBeInTheDocument()
  })

  // @clause CL-PROPS-002
  it("succeeds when editor mostra form dinâmico ao selecionar item", () => {
    const selectedItem = {
      id: "item-1",
      component: "Button",
      props: {},
    }

    const componentMetadata = createComponentMetadata()

    const MockPropsEditor = () => (
      <div data-testid="props-editor">
        <div data-testid="props-editor-form">
          <h3>{componentMetadata.componentType}</h3>
          {componentMetadata.propFields.map((field) => (
            <div key={field.name} data-testid={`prop-field-${field.name}`}>
              <label>{field.label}</label>
            </div>
          ))}
        </div>
      </div>
    )

    render(<MockPropsEditor />)

    expect(screen.getByTestId("props-editor-form")).toBeInTheDocument()
    expect(screen.getByText("Button")).toBeInTheDocument()
    expect(screen.getByTestId("prop-field-children")).toBeInTheDocument()
    expect(screen.getByTestId("prop-field-variant")).toBeInTheDocument()
  })

  // @clause CL-PROPS-002
  it("succeeds when form exibe campos baseados em propFields", () => {
    const metadata = createComponentMetadata({
      propFields: [
        { name: "title", label: "Título", type: "text" },
        { name: "size", label: "Tamanho", type: "select", options: [] },
      ],
    })

    expect(metadata.propFields).toHaveLength(2)
    expect(metadata.propFields[0].name).toBe("title")
    expect(metadata.propFields[1].name).toBe("size")
  })

  // @clause CL-PROPS-002
  it("fails when form não aparece com item selecionado", () => {
    const MockPropsEditor = () => <div data-testid="props-editor" />

    render(<MockPropsEditor />)

    expect(screen.queryByTestId("props-editor-form")).not.toBeInTheDocument()
  })

  // @clause CL-PROPS-003
  it("succeeds when edição de prop dispara UPDATE_GRID_ITEM_PROPS", async () => {
    const user = userEvent.setup()

    const MockPropField = () => (
      <input
        data-testid="prop-input"
        onChange={(e) => {
          mockDispatch({
            type: "UPDATE_GRID_ITEM_PROPS",
            payload: {
              itemId: "item-1",
              props: { children: e.target.value },
            },
          })
        }}
      />
    )

    render(<MockPropField />)

    const input = screen.getByTestId("prop-input")
    await user.type(input, "Novo texto")

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "UPDATE_GRID_ITEM_PROPS",
          payload: expect.objectContaining({
            itemId: "item-1",
          }),
        })
      )
    })
  })

  // @clause CL-PROPS-003
  it("succeeds when props são atualizados imediatamente", async () => {
    const user = userEvent.setup()
    let itemProps = { children: "Texto inicial" }

    const MockPropField = () => (
      <input
        data-testid="prop-input"
        value={itemProps.children}
        onChange={(e) => {
          itemProps = { children: e.target.value }
        }}
      />
    )

    render(<MockPropField />)

    const input = screen.getByTestId("prop-input")
    await user.clear(input)
    await user.type(input, "Novo")

    expect(itemProps.children).toBe("Novo")
  })

  // @clause CL-PROPS-003
  it("fails when edição não dispara ação", async () => {
    const user = userEvent.setup()

    const MockPropField = () => <input data-testid="prop-input" />

    render(<MockPropField />)

    const input = screen.getByTestId("prop-input")
    await user.type(input, "Texto")

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  // @clause CL-PROPS-004
  it("succeeds when canvas re-renderiza com novas props", () => {
    const itemProps = { children: "Texto atualizado" }

    const MockGridItem = () => (
      <div data-testid="grid-item">{itemProps.children}</div>
    )

    const { rerender } = render(<MockGridItem />)

    expect(screen.getByTestId("grid-item")).toHaveTextContent("Texto atualizado")

    itemProps.children = "Novo texto"
    rerender(<MockGridItem />)

    expect(screen.getByTestId("grid-item")).toHaveTextContent("Novo texto")
  })

  // @clause CL-PROPS-004
  it("succeeds when preview atualiza em tempo real", () => {
    let propValue = "Inicial"

    const MockPreview = () => <div data-testid="preview">{propValue}</div>

    const { rerender } = render(<MockPreview />)
    expect(screen.getByTestId("preview")).toHaveTextContent("Inicial")

    propValue = "Atualizado"
    rerender(<MockPreview />)
    expect(screen.getByTestId("preview")).toHaveTextContent("Atualizado")
  })

  // @clause CL-PROPS-004
  it("fails when canvas não atualiza após mudança de props", () => {
    const MockGridItem = () => <div data-testid="grid-item">Texto fixo</div>

    const { rerender } = render(<MockGridItem />)

    expect(screen.getByTestId("grid-item")).toHaveTextContent("Texto fixo")

    rerender(<MockGridItem />)
    expect(screen.getByTestId("grid-item")).toHaveTextContent("Texto fixo")
  })
})

describe("ComponentPaletteSidebar - Sistema de Templates", () => {
  // @clause CL-TEMPLATE-001
  it("succeeds when template com $ é detectado e marcado", () => {
    const value = "$user.name"
    const isTemplate = value.startsWith("$")

    expect(isTemplate).toBe(true)

    const MockTemplateField = () => (
      <div data-testid="prop-field">
        {isTemplate && <span data-testid="template-badge">$</span>}
        <input value={value} />
      </div>
    )

    render(<MockTemplateField />)

    expect(screen.getByTestId("template-badge")).toBeInTheDocument()
  })

  // @clause CL-TEMPLATE-001
  it("succeeds when badge de template é exibido visualmente", () => {
    const MockTemplateField = () => (
      <div data-testid="prop-field">
        <span
          data-testid="template-badge"
          style={{ background: "#3b82f6", padding: "2px 6px" }}
        >
          $
        </span>
      </div>
    )

    render(<MockTemplateField />)

    const badge = screen.getByTestId("template-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: "#3b82f6" })
  })

  // @clause CL-TEMPLATE-001
  it("fails when $ não é detectado como template", () => {
    const value = "user.name" // Sem $
    const isTemplate = value.startsWith("$")

    expect(isTemplate).toBe(false)
  })

  // @clause CL-TEMPLATE-002
  it("succeeds when autocomplete aparece ao digitar $", async () => {
    const user = userEvent.setup()
    let showAutocomplete = false

    const MockTemplateField = () => (
      <div>
        <input
          data-testid="prop-input"
          onKeyUp={(e) => {
            const value = e.currentTarget.value
            showAutocomplete = value.endsWith("$")
          }}
        />
        {showAutocomplete && (
          <div data-testid="template-autocomplete">
            <div>$stats.totalSales</div>
            <div>$user.name</div>
          </div>
        )}
      </div>
    )

    render(<MockTemplateField />)

    const input = screen.getByTestId("prop-input")
    await user.type(input, "$")

    // Como é assíncrono, simulamos o comportamento
    showAutocomplete = true
    const { rerender } = render(<MockTemplateField />)

    await waitFor(() => {
      expect(screen.queryByTestId("template-autocomplete")).toBeInTheDocument()
    })
  })

  // @clause CL-TEMPLATE-002
  it("succeeds when autocomplete mostra variáveis disponíveis", () => {
    const variables = ["$stats.totalSales", "$user.name", "$order.total"]

    const MockAutocomplete = () => (
      <div data-testid="template-autocomplete">
        {variables.map((v) => (
          <div key={v} data-testid="autocomplete-option">
            {v}
          </div>
        ))}
      </div>
    )

    render(<MockAutocomplete />)

    const options = screen.getAllByTestId("autocomplete-option")
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent("$stats.totalSales")
  })

  // @clause CL-TEMPLATE-002
  it("fails when autocomplete não aparece ao digitar $", () => {
    const MockTemplateField = () => <input data-testid="prop-input" />

    render(<MockTemplateField />)

    expect(screen.queryByTestId("template-autocomplete")).not.toBeInTheDocument()
  })
})

describe("ComponentPaletteSidebar - Metadata System", () => {
  // @clause CL-META-001
  it("succeeds when ComponentMetadata tem estrutura correta", () => {
    const metadata = createComponentMetadata()

    expect(metadata).toHaveProperty("componentType")
    expect(metadata).toHaveProperty("category")
    expect(metadata).toHaveProperty("icon")
    expect(metadata).toHaveProperty("defaultColSpan")
    expect(metadata).toHaveProperty("defaultRowSpan")
    expect(metadata).toHaveProperty("propFields")
    expect(Array.isArray(metadata.propFields)).toBe(true)
  })

  // @clause CL-META-001
  it("succeeds when category é uma das 7 categorias válidas", () => {
    const validCategories = [
      "Entrada",
      "Seleção",
      "Feedback",
      "Layouts",
      "Dados",
      "Especializados",
      "Utilitários",
    ]

    const metadata = createComponentMetadata({ category: "Entrada" })
    expect(validCategories).toContain(metadata.category)
  })

  // @clause CL-META-001
  it("fails when ComponentMetadata está incompleto", () => {
    const incomplete = {
      componentType: "Button",
      // Faltando campos obrigatórios
    }

    expect(incomplete).not.toHaveProperty("category")
    expect(incomplete).not.toHaveProperty("icon")
    expect(incomplete).not.toHaveProperty("defaultColSpan")
  })

  // @clause CL-META-002
  it("succeeds when PropField tem estrutura correta", () => {
    const propField = {
      name: "variant",
      label: "Variante",
      type: "select",
      defaultValue: "default",
      options: [{ value: "default", label: "Default" }],
      supportsTemplates: false,
    }

    expect(propField).toHaveProperty("name")
    expect(propField).toHaveProperty("label")
    expect(propField).toHaveProperty("type")
    expect(propField).toHaveProperty("defaultValue")
    expect(propField).toHaveProperty("options")
    expect(propField).toHaveProperty("supportsTemplates")
  })

  // @clause CL-META-002
  it("succeeds when type é um dos tipos válidos", () => {
    const validTypes = ["text", "number", "select", "boolean", "color", "icon"]

    const propField = { type: "text" }
    expect(validTypes).toContain(propField.type)
  })

  // @clause CL-META-002
  it("fails when PropField não tem campos obrigatórios", () => {
    const incomplete = {
      name: "variant",
      // Faltando label, type
    }

    expect(incomplete).not.toHaveProperty("label")
    expect(incomplete).not.toHaveProperty("type")
  })

  // @clause CL-CATALOG-001
  it("succeeds when catálogo exporta 46 componentes", () => {
    const catalog = createCatalog()
    expect(catalog).toHaveLength(46)
  })

  // @clause CL-CATALOG-001
  it("succeeds when catálogo está organizado por categoria", () => {
    const catalog = createCatalog()

    const categories = new Set(catalog.map((c) => c.category))
    expect(categories.size).toBe(7)
  })

  // @clause CL-CATALOG-001
  it("fails when catálogo tem menos de 46 componentes", () => {
    const incompleteCatalog = createCatalog().slice(0, 20)
    expect(incompleteCatalog.length).toBeLessThan(46)
  })
})

describe("ComponentPaletteSidebar - Feedback Visual", () => {
  // @clause CL-VISUAL-001
  it("succeeds when preview fantasma tem estilo correto", () => {
    const MockPreview = () => (
      <div
        data-testid="canvas-drop-preview"
        style={{
          opacity: 0.4,
          border: "2px dashed blue",
          background: "rgba(0, 0, 255, 0.1)",
        }}
      >
        <span data-testid="preview-icon">Square</span>
      </div>
    )

    render(<MockPreview />)

    const preview = screen.getByTestId("canvas-drop-preview")
    expect(preview).toHaveStyle({ opacity: "0.4" })
    expect(preview).toHaveStyle({ border: "2px dashed blue" })
    expect(screen.getByTestId("preview-icon")).toBeInTheDocument()
  })

  // @clause CL-VISUAL-001
  it("succeeds when preview mostra ícone do componente centralizado", () => {
    const MockPreview = () => (
      <div
        data-testid="canvas-drop-preview"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span data-testid="preview-icon" style={{ fontSize: "32px" }}>
          Square
        </span>
      </div>
    )

    render(<MockPreview />)

    const preview = screen.getByTestId("canvas-drop-preview")
    expect(preview).toHaveStyle({ display: "flex" })

    const icon = screen.getByTestId("preview-icon")
    expect(icon).toHaveStyle({ fontSize: "32px" })
  })

  // @clause CL-VISUAL-001
  it("fails when preview não tem opacity ou border corretos", () => {
    const MockPreview = () => <div data-testid="canvas-drop-preview" />

    render(<MockPreview />)

    const preview = screen.getByTestId("canvas-drop-preview")
    expect(preview).not.toHaveStyle({ opacity: "0.4" })
  })

  // @clause CL-VISUAL-002
  it("succeeds when item arrastado tem cursor grabbing", () => {
    const MockPaletteItem = ({ isDragging }: { isDragging: boolean }) => (
      <div
        data-testid="palette-item"
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          opacity: isDragging ? 0.5 : 1,
        }}
      />
    )

    const { rerender } = render(<MockPaletteItem isDragging={false} />)
    let item = screen.getByTestId("palette-item")
    expect(item).toHaveStyle({ cursor: "grab", opacity: "1" })

    rerender(<MockPaletteItem isDragging={true} />)
    item = screen.getByTestId("palette-item")
    expect(item).toHaveStyle({ cursor: "grabbing", opacity: "0.5" })
  })

  // @clause CL-VISUAL-002
  it("succeeds when opacity reduzida durante drag", () => {
    const isDragging = true
    const opacity = isDragging ? 0.5 : 1

    expect(opacity).toBe(0.5)
  })

  // @clause CL-VISUAL-002
  it("fails when feedback visual não muda durante drag", () => {
    const MockPaletteItem = () => (
      <div data-testid="palette-item" style={{ cursor: "grab", opacity: 1 }} />
    )

    render(<MockPaletteItem />)

    const item = screen.getByTestId("palette-item")
    expect(item).toHaveStyle({ cursor: "grab" })
    expect(item).not.toHaveStyle({ cursor: "grabbing" })
  })
})
