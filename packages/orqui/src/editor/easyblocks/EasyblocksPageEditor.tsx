// ============================================================================
// EasyblocksPageEditor — Drop-in replacement for PageEditor
//
// ARCHITECTURE:
// Easyblocks renders using TWO instances of <EasyblocksEditor>:
//   1. PARENT — the toolbar, sidebar, property panel (this window)
//   2. CHILD  — the canvas iframe (loaded via same URL)
//
// When this component detects it's inside the Easyblocks canvas iframe,
// it short-circuits and renders ONLY <EasyblocksEditor> with a minimal
// config — the child instance gets everything from the parent via
// window.parent.editorWindowAPI.
//
// This is CRITICAL because without it, the iframe loads the full
// Gatekeeper app (sidebar, dashboard, nav) instead of the blank canvas.
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
import { hasEbCachedEntry, removeEbCachedEntry, clearAdapterSeededEntry, invalidateAllEntries } from "./backend";

// ============================================================================
// Iframe Detection
// ============================================================================

/**
 * Detect if we're inside the Easyblocks canvas iframe.
 *
 * Easyblocks parent sets `window.isShopstoryEditor = true` before
 * creating the iframe. The iframe loads the same URL, so we check:
 *   1. Are we in an iframe? (window.self !== window.parent)
 *   2. Does the parent have the Easyblocks flag?
 *   3. Fallback: any iframe on /__orqui is the Easyblocks canvas
 */
function isEasyblocksCanvasIframe(): boolean {
  // Check 1: Are we in an iframe at all?
  if (window.self === window.parent) return false;

  // Check 2: Does parent have the Easyblocks/Shopstory flag?
  try {
    if ((window.parent as any).isShopstoryEditor) return true;
  } catch {
    // Cross-origin — can't access parent
  }

  // Check 3: Does parent have editorWindowAPI?
  try {
    if ((window.parent as any).editorWindowAPI) return true;
  } catch {
    // Cross-origin
  }

  // Check 4: Fallback — if we're in ANY iframe on /__orqui,
  // it's the Easyblocks canvas. Gatekeeper never iframes itself.
  return true;
}

// ============================================================================
// Canvas-Only Mode (iframe child)
// ============================================================================

/**
 * Minimal renderer for the Easyblocks canvas iframe.
 * EasyblocksEditor auto-detects child mode and reads config from parent.
 */
