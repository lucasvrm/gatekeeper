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

import React, { useState, useCallback, useMemo, useEffect, Component, type ErrorInfo, type ReactNode } from "react";
import { EasyblocksEditor } from "@easyblocks/editor";
import type { PageDef } from "../page-editor/nodeDefaults";
import type { VariablesSection } from "../page-editor/variableSchema";
import { buildOrquiEasyblocksConfig } from "./config";
import { generateTokenCSSVariables } from "./bridge/tokens";
import { ORQUI_COMPONENTS } from "./components";
import { ORQUI_WIDGETS } from "./widgets/TemplatePickerWidget";

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
// ============================================================================

function EasyblocksParentEditor({
  pages,
  onPagesChange,
  tokens = {},
}: EasyblocksPageEditorProps) {
  const [ready, setReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // ---- Inject URL params that EasyblocksEditor reads ----
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set("readOnly", "false");

    // Always force rootComponent — legacy documents crash normalizeTokenValue
    params.delete("document");
    params.delete("rootTemplate");
    params.set("rootComponent", ROOT_COMPONENT_ID);

    window.history.replaceState({}, "", url.toString());
    setReady(true);

    return () => {
      const cleanUrl = new URL(window.location.href);
      ["rootComponent", "document", "rootTemplate", "readOnly"].forEach(p =>
        cleanUrl.searchParams.delete(p)
      );
      window.history.replaceState({}, "", cleanUrl.toString());
    };
  }, []);

  // ---- Build Easyblocks config ----
  const handlePageChange = useCallback((pageId: string, page: PageDef) => {
    onPagesChange({ ...pages, [pageId]: page });
  }, [pages, onPagesChange]);

  const config = useMemo(
    () => buildOrquiEasyblocksConfig({
      tokens,
      pages,
      onPageChange: handlePageChange,
    }),
    [tokens, pages, handlePageChange]
  );

  // ---- CSS variables for Orqui tokens ----
  const tokenCSS = useMemo(() => generateTokenCSSVariables(tokens), [tokens]);

  // ---- Error boundary reset ----
  const handleErrorReset = useCallback(() => {
    setResetKey(k => k + 1);
  }, []);

  // NOTE: Previous CSS overrides and MutationObserver for sidebar width
  // have been removed. Run the diagnostic script (DIAGNOSTIC-SIDEBAR.js)
  // in DevTools to identify the actual Easyblocks sidebar structure,
  // then apply a minimal targeted fix based on findings.

  // Wait for URL params before rendering
  if (!ready) return null;

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <style>{tokenCSS}</style>
      <EasyblocksErrorBoundary onReset={handleErrorReset}>
        <EasyblocksEditor
          key={resetKey}
          config={config}
          components={ORQUI_COMPONENTS}
          widgets={ORQUI_WIDGETS}
        />
      </EasyblocksErrorBoundary>
    </div>
  );
}
