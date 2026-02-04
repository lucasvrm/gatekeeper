// ============================================================================
// EasyblocksPageEditor — Drop-in replacement for PageEditor
//
// PHASE 6 CHANGES:
//   P5: `visible` prop gates keyboard shortcuts (display:none coexistence)
//       Token CSS always updates (even when hidden) for instant show
//   P7: Change count indicator in floating overlay
//       ⌘? shortcut help button
//       Page duplicate support
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from "react";
import { EasyblocksEditor } from "@easyblocks/editor";
import type { PageDef } from "../page-editor/nodeDefaults";
import type { VariablesSection } from "../page-editor/variableSchema";
import { buildOrquiEasyblocksConfig } from "./config";
import { generateTokenCSSVariables } from "./bridge/tokens";
import { ORQUI_COMPONENTS } from "./components";
import { ORQUI_WIDGETS } from "./widgets/TemplatePickerWidget";
import { buildWidgetVariableContext } from "./bridge/variables";
import { PageSwitcher } from "./PageSwitcher";
import { hasEbCachedEntry, removeEbCachedEntry, clearAdapterSeededEntry, invalidateAllEntries, updatePageMeta } from "./backend";

// ============================================================================
// Iframe Detection
// ============================================================================

function isEasyblocksCanvasIframe(): boolean {
  if (window.self === window.parent) return false;
  try {
    if ((window.parent as any).isShopstoryEditor) return true;
  } catch {}
  try {
    if ((window.parent as any).editorWindowAPI) return true;
  } catch {}
  return true;
}

// ============================================================================
// Canvas-Only Mode (iframe child)
// ============================================================================

function EasyblocksCanvasOnly() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#fff" }}>
      <EasyblocksEditor
        config={{
          backend: {
            documents: {
              get: async () => ({ id: "", version: 0, entry: {} }),
              create: async () => ({ id: "", version: 0, entry: {} }),
              update: async () => ({ id: "", version: 0, entry: {} }),
            },
            templates: {
              get: async () => ({ id: "", label: "", entry: {}, isUserDefined: true as const }),
              getAll: async () => [],
              create: async () => ({ id: "", label: "", entry: {}, isUserDefined: true as const }),
              update: async () => ({ id: "", label: "" }),
              delete: async () => {},
            },
          },
          components: [],
          locales: [{ code: "pt-BR", isDefault: true }],
        } as any}
        components={ORQUI_COMPONENTS}
        widgets={ORQUI_WIDGETS}
      />
    </div>
  );
}

// ============================================================================
// Constants
// ============================================================================

