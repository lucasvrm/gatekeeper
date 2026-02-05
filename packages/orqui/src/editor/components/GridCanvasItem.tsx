// ============================================================================
// GridCanvasItem — Individual grid item with selection, drag, and resize
// ============================================================================

import React, { useRef } from "react";
import type { GridItem } from "@/runtime/types";
import { useGridDrag } from "../hooks/useGridDrag";
import { useGridResize, type ResizeDirection } from "../hooks/useGridResize";

interface GridCanvasItemProps {
  item: GridItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onUpdatePosition: (colStart: number, rowStart: number) => void;
  onUpdateSize: (colSpan: number, rowSpan: number) => void;
  containerRef: React.RefObject<HTMLElement>;
  columnWidth: number;
  rowHeight: number;
  gridColumns: number;
}

export function GridCanvasItem({
  item,
  isSelected,
  onSelect,
  onUpdatePosition,
  onUpdateSize,
  containerRef,
  columnWidth,
  rowHeight,
  gridColumns,
}: GridCanvasItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  const { isDragging, dragPosition, handleMouseDown: handleDragStart } = useGridDrag({
    itemId: item.component,
    initialPosition: { colStart: item.colStart, rowStart: item.rowStart },
    onUpdatePosition,
    containerRef,
    columnWidth,
    rowHeight,
    columns: gridColumns,
  });

  const { isResizing, resizeSize, handleResizeStart } = useGridResize({
    itemId: item.component,
    initialPosition: { colStart: item.colStart, rowStart: item.rowStart },
    initialSize: { colSpan: item.colSpan, rowSpan: item.rowSpan },
    onUpdateSize,
    containerRef,
    columnWidth,
    rowHeight,
    columns: gridColumns,
  });

  const currentPosition = isDragging ? dragPosition : { colStart: item.colStart, rowStart: item.rowStart };
  const currentSize = isResizing ? resizeSize : { colSpan: item.colSpan, rowSpan: item.rowSpan };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.component);
  };

  const handles: Array<{ position: ResizeDirection; cursor: string; style: React.CSSProperties }> = [
    { position: "top-left", cursor: "nwse-resize", style: { top: -4, left: -4 } },
    { position: "top-right", cursor: "nesw-resize", style: { top: -4, right: -4 } },
    { position: "bottom-left", cursor: "nesw-resize", style: { bottom: -4, left: -4 } },
    { position: "bottom-right", cursor: "nwse-resize", style: { bottom: -4, right: -4 } },
    { position: "top", cursor: "ns-resize", style: { top: -4, left: "50%", transform: "translateX(-50%)" } },
    { position: "right", cursor: "ew-resize", style: { right: -4, top: "50%", transform: "translateY(-50%)" } },
    { position: "bottom", cursor: "ns-resize", style: { bottom: -4, left: "50%", transform: "translateX(-50%)" } },
    { position: "left", cursor: "ew-resize", style: { left: -4, top: "50%", transform: "translateY(-50%)" } },
  ];

  return (
    <div
      ref={itemRef}
      data-testid="grid-canvas-item"
      onClick={handleClick}
      onMouseDown={handleDragStart}
      style={{
        gridColumn: `${currentPosition.colStart} / span ${currentSize.colSpan}`,
        gridRow: `${currentPosition.rowStart} / span ${currentSize.rowSpan}`,
        position: "relative",
        background: "#1e1e2e",
        border: isSelected ? "2px solid #6d9cff" : "1px solid #2a2a33",
        borderRadius: "4px",
        padding: "12px",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.6 : 1,
        transition: isDragging ? "none" : "all 0.15s",
        userSelect: "none",
        minHeight: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#a0a0b0",
        fontSize: "13px",
      }}
    >
      {/* Item content preview */}
      <div style={{ pointerEvents: "none" }}>
        {item.component}
      </div>

      {/* Resize handles (only when selected) */}
      {isSelected && handles.map(({ position, cursor, style }) => (
        <div
          key={position}
          data-testid={`grid-canvas-item-handle-${position}`}
          onMouseDown={(e) => handleResizeStart(e, position)}
          style={{
            position: "absolute",
            width: "8px",
            height: "8px",
            background: "#6d9cff",
            border: "1px solid white",
            borderRadius: "2px",
            cursor,
            zIndex: 10,
            ...style,
          }}
        />
      ))}
    </div>
  );
}
