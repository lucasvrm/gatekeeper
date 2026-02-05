// ============================================================================
// useGridResize — Hook for resizing grid items via handles
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import { useGridSnap } from "./useGridSnap";

export type ResizeDirection =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface UseGridResizeResult {
  isResizing: boolean;
  resizeSize: { colSpan: number; rowSpan: number } | null;
  handleResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
}

interface UseGridResizeOptions {
  itemId: string;
  initialPosition: { colStart: number; rowStart: number };
  initialSize: { colSpan: number; rowSpan: number };
  onUpdateSize: (colSpan: number, rowSpan: number) => void;
  containerRef: React.RefObject<HTMLElement>;
  columnWidth: number;
  rowHeight: number;
  columns?: number;
}

export function useGridResize({
  itemId,
  initialPosition,
  initialSize,
  onUpdateSize,
  containerRef,
  columnWidth,
  rowHeight,
  columns = 12,
}: UseGridResizeOptions): UseGridResizeResult {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeSize, setResizeSize] = useState<{ colSpan: number; rowSpan: number } | null>(null);
  const resizeDirection = useRef<ResizeDirection | null>(null);
  const resizeStartPos = useRef<{ x: number; y: number } | null>(null);
  const initialSizeRef = useRef(initialSize);

  const { snapColSpan, snapRowSpan } = useGridSnap(columns);

  const handleResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    resizeDirection.current = direction;
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    initialSizeRef.current = initialSize;
  }, [initialSize]);

  useEffect(() => {
    if (!isResizing || !resizeDirection.current || !resizeStartPos.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !resizeStartPos.current) return;

      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;

      const colDelta = Math.round(deltaX / columnWidth);
      const rowDelta = Math.round(deltaY / rowHeight);

      let newColSpan = initialSizeRef.current.colSpan;
      let newRowSpan = initialSizeRef.current.rowSpan;

      const dir = resizeDirection.current;

      // Handle horizontal resize
      if (dir === "right" || dir === "top-right" || dir === "bottom-right") {
        newColSpan = initialSizeRef.current.colSpan + colDelta;
      } else if (dir === "left" || dir === "top-left" || dir === "bottom-left") {
        newColSpan = initialSizeRef.current.colSpan - colDelta;
      }

      // Handle vertical resize
      if (dir === "bottom" || dir === "bottom-left" || dir === "bottom-right") {
        newRowSpan = initialSizeRef.current.rowSpan + rowDelta;
      } else if (dir === "top" || dir === "top-left" || dir === "top-right") {
        newRowSpan = initialSizeRef.current.rowSpan - rowDelta;
      }

      setResizeSize({
        colSpan: snapColSpan(newColSpan),
        rowSpan: snapRowSpan(newRowSpan),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);

      if (resizeSize) {
        onUpdateSize(resizeSize.colSpan, resizeSize.rowSpan);
      }

      setResizeSize(null);
      resizeDirection.current = null;
      resizeStartPos.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeSize, onUpdateSize, containerRef, columnWidth, rowHeight, snapColSpan, snapRowSpan]);

  return {
    isResizing,
    resizeSize: resizeSize || initialSize,
    handleResizeStart,
  };
}