const ROOT_COMPONENT_ID = "OrquiStack";

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryProps {
  onReset?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EasyblocksErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[EasyblocksEditor] Crash:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100%", width: "100%", gap: 16, padding: 32,
          background: "#0e0e11", color: "#e4e4e7",
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>O editor encontrou um erro</div>
          <div style={{ fontSize: 12, color: "#8b8b96", maxWidth: 480, textAlign: "center", lineHeight: 1.5 }}>
            {this.state.error?.message || "Erro desconhecido"}
          </div>
          <pre style={{
            fontSize: 11, color: "#5b5b66", fontFamily: "'JetBrains Mono', monospace",
            maxWidth: 560, maxHeight: 120, overflow: "auto", padding: 12,
            background: "#141417", borderRadius: 6, border: "1px solid #2a2a33",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}>
            {this.state.error?.stack?.split("\n").slice(0, 6).join("\n") || "No stack"}
          </pre>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: "#6d9cff", color: "#fff", fontSize: 13,
              fontWeight: 600, cursor: "pointer", marginTop: 8,
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Public Interface
// ============================================================================

interface EasyblocksPageEditorProps {
  pages: Record<string, PageDef>;
  onPagesChange: (pages: Record<string, PageDef>) => void;
  tokens?: Record<string, any>;
  variables?: VariablesSection;
  onVariablesChange?: (v: VariablesSection) => void;
  externalVariables?: VariablesSection;
  onSwitchToShell?: () => void;
  onSave?: () => void;
  saveStatus?: string | null;
  hasUnsavedChanges?: boolean;
  /** P5: Whether the editor is currently visible (gates keyboard shortcuts) */
  visible?: boolean;
}

// ============================================================================
// Component — Entry point with iframe detection
// ============================================================================

export function EasyblocksPageEditor({
  pages,
  onPagesChange,
  tokens = {},
  variables,
  onVariablesChange,
  externalVariables,
  onSwitchToShell,
  onSave,
  saveStatus,
  hasUnsavedChanges,
  visible = true,
}: EasyblocksPageEditorProps) {
  const [isCanvas] = useState(() => isEasyblocksCanvasIframe());

  if (isCanvas) {
    console.log("[Orqui] Easyblocks canvas iframe detected — rendering canvas only");
    return <EasyblocksCanvasOnly />;
  }

  return <EasyblocksParentEditor
    pages={pages}
    onPagesChange={onPagesChange}
    tokens={tokens}
    variables={variables}
    onVariablesChange={onVariablesChange}
    externalVariables={externalVariables}
    onSwitchToShell={onSwitchToShell}
    onSave={onSave}
    saveStatus={saveStatus}
    hasUnsavedChanges={hasUnsavedChanges}
    visible={visible}
  />;
}

// ============================================================================
// Parent Editor
// ============================================================================

function EasyblocksParentEditor({
  pages,
  onPagesChange,
  tokens = {},
  variables,
  externalVariables,
  onSwitchToShell,
  onSave,
  saveStatus,
  hasUnsavedChanges,
  visible = true,
}: EasyblocksPageEditorProps) {
  // ---- Page selection state ----
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    const pageIds = Object.keys(pages);
    return pageIds.length > 0 ? pageIds[0] : null;
  });

  const [ready, setReady] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  // ---- P7: Track EB change count since last save ----
  const [ebChangeCount, setEbChangeCount] = useState(0);

  // ---- Inject URL params that EasyblocksEditor reads ----
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set("readOnly", "false");

    if (selectedPageId && hasEbCachedEntry(selectedPageId)) {
      params.delete("rootComponent");
      params.delete("rootTemplate");
      params.set("document", selectedPageId);
    } else {
      params.delete("document");
      params.delete("rootTemplate");
      params.set("rootComponent", ROOT_COMPONENT_ID);
    }

    window.history.replaceState({}, "", url.toString());
    setReady(true);

    return () => {
      const cleanUrl = new URL(window.location.href);
      ["rootComponent", "document", "rootTemplate", "readOnly"].forEach(p =>
        cleanUrl.searchParams.delete(p)
      );
      window.history.replaceState({}, "", cleanUrl.toString());
    };
  }, [selectedPageId, editorKey]);  

  // ---- Expose variable context for template picker widgets ----
  useEffect(() => {
    const ctx = buildWidgetVariableContext(variables, externalVariables);
    (window as any).__orquiVariableContext = ctx;
    return () => {
      delete (window as any).__orquiVariableContext;
    };
  }, [variables, externalVariables]);

  // ---- Page switch handler ----
  const handleSelectPage = useCallback((pageId: string) => {
    if (pageId === selectedPageId) return;
    setReady(false);
    setSelectedPageId(pageId);
    setEditorKey(k => k + 1);
  }, [selectedPageId]);

  // ---- New page handler ----
  const handleNewPage = useCallback(() => {
    setReady(false);
    setSelectedPageId(null);
    setEditorKey(k => k + 1);
  }, []);

  // ---- Delete page handler ----
  const handleDeletePage = useCallback((pageId: string) => {
    const pageIds = Object.keys(pages);
    if (pageIds.length <= 1) return;

    const idx = pageIds.indexOf(pageId);
    const nextId = pageIds[idx === pageIds.length - 1 ? idx - 1 : idx + 1];

    removeEbCachedEntry(pageId);
    const { [pageId]: _removed, ...rest } = pages;
    onPagesChange(rest);

    setReady(false);
    setSelectedPageId(nextId || null);
    setEditorKey(k => k + 1);
  }, [pages, onPagesChange]);

  // ---- Page metadata update handler ----
  const handlePageMetaChange = useCallback((pageId: string, meta: Partial<Pick<PageDef, "label" | "route" | "browserTitle">>) => {
    const updated = updatePageMeta(pages, pageId, meta);
    onPagesChange(updated);
  }, [pages, onPagesChange]);

  // ---- Track newly created pages ----
  useEffect(() => {
    if (selectedPageId !== null) return;
    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) return;
    const newest = pageIds.reduce((a, b) => (a > b ? a : b));
    if (newest.startsWith("page-")) {
      setSelectedPageId(newest);
    }
  }, [pages, selectedPageId]);

  // ---- P5: Keyboard shortcuts — GATED on `visible` ----
  // Only active when the editor is shown (prevents conflicts with Shell shortcuts)
  useEffect(() => {
    if (!visible) return; // ← P5: don't register shortcuts when hidden

    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S — Force save (flush debounced changes)
      if (ctrl && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("orqui:force-save"));
      }

      // Ctrl+Shift+P — New page
      if (ctrl && e.shiftKey && e.key === "P") {
        e.preventDefault();
        handleNewPage();
      }

      // Ctrl+PgUp / Ctrl+Shift+Tab — Previous page
      if (ctrl && (e.key === "PageUp" || (e.shiftKey && e.key === "Tab"))) {
        e.preventDefault();
        const ids = Object.keys(pages);
        if (ids.length <= 1 || !selectedPageId) return;
        const idx = ids.indexOf(selectedPageId);
        const prev = ids[(idx - 1 + ids.length) % ids.length];
        handleSelectPage(prev);
      }

      // Ctrl+PgDn / Ctrl+Tab — Next page
      if (ctrl && (e.key === "PageDown" || (!e.shiftKey && e.key === "Tab"))) {
        e.preventDefault();
        const ids = Object.keys(pages);
        if (ids.length <= 1 || !selectedPageId) return;
        const idx = ids.indexOf(selectedPageId);
        const next = ids[(idx + 1) % ids.length];
        handleSelectPage(next);
      }

      // Ctrl+W — Delete current page
      if (ctrl && e.key === "w") {
        const ids = Object.keys(pages);
        if (ids.length > 1 && selectedPageId) {
          e.preventDefault();
          handleDeletePage(selectedPageId);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, handleNewPage, handleSelectPage, handleDeletePage, pages, selectedPageId]);

  // ---- Build Easyblocks config ----
  const handlePageChange = useCallback((pageId: string, page: PageDef) => {
    setEbChangeCount(c => c + 1); // P7: track change count
    onPagesChange({ ...pages, [pageId]: page });
  }, [pages, onPagesChange]);

  const config = useMemo(
    () => buildOrquiEasyblocksConfig({
      tokens,
      pages,
      onPageChange: handlePageChange,
      onPageDelete: handleDeletePage,
    }),
    [tokens, pages, handlePageChange, handleDeletePage]
  );

  // ---- Ref to latest config for cleanup ----
  const configRef = useRef(config);
  configRef.current = config;

  // ---- Flush debounced backend changes on unmount ----
  useEffect(() => {
    return () => {
      const c = configRef.current;
      if (c.backend && typeof (c.backend as any).flush === "function") {
        (c.backend as any).flush();
      }
    };
  }, []);  

  // ---- Listen for external changes (import, undo, token sync) ----
  // P5: This event is dispatched by OrquiEditor when tokens/vars change in Shell
  useEffect(() => {
    const handler = () => {
      invalidateAllEntries();
      setReady(false);
      setEditorKey(k => k + 1);
      setEbChangeCount(0); // Reset change count on rebuild
    };
    window.addEventListener("orqui:external-change", handler);
    return () => window.removeEventListener("orqui:external-change", handler);
  }, []);

  // ---- Flush backend on Ctrl+S (force-save event) ----
  // ALWAYS active (even when hidden) — OrquiEditor dispatches this during save
  useEffect(() => {
    const handler = async () => {
      if (config.backend && typeof (config.backend as any).flushSync === "function") {
        await (config.backend as any).flushSync();
      } else if (config.backend && typeof (config.backend as any).flush === "function") {
        (config.backend as any).flush();
      }
      setEbChangeCount(0); // Reset after flush
    };
    window.addEventListener("orqui:force-save", handler);
    return () => window.removeEventListener("orqui:force-save", handler);
  }, [config]);

  // ---- CSS variables for Orqui tokens ----
  // P5: Always update (even when hidden) so canvas is ready when shown
  const tokenCSS = useMemo(() => generateTokenCSSVariables(tokens), [tokens]);

  // ---- Error boundary reset ----
  const handleErrorReset = useCallback(() => {
    if (selectedPageId) {
      clearAdapterSeededEntry(selectedPageId);
    }
    setEditorKey(k => k + 1);
    setReady(false);
  }, [selectedPageId]);

  // Wait for URL params before rendering
  if (!ready) {
    return (
      <div style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0e11" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          color: "#5b5b66", fontSize: 13, fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "2px solid #2a2a33", borderTopColor: "#6d9cff",
            animation: "orqui-spin 0.7s linear infinite",
          }} />
          <span>Carregando página…</span>
          <style>{`@keyframes orqui-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* Token CSS variables — injected globally */}
      <style>{tokenCSS}</style>

      {/* ── Floating overlay: Orqui controls ─────────────────────────── */}
      <div style={{
        position: "fixed",
        top: 0, left: 64,
        zIndex: 100001,
        display: "flex", alignItems: "center", gap: 6,
        padding: "0 8px",
        height: 40,
        pointerEvents: "none",
      }}>
        {/* Switch to Shell & Tokens */}
        {onSwitchToShell && (
          <button
            onClick={onSwitchToShell}
            title="⌘⇧M — Shell & Tokens"
            style={{
              pointerEvents: "auto",
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "1px solid #2a2a33", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: "#1a1a1f", color: "#a0a0b0",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#242430";
              e.currentTarget.style.color = "#d0d0e0";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#1a1a1f";
              e.currentTarget.style.color = "#a0a0b0";
            }}
          >
            <span style={{ fontSize: 12 }}>⚙</span>
            Shell & Tokens
          </button>
        )}

        {/* Save button */}
        {onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === "saving"}
            title="⌘S — Salvar"
            style={{
              pointerEvents: "auto",
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: saveStatus === "saved" ? "#22c55e" : saveStatus === "error" ? "#ef4444" : "#6d9cff",
              color: "#fff",
              opacity: saveStatus === "saving" ? 0.6 : 1,
              transition: "all 0.15s",
              position: "relative",
            }}
          >
            {saveStatus === "saving" ? "…" : saveStatus === "saved" ? "✓" : saveStatus === "error" ? "✕" : "Save"}
            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && !saveStatus && (
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#fbbf24",
                position: "absolute", top: -2, right: -2,
              }} />
            )}
          </button>
        )}

        {/* P7: Change count indicator */}
        {ebChangeCount > 0 && !saveStatus && (
          <span style={{
            pointerEvents: "none",
            fontSize: 10, fontWeight: 500,
            color: "#fbbf24", opacity: 0.8,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {ebChangeCount} {ebChangeCount === 1 ? "alteração" : "alterações"}
          </span>
        )}
      </div>

      {/* ── Floating overlay: Page switcher ───────────────────────────── */}
      <div style={{
        position: "fixed",
        top: 40, left: 0,
        right: 240,
        zIndex: 100001,
        pointerEvents: "none",
      }}>
        <div style={{ pointerEvents: "auto" }}>
          <PageSwitcher
            pages={pages}
            currentPageId={selectedPageId}
            onSelectPage={handleSelectPage}
            onNewPage={handleNewPage}
            onDeletePage={handleDeletePage}
            onPageMetaChange={handlePageMetaChange}
            onPagesReorder={onPagesChange}
          />
        </div>
      </div>

      {/* ── EasyblocksEditor — THE sole component in the viewport ───── */}
      <EasyblocksErrorBoundary onReset={handleErrorReset}>
        <EasyblocksEditor
          key={editorKey}
          config={config}
          components={ORQUI_COMPONENTS}
          widgets={ORQUI_WIDGETS}
        />
      </EasyblocksErrorBoundary>
    </>
  );
}
