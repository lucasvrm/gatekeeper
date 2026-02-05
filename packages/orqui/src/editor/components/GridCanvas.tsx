// ============================================================================
// GridCanvas — Main canvas component for grid layout editor
// ============================================================================

import React, { useRef, useState, useEffect } from "react";
import type { GridLayoutConfig, GridItem } from "@/runtime/types";
import { GridCanvasItem } from "./GridCanvasItem";

interface GridCanvasProps {
  layout: GridLayoutConfig;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  onUpdateItem: (itemId: string, updates: Partial<GridItem>) => void;
}

export function GridCanvas({
  layout,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
}: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const rowHeightPx = parseInt(layout.rowHeight) || 80;

  // Calculate column width based on container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateColumnWidth = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const gapPx = parseInt(layout.gap) || 16;
      const totalGapWidth = gapPx * (layout.columns - 1);
      const availableWidth = containerWidth - totalGapWidth;
      setColumnWidth(availableWidth / layout.columns);
    };

    updateColumnWidth();

    const resizeObserver = new ResizeObserver(updateColumnWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [layout.columns, layout.gap]);

  const handleBackgroundClick = () => {
    onSelectItem(null);
  };

  const handleUpdatePosition = (itemId: string, colStart: number, rowStart: number) => {
    // Check for collisions
    const hasCollision = layout.items.some((other) => {
      if (other.component === itemId) return false;

      const item = layout.items.find((i) => i.component === itemId);
      if (!item) return false;

      const itemEnd = { colEnd: colStart + item.colSpan, rowEnd: rowStart + item.rowSpan };
      const otherEnd = { colEnd: other.colStart + other.colSpan, rowEnd: other.rowStart + other.rowSpan };

      const colOverlap = colStart < otherEnd.colEnd && itemEnd.colEnd > other.colStart;
      const rowOverlap = rowStart < otherEnd.rowEnd && itemEnd.rowEnd > other.rowStart;

      return colOverlap && rowOverlap;
    });

    if (!hasCollision) {
      onUpdateItem(itemId, { colStart, rowStart });
    }
  };

  const handleUpdateSize = (itemId: string, colSpan: number, rowSpan: number) => {
    onUpdateItem(itemId, { colSpan, rowSpan });
  };

  return (
    <div
      ref={containerRef}
      data-testid="grid-canvas"
      onClick={handleBackgroundClick}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "600px",
        background: "#16161e",
        backgroundImage: `
          repeating-linear-gradient(
            to right,
            transparent,
            transparent calc(100% / ${layout.columns} - 1px),
            #2a2a33 calc(100% / ${layout.columns} - 1px),
            #2a2a33 calc(100% / ${layout.columns})
          )
        `,
        padding: "24px",
        display: "grid",
        gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
        gridAutoRows: layout.rowHeight,
        gap: layout.gap,
        overflow: "auto",
      }}
    >
      {/* Grid lines indicator */}
      <div data-testid="grid-canvas-lines" style={{ display: "none" }} />

      {/* Render grid items */}
      {layout.items.map((item, idx) => (
        <GridCanvasItem
          key={item.component}
          item={item}
          isSelected={selectedItemId === item.component}
          onSelect={onSelectItem}
          onUpdatePosition={(colStart, rowStart) => handleUpdatePosition(item.component, colStart, rowStart)}
          onUpdateSize={(colSpan, rowSpan) => handleUpdateSize(item.component, colSpan, rowSpan)}
          containerRef={containerRef}
          columnWidth={columnWidth}
          rowHeight={rowHeightPx}
          gridColumns={layout.columns}
        />
      ))}
    </div>
  );
}