function EasyblocksCanvasOnly() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#fff" }}>
      <EasyblocksEditor
        config={{
          // Minimal config — child mode ignores this and reads from parent
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
// Public Interface (matches PageEditor exactly)
// ============================================================================

interface EasyblocksPageEditorProps {
  pages: Record<string, PageDef>;
  onPagesChange: (pages: Record<string, PageDef>) => void;
  tokens?: Record<string, any>;
  variables?: VariablesSection;
  onVariablesChange?: (v: VariablesSection) => void;
  externalVariables?: VariablesSection;
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
}: EasyblocksPageEditorProps) {
  // =====================================================================
  // IFRAME DETECTION — must be FIRST, before any other logic.
  // If we're in the Easyblocks canvas iframe, skip everything and render
  // only the canvas. This prevents the full Gatekeeper app from loading.
  // =====================================================================
  const [isCanvas] = useState(() => isEasyblocksCanvasIframe());

  if (isCanvas) {
    console.log("[Orqui] Easyblocks canvas iframe detected — rendering canvas only");
    return <EasyblocksCanvasOnly />;
  }

  // =====================================================================
  // PARENT MODE — Full editor with toolbar, sidebar, property panel
  // =====================================================================
  return <EasyblocksParentEditor
    pages={pages}
    onPagesChange={onPagesChange}
    tokens={tokens}
    variables={variables}
    onVariablesChange={onVariablesChange}
    externalVariables={externalVariables}
  />;
}

// ============================================================================
// Parent Editor (extracted to separate component to avoid conditional hooks)
//
// Phase 5: Page selection with PageSwitcher. The editor loads either:
//   - An existing page via ?document={id}  (backend.documents.get)
//   - A new blank page via ?rootComponent=OrquiStack (backend.documents.create)
//
// Switching pages requires re-mounting <EasyblocksEditor> because it only
// reads ?document= on initialization. We use the `key` prop to force this.
// ============================================================================

function EasyblocksParentEditor({
  pages,
  onPagesChange,
  tokens = {},
  variables,
  externalVariables,
}: EasyblocksPageEditorProps) {
  // ---- Page selection state ----
  // null = new page (rootComponent mode), string = existing page (document mode)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    const pageIds = Object.keys(pages);
    return pageIds.length > 0 ? pageIds[0] : null;
  });

  const [ready, setReady] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  // ---- Inject URL params that EasyblocksEditor reads ----
  // CRITICAL: We can only use ?document=xxx mode for pages that have a
  // cached Easyblocks-native entry (from previous create/update calls).
  // For pages never opened in Easyblocks, we MUST use ?rootComponent mode
  // because we can't convert NodeDef → Easyblocks internal format.
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set("readOnly", "false");

    if (selectedPageId && hasEbCachedEntry(selectedPageId)) {
      // Page has cached Easyblocks entry → document mode (loads via get())
      params.delete("rootComponent");
      params.delete("rootTemplate");
      params.set("document", selectedPageId);
    } else {
      // No cache → rootComponent mode (creates fresh OrquiStack)
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
  }, [selectedPageId, editorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Expose variable context for template picker widgets ----
  useEffect(() => {
    const ctx = buildWidgetVariableContext(variables, externalVariables);
    (window as any).__orquiVariableContext = ctx;
    return () => {
      delete (window as any).__orquiVariableContext;
    };
  }, [variables, externalVariables]);

  // ---- Page switch handler (forces EasyblocksEditor re-mount) ----
  const handleSelectPage = useCallback((pageId: string) => {
    if (pageId === selectedPageId) return;
    setReady(false);
    setSelectedPageId(pageId);
    setEditorKey(k => k + 1);
  }, [selectedPageId]);

  // ---- New page handler ----
  const handleNewPage = useCallback(() => {
    setReady(false);
    setSelectedPageId(null);  // null → rootComponent mode → backend.create()
    setEditorKey(k => k + 1);
  }, []);

  // ---- Delete page handler ----
  const handleDeletePage = useCallback((pageId: string) => {
    const pageIds = Object.keys(pages);
    if (pageIds.length <= 1) return; // Don't allow deleting the last page

    // Compute next page to navigate to
    const idx = pageIds.indexOf(pageId);
    const nextId = pageIds[idx === pageIds.length - 1 ? idx - 1 : idx + 1];

    // Clean up cached Easyblocks entry
    removeEbCachedEntry(pageId);

    // Remove from pages
    const { [pageId]: _removed, ...rest } = pages;
    onPagesChange(rest);

    // Navigate to adjacent page
    setReady(false);
    setSelectedPageId(nextId || null);
    setEditorKey(k => k + 1);
  }, [pages, onPagesChange]);

  // ---- Track newly created pages ----
  // When selectedPageId is null (new page mode), the backend.create() will
  // generate a new ID and call onPageChange. We detect when a new page appears
  // in the pages prop and auto-select it.
  useEffect(() => {
    if (selectedPageId !== null) return;
    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) return;
    // Find the newest page (highest timestamp in page-XXXXX format)
    const newest = pageIds.reduce((a, b) => (a > b ? a : b));
    if (newest.startsWith("page-")) {
      setSelectedPageId(newest);
    }
  }, [pages, selectedPageId]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+S — Force save (flush debounced changes)
      if (ctrl && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("orqui:force-save"));
      }

      // Ctrl+Shift+P — Focus page switcher (open new page prompt)
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

      // Ctrl+W — Delete current page (with safety: must have >1 page)
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
  }, [handleNewPage, handleSelectPage, handleDeletePage, pages, selectedPageId]);

  // ---- Build Easyblocks config ----
  const handlePageChange = useCallback((pageId: string, page: PageDef) => {
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
  // Prevents data loss when switching from Pages to Shell mode.
  useEffect(() => {
    return () => {
      const c = configRef.current;
      if (c.backend && typeof (c.backend as any).flush === "function") {
        (c.backend as any).flush();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Listen for external changes (import, undo, collaborative edits) ----
  // When emitted, invalidate all cache entries and remount the editor
  // so it re-hydrates from the current layout state.
  useEffect(() => {
    const handler = () => {
      invalidateAllEntries();
      setReady(false);
      setEditorKey(k => k + 1);
    };
    window.addEventListener("orqui:external-change", handler);
    return () => window.removeEventListener("orqui:external-change", handler);
  }, []);

  // ---- Flush backend on Ctrl+S (force-save event) ----
  useEffect(() => {
    const handler = () => {
      if (config.backend && typeof config.backend.flush === "function") {
        config.backend.flush();
      }
    };
    window.addEventListener("orqui:force-save", handler);
    return () => window.removeEventListener("orqui:force-save", handler);
  }, [config]);

  // ---- CSS variables for Orqui tokens ----
  const tokenCSS = useMemo(() => generateTokenCSSVariables(tokens), [tokens]);

  // ---- Error boundary reset ----
  // If the crash was caused by an adapter-seeded entry (best-effort hydration),
  // clear it so the editor falls back to rootComponent mode (empty stack).
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
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        {/* Keep PageSwitcher visible during loading for continuity */}
        <PageSwitcher
          pages={pages}
          currentPageId={selectedPageId}
          onSelectPage={handleSelectPage}
          onNewPage={handleNewPage}
          onDeletePage={handleDeletePage}
        />
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0e0e11",
        }}>
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
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
      <style>{tokenCSS}</style>

      {/* Page switcher bar */}
      <PageSwitcher
        pages={pages}
        currentPageId={selectedPageId}
        onSelectPage={handleSelectPage}
        onNewPage={handleNewPage}
        onDeletePage={handleDeletePage}
      />

      {/* Easyblocks editor — re-mounted on page switch via key.
       *
       * HEIGHT FIX — based on source analysis of @easyblocks/editor v1.0.10:
       *
       * Easyblocks has an internal `heightMode` prop (not in public API) that
       * defaults to "viewport". This causes:
       *   - #shopstory-app  → height: 100vh
       *   - SidebarAndContentContainer → height: calc(100vh - 40px)
       *
       * Since Orqui embeds the editor below its own header + page tabs,
       * the 100vh overflows by ~62px, cutting off the sidebar and canvas bottom.
       *
       * Fix: Two targeted CSS rules convert the layout from viewport-based
       * to container-based sizing, letting flex do the work.
       */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <style>{`
          /* Rule 1: Make editor root fill its flex parent instead of viewport */
          #shopstory-app {
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
          }
          /* Rule 2: SidebarAndContentContainer (always last DOM child of
             #shopstory-app — providers don't create DOM elements) uses
             flex-grow instead of calc(100vh - 40px) */
          #shopstory-app > :last-child {
            flex: 1 !important;
            height: auto !important;
            min-height: 0 !important;
          }
        `}</style>
        <EasyblocksErrorBoundary onReset={handleErrorReset}>
          <EasyblocksEditor
            key={editorKey}
            config={config}
            components={ORQUI_COMPONENTS}
            widgets={ORQUI_WIDGETS}
          />
        </EasyblocksErrorBoundary>
      </div>
    </div>
  );
}
