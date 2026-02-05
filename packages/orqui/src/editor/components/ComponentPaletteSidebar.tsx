// ============================================================================
// ComponentPaletteSidebar — Main sidebar with palette and props editor
// ============================================================================

import React from "react";
import { COMPONENT_CATALOG, COMPONENT_CATEGORIES } from "../config/componentCatalog";
import { ComponentPaletteItem } from "./ComponentPaletteItem";
import { PropsEditor } from "./PropsEditor";
import { usePaletteDrag } from "../hooks/usePaletteDrag";
import type { GridItem } from "@/runtime/types";
import type { ComponentMetadata } from "../types/ComponentMetadata";

interface ComponentPaletteSidebarProps {
  selectedItem: GridItem | null;
  onUpdateProps: (itemId: string, props: Record<string, any>) => void;
  onDragStart: (metadata: ComponentMetadata) => void;
  onDragEnd: () => void;
}

export function ComponentPaletteSidebar({
  selectedItem,
  onUpdateProps,
  onDragStart,
  onDragEnd,
}: ComponentPaletteSidebarProps) {
  const { isDragging, draggedComponent, handleDragStart, handleDragEnd } = usePaletteDrag();

  const handleItemDragStart = (component: ComponentMetadata) => {
    handleDragStart(component);
    onDragStart(component);
  };

  const handleItemDragEnd = () => {
    handleDragEnd();
    onDragEnd();
  };

  // Find metadata for selected item
  const selectedMetadata = selectedItem
    ? COMPONENT_CATALOG.find((c) => selectedItem.component.startsWith(c.componentType))
    : null;

  return (
    <div
      data-testid="component-palette-sidebar"
      style={{
        width: "320px",
        background: "hsl(var(--background))",
        borderRight: "1px solid hsl(var(--border))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Component Palette Section */}
      <div
        data-testid="component-palette-section"
        style={{
          padding: "16px",
          overflowY: "auto",
          maxHeight: "60%",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px" }}>
          Componentes
        </h2>

        {Object.entries(COMPONENT_CATEGORIES).map(([category, components]) => (
          <div key={category} style={{ marginBottom: "16px" }}>
            <h3
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#888",
                marginBottom: "8px",
                position: "sticky",
                top: 0,
                background: "hsl(var(--background))",
                padding: "4px 0",
              }}
            >
              {category}
            </h3>

            {components.map((component) => (
              <ComponentPaletteItem
                key={component.componentType}
                component={component}
                onDragStart={handleItemDragStart}
                onDragEnd={handleItemDragEnd}
                isDragging={isDragging && draggedComponent?.componentType === component.componentType}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Props Editor Section */}
      <PropsEditor
        selectedItem={selectedItem}
        componentMetadata={selectedMetadata}
        onUpdateProps={onUpdateProps}
      />
    </div>
  );
}
