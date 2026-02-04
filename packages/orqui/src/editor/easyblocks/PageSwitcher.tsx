// ============================================================================
// PageSwitcher — Tab bar for navigating between pages in the Easyblocks editor
//
// PHASE 5 ENHANCEMENTS:
//   - Double-click tab label to rename inline
//   - Right-click (or ⋯ button) opens page settings popover
//     (route, browserTitle, id display)
//   - Visual improvements: active indicator line, smoother transitions
//   - onPageMetaChange callback for metadata updates
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  /** Callback when page metadata (label, route, browserTitle) changes */
  onPageMetaChange?: (pageId: string, meta: Partial<Pick<PageDef, "label" | "route" | "browserTitle">>) => void;
}

// ============================================================================
// Inline Edit Hook
// ============================================================================

function useInlineEdit(
  initialValue: string,
  onCommit: (value: string) => void,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setDraft(initialValue);
    setEditing(true);
  }, [initialValue]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== initialValue) {
      onCommit(trimmed);
    }
    setEditing(false);
  }, [draft, initialValue, onCommit]);

  const cancel = useCallback(() => {
    setDraft(initialValue);
    setEditing(false);
  }, [initialValue]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
    // Stop propagation to prevent Easyblocks shortcuts
    e.stopPropagation();
  }, [commit, cancel]);

  return { editing, draft, setDraft, inputRef, startEditing, commit, cancel, handleKeyDown };
}

// ============================================================================
// Page Settings Popover
// ============================================================================

interface PageSettingsProps {
  page: PageDef;
  pageId: string;
  onClose: () => void;
  onMetaChange: (meta: Partial<Pick<PageDef, "label" | "route" | "browserTitle">>) => void;
  anchorRect: DOMRect | null;
}

function PageSettings({ page, pageId, onClose, onMetaChange, anchorRect }: PageSettingsProps) {
  const [label, setLabel] = useState(page.label || "");
  const [route, setRoute] = useState(page.route || "");
  const [browserTitle, setBrowserTitle] = useState(page.browserTitle || "");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = () => {
    const meta: Partial<Pick<PageDef, "label" | "route" | "browserTitle">> = {};
    if (label.trim() && label.trim() !== page.label) meta.label = label.trim();
    if (route.trim() && route.trim() !== page.route) meta.route = route.trim();
    if (browserTitle.trim() !== (page.browserTitle || "")) meta.browserTitle = browserTitle.trim() || undefined;

    if (Object.keys(meta).length > 0) {
      onMetaChange(meta);
    }
    onClose();
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    e.stopPropagation();
  };

  // Position below the anchor
  const top = anchorRect ? anchorRect.bottom + 4 : 0;
  const left = anchorRect ? anchorRect.left : 0;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top, left,
        zIndex: 200000,
        minWidth: 280,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 2,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Configurações da Página
        </span>
        <span style={{ fontSize: 9, color: C.textDim, fontFamily: MONO }}>
          {pageId}
        </span>
      </div>

      {/* Label */}
      <SettingsField
        label="Nome"
        value={label}
        onChange={setLabel}
        placeholder="Nome da página"
        autoFocus
      />

      {/* Route */}
      <SettingsField
        label="Rota"
        value={route}
        onChange={setRoute}
        placeholder="/caminho-da-pagina"
        mono
      />

      {/* Browser Title */}
      <SettingsField
        label="Título do navegador"
        value={browserTitle}
        onChange={setBrowserTitle}
        placeholder="(usa o nome da página)"
      />

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{
            padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 500,
            border: `1px solid ${C.border}`, background: "transparent",
            color: C.textMuted, cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600,
            border: "none", background: C.accent, color: "#fff",
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}
        >
          Salvar ⌘↵
        </button>
      </div>
    </div>
  );
}

