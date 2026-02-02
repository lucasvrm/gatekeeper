import React, { useState } from "react";
import { COLORS } from "../lib/constants";
import { TabBar } from "../components/shared";
import { LayoutPreview } from "./LayoutPreview";
import { TypographyPreview } from "./TypographyPreview";
import { ComponentPreview } from "./ComponentPreview";

// ============================================================================
// Preview Panel (standalone orchestrator - currently unused in main layout)
// ============================================================================
export function PreviewPanel({ layout, registry }) {
  const [previewTab, setPreviewTab] = useState("layout");
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>Live Preview</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Visualize o que os contratos descrevem antes de exportar</p>
      </div>
      <TabBar
        tabs={[{ id: "layout", label: "Layout" }, { id: "typography", label: "Typography" }, { id: "components", label: "Components" }]}
        active={previewTab}
        onChange={setPreviewTab}
      />
      {previewTab === "layout" && <LayoutPreview layout={layout} />}
      {previewTab === "typography" && <TypographyPreview layout={layout} />}
      {previewTab === "components" && <ComponentPreview registry={registry} />}
    </div>
  );
}
