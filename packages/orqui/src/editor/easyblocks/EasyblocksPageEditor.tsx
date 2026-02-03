// ============================================================================
// EasyblocksPageEditor — Drop-in replacement for PageEditor
//
// Renders the real EasyblocksEditor from @easyblocks/editor.
// Same public interface as page-editor/PageEditor.tsx.
//
// ARCHITECTURE NOTE:
// The Easyblocks iframe problem is solved at the entry.tsx level, NOT here.
// entry.tsx detects if we're in the iframe and renders CanvasEntry.tsx
// directly — this component ONLY runs in parent (normal) mode.
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
// Component — Parent mode only (iframe is handled by entry.tsx)
// ============================================================================

export function EasyblocksPageEditor({
  pages,
  onPagesChange,
  tokens = {},
  variables,
  onVariablesChange,
  externalVariables,
}: EasyblocksPageEditorProps) {
  const [ready, setReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // ---- Inject URL params that EasyblocksEditor reads ----
  // Easyblocks reads from window.location.search at init:
  //   ?readOnly=false       → edit mode (MUST be explicit "false"!)
  //   ?document={id}        → load existing document
  //   ?rootComponent={id}   → create new document with this root
  // CRITICAL: Easyblocks defaults readOnly to TRUE if param is absent.

  const pageIds = useMemo(() => Object.keys(pages), [pages]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    params.set("readOnly", "false");

    if (!params.has("document") && !params.has("rootComponent") && !params.has("rootTemplate")) {
      // IMPORTANT: Always create a new document. Existing Orqui pages use raw CSS
      // values (e.g. "24px") for space/color props, but Easyblocks expects tokenized
      // responsive objects ({ tokenId: "md", value: "8px" }). Loading legacy pages
      // via the backend crashes normalizeTokenValue.
      // Phase 3 TODO: implement proper adapter conversion for tokenized props.
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
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
