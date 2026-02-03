// ============================================================================
// ElementPalette — draggable node catalog, left panel
// ============================================================================

import React, { useState, type CSSProperties } from "react";
import { NODE_CATALOG, CATEGORIES, type NodeTypeMeta } from "./nodeDefaults";
import { usePageEditor } from "./PageEditorProvider";
import { C } from "./styles";

export function ElementPalette() {
  const { startDragFromPalette, endDrag } = usePageEditor();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCat = (id: string) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };

  const filtered = search.trim()
    ? CATEGORIES.map(cat => ({
        ...cat,
        items: NODE_CATALOG.filter(n =>
          n.category === cat.id && (
            n.label.toLowerCase().includes(search.toLowerCase()) ||
            n.type.toLowerCase().includes(search.toLowerCase()) ||
            n.description.toLowerCase().includes(search.toLowerCase())
          )
        ),
      })).filter(c => c.items.length > 0)
    : CATEGORIES.map(cat => ({
        ...cat,
        items: NODE_CATALOG.filter(n => n.category === cat.id),
      }));

  const handleDragStart = (e: React.DragEvent, meta: NodeTypeMeta) => {
    e.dataTransfer.setData("application/orqui-node-type", meta.type);
    e.dataTransfer.effectAllowed = "copy";
    startDragFromPalette(meta.type);
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Elementos</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{NODE_CATALOG.length}</span>
      </div>

      {/* Search */}
      <div style={{ padding: "0 10px 8px" }}>
        <input
          type="search"
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 12px" }}>
        {filtered.map(cat => (
          <div key={cat.id} style={{ marginBottom: 2 }}>
            <button onClick={() => toggleCat(cat.id)} style={catHeaderStyle}>
              <span style={{
                fontSize: 9, opacity: 0.5, transition: "transform 0.15s",
                transform: collapsed.has(cat.id) ? "rotate(-90deg)" : "rotate(0)",
                display: "inline-block",
              }}>▼</span>
              <span>{cat.label}</span>
              <span style={{ fontSize: 11, opacity: 0.4, marginLeft: "auto" }}>{cat.items.length}</span>
            </button>

            {!collapsed.has(cat.id) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, padding: "2px 0 6px" }}>
                {cat.items.map(meta => (
                  <div
                    key={meta.type}
                    draggable
                    onDragStart={e => handleDragStart(e, meta)}
                    onDragEnd={endDrag}
                    title={meta.description}
                    style={cardStyle}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = C.accent + "60";
                      e.currentTarget.style.color = C.text;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.color = C.textMuted;
                    }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{meta.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.2, textAlign: "center" }}>{meta.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: CSSProperties = {
  width: "100%", height: "100%",
  display: "flex", flexDirection: "column",
  background: C.surface,
  fontFamily: "'Inter', -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  padding: "12px 12px 8px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const searchStyle: CSSProperties = {
  width: "100%",
  background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 5, padding: "6px 8px", fontSize: 12,
  color: C.text, outline: "none",
  fontFamily: "'Inter', sans-serif",
};

const catHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  width: "100%", padding: "5px 6px",
  fontSize: 11, fontWeight: 600,
  color: C.textMuted, textTransform: "uppercase" as const,
  letterSpacing: "0.4px",
  background: "none", border: "none", cursor: "pointer",
};

const cardStyle: CSSProperties = {
  display: "flex", flexDirection: "column",
  alignItems: "center", gap: 3,
  padding: "8px 4px", borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  cursor: "grab", transition: "border-color 0.15s, color 0.15s",
  color: C.textMuted, userSelect: "none" as const,
};
