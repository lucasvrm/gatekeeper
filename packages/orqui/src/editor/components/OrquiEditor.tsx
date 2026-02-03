// ============================================================================
// OrquiEditor
// Main editor layout — composes all panels into the full editing experience
// ============================================================================

import React, { type CSSProperties } from "react";
import { EditorProvider, useEditor } from "../EditorProvider.js";
import { EditorCanvas } from "./EditorCanvas.js";
import { ElementPanel } from "./ElementPanel.js";
import { PropsPanel } from "./PropsPanel.js";
import { VariablePicker } from "./VariablePicker.js";
import { NavEditor, NavItemEditor, HeaderEditor } from "./NavHeaderEditors.js";
import type { LayoutContractV2 } from "../../runtime/context/ContractProvider.js";

// ============================================================================
// Public Component
// ============================================================================

export interface OrquiEditorProps {
  contract: LayoutContractV2;
  variables: Record<string, any>;
  onSave?: (contract: LayoutContractV2) => void;
  onExport?: (contract: LayoutContractV2) => void;
}

export function OrquiEditor({ contract, variables, onSave, onExport }: OrquiEditorProps) {
  return (
    <EditorProvider contract={contract} variables={variables}>
      <EditorLayout onSave={onSave} onExport={onExport} />
    </EditorProvider>
  );
}

// ============================================================================
// Internal Layout
// ============================================================================

