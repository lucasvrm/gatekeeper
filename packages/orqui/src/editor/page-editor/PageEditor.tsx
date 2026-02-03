// ============================================================================
// PageEditor — main DnD page builder view
// Composes: page selector + element palette + DnD canvas + props editor
// Keyboard shortcuts: Cmd+Z, Cmd+Shift+Z, Cmd+D, Cmd+C, Cmd+V, Delete, Cmd+J
// ============================================================================

import React, { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { PageEditorProvider, usePageEditor } from "./PageEditorProvider";
import { VariablesProvider, useVariables } from "./VariablesContext";
import { LeftPanel } from "./LeftPanel";
import { DndCanvas } from "./DndCanvas";
import { PropsEditor } from "./PropsEditor";
import type { PageDef, NodeDef } from "./nodeDefaults";
import { createDefaultPage, generateId } from "./nodeDefaults";
import { flattenTree, findParent } from "./treeUtils";
import type { VariablesSection } from "./variableSchema";
import { EMPTY_VARIABLES } from "./variableSchema";
import { C, MONO } from "./styles";

// ============================================================================
// Public component
// ============================================================================

interface PageEditorProps {
  pages: Record<string, PageDef>;
  onPagesChange: (pages: Record<string, PageDef>) => void;
  tokens?: Record<string, any>;
  /** User-defined variables (from contract layout.variables) */
  variables?: VariablesSection;
  /** Called when user edits variables */
  onVariablesChange?: (v: VariablesSection) => void;
  /** External variables provided by consumer (read-only in editor) */
  externalVariables?: VariablesSection;
}

export function PageEditor({ pages, onPagesChange, tokens, variables, onVariablesChange, externalVariables }: PageEditorProps) {
  const userVars = variables || EMPTY_VARIABLES;
  const handleVarsChange = onVariablesChange || (() => {});

  return (
    <PageEditorProvider initialPages={pages}>
      <VariablesProvider
        userVariables={userVars}
        externalVariables={externalVariables}
        onUserVariablesChange={handleVarsChange}
      >
        <PageEditorInner onPagesChange={onPagesChange} />
      </VariablesProvider>
    </PageEditorProvider>
  );
}

// ============================================================================
// Inner layout
// ============================================================================

function PageEditorInner({ onPagesChange }: { onPagesChange: (pages: Record<string, PageDef>) => void }) {
  const {
    state, dispatch, currentPage, currentContent, selectedNode,
    undo, redo, canUndo, canRedo,
    removeNode, duplicateNode, copyNode, pasteNode,
  } = usePageEditor();
  const { merged, userVariables, onUserVariablesChange } = useVariables();
  const [viewMode, setViewMode] = useState<"design" | "json">("design");

  // Sync pages to parent on every change
  useEffect(() => {
    onPagesChange(state.pages);
  }, [state.pages]);

  // ---- Global keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

      // Undo: Cmd+Z (works even in inputs)
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if (mod && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Skip remaining shortcuts if in a text input
      if (isInput) return;

      // Duplicate: Cmd+D
      if (mod && e.key === "d") {
        e.preventDefault();
        if (state.selectedNodeId) duplicateNode(state.selectedNodeId);
        return;
      }

      // Copy: Cmd+C
      if (mod && e.key === "c") {
        e.preventDefault();
        if (state.selectedNodeId) copyNode(state.selectedNodeId);
        return;
      }

      // Paste: Cmd+V
      if (mod && e.key === "v") {
        e.preventDefault();
        if (!state.clipboard || !currentContent) return;
        // Paste into selected container, or into root
        if (state.selectedNodeId) {
          const sel = selectedNode;
          if (sel?.children !== undefined) {
            // Selected node is a container — paste as last child
            pasteNode(sel.id, sel.children?.length || 0);
          } else {
            // Selected node is a leaf — paste after it in parent
            const parentInfo = findParent(currentContent, state.selectedNodeId);
            if (parentInfo) {
              pasteNode(parentInfo.parent.id, parentInfo.index + 1);
            }
          }
        } else {
          // No selection — paste at end of root
          pasteNode(currentContent.id, currentContent.children?.length || 0);
        }
        return;
      }

      // Delete/Backspace: remove selected node
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedNodeId && state.selectedNodeId !== currentContent?.id) {
          e.preventDefault();
          removeNode(state.selectedNodeId);
        }
        return;
      }

      // Escape: deselect
      if (e.key === "Escape") {
        dispatch({ type: "SELECT_NODE", nodeId: null });
        return;
      }

      // Cmd+J: toggle JSON view
      if (mod && e.key === "j") {
        e.preventDefault();
        setViewMode(prev => prev === "design" ? "json" : "design");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.selectedNodeId, state.clipboard, currentContent, selectedNode, undo, redo]);

  return (
    <div style={rootStyle}>
      {/* Page selector + actions bar */}
      <PageBar viewMode={viewMode} setViewMode={setViewMode} />

      {/* Three-panel layout */}
      <div style={mainStyle}>
        {/* Left: palette / tree / variables / presets */}
        <div style={leftPanelStyle}>
          <LeftPanel
            merged={merged}
            userVariables={userVariables}
            onUserVariablesChange={onUserVariablesChange}
          />
        </div>

        {/* Center: canvas or JSON */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {currentContent && <CanvasInfoBar content={currentContent} />}
          {viewMode === "design" ? <DndCanvas /> : <JsonView />}
        </div>

        {/* Right: props editor */}
        <div style={rightPanelStyle}>
          <PropsEditor />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page selector bar
// ============================================================================

function PageBar({ viewMode, setViewMode }: { viewMode: string; setViewMode: (m: "design" | "json") => void }) {
  const { state, dispatch, currentPage, undo, redo, canUndo, canRedo, historySize } = usePageEditor();
  const pages = Object.values(state.pages);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const page = createDefaultPage(id, newLabel.trim(), `/${id}`);
    dispatch({ type: "ADD_PAGE", page });
    setNewLabel("");
    setAdding(false);
  };

  const handleStartEdit = (page: PageDef) => {
    setEditingId(page.id);
    setEditLabel(page.label);
  };

  const handleFinishEdit = () => {
    if (editingId && editLabel.trim()) {
      dispatch({ type: "UPDATE_PAGE_META", pageId: editingId, label: editLabel.trim() });
    }
    setEditingId(null);
  };

  return (
    <div style={pageBarStyle}>
      {/* Page tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflow: "auto" }}>
        {pages.map(page => (
          <div key={page.id} style={{ display: "flex", alignItems: "center" }}>
            {editingId === page.id ? (
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={e => { if (e.key === "Enter") handleFinishEdit(); if (e.key === "Escape") setEditingId(null); }}
                autoFocus
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${C.accent}`, background: C.surface2, color: C.text,
                  outline: "none", width: 120, fontFamily: "'Inter', sans-serif",
                }}
              />
            ) : (
              <button
                onClick={() => dispatch({ type: "SELECT_PAGE", pageId: page.id })}
                onDoubleClick={() => handleStartEdit(page)}
                style={{
                  padding: "5px 12px", borderRadius: 5, fontSize: 12, fontWeight: 500,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  background: state.currentPageId === page.id ? C.accent + "20" : "transparent",
                  color: state.currentPageId === page.id ? C.accent : C.textMuted,
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {page.label}
                <span style={{ fontSize: 9, color: C.textDim }}>{page.route}</span>
              </button>
            )}

            {pages.length > 1 && state.currentPageId === page.id && (
              <button
                onClick={() => {
                  if (confirm(`Excluir página "${page.label}"?`)) {
                    dispatch({ type: "REMOVE_PAGE", pageId: page.id });
                  }
                }}
                style={tinyBtnStyle}
                title="Excluir página"
              >✕</button>
            )}
          </div>
        ))}

        {/* Add page */}
        {adding ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              autoFocus
              placeholder="Nome da página"
              style={{
                padding: "4px 8px", borderRadius: 4, fontSize: 12,
                border: `1px solid ${C.accent}`, background: C.surface2, color: C.text,
                outline: "none", width: 140, fontFamily: "'Inter', sans-serif",
              }}
            />
            <button onClick={handleAdd} style={{ ...addBtnStyle, background: C.accent, color: "#fff" }}>OK</button>
            <button onClick={() => setAdding(false)} style={addBtnStyle}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={addPageBtnStyle} title="Adicionar página">
            + Página
          </button>
        )}
      </div>

      {/* Right: undo/redo + view toggle + node count */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Undo/Redo */}
        <button onClick={undo} disabled={!canUndo} style={actionBtnStyle(canUndo)} title="Desfazer (⌘Z)">↶</button>
        <button onClick={redo} disabled={!canRedo} style={actionBtnStyle(canRedo)} title="Refazer (⌘⇧Z)">↷</button>

        {canUndo && (
          <span style={{ fontSize: 9, color: C.textDim, fontFamily: MONO, marginRight: 2 }}>
            {historySize}
          </span>
        )}

        <div style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />

        {/* View toggle */}
        <div style={{ display: "flex", gap: 1, background: C.surface2, padding: 2, borderRadius: 5 }}>
          <button
            onClick={() => setViewMode("design")}
            style={viewToggle(viewMode === "design")}
            title="Design (⌘J)"
          >📐</button>
          <button
            onClick={() => setViewMode("json")}
            style={viewToggle(viewMode === "json")}
            title="JSON (⌘J)"
          >{"{}"}</button>
        </div>

        {currentPage && (
          <>
            <div style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
            <span style={nodeCountStyle}>
              {currentPage.content ? flattenTree(currentPage.content).length : 0} nodes
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Canvas info bar
// ============================================================================

function CanvasInfoBar({ content }: { content: NodeDef }) {
  const { state } = usePageEditor();
  const nodes = flattenTree(content);
  const types = new Set(nodes.map(n => n.node.type));

  return (
    <div style={infoBarStyle}>
      <span>{nodes.length} elementos · {types.size} tipos</span>
      <span style={{ flex: 1 }} />

      {/* Clipboard indicator */}
      {state.clipboard && (
        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 3,
          background: C.accent + "10", color: C.accent,
          border: `1px solid ${C.accent}25`,
        }}>
          📋 {state.clipboard.type} copiado
        </span>
      )}

      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim + "80" }}>
        ⌘Z desfazer · ⌘D duplicar · ⌘C/V copiar/colar · Del remover · ⌘J json
      </span>
    </div>
  );
}

