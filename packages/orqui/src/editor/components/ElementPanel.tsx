// ============================================================================
// Orqui ElementPanel
// Sidebar with draggable elements organized by category
// ============================================================================

import React, { useState, type CSSProperties } from "react";
import { useEditor } from "../EditorProvider.js";
import type { DragItem } from "../EditorProvider.js";

interface ElementDef {
  type: string;
  label: string;
  icon: string;
  description: string;
}

interface ElementCategory {
  id: string;
  label: string;
  elements: ElementDef[];
}

const ELEMENT_CATALOG: ElementCategory[] = [
  {
    id: "layout",
    label: "Layout",
    elements: [
      { type: "grid", label: "Grid", icon: "⊞", description: "CSS Grid com colunas configuráveis" },
      { type: "stack", label: "Stack", icon: "☰", description: "Empilhamento vertical (flexbox column)" },
      { type: "row", label: "Row", icon: "≡", description: "Linha horizontal (flexbox row)" },
      { type: "container", label: "Container", icon: "☐", description: "Wrapper genérico com padding/bg" },
    ],
  },
  {
    id: "content",
    label: "Conteúdo",
    elements: [
      { type: "heading", label: "Título", icon: "H", description: "H1–H6 com text styles" },
      { type: "text", label: "Texto", icon: "T", description: "Texto com templates {{}}" },
      { type: "badge", label: "Badge", icon: "●", description: "Badge/tag colorido" },
      { type: "button", label: "Botão", icon: "▣", description: "Botão com variantes" },
      { type: "icon", label: "Ícone", icon: "★", description: "Ícone Phosphor" },
      { type: "image", label: "Imagem", icon: "◻", description: "Imagem/avatar" },
      { type: "divider", label: "Divisor", icon: "—", description: "Linha separadora" },
      { type: "spacer", label: "Espaço", icon: "↕", description: "Espaçamento vertical" },
    ],
  },
  {
    id: "data",
    label: "Dados",
    elements: [
      { type: "stat-card", label: "Stat Card", icon: "📊", description: "Card de métrica com valor/ícone" },
      { type: "card", label: "Card", icon: "🃏", description: "Card genérico com título" },
      { type: "key-value", label: "Key-Value", icon: "🔑", description: "Pares chave-valor" },
      { type: "table", label: "Tabela", icon: "📋", description: "Tabela com colunas e {{}}" },
      { type: "list", label: "Lista", icon: "📃", description: "Lista/feed de items" },
    ],
  },
  {
    id: "navigation",
    label: "Navegação",
    elements: [
      { type: "tabs", label: "Tabs", icon: "⊟", description: "Abas com conteúdo" },
    ],
  },
  {
    id: "input",
    label: "Inputs",
    elements: [
      { type: "search", label: "Busca", icon: "🔍", description: "Campo de busca" },
      { type: "select", label: "Select", icon: "▾", description: "Dropdown de seleção" },
    ],
  },
  {
    id: "special",
    label: "Especial",
    elements: [
      { type: "slot", label: "Slot", icon: "⧉", description: "Slot para componente custom" },
    ],
  },
];

export function ElementPanel() {
  const { dispatch } = useEditor();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };

  const filteredCatalog = search.trim()
    ? ELEMENT_CATALOG.map((cat) => ({
        ...cat,
        elements: cat.elements.filter(
          (el) =>
            el.label.toLowerCase().includes(search.toLowerCase()) ||
            el.type.toLowerCase().includes(search.toLowerCase()) ||
            el.description.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((cat) => cat.elements.length > 0)
    : ELEMENT_CATALOG;

  const handleDragStart = (e: React.DragEvent, el: ElementDef) => {
    const item: DragItem = { type: "new-node", nodeType: el.type };
    e.dataTransfer.setData("application/orqui-drag", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    dispatch({ type: "DRAG_START", item });
  };

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span style={{ fontWeight: 600, fontSize: "13px" }}>Elementos</span>
      </div>

      {/* Search */}
      <div style={{ padding: "0 12px 8px" }}>
        <input
          type="search"
          placeholder="Buscar elementos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
        {filteredCatalog.map((cat) => (
          <div key={cat.id} style={{ marginBottom: "4px" }}>
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat.id)}
              style={categoryHeaderStyle}
            >
              <span style={{ fontSize: "10px", opacity: 0.5, transition: "transform 0.15s", transform: collapsed.has(cat.id) ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
              <span>{cat.label}</span>
              <span style={{ fontSize: "11px", opacity: 0.4, marginLeft: "auto" }}>{cat.elements.length}</span>
            </button>

            {/* Elements */}
            {!collapsed.has(cat.id) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", padding: "4px 0" }}>
                {cat.elements.map((el) => (
                  <div
                    key={el.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, el)}
                    onDragEnd={() => dispatch({ type: "DRAG_END" })}
                    style={elementCardStyle}
                    title={el.description}
                  >
                    <span style={{ fontSize: "16px", lineHeight: 1 }}>{el.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: 500 }}>{el.label}</span>
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
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "var(--orqui-colors-surface, #141417)",
  borderRight: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const panelHeaderStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const searchStyle: CSSProperties = {
  width: "100%",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  borderRadius: "4px",
  padding: "5px 8px",
  fontSize: "12px",
  color: "var(--orqui-colors-text, #e4e4e7)",
  outline: "none",
};

const categoryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  width: "100%",
  padding: "6px 8px",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--orqui-colors-text-muted, #8b8b96)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  background: "none",
  border: "none",
  cursor: "pointer",
};

const elementCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  padding: "10px 4px",
  borderRadius: "6px",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  cursor: "grab",
  transition: "border-color 0.15s, background 0.15s",
  color: "var(--orqui-colors-text-muted, #8b8b96)",
  userSelect: "none",
};
