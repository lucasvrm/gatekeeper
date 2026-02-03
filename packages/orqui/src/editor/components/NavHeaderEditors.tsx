// ============================================================================
// Orqui NavEditor & HeaderEditor
// P3.7 — Drag-and-drop reorder navigation items
// P3.8 — Move elements between header zones (left/center/right)
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from "react";
import { useEditor } from "../EditorProvider.js";
import type { NavItem, HeaderElement } from "../../runtime/context/ContractProvider.js";

// ============================================================================
// P3.7 — NavEditor: drag to reorder menu items
// ============================================================================

export function NavEditor() {
  const { state, dispatch, select } = useEditor();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const navItems = [...state.contract.navigation].sort((a, b) => a.order - b.order);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;

    const reordered = [...navItems];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    // Update order values
    const updated = reordered.map((item, i) => ({ ...item, order: i }));
    dispatch({ type: "UPDATE_NAV_ORDER", navigation: updated });

    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  const addNavItem = () => {
    const id = `nav-${Date.now().toString(36)}`;
    dispatch({
      type: "ADD_NAV_ITEM",
      item: {
        id,
        label: "Novo Item",
        icon: "Circle",
        route: "/new",
        order: navItems.length,
      },
    });
  };

  const addDivider = () => {
    const id = `divider-${Date.now().toString(36)}`;
    dispatch({
      type: "ADD_NAV_ITEM",
      item: { id, type: "divider", order: navItems.length },
    });
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span style={{ fontWeight: 600, fontSize: "13px" }}>Navegação</span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={addNavItem} style={addBtnStyle}>+ Item</button>
          <button onClick={addDivider} style={addBtnStyle}>+ Divisor</button>
        </div>
      </div>

      <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {navItems.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            onDragEnd={handleDragEnd}
            onClick={() => select({ type: "nav-item", id: item.id })}
            style={{
              ...navItemStyle,
              opacity: dragIdx === idx ? 0.4 : 1,
              borderTop: overIdx === idx && dragIdx !== null ? "2px solid var(--orqui-colors-accent, #6d9cff)" : "2px solid transparent",
              background: state.selection?.id === item.id ? "rgba(109,156,255,0.1)" : "transparent",
            }}
          >
            {/* Drag handle */}
            <span style={dragHandleStyle}>⋮⋮</span>

            {item.type === "divider" ? (
              <span style={{ flex: 1, fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>— divider —</span>
            ) : (
              <>
                <span style={{ flexShrink: 0, width: "18px", textAlign: "center", fontSize: "12px" }}>{item.icon ? "●" : ""}</span>
                <span style={{ flex: 1, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.label || item.id}
                </span>
                {item.badge && <span style={navBadgeStyle}>{item.badge}</span>}
                {item.position === "bottom" && <span style={{ fontSize: "9px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>↓</span>}
              </>
            )}

            {/* Delete */}
            <button
              onClick={(e) => { e.stopPropagation(); dispatch({ type: "REMOVE_NAV_ITEM", navItemId: item.id }); }}
              style={{ background: "none", border: "none", color: "var(--orqui-colors-text-dim, #5b5b66)", cursor: "pointer", fontSize: "11px", flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Selected nav item editor
// ============================================================================

export function NavItemEditor() {
  const { state, dispatch } = useEditor();

  if (state.selection?.type !== "nav-item") return null;
  const item = state.contract.navigation.find((n) => n.id === state.selection!.id);
  if (!item || item.type === "divider") return null;

  const update = (updates: Partial<NavItem>) => {
    dispatch({ type: "UPDATE_NAV_ITEM", navItemId: item.id, updates });
  };

  return (
    <div style={{ padding: "8px 0", borderTop: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
      <PropRow label="Label">
        <input value={item.label || ""} onChange={(e) => update({ label: e.target.value })} style={inputStyle} />
      </PropRow>
      <PropRow label="Ícone">
        <input value={item.icon || ""} onChange={(e) => update({ icon: e.target.value })} style={inputStyle} placeholder="House" />
      </PropRow>
      <PropRow label="Rota">
        <input value={item.route || ""} onChange={(e) => update({ route: e.target.value })} style={inputStyle} placeholder="/path" />
      </PropRow>
      <PropRow label="Badge">
        <input value={item.badge || ""} onChange={(e) => update({ badge: e.target.value })} style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="{{stats.count}}" />
      </PropRow>
      <PropRow label="Posição">
        <select value={item.position || "top"} onChange={(e) => update({ position: e.target.value as any })} style={inputStyle}>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
        </select>
      </PropRow>
    </div>
  );
}

// ============================================================================
// P3.8 — HeaderEditor: drag elements between zones
// ============================================================================

export function HeaderEditor() {
  const { state, dispatch, select } = useEditor();
  const header = state.contract.shell.header;
  if (!header) return null;

  const zones: ("left" | "center" | "right")[] = ["left", "center", "right"];

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <span style={{ fontWeight: 600, fontSize: "13px" }}>Header</span>
      </div>

      <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {zones.map((zone) => (
          <HeaderZone key={zone} zone={zone} elements={header[zone] || []} />
        ))}
      </div>
    </div>
  );
}

function HeaderZone({ zone, elements }: { zone: "left" | "center" | "right"; elements: HeaderElement[] }) {
  const { state, dispatch, select } = useEditor();
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/orqui-header");
    if (!data) return;
    const { elementId, sourceZone } = JSON.parse(data);
    dispatch({
      type: "MOVE_HEADER_ELEMENT",
      elementId,
      fromZone: sourceZone,
      toZone: zone,
      index: dropIdx,
    });
    setOverIdx(null);
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/orqui-header");
    if (!data) return;
    const { elementId, sourceZone } = JSON.parse(data);
    dispatch({
      type: "MOVE_HEADER_ELEMENT",
      elementId,
      fromZone: sourceZone,
      toZone: zone,
      index: elements.length,
    });
    setOverIdx(null);
  };

  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--orqui-colors-text-dim, #5b5b66)", marginBottom: "4px" }}>
        {zone}
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleZoneDrop}
        style={{
          minHeight: "32px",
          padding: "4px",
          border: "1px dashed var(--orqui-colors-border, #2a2a33)",
          borderRadius: "4px",
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
        }}
      >
        {elements.map((el, idx) => (
          <div
            key={el.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/orqui-header", JSON.stringify({ elementId: el.id, sourceZone: zone }));
            }}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onClick={() => select({ type: "header-element", id: el.id, zone })}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "grab",
              background: state.selection?.id === el.id ? "rgba(109,156,255,0.15)" : "var(--orqui-colors-surface-2, #1c1c21)",
              border: state.selection?.id === el.id ? "1px solid var(--orqui-colors-accent, #6d9cff)" : "1px solid var(--orqui-colors-border, #2a2a33)",
              color: "var(--orqui-colors-text, #e4e4e7)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              borderLeft: overIdx === idx ? "2px solid var(--orqui-colors-accent, #6d9cff)" : undefined,
            }}
          >
            <span style={{ fontSize: "9px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>{el.type}</span>
            <span>{String(el.props?.label || el.props?.placeholder || el.props?.icon || el.id)}</span>
          </div>
        ))}
        {elements.length === 0 && (
          <div style={{ fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)", padding: "4px 8px" }}>
            Arraste elementos aqui
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Shared helpers
// ============================================================================

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 12px", fontSize: "12px" }}>
      <span style={{ width: "55px", flexShrink: 0, color: "var(--orqui-colors-text-muted, #8b8b96)", fontSize: "11px" }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const sectionStyle: CSSProperties = {
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const sectionHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const addBtnStyle: CSSProperties = {
  padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500,
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  color: "var(--orqui-colors-text-muted, #8b8b96)", cursor: "pointer",
};

const navItemStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "6px 8px", borderRadius: "4px", cursor: "pointer",
  transition: "background 0.1s",
  color: "var(--orqui-colors-text, #e4e4e7)",
};

const dragHandleStyle: CSSProperties = {
  cursor: "grab", fontSize: "10px", color: "var(--orqui-colors-text-dim, #5b5b66)",
  letterSpacing: "-2px", flexShrink: 0,
};

const navBadgeStyle: CSSProperties = {
  fontSize: "10px", padding: "0 4px", borderRadius: "3px",
  background: "rgba(109,156,255,0.15)", color: "var(--orqui-colors-accent, #6d9cff)",
  fontFamily: "monospace",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  borderRadius: "4px", padding: "4px 8px", fontSize: "12px",
  color: "var(--orqui-colors-text, #e4e4e7)", outline: "none",
};
