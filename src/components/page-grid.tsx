import type { GridLayoutConfig } from "@/lib/types"
import { ComponentRegistry } from "@/lib/component-registry"

interface PageGridProps {
  config: GridLayoutConfig
}

/**
 * PageGrid
 *
 * Renderiza um layout em CSS Grid baseado na configuração fornecida.
 * Busca componentes no ComponentRegistry e os posiciona nas células corretas.
 */
export function PageGrid({ config }: PageGridProps) {
  const { columns, rowHeight, gap, items } = config

  if (!items || items.length === 0) {
    return null
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridAutoRows: rowHeight,
    gap: gap,
    width: "100%",
    height: "100%",
  }

  return (
    <div data-testid="page-grid" style={gridStyle}>
      {items.map((item, index) => {
        const Component = ComponentRegistry.get(item.component)

        if (!Component) {
          return null
        }

        const itemStyle: React.CSSProperties = {
          gridColumnStart: item.colStart,
          gridColumnEnd: item.colStart + item.colSpan,
          gridRowStart: item.rowStart,
          gridRowEnd: item.rowStart + item.rowSpan,
        }

        return (
          <div key={index} data-testid="grid-item" style={itemStyle}>
            <Component {...(item.props || {})} />
          </div>
        )
      })}
    </div>
  )
}