function EditorLayout({ onSave, onExport }: { onSave?: (c: LayoutContractV2) => void; onExport?: (c: LayoutContractV2) => void }) {
  const { state, setPage, setMode, undo, redo, canUndo, canRedo } = useEditor();

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); onSave?.(state.contract); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, state.contract, onSave]);

  const pages = Object.entries(state.contract.pages);

  return (
    <div style={rootStyle}>
      {/* ---- Top Toolbar ---- */}
      <div style={toolbarStyle}>
        {/* Left: Logo + pages */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: "14px", color: "var(--orqui-colors-accent, #6d9cff)" }}>
            .Orqui
          </span>
          <span style={{ width: "1px", height: "20px", background: "var(--orqui-colors-border, #2a2a33)" }} />
          {/* Page selector */}
          <div style={{ display: "flex", gap: "2px" }}>
            {pages.map(([id, page]) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                style={{
                  padding: "4px 10px", borderRadius: "4px", fontSize: "12px",
                  background: state.currentPage === id ? "rgba(109,156,255,0.15)" : "transparent",
                  color: state.currentPage === id ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-muted, #8b8b96)",
                  border: "none", cursor: "pointer", fontWeight: state.currentPage === id ? 600 : 400,
                }}
              >
                {page.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Mode toggle */}
        <div style={{ display: "flex", gap: "2px", padding: "2px", background: "var(--orqui-colors-surface-2, #1c1c21)", borderRadius: "6px" }}>
          {(["design", "preview", "json"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              style={{
                padding: "4px 12px", borderRadius: "4px", fontSize: "12px",
                background: state.mode === mode ? "var(--orqui-colors-surface-3, #24242b)" : "transparent",
                color: state.mode === mode ? "var(--orqui-colors-text, #e4e4e7)" : "var(--orqui-colors-text-dim, #5b5b66)",
                border: "none", cursor: "pointer", fontWeight: 500, textTransform: "capitalize",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button onClick={undo} disabled={!canUndo} style={actionBtnStyle(canUndo)} title="Undo (⌘Z)">↶</button>
          <button onClick={redo} disabled={!canRedo} style={actionBtnStyle(canRedo)} title="Redo (⌘⇧Z)">↷</button>
          <span style={{ width: "1px", height: "20px", background: "var(--orqui-colors-border, #2a2a33)" }} />
          {onExport && (
            <button onClick={() => onExport(state.contract)} style={saveBtnStyle("outline")}>Exportar</button>
          )}
          {onSave && (
            <button onClick={() => onSave(state.contract)} style={saveBtnStyle("primary")}>
              {state.isDirty ? "Salvar *" : "Salvar"}
            </button>
          )}
        </div>
      </div>

      {/* ---- Main Area ---- */}
      <div style={mainAreaStyle}>
        {/* Left Panel */}
        <div style={leftPanelStyle}>
          {/* Tabs: Elements vs Nav/Header */}
          <LeftPanelTabs />
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {state.mode === "design" && <EditorCanvas />}
          {state.mode === "preview" && <PreviewMode />}
          {state.mode === "json" && <JsonMode />}
        </div>

        {/* Right Panel */}
        <div style={rightPanelStyle}>
          <PropsPanel />
        </div>
      </div>

      {/* Variable Picker overlay */}
      <VariablePicker />
    </div>
  );
}

// ============================================================================
// Left panel with tab switching
// ============================================================================

function LeftPanelTabs() {
  const [tab, setTab] = React.useState<"elements" | "structure">("elements");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
        {(["elements", "structure"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px", fontSize: "11px", fontWeight: 600,
              background: "none", border: "none", cursor: "pointer",
              color: tab === t ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-dim, #5b5b66)",
              borderBottom: tab === t ? "2px solid var(--orqui-colors-accent, #6d9cff)" : "2px solid transparent",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}
          >
            {t === "elements" ? "Elementos" : "Estrutura"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "elements" && <ElementPanel />}
        {tab === "structure" && (
          <div style={{ height: "100%", overflow: "auto" }}>
            <NavEditor />
            <NavItemEditor />
            <HeaderEditor />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Preview Mode
// ============================================================================

function PreviewMode() {
  const { state } = useEditor();
  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--orqui-colors-bg, #0a0a0b)", padding: "24px" }}>
      <div style={{ textAlign: "center", padding: "48px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>👁</div>
        <div style={{ fontSize: "14px" }}>Preview mode — renderiza com dados mock do variable schema</div>
        <div style={{ fontSize: "12px", marginTop: "4px" }}>
          Página: {state.currentPage}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// JSON Mode
// ============================================================================

function JsonMode() {
  const { state } = useEditor();
  const page = state.contract.pages[state.currentPage];
  const json = JSON.stringify(page || {}, null, 2);

  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--orqui-colors-bg, #0a0a0b)", padding: "16px" }}>
      <pre style={{
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: "12px",
        lineHeight: 1.6,
        color: "var(--orqui-colors-text, #e4e4e7)",
        background: "var(--orqui-colors-surface, #141417)",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--orqui-colors-border, #2a2a33)",
        overflow: "auto",
        whiteSpace: "pre-wrap",
      }}>
        {json}
      </pre>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const rootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  background: "var(--orqui-colors-bg, #0a0a0b)",
  color: "var(--orqui-colors-text, #e4e4e7)",
  fontFamily: "Inter, -apple-system, sans-serif",
  fontSize: "14px",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  height: "48px",
  minHeight: "48px",
  background: "var(--orqui-colors-surface, #141417)",
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const mainAreaStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
};

const leftPanelStyle: CSSProperties = {
  width: "240px",
  minWidth: "240px",
  height: "100%",
  overflow: "hidden",
  borderRight: "1px solid var(--orqui-colors-border, #2a2a33)",
  background: "var(--orqui-colors-surface, #141417)",
};

const rightPanelStyle: CSSProperties = {
  width: "280px",
  minWidth: "280px",
  height: "100%",
  overflow: "hidden",
};

function actionBtnStyle(enabled: boolean): CSSProperties {
  return {
    width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "4px", border: "1px solid var(--orqui-colors-border, #2a2a33)",
    background: "var(--orqui-colors-surface-2, #1c1c21)",
    color: enabled ? "var(--orqui-colors-text, #e4e4e7)" : "var(--orqui-colors-text-dim, #5b5b66)",
    cursor: enabled ? "pointer" : "not-allowed", fontSize: "14px", opacity: enabled ? 1 : 0.4,
  };
}

function saveBtnStyle(variant: "primary" | "outline"): CSSProperties {
  return {
    padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    background: variant === "primary" ? "var(--orqui-colors-accent, #6d9cff)" : "transparent",
    color: variant === "primary" ? "#fff" : "var(--orqui-colors-text, #e4e4e7)",
    border: variant === "outline" ? "1px solid var(--orqui-colors-border, #2a2a33)" : "none",
  };
}
