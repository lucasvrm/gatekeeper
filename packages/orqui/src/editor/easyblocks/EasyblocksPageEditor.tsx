// ============================================================================
// EasyblocksPageEditor — Drop-in replacement for PageEditor
//
// Uses the real EasyblocksEditor from @easyblocks/editor.
// Same public interface as page-editor/PageEditor.tsx.
//
// The EasyblocksEditor does NOT take a documentId — it manages document
// lifecycle internally via the Backend + URL hash. Our OrquiBackend
// bridges this to layout.pages.
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { EasyblocksEditor } from "@easyblocks/editor";
import type { PageDef, NodeDef } from "../page-editor/nodeDefaults";
import type { VariablesSection } from "../page-editor/variableSchema";
import { buildOrquiEasyblocksConfig } from "./config";
import { generateTokenCSSVariables } from "./bridge/tokens";
import { ORQUI_COMPONENTS } from "./components";
import { ORQUI_WIDGETS } from "./widgets/TemplatePickerWidget";

// ============================================================================
// Root component for new documents — OrquiStack acts as page root
// ============================================================================

const ROOT_COMPONENT_ID = "OrquiStack";

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
// Component
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

  // ---- Inject URL params that EasyblocksEditor reads via window.location.search ----
  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // If there's no document and no rootComponent, inject our default root
    if (!params.has("document") && !params.has("rootComponent") && !params.has("rootTemplate")) {
      params.set("rootComponent", ROOT_COMPONENT_ID);
      window.history.replaceState({}, "", url.toString());
    }

    setReady(true);

    // Cleanup: remove the param when unmounting
    return () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("rootComponent");
      cleanUrl.searchParams.delete("document");
      cleanUrl.searchParams.delete("rootTemplate");
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

  // ---- Wait for URL params before rendering editor ----
  if (!ready) return null;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {/* Inject Orqui token CSS variables into the page */}
      <style>{tokenCSS}</style>

      {/* Real Easyblocks Editor */}
      <EasyblocksEditor
        config={config}
        components={ORQUI_COMPONENTS}
        widgets={ORQUI_WIDGETS}
      />
    </div>
  );
}
