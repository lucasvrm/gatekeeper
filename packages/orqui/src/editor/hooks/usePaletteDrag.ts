// ============================================================================
// usePaletteDrag — Hook for managing palette item drag state
// ============================================================================

import { useState, useCallback } from "react";
import type { ComponentMetadata } from "../types/ComponentMetadata";

export interface UsePaletteDragReturn {
  isDragging: boolean;
  draggedComponent: ComponentMetadata | null;
  handleDragStart: (component: ComponentMetadata) => void;
  handleDragEnd: () => void;
}

export function usePaletteDrag(): UsePaletteDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<ComponentMetadata | null>(null);

  const handleDragStart = useCallback((component: ComponentMetadata) => {
    setIsDragging(true);
    setDraggedComponent(component);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedComponent(null);
  }, []);

  return {
    isDragging,
    draggedComponent,
    handleDragStart,
    handleDragEnd,
  };
}
