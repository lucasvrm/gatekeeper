// ============================================================================
// ComponentPaletteItem — Draggable palette item
// ============================================================================

import React from "react";
import type { ComponentMetadata } from "../types/ComponentMetadata";

interface ComponentPaletteItemProps {
  component: ComponentMetadata;
  onDragStart: (component: ComponentMetadata) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export function ComponentPaletteItem({
  component,
  onDragStart,
  onDragEnd,
  isDragging,
}: ComponentPaletteItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "component",
      JSON.stringify({
        componentType: component.componentType,
        defaultColSpan: component.defaultColSpan,
        defaultRowSpan: component.defaultRowSpan,
        componentMetadata: component,
      })
    );
    onDragStart(component);
  };

  return (
    <div
      data-testid={`palette-item-${component.componentType}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "4px",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.5 : 1,
        background: "transparent",
        transition: "all 0.15s",
        fontSize: "13px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "hsl(var(--accent) / 0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span data-testid="palette-item-icon" style={{ fontSize: "16px" }}>
        {component.icon}
      </span>
      <span data-testid="palette-item-name">{component.componentType}</span>
    </div>
  );
}
