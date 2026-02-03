// ============================================================================
// LeftPanel — tabs: Elementos | Estrutura | Variáveis | Presets
// ============================================================================

import React, { useState, type CSSProperties } from "react";
import { ElementPalette } from "./ElementPalette";
import { StructureTree } from "./StructureTree";
import { PagePresets } from "./PagePresets";
import { VariableEditor } from "./VariableEditor";
import type { MergedVariables, VariablesSection } from "./variableSchema";
import { C } from "./styles";

type Tab = "elements" | "tree" | "variables" | "presets";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "elements", label: "Elementos", icon: "⊞" },
  { id: "tree", label: "Árvore", icon: "🌲" },
  { id: "variables", label: "Vars", icon: "{ }" },
  { id: "presets", label: "Presets", icon: "📐" },
];

interface LeftPanelProps {
  merged: MergedVariables;
  userVariables: VariablesSection;
  onUserVariablesChange: (v: VariablesSection) => void;
}

export function LeftPanel({ merged, userVariables, onUserVariablesChange }: LeftPanelProps) {
  const [tab, setTab] = useState<Tab>("elements");

  return (
    <div style={rootStyle}>
      {/* Tab switcher */}
      <div style={tabBarStyle}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 10,
              fontWeight: 600,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: tab === t.id ? C.accent : C.textDim,
              borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              transition: "all 0.12s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              fontFamily: t.id === "variables" ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
            }}
          >
            <span style={{ fontSize: t.id === "variables" ? 9 : 11 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "elements" && <ElementPalette />}
        {tab === "tree" && <StructureTree />}
        {tab === "variables" && (
          <VariableEditor
            merged={merged}
            userVariables={userVariables}
            onUserVariablesChange={onUserVariablesChange}
          />
        )}
        {tab === "presets" && <PagePresets />}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: C.surface,
  borderRight: `1px solid ${C.border}`,
};

const tabBarStyle: CSSProperties = {
  display: "flex",
  borderBottom: `1px solid ${C.border}`,
  flexShrink: 0,
};
