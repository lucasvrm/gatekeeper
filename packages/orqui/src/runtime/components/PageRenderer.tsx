// ============================================================================
// Orqui PageRenderer
// Renders a page from the contract by reading its definition and mounting
// the node tree through NodeRenderer
// ============================================================================

import React, { useEffect, type ReactNode } from "react";
import { useOrqui } from "../context/ContractProvider.js";
import { NodeRenderer } from "./NodeRenderer.js";
import type { DataContext } from "../../engine/resolver.js";

export interface PageRendererProps {
  /** Page ID from the contract (e.g., "dashboard", "runs-list") */
  page: string;
  /** Data context for this page (entity data, stats, etc.) */
  data?: DataContext;
  /** Named slots for injecting custom React components */
  slots?: Record<string, ReactNode>;
  /** Handler for row actions (table/list) */
  onAction?: (action: string, item: unknown) => void;
  /** Navigation handler */
  onNavigate?: (route: string) => void;
  /** Additional class name */
  className?: string;
  /** Additional inline style */
  style?: React.CSSProperties;
}

export function PageRenderer({
  page,
  data = {},
  slots = {},
  onAction,
  onNavigate,
  className,
  style,
}: PageRendererProps) {
  const ctx = useOrqui();

  // Sync current page in context
  useEffect(() => {
    ctx.setCurrentPage(page);
  }, [page]);

  // Get page definition
  const pageDef = ctx.getPage(page);

  if (!pageDef) {
    return (
      <div
        data-orqui-page={page}
        data-orqui-error="not-found"
        style={{
          padding: "var(--orqui-spacing-xl)",
          color: "var(--orqui-colors-text-dim)",
          textAlign: "center",
          ...style,
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
          Página não encontrada
        </h2>
        <p style={{ fontSize: "14px" }}>
          A página <code style={{ color: "var(--orqui-colors-accent)" }}>{page}</code> não existe no contrato.
        </p>
      </div>
    );
  }

  // Update document title
  useEffect(() => {
    if (pageDef.browserTitle && typeof document !== "undefined") {
      document.title = ctx.resolveText(pageDef.browserTitle, data);
    }
  }, [pageDef.browserTitle, data]);

  // Merge global data with page-specific data
  const mergedData: DataContext = { ...ctx.globalData, ...data };

  return (
    <div
      data-orqui-page={page}
      className={className}
      style={{
        width: "100%",
        maxWidth: "var(--orqui-sizing-content-max-width, 1200px)",
        margin: "0 auto",
        padding: "var(--orqui-spacing-lg)",
        ...style,
      }}
    >
      <NodeRenderer
        node={pageDef.content}
        data={mergedData}
        slots={slots}
        onAction={onAction}
        onNavigate={onNavigate}
      />
    </div>
  );
}
