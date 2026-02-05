// ============================================================================
// useGridDrag — Hook for dragging grid items with snap
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { useGridSnap } from "./useGridSnap";

export interface UseGridDragResult {
  isDragging: boolean;
  dragPosition: { colStart: number; rowStart: number } | null;
  handleMouseDown: (e: React.MouseEvent) => void;
}

interface UseGridDragOptions {
  itemId: string;
  initialPosition: { colStart: number; rowStart: number };
  onUpdatePosition: (colStart: number, rowStart: number) => void;
  containerRef: React.RefObject<HTMLElement>;
  columnWidth: number;
  rowHeight: number;
  columns?: number;
}

export function useGridDrag({
  itemId,
  initialPosition,
  onUpdatePosition,
  containerRef,
  columnWidth,
  rowHeight,
  columns = 12,
}: UseGridDragOptions): UseGridDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ colStart: number; rowStart: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const { snapToGrid, clampColStart, clampRowStart } = useGridSnap(columns);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left mouse button
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !dragStartPos.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const { col, row } = snapToGrid(e.clientX, e.clientY, containerRect, columnWidth, rowHeight);

      setDragPosition({ colStart: clampColStart(col), rowStart: clampRowStart(row) });
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      if (dragPosition) {
        onUpdatePosition(dragPosition.colStart, dragPosition.rowStart);
      }

      setDragPosition(null);
      dragStartPos.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragPosition, onUpdatePosition, containerRef, columnWidth, rowHeight, snapToGrid, clampColStart, clampRowStart]);

  return {
    isDragging,
    dragPosition: dragPosition || initialPosition,
    handleMouseDown,
  };
}