function SettingsField({
  label, value, onChange, placeholder, mono, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          padding: "6px 8px", borderRadius: 5, fontSize: 12,
          border: `1px solid ${C.border}`, background: C.surface2,
          color: C.text, outline: "none",
          fontFamily: mono ? MONO : "'Inter', sans-serif",
          transition: "border-color 0.15s",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
        onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
      />
    </div>
  );
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
  onPageMetaChange,
}: PageSwitcherProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [settingsPage, setSettingsPage] = useState<string | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<DOMRect | null>(null);
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

  const handleOpenSettings = (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setSettingsPage(pageId);
    setSettingsAnchor(rect);
  };

  const handleMetaChange = useCallback((pageId: string, meta: Partial<Pick<PageDef, "label" | "route" | "browserTitle">>) => {
    onPageMetaChange?.(pageId, meta);
  }, [onPageMetaChange]);

  return (
    <>
      <div style={containerStyle}>
        <div ref={scrollRef} style={scrollAreaStyle}>
          {pageIds.map(id => {
            const page = pages[id];
            const isActive = id === currentPageId;
            const isConfirming = confirmDelete === id;

            return (
              <PageTab
                key={id}
                pageId={id}
                page={page}
                isActive={isActive}
                isConfirming={isConfirming}
                canDelete={pageIds.length > 1 && !!onDeletePage}
                onSelect={() => onSelectPage(id)}
                onDelete={e => handleDelete(id, e)}
                onOpenSettings={e => handleOpenSettings(id, e)}
                onRename={onPageMetaChange ? (label) => handleMetaChange(id, { label }) : undefined}
              />
            );
          })}

          {/* New page button */}
          <button
            onClick={onNewPage}
            style={newPageStyle}
            onMouseEnter={e => { e.currentTarget.style.background = C.surface3; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            title="⌘⇧P — Nova página"
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

      {/* Page settings popover */}
      {settingsPage && pages[settingsPage] && (
        <PageSettings
          page={pages[settingsPage]}
          pageId={settingsPage}
          anchorRect={settingsAnchor}
          onClose={() => { setSettingsPage(null); setSettingsAnchor(null); }}
          onMetaChange={meta => {
            handleMetaChange(settingsPage, meta);
            setSettingsPage(null);
            setSettingsAnchor(null);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// PageTab — individual tab with inline rename
// ============================================================================

interface PageTabProps {
  pageId: string;
  page: PageDef;
  isActive: boolean;
  isConfirming: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onOpenSettings: (e: React.MouseEvent) => void;
  onRename?: (label: string) => void;
}

function PageTab({
  pageId, page, isActive, isConfirming, canDelete,
  onSelect, onDelete, onOpenSettings, onRename,
}: PageTabProps) {
  const { editing, draft, setDraft, inputRef, startEditing, commit, cancel, handleKeyDown } =
    useInlineEdit(page.label || pageId, (value) => onRename?.(value));

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRename) startEditing();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenSettings(e);
  };

  return (
    <button
      data-page-id={pageId}
      onClick={editing ? undefined : onSelect}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
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
      {/* Active indicator line */}
      {isActive && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 8, right: 8,
          height: 2, borderRadius: 1,
          background: C.accent,
        }} />
      )}

      <span style={{ fontSize: 12, opacity: 0.6 }}>📄</span>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={e => e.stopPropagation()}
          style={{
            width: Math.max(40, draft.length * 7 + 10),
            padding: "1px 4px",
            borderRadius: 3,
            border: `1px solid ${C.accent}`,
            background: C.surface2,
            color: C.text,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            outline: "none",
          }}
        />
      ) : (
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: 120,
        }}
          title={`${page.label || pageId} — ${page.route || "/"}\nDuplo-clique para renomear • Botão direito para configurações`}
        >
          {page.label || pageId}
        </span>
      )}

      {/* Settings button (⋯) */}
      {!editing && (
        <span
          onClick={onOpenSettings}
          title="Configurações da página"
          style={settingsButtonStyle}
          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
        >
          ⋯
        </span>
      )}

      {/* Delete button */}
      {!editing && canDelete && (
        <span
          onClick={onDelete}
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

const settingsButtonStyle: CSSProperties = {
  marginLeft: 1,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  transition: "opacity 0.15s",
  lineHeight: 1,
  padding: "0 2px",
  opacity: 0,
  color: C.textDim,
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
