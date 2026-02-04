// ============================================================================
// PageSwitcher — Tab bar for navigating between pages in the Easyblocks editor
//
// Renders above the EasyblocksEditor, showing:
//   - A tab for each existing page (from the `pages` prop)
//   - A [+ Nova] button to create a new blank page
//   - A delete button (×) on each tab (with confirmation)
//
// When the user switches pages, the parent re-mounts the EasyblocksEditor
// with a new `key` so it re-initializes with the correct ?document= param.
// ============================================================================

import React, { useState, useRef, useEffect, type CSSProperties } from "react";
import type { PageDef } from "../page-editor/nodeDefaults";
import { C, MONO } from "../page-editor/styles";

// ============================================================================
// Types
// ============================================================================

export interface PageSwitcherProps {
  pages: Record<string, PageDef>;
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onNewPage: () => void;
  onDeletePage?: (pageId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function PageSwitcher({
  pages,
  currentPageId,
  onSelectPage,
  onNewPage,
  onDeletePage,
}: PageSwitcherProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageIds = Object.keys(pages);

  // Auto-scroll to active tab
  useEffect(() => {
    if (!scrollRef.current || !currentPageId) return;
    const active = scrollRef.current.querySelector(`[data-page-id="${currentPageId}"]`);
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [currentPageId]);

  const handleDelete = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete === pageId) {
      // Second click — confirm delete
      onDeletePage?.(pageId);
      setConfirmDelete(null);
    } else {
      // First click — request confirmation
      setConfirmDelete(pageId);
      // Auto-dismiss after 3s
      setTimeout(() => setConfirmDelete(prev => prev === pageId ? null : prev), 3000);
    }
  };

  return (
    <div style={containerStyle}>
      <div ref={scrollRef} style={scrollAreaStyle}>
        {pageIds.map(id => {
          const page = pages[id];
          const isActive = id === currentPageId;
          const isConfirming = confirmDelete === id;

          return (
            <button
              key={id}
              data-page-id={id}
              onClick={() => onSelectPage(id)}
              style={{
                ...tabStyle,
                ...(isActive ? activeTabStyle : {}),
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = C.surface3;
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 12, opacity: 0.6 }}>📄</span>
              <span style={{
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 120,
              }}>
                {page.label || id}
              </span>

              {/* Delete button */}
              {onDeletePage && pageIds.length > 1 && (
                <span
                  onClick={e => handleDelete(id, e)}
                  title={isConfirming ? "Clique novamente para confirmar" : "Excluir página"}
                  style={{
                    ...deleteStyle,
                    color: isConfirming ? C.danger : C.textDim,
                    opacity: isConfirming ? 1 : 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={e => {
                    if (!isConfirming) e.currentTarget.style.opacity = "0";
                  }}
                >
                  {isConfirming ? "✕" : "×"}
                </span>
              )}
            </button>
          );
        })}

        {/* New page button */}
        <button
          onClick={onNewPage}
          style={newPageStyle}
          onMouseEnter={e => { e.currentTarget.style.background = C.surface3; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          title="Nova página"
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          <span>Nova</span>
        </button>
      </div>

      {/* Page count indicator */}
      <div style={countStyle}>
        {pageIds.length} {pageIds.length === 1 ? "página" : "páginas"}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "0 8px",
  height: 36,
  background: C.bg,
  borderBottom: `1px solid ${C.border}`,
  flexShrink: 0,
  fontFamily: "'Inter', sans-serif",
};

const scrollAreaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  flex: 1,
  overflow: "auto",
  scrollbarWidth: "none",   // Firefox
};

const tabStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 5,
  border: "none",
  background: "transparent",
  color: C.textMuted,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.12s",
  fontFamily: "'Inter', sans-serif",
  position: "relative",
};

const activeTabStyle: CSSProperties = {
  background: C.surface2,
  color: C.text,
  fontWeight: 600,
};

const deleteStyle: CSSProperties = {
  marginLeft: 2,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.15s, color 0.15s",
  lineHeight: 1,
  padding: "0 2px",
};

const newPageStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "4px 8px",
  borderRadius: 5,
  border: `1px dashed ${C.border}`,
  background: "transparent",
  color: C.textDim,
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.12s",
  fontFamily: "'Inter', sans-serif",
  flexShrink: 0,
};

const countStyle: CSSProperties = {
  fontSize: 10,
  color: C.textDim,
  fontFamily: MONO,
  flexShrink: 0,
  padding: "0 4px",
};