// ============================================================================
// JSON view
// ============================================================================

function JsonView() {
  const { currentPage, currentContent, dispatch } = usePageEditor();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync from state → textarea
  useEffect(() => {
    if (currentPage) {
      setJsonText(JSON.stringify(currentPage, null, 2));
      setError(null);
    }
  }, [currentPage]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.id || !parsed.content) {
        setError("JSON precisa ter 'id' e 'content'");
        return;
      }
      dispatch({
        type: "SET_PAGES",
        pages: { ...usePageEditor_hack_pages(), [parsed.id]: parsed },
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Hack to get current pages without being inside the callback
  // The dispatch SET_PAGES needs all pages — we read from the state at render time
  const pagesRef = useRef(usePageEditor().state.pages);
  pagesRef.current = usePageEditor().state.pages;
  const usePageEditor_hack_pages = () => pagesRef.current;

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: C.bg, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>JSON da página</span>
        <span style={{ flex: 1 }} />
        {error && <span style={{ fontSize: 11, color: C.danger }}>{error}</span>}
        <button onClick={handleApply} style={{
          padding: "4px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
          background: C.accent, color: "#fff", border: "none", cursor: "pointer",
        }}>
          Aplicar
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={jsonText}
        onChange={e => setJsonText(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1, width: "100%",
          fontFamily: MONO, fontSize: 12, lineHeight: 1.6,
          color: C.text, background: C.surface,
          padding: 16, borderRadius: 8,
          border: `1px solid ${error ? C.danger : C.border}`,
          outline: "none", resize: "none",
          tabSize: 2,
        }}
      />
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const rootStyle: CSSProperties = {
  display: "flex", flexDirection: "column",
  height: "100%", width: "100%",
  background: C.bg,
  fontFamily: "'Inter', sans-serif",
};

const mainStyle: CSSProperties = {
  flex: 1, display: "flex", overflow: "hidden",
};

const leftPanelStyle: CSSProperties = {
  width: 220, minWidth: 220,
  height: "100%", overflow: "hidden",
};

const rightPanelStyle: CSSProperties = {
  width: 270, minWidth: 270,
  height: "100%", overflow: "hidden",
};

const pageBarStyle: CSSProperties = {
  display: "flex", alignItems: "center",
  padding: "0 12px", height: 40, minHeight: 40,
  background: C.surface,
  borderBottom: `1px solid ${C.border}`,
  gap: 8,
};

const infoBarStyle: CSSProperties = {
  padding: "4px 16px", display: "flex", alignItems: "center", gap: 8,
  borderBottom: `1px solid ${C.border}`,
  background: C.surface, fontSize: 11, color: C.textDim,
  flexShrink: 0,
};

const addPageBtnStyle: CSSProperties = {
  padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
  border: `1px dashed ${C.border}`,
  background: "transparent", color: C.textDim,
  cursor: "pointer", fontFamily: "'Inter', sans-serif",
  marginLeft: 4,
};

const addBtnStyle: CSSProperties = {
  padding: "3px 8px", borderRadius: 4, fontSize: 11,
  border: `1px solid ${C.border}`,
  background: "transparent", color: C.textMuted,
  cursor: "pointer", fontFamily: "'Inter', sans-serif",
};

const tinyBtnStyle: CSSProperties = {
  width: 18, height: 18, borderRadius: 3, border: "none",
  background: "transparent", color: C.textDim, cursor: "pointer",
  fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
};

function actionBtnStyle(enabled: boolean): CSSProperties {
  return {
    width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 4, border: `1px solid ${C.border}`,
    background: C.surface2,
    color: enabled ? C.text : C.textDim,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: 13, opacity: enabled ? 1 : 0.35,
    fontFamily: "'Inter', sans-serif",
  };
}

function viewToggle(active: boolean): CSSProperties {
  return {
    padding: "3px 8px", borderRadius: 3, fontSize: 11,
    background: active ? C.surface3 : "transparent",
    color: active ? C.text : C.textDim,
    border: "none", cursor: "pointer",
    fontFamily: MONO, fontWeight: 600,
  };
}

const nodeCountStyle: CSSProperties = {
  fontSize: 10, padding: "2px 8px", borderRadius: 4,
  background: C.accent + "10", color: C.accent,
  border: `1px solid ${C.accent}25`,
  fontWeight: 600,
};
