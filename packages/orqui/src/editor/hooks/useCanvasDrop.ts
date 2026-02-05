// ============================================================================
// useCanvasDrop — Hook for managing canvas drop logic
// ============================================================================

import { useState, useCallback, type RefObject } from "react";
import type { GridLayoutConfig, GridItem } from "@/runtime/types";
import type { ComponentMetadata } from "../types/ComponentMetadata";

export interface DropPreview {
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  hasCollision: boolean;
}

export interface UseCanvasDropReturn {
  dropPreview: DropPreview | null;
  handleDragOver: (e: React.DragEvent, metadata: ComponentMetadata | null) => void;
  handleDrop: (e: React.DragEvent, metadata: ComponentMetadata | null, onAdd: (item: GridItem) => void) => void;
  handleDragLeave: () => void;
}

export function useCanvasDrop(
  canvasRef: RefObject<HTMLElement>,
  gridConfig: GridLayoutConfig,
  existingItems: GridItem[]
): UseCanvasDropReturn {
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);

  const calculateGridPosition = useCallback(
    (clientX: number, clientY: number, colSpan: number, rowSpan: number) => {
      if (!canvasRef.current) return null;

      const rect = canvasRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left - 24; // padding
      const relativeY = clientY - rect.top - 24; // padding

      const gapPx = parseInt(gridConfig.gap) || 16;
      const rowHeightPx = parseInt(gridConfig.rowHeight) || 80;

      // Calculate column width
      const containerWidth = rect.width - 48; // padding
      const totalGapWidth = gapPx * (gridConfig.columns - 1);
      const columnWidth = (containerWidth - totalGapWidth) / gridConfig.columns;

      // Calculate cell position
      let colStart = 1;
      let accumulatedWidth = 0;

      for (let col = 1; col <= gridConfig.columns; col++) {
        accumulatedWidth += columnWidth;
        if (relativeX < accumulatedWidth) {
          colStart = col;
          break;
        }
        accumulatedWidth += gapPx;
      }

      const rowStart = Math.max(1, Math.floor(relativeY / (rowHeightPx + gapPx)) + 1);

      // Ensure item doesn't go out of bounds
      colStart = Math.min(colStart, gridConfig.columns - colSpan + 1);

      return { colStart, rowStart };
    },
    [canvasRef, gridConfig]
  );

  const detectCollision = useCallback(
    (colStart: number, rowStart: number, colSpan: number, rowSpan: number) => {
      return existingItems.some((item) => {
        const itemEnd = { colEnd: colStart + colSpan, rowEnd: rowStart + rowSpan };
        const otherEnd = { colEnd: item.colStart + item.colSpan, rowEnd: item.rowStart + item.rowSpan };

        const colOverlap = colStart < otherEnd.colEnd && itemEnd.colEnd > item.colStart;
        const rowOverlap = rowStart < otherEnd.rowEnd && itemEnd.rowEnd > item.rowStart;

        return colOverlap && rowOverlap;
      });
    },
    [existingItems]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, metadata: ComponentMetadata | null) => {
      e.preventDefault();
      e.stopPropagation();

      if (!metadata) return;

      const position = calculateGridPosition(
        e.clientX,
        e.clientY,
        metadata.defaultColSpan,
        metadata.defaultRowSpan
      );

      if (!position) return;

      const hasCollision = detectCollision(
        position.colStart,
        position.rowStart,
        metadata.defaultColSpan,
        metadata.defaultRowSpan
      );

      setDropPreview({
        colStart: position.colStart,
        rowStart: position.rowStart,
        colSpan: metadata.defaultColSpan,
        rowSpan: metadata.defaultRowSpan,
        hasCollision,
      });
    },
    [calculateGridPosition, detectCollision]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, metadata: ComponentMetadata | null, onAdd: (item: GridItem) => void) => {
      e.preventDefault();
      e.stopPropagation();

      if (!metadata || !dropPreview) {
        setDropPreview(null);
        return;
      }

      // Cancel drop if collision
      if (dropPreview.hasCollision) {
        setDropPreview(null);
        return;
      }

      // Create new item
      const newItem: GridItem = {
        component: `${metadata.componentType}-${Date.now()}`,
        colStart: dropPreview.colStart,
        rowStart: dropPreview.rowStart,
        colSpan: dropPreview.colSpan,
        rowSpan: dropPreview.rowSpan,
        props: {},
      };

      onAdd(newItem);
      setDropPreview(null);
    },
    [dropPreview]
  );

  const handleDragLeave = useCallback(() => {
    setDropPreview(null);
  }, []);

  return {
    dropPreview,
    handleDragOver,
    handleDrop,
    handleDragLeave,
  };
}
