// ============================================================================
// useGridSnap — Hook for snapping coordinates to grid cells
// ============================================================================

import { useCallback } from "react";

export interface UseGridSnapResult {
  snapToGrid: (x: number, y: number, containerRect: DOMRect, columnWidth: number, rowHeight: number) => { col: number; row: number };
  snapColSpan: (span: number) => number;
  snapRowSpan: (span: number) => number;
  clampColStart: (col: number) => number;
  clampRowStart: (row: number) => number;
}

export function useGridSnap(columns: number = 12): UseGridSnapResult {
  const snapToGrid = useCallback(
    (x: number, y: number, containerRect: DOMRect, columnWidth: number, rowHeight: number) => {
      // Convert pixel coordinates to grid cell
      const relativeX = x - containerRect.left;
      const relativeY = y - containerRect.top;

      const col = Math.max(1, Math.min(columns, Math.round(relativeX / columnWidth) + 1));
      const row = Math.max(1, Math.round(relativeY / rowHeight) + 1);

      return { col, row };
    },
    [columns]
  );

  const snapColSpan = useCallback((span: number): number => {
    return Math.max(1, Math.min(columns, Math.round(span)));
  }, [columns]);

  const snapRowSpan = useCallback((span: number): number => {
    return Math.max(1, Math.round(span));
  }, []);

  const clampColStart = useCallback((col: number): number => {
    return Math.max(1, Math.min(columns, col));
  }, [columns]);

  const clampRowStart = useCallback((row: number): number => {
    return Math.max(1, row);
  }, []);

  return {
    snapToGrid,
    snapColSpan,
    snapRowSpan,
    clampColStart,
    clampRowStart,
  };
}
