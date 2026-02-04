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

  // ---- CSS overrides for Easyblocks editor layout ----
  // Increase right sidebar panel width by 40% (default ~300px → ~420px)
  const editorOverrideCSS = `
    /* ================================================================
     * Easyblocks Right Sidebar Panel — 40% wider
     * The editor uses a 3-column grid: [left] [canvas] [right-sidebar]
     * We target all known panel selectors from Easyblocks/Shopstory
     * ================================================================ */

    /* Approach 1: Override grid-template-columns on the editor root layout */
    [class*="EditorRoot"] > div,
    [class*="editor-root"] > div,
    [data-testid="editor-root"] > div,
    [class*="Editor__"] > div {
      grid-template-columns: auto 1fr 420px !important;
    }

    /* Approach 2: Target the right sidebar panel directly by position */
    [class*="SidebarRight"],
    [class*="sidebar-right"],
    [class*="RightPanel"],
    [class*="right-panel"],
    [class*="PropertiesPanel"],
    [class*="SidePanel"],
    [data-testid*="sidebar"],
    [data-testid*="right-panel"] {
      width: 420px !important;
      min-width: 420px !important;
      max-width: 420px !important;
    }

    /* Approach 3: Easyblocks/Shopstory uses inline styles with fixed widths.
     * Target last-child div siblings in the editor layout that look like sidebars.
     * The editor typically renders: [left 260px] [canvas flex] [right 300px]
     * We catch the right panel via the :last-child of the main grid. */
    [class*="Editor"] > div > div:last-child:not([class*="canvas"]):not([class*="Canvas"]):not(iframe) {
      width: 420px !important;
      min-width: 420px !important;
      flex-shrink: 0 !important;
    }

    /* Approach 4: Direct override for known Shopstory/Easyblocks panel containers.
     * Shopstory sets the sidebar width via CSS custom property. */
    :root {
      --easyblocks-sidebar-width: 420px;
      --shopstory-sidebar-width: 420px;
      --editor-right-panel-width: 420px;
    }

    /* Approach 5: Catch-all — any fixed-width element (~290-310px range)
     * sitting at the right edge of the editor grid. */
    [class*="Editor"] > div[style*="grid"] > div:last-child[style*="width"] {
      width: 420px !important;
      min-width: 420px !important;
    }
  `;

  // ---- Error boundary reset ----
  const handleErrorReset = useCallback(() => {
    setResetKey(k => k + 1);
  }, []);

  // ---- Force sidebar width via DOM observation ----
  // Easyblocks sets sidebar width via inline styles (JS-controlled),
  // so CSS !important alone may not be enough. MutationObserver ensures
  // the width is enforced even after Easyblocks re-renders.
  useEffect(() => {
    const SIDEBAR_WIDTH = 420; // 40% wider than default ~300px
    let observer: MutationObserver | null = null;

    function findAndResizeRightPanel() {
      // Strategy 1: Look for the Easyblocks editor grid container
      // and resize the last column (right sidebar)
      const editorRoot = document.querySelector('[class*="Editor"]') 
        || document.querySelector('[data-testid*="editor"]');
      
      if (!editorRoot) return;

      // The Easyblocks editor layout is typically:
      //   div (grid root)
      //     div (left panel ~260px)
      //     div/iframe (canvas)  
      //     div (right sidebar ~300px)
      const gridContainer = editorRoot.querySelector(':scope > div[style*="grid"], :scope > div[style*="display"]');
      if (gridContainer) {
        const children = Array.from(gridContainer.children) as HTMLElement[];
        if (children.length >= 3) {
          const rightPanel = children[children.length - 1] as HTMLElement;
          // Only resize if it looks like a sidebar (narrow, not canvas/iframe)
          const currentWidth = rightPanel.getBoundingClientRect().width;
          if (currentWidth > 200 && currentWidth < 400 && currentWidth !== SIDEBAR_WIDTH) {
            rightPanel.style.setProperty('width', `${SIDEBAR_WIDTH}px`, 'important');
            rightPanel.style.setProperty('min-width', `${SIDEBAR_WIDTH}px`, 'important');
            rightPanel.style.setProperty('max-width', `${SIDEBAR_WIDTH}px`, 'important');
          }
        }
        // Also override grid-template-columns if it uses grid
        const style = gridContainer.getAttribute('style') || '';
        if (style.includes('grid')) {
          const newStyle = style.replace(
            /grid-template-columns:\s*[^;]+/,
            `grid-template-columns: auto 1fr ${SIDEBAR_WIDTH}px`
          );
          if (newStyle !== style) {
            gridContainer.setAttribute('style', newStyle);
          }
        }
      }

      // Strategy 2: Find any panel-looking element on the right side
      // that has a width around 280-320px
      const allDivs = editorRoot.querySelectorAll('div');
      for (const div of allDivs) {
        const rect = div.getBoundingClientRect();
        const parentRect = editorRoot.getBoundingClientRect();
        // Is this div on the right edge and sidebar-width-ish?
        if (
          rect.right >= parentRect.right - 5 &&
          rect.width >= 250 && rect.width <= 380 &&
          rect.height > parentRect.height * 0.5 &&
          rect.width !== SIDEBAR_WIDTH
        ) {
          div.style.setProperty('width', `${SIDEBAR_WIDTH}px`, 'important');
          div.style.setProperty('min-width', `${SIDEBAR_WIDTH}px`, 'important');
          break; // Found the right panel, stop
        }
      }
    }

    // Run after initial render
    const initialTimer = setTimeout(findAndResizeRightPanel, 500);
    const secondTimer = setTimeout(findAndResizeRightPanel, 1500);

    // Observe DOM changes (Easyblocks re-renders can reset widths)
    observer = new MutationObserver(() => {
      // Debounce — don't run on every tiny mutation
      clearTimeout((observer as any).__debounce);
      (observer as any).__debounce = setTimeout(findAndResizeRightPanel, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
      observer?.disconnect();
    };
  }, [resetKey]);

  // Wait for URL params before rendering
  if (!ready) return null;

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <style>{tokenCSS}{editorOverrideCSS}</style>
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
