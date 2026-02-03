// ============================================================================
// EasyblocksPageEditor — Drop-in replacement for PageEditor
//
// Same public interface as page-editor/PageEditor.tsx:
//   pages, onPagesChange, tokens, variables, onVariablesChange, externalVariables
//
// Internally renders the Easyblocks editor with Orqui configuration.
//
// Phase 1 (this file): Structural scaffold with fallback to legacy editor.
// Phase 4: Full Easyblocks editor integration.
//
// IMPORTANT: @easyblocks/editor must be installed before this can render.
// Until then, USE_EASYBLOCKS_EDITOR flag controls the switch.
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { PageDef } from "../page-editor/nodeDefaults";
import type { VariablesSection } from "../page-editor/variableSchema";
import { EMPTY_VARIABLES } from "../page-editor/variableSchema";
import { buildOrquiEasyblocksConfig } from "./config";
import { generateTokenCSSVariables } from "./bridge/tokens";
import { buildWidgetVariableContext } from "./bridge/variables";
import { pageDefToDocument, documentToPageDef } from "./adapter";

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * When false, renders a placeholder showing the Easyblocks config
 * is correctly built, but falls back to a status panel instead of
 * the actual EasyblocksEditor component (which requires npm install).
 *
 * Set to true once @easyblocks/editor is installed.
 */
const EASYBLOCKS_INSTALLED = false;

// ============================================================================
// Public Interface (matches PageEditor exactly)
// ============================================================================

interface EasyblocksPageEditorProps {
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
  const [currentPageId, setCurrentPageId] = useState<string | null>(
    () => Object.keys(pages)[0] || null
  );

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

  // ---- Variable context for template widgets ----
  const variableContext = useMemo(
    () => buildWidgetVariableContext(variables, externalVariables),
    [variables, externalVariables]
  );

  // ---- Sync current page when pages change externally ----
  useEffect(() => {
    if (currentPageId && !pages[currentPageId]) {
      const firstId = Object.keys(pages)[0] || null;
      setCurrentPageId(firstId);
    }
  }, [pages, currentPageId]);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  if (EASYBLOCKS_INSTALLED) {
    return <EasyblocksEditorWrapper config={config} currentPageId={currentPageId} />;
  }

  // ---- Fallback: Status panel showing config is ready ----
  return (
    <div style={{ display: "flex", height: "100%", background: "#0a0a0b", color: "#e4e4e7" }}>
      {/* Inject token CSS variables */}
      <style>{tokenCSS}</style>

      {/* Page sidebar */}
      <PageSidebar
        pages={pages}
        currentPageId={currentPageId}
        onSelectPage={setCurrentPageId}
      />

      {/* Main area — config status */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <div style={{ fontSize: 32, opacity: 0.2 }}>⚡</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Easyblocks Integration — Phase 1</div>
        <div style={{ fontSize: 12, color: "#8b8b96", textAlign: "center", maxWidth: 480, lineHeight: 1.6 }}>
          A configuração do Easyblocks foi construída com sucesso.
          Instale <code style={{ color: "#6d9cff" }}>@easyblocks/core</code> e{" "}
          <code style={{ color: "#6d9cff" }}>@easyblocks/editor</code> para ativar o editor visual.
        </div>

        {/* Config summary */}
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <StatusBadge label="Definitions" value={`${config.components.length}`} color="#4ade80" />
          <StatusBadge label="Colors" value={`${config.tokens.colors.length}`} color="#6d9cff" />
          <StatusBadge label="Space" value={`${config.tokens.space.length}`} color="#fbbf24" />
          <StatusBadge label="Fonts" value={`${config.tokens.fonts.length}`} color="#c084fc" />
          <StatusBadge label="Types" value={`${Object.keys(config.types || {}).length}`} color="#f472b6" />
          <StatusBadge label="Pages" value={`${Object.keys(pages).length}`} color="#4ade80" />
          <StatusBadge label="Variables" value={`${variableContext.paths.length}`} color="#fb923c" />
        </div>

        {/* Current page details */}
        {currentPageId && pages[currentPageId] && (
          <PageDetail page={pages[currentPageId]} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/** Placeholder for actual EasyblocksEditor — renders once package is installed */
function EasyblocksEditorWrapper({ config, currentPageId }: { config: any; currentPageId: string | null }) {
  // TODO Phase 4: import { EasyblocksEditor } from "@easyblocks/editor";
  // return (
  //   <EasyblocksEditor
  //     config={config}
  //     documentId={currentPageId}
  //     rootComponent="OrquiStack"
  //   />
  // );
  return <div>EasyblocksEditor placeholder — waiting for @easyblocks/editor install</div>;
}

/** Page list sidebar */
function PageSidebar({
  pages,
  currentPageId,
  onSelectPage,
}: {
  pages: Record<string, PageDef>;
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
}) {
  const pageList = Object.values(pages);

  return (
    <div style={{
      width: 220, borderRight: "1px solid #2a2a33", background: "#141417",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 14px", fontSize: 11, fontWeight: 600, color: "#8b8b96",
        textTransform: "uppercase", letterSpacing: "0.05em",
        borderBottom: "1px solid #2a2a33",
      }}>
        Páginas ({pageList.length})
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {pageList.map(page => (
          <button
            key={page.id}
            onClick={() => onSelectPage(page.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 14px", border: "none", cursor: "pointer",
              background: page.id === currentPageId ? "#6d9cff15" : "transparent",
              color: page.id === currentPageId ? "#6d9cff" : "#e4e4e7",
              fontSize: 13, fontFamily: "'Inter', sans-serif",
              borderLeft: page.id === currentPageId ? "2px solid #6d9cff" : "2px solid transparent",
              transition: "all 0.12s",
            }}
          >
            <div style={{ fontWeight: 500 }}>{page.label}</div>
            <div style={{ fontSize: 11, color: "#5b5b66", fontFamily: "'JetBrains Mono', monospace" }}>
              {page.route}
            </div>
          </button>
        ))}
        {pageList.length === 0 && (
          <div style={{ padding: 14, fontSize: 12, color: "#5b5b66" }}>
            Nenhuma página criada
          </div>
        )}
      </div>
    </div>
  );
}

/** Status badge */
function StatusBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: `${color}15`, color, border: `1px solid ${color}30`,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      <span style={{ color: "#8b8b96", fontWeight: 400 }}>{label}</span>
    </div>
  );
}

/** Page detail panel */
function PageDetail({ page }: { page: PageDef }) {
  const doc = pageDefToDocument(page);
  const entryJson = JSON.stringify(doc.entry, null, 2);
  const nodeCount = countNodes(page.content);

  return (
    <div style={{
      marginTop: 16, width: "100%", maxWidth: 640,
      background: "#141417", border: "1px solid #2a2a33", borderRadius: 8,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid #2a2a33",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12, color: "#8b8b96",
      }}>
        <span style={{ color: "#6d9cff", fontWeight: 600 }}>{page.label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{page.route}</span>
        <span style={{ marginLeft: "auto" }}>{nodeCount} nodes</span>
      </div>
      <pre style={{
        margin: 0, padding: 14, fontSize: 11, lineHeight: 1.5,
        color: "#8b8b96", fontFamily: "'JetBrains Mono', monospace",
        maxHeight: 300, overflow: "auto",
        whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
        {entryJson}
      </pre>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

import type { NodeDef } from "../page-editor/nodeDefaults";

function countNodes(node: NodeDef): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}
