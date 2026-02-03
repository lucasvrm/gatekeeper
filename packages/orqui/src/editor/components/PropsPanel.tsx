// ============================================================================
// Orqui PropsPanel
// Property editor for the selected node — inline editing of props, styles,
// grid configuration, visibility rules, and variable picker
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from "react";
import { useEditor } from "../EditorProvider.js";
import type { NodeDef } from "../../runtime/context/ContractProvider.js";

export function PropsPanel() {
  const { state, selectedNode, select, removeNode, updateNodeProps, updateNodeStyle, updateGrid, openVariablePicker, dispatch } = useEditor();

  if (!state.selection) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>
          <span style={{ fontSize: "20px", opacity: 0.3 }}>🎯</span>
          <span>Selecione um elemento no canvas</span>
        </div>
      </div>
    );
  }

  if (state.selection.type === "node" && selectedNode) {
    return (
      <div style={panelStyle}>
        <NodePropsEditor node={selectedNode} />
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={emptyStyle}>
        <span>Propriedades não disponíveis</span>
      </div>
    </div>
  );
}

// ============================================================================
// Node Props Editor
// ============================================================================

function NodePropsEditor({ node }: { node: NodeDef }) {
  const { updateNodeProps, updateNodeStyle, removeNode, updateGrid, openVariablePicker, dispatch, state } = useEditor();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--orqui-colors-accent, #6d9cff)" }}>
            {node.type}
          </span>
          <span style={{ fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)" }}>{node.id}</span>
        </div>
        <button onClick={() => removeNode(node.id)} style={deleteButtonStyle} title="Remover elemento">✕</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
        {/* Type-specific props */}
        <PropsSection title="Propriedades">
          <TypeSpecificProps node={node} />
        </PropsSection>

        {/* Grid configuration (P3.6) */}
        {node.type === "grid" && (
          <PropsSection title="Grid">
            <GridConfig node={node} />
          </PropsSection>
        )}

        {/* Style overrides */}
        <PropsSection title="Estilo" defaultCollapsed>
          <StyleEditor node={node} />
        </PropsSection>

        {/* Visibility rules (P3.9) */}
        <PropsSection title="Visibilidade" defaultCollapsed>
          <VisibilityEditor node={node} />
        </PropsSection>
      </div>
    </div>
  );
}

// ============================================================================
// P3.6 — Grid Configurator
// ============================================================================

function GridConfig({ node }: { node: NodeDef }) {
  const { updateGrid, updateNodeProps } = useEditor();
  const p = node.props || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <PropRow label="Colunas">
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => updateGrid(node.id, n)}
              style={{
                ...gridBtnStyle,
                background: p.columns === n ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                color: p.columns === n ? "#fff" : "var(--orqui-colors-text-muted, #8b8b96)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </PropRow>

      <PropRow label="Gap">
        <select
          value={p.gap || "$tokens.spacing.md"}
          onChange={(e) => updateGrid(node.id, p.columns || 2, e.target.value)}
          style={selectStyle}
        >
          <option value="$tokens.spacing.xs">XS (4px)</option>
          <option value="$tokens.spacing.sm">SM (8px)</option>
          <option value="$tokens.spacing.md">MD (16px)</option>
          <option value="$tokens.spacing.lg">LG (24px)</option>
          <option value="$tokens.spacing.xl">XL (32px)</option>
        </select>
      </PropRow>

      {/* Visual grid preview */}
      <div style={{ padding: "8px 0" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${p.columns || 2}, 1fr)`,
          gap: "4px",
          padding: "8px",
          background: "var(--orqui-colors-surface-2, #1c1c21)",
          borderRadius: "4px",
        }}>
          {Array.from({ length: p.columns || 2 }).map((_, i) => (
            <div key={i} style={{
              height: "24px",
              background: "rgba(109,156,255,0.15)",
              borderRadius: "2px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", color: "var(--orqui-colors-accent, #6d9cff)",
            }}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Type-specific property editors
// ============================================================================

function TypeSpecificProps({ node }: { node: NodeDef }) {
  const { updateNodeProps, openVariablePicker } = useEditor();
  const p = node.props || {};
  const update = (key: string, value: any) => updateNodeProps(node.id, { [key]: value });

  switch (node.type) {
    case "heading":
      return (
        <>
          <TemplateInput label="Conteúdo" value={p.content || ""} onChange={(v) => update("content", v)} nodeId={node.id} propKey="content" />
          <PropRow label="Nível">
            <div style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => update("level", n)} style={{
                  ...gridBtnStyle,
                  background: p.level === n ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                  color: p.level === n ? "#fff" : "var(--orqui-colors-text-muted, #8b8b96)",
                }}>
                  H{n}
                </button>
              ))}
            </div>
          </PropRow>
          <TextStyleSelect value={p.textStyle} onChange={(v) => update("textStyle", v)} />
        </>
      );

    case "text":
      return (
        <>
          <TemplateInput label="Conteúdo" value={p.content || ""} onChange={(v) => update("content", v)} nodeId={node.id} propKey="content" />
          <TextStyleSelect value={p.textStyle} onChange={(v) => update("textStyle", v)} />
        </>
      );

    case "badge":
      return (
        <TemplateInput label="Conteúdo" value={p.content || ""} onChange={(v) => update("content", v)} nodeId={node.id} propKey="content" />
      );

    case "button":
      return (
        <>
          <TemplateInput label="Label" value={p.label || ""} onChange={(v) => update("label", v)} nodeId={node.id} propKey="label" />
          <PropRow label="Variante">
            <select value={p.variant || "default"} onChange={(e) => update("variant", e.target.value)} style={selectStyle}>
              <option value="primary">Primary</option>
              <option value="outline">Outline</option>
              <option value="danger">Danger</option>
              <option value="default">Default</option>
            </select>
          </PropRow>
          <PropRow label="Ícone">
            <input value={p.icon || ""} onChange={(e) => update("icon", e.target.value)} style={inputStyle} placeholder="Nome do ícone" />
          </PropRow>
          <PropRow label="Rota">
            <input value={p.route || ""} onChange={(e) => update("route", e.target.value)} style={inputStyle} placeholder="/path" />
          </PropRow>
        </>
      );

    case "stat-card":
      return (
        <>
          <PropRow label="Label">
            <input value={p.label || ""} onChange={(e) => update("label", e.target.value)} style={inputStyle} />
          </PropRow>
          <TemplateInput label="Valor" value={p.value || ""} onChange={(v) => update("value", v)} nodeId={node.id} propKey="value" />
          <PropRow label="Ícone">
            <input value={p.icon || ""} onChange={(e) => update("icon", e.target.value)} style={inputStyle} placeholder="ChartLineUp" />
          </PropRow>
          <PropRow label="Cor">
            <select value={p.color || ""} onChange={(e) => update("color", e.target.value)} style={selectStyle}>
              <option value="">Default</option>
              <option value="accent">Accent</option>
              <option value="success">Success</option>
              <option value="danger">Danger</option>
              <option value="warning">Warning</option>
            </select>
          </PropRow>
        </>
      );

    case "card":
      return (
        <TemplateInput label="Título" value={p.title || ""} onChange={(v) => update("title", v)} nodeId={node.id} propKey="title" />
      );

    case "table":
      return <TablePropsEditor node={node} />;

    case "stack":
    case "row":
      return (
        <>
          <PropRow label="Gap">
            <select value={p.gap || "$tokens.spacing.md"} onChange={(e) => update("gap", e.target.value)} style={selectStyle}>
              <option value="$tokens.spacing.xs">XS (4px)</option>
              <option value="$tokens.spacing.sm">SM (8px)</option>
              <option value="$tokens.spacing.md">MD (16px)</option>
              <option value="$tokens.spacing.lg">LG (24px)</option>
              <option value="$tokens.spacing.xl">XL (32px)</option>
            </select>
          </PropRow>
          {node.type === "row" && (
            <>
              <PropRow label="Align">
                <select value={p.align || "center"} onChange={(e) => update("align", e.target.value)} style={selectStyle}>
                  <option value="flex-start">Top</option>
                  <option value="center">Center</option>
                  <option value="flex-end">Bottom</option>
                  <option value="stretch">Stretch</option>
                </select>
              </PropRow>
              <PropRow label="Justify">
                <select value={p.justify || "flex-start"} onChange={(e) => update("justify", e.target.value)} style={selectStyle}>
                  <option value="flex-start">Start</option>
                  <option value="center">Center</option>
                  <option value="flex-end">End</option>
                  <option value="space-between">Space Between</option>
                  <option value="space-around">Space Around</option>
                </select>
              </PropRow>
            </>
          )}
        </>
      );

    case "icon":
      return (
        <>
          <PropRow label="Ícone">
            <input value={p.name || ""} onChange={(e) => update("name", e.target.value)} style={inputStyle} placeholder="CheckCircle" />
          </PropRow>
          <PropRow label="Tamanho">
            <input type="number" value={p.size || 20} onChange={(e) => update("size", parseInt(e.target.value))} style={inputStyle} min={8} max={64} />
          </PropRow>
        </>
      );

    case "image":
      return (
        <>
          <TemplateInput label="URL" value={p.src || ""} onChange={(v) => update("src", v)} nodeId={node.id} propKey="src" />
          <PropRow label="Tamanho">
            <input type="number" value={p.size || 64} onChange={(e) => update("size", parseInt(e.target.value))} style={inputStyle} />
          </PropRow>
          <PropRow label="Redondo">
            <input type="checkbox" checked={p.rounded || false} onChange={(e) => update("rounded", e.target.checked)} />
          </PropRow>
        </>
      );

    case "search":
      return (
        <PropRow label="Placeholder">
          <input value={p.placeholder || ""} onChange={(e) => update("placeholder", e.target.value)} style={inputStyle} />
        </PropRow>
      );

    case "slot":
      return (
        <PropRow label="Nome">
          <input value={p.name || ""} onChange={(e) => update("name", e.target.value)} style={inputStyle} />
        </PropRow>
      );

    default:
      return <div style={{ fontSize: "12px", color: "var(--orqui-colors-text-dim, #5b5b66)", padding: "8px 12px" }}>Sem propriedades editáveis</div>;
  }
}

// ============================================================================
// Table Props Editor
// ============================================================================

function TablePropsEditor({ node }: { node: NodeDef }) {
  const { updateNodeProps, openVariablePicker } = useEditor();
  const p = node.props || {};
  const columns = p.columns || [];

  const updateColumn = (idx: number, key: string, value: any) => {
    const newCols = columns.map((col: any, i: number) => i === idx ? { ...col, [key]: value } : col);
    updateNodeProps(node.id, { columns: newCols });
  };

  const addColumn = () => {
    const newCol = { key: `col${columns.length + 1}`, label: `Coluna ${columns.length + 1}`, width: "auto", content: "" };
    updateNodeProps(node.id, { columns: [...columns, newCol] });
  };

  const removeColumn = (idx: number) => {
    updateNodeProps(node.id, { columns: columns.filter((_: any, i: number) => i !== idx) });
  };

  return (
    <>
      <PropRow label="Data Source">
        <input value={p.dataSource || ""} onChange={(e) => updateNodeProps(node.id, { dataSource: e.target.value })} style={inputStyle} placeholder="runs" />
      </PropRow>
      <PropRow label="Row Height">
        <input type="number" value={p.rowHeight || 48} onChange={(e) => updateNodeProps(node.id, { rowHeight: parseInt(e.target.value) })} style={inputStyle} min={24} max={96} />
      </PropRow>

      <div style={{ padding: "4px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--orqui-colors-text-muted, #8b8b96)" }}>COLUNAS</span>
          <button onClick={addColumn} style={{ ...gridBtnStyle, fontSize: "11px", padding: "2px 8px" }}>+ Coluna</button>
        </div>

        {columns.map((col: any, idx: number) => (
          <div key={idx} style={{
            padding: "8px", marginBottom: "4px",
            background: "var(--orqui-colors-surface-2, #1c1c21)",
            borderRadius: "4px", fontSize: "12px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <input value={col.label || ""} onChange={(e) => updateColumn(idx, "label", e.target.value)} style={{ ...inputStyle, fontWeight: 600, fontSize: "12px" }} placeholder="Label" />
              <button onClick={() => removeColumn(idx)} style={{ background: "none", border: "none", color: "var(--orqui-colors-danger, #ff6b6b)", cursor: "pointer", fontSize: "11px" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
              <input value={col.width || ""} onChange={(e) => updateColumn(idx, "width", e.target.value)} style={{ ...inputStyle, width: "60px", fontSize: "11px" }} placeholder="Width" />
              <select value={col.align || "left"} onChange={(e) => updateColumn(idx, "align", e.target.value)} style={{ ...selectStyle, fontSize: "11px", flex: 1 }}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <input
              value={col.content || ""}
              onChange={(e) => updateColumn(idx, "content", e.target.value)}
              style={{ ...inputStyle, width: "100%", fontSize: "11px", fontFamily: "monospace" }}
              placeholder={"{{entity.field | formatter}}"}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ============================================================================
// P3.5 — Template Input with Variable Picker trigger
// ============================================================================

function TemplateInput({ label, value, onChange, nodeId, propKey }: {
  label: string; value: string; onChange: (v: string) => void; nodeId: string; propKey: string;
}) {
  const { openVariablePicker } = useEditor();

  return (
    <PropRow label={label}>
      <div style={{ display: "flex", gap: "4px", width: "100%" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, flex: 1, fontFamily: value.includes("{{") ? "monospace" : "inherit" }}
          placeholder="Texto ou {{variável}}"
        />
        <button
          onClick={() => openVariablePicker(nodeId, propKey)}
          style={varBtnStyle}
          title="Inserir variável {{}}"
        >
          {"{{ }}"}
        </button>
      </div>
    </PropRow>
  );
}

// ============================================================================
// Style Editor
// ============================================================================

function StyleEditor({ node }: { node: NodeDef }) {
  const { updateNodeStyle } = useEditor();
  const style = node.style || {};

  const STYLE_PROPS = [
    { key: "background", label: "Background", placeholder: "$tokens.colors.surface" },
    { key: "padding", label: "Padding", placeholder: "$tokens.spacing.md" },
    { key: "margin", label: "Margin", placeholder: "0" },
    { key: "borderRadius", label: "Border Radius", placeholder: "$tokens.borderRadius.lg" },
    { key: "border", label: "Border", placeholder: "1px solid $tokens.colors.border" },
    { key: "color", label: "Color", placeholder: "$tokens.colors.text" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {STYLE_PROPS.map(({ key, label, placeholder }) => (
        <PropRow key={key} label={label}>
          <input
            value={style[key] || ""}
            onChange={(e) => updateNodeStyle(node.id, { [key]: e.target.value })}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: "11px" }}
            placeholder={placeholder}
          />
        </PropRow>
      ))}
    </div>
  );
}

// ============================================================================
// P3.9 — Visibility Editor
// ============================================================================

function VisibilityEditor({ node }: { node: NodeDef }) {
  const { state, dispatch } = useEditor();
  const visibility = node.visibility || {};
  const allPages = Object.keys(state.contract.pages);

  const updateVisibility = (updates: any) => {
    dispatch({
      type: "UPDATE_VISIBILITY",
      target: { type: "node", id: node.id, pageId: state.currentPage },
      rule: { ...visibility, ...updates },
    });
  };

  const togglePage = (pageId: string) => {
    const pages = visibility.pages || [];
    const next = pages.includes(pageId) ? pages.filter((p: string) => p !== pageId) : [...pages, pageId];
    updateVisibility({ pages: next.length > 0 ? next : undefined });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Pages */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--orqui-colors-text-muted, #8b8b96)", marginBottom: "4px", padding: "0 12px" }}>
          Visível nas páginas:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "0 12px" }}>
          {allPages.map((pageId) => {
            const isActive = !visibility.pages || visibility.pages.includes("*") || visibility.pages.includes(pageId);
            return (
              <button
                key={pageId}
                onClick={() => togglePage(pageId)}
                style={{
                  padding: "2px 8px", borderRadius: "4px", fontSize: "11px", border: "none", cursor: "pointer",
                  background: isActive ? "rgba(109,156,255,0.15)" : "var(--orqui-colors-surface-2, #1c1c21)",
                  color: isActive ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-dim, #5b5b66)",
                }}
              >
                {pageId}
              </button>
            );
          })}
        </div>
      </div>

      {/* Condition */}
      <PropRow label="Condição">
        <input
          value={visibility.condition || ""}
          onChange={(e) => updateVisibility({ condition: e.target.value || undefined })}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: "11px" }}
          placeholder={'{{user.role}} === \'admin\''}
        />
      </PropRow>

      {/* Breakpoints */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--orqui-colors-text-muted, #8b8b96)", marginBottom: "4px", padding: "0 12px" }}>
          Esconder em:
        </div>
        <div style={{ display: "flex", gap: "4px", padding: "0 12px" }}>
          {(["mobile", "tablet", "desktop"] as const).map((bp) => {
            const hidden = visibility.breakpoints?.hidden?.includes(bp);
            return (
              <button
                key={bp}
                onClick={() => {
                  const current = visibility.breakpoints?.hidden || [];
                  const next = hidden ? current.filter((b: string) => b !== bp) : [...current, bp];
                  updateVisibility({ breakpoints: next.length > 0 ? { hidden: next } : undefined });
                }}
                style={{
                  padding: "3px 10px", borderRadius: "4px", fontSize: "11px", border: "none", cursor: "pointer",
                  background: hidden ? "rgba(255,107,107,0.15)" : "var(--orqui-colors-surface-2, #1c1c21)",
                  color: hidden ? "var(--orqui-colors-danger, #ff6b6b)" : "var(--orqui-colors-text-dim, #5b5b66)",
                }}
              >
                {bp}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function TextStyleSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <PropRow label="Text Style">
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="">Default</option>
        <option value="heading-1">Heading 1</option>
        <option value="heading-2">Heading 2</option>
        <option value="heading-3">Heading 3</option>
        <option value="body">Body</option>
        <option value="body-sm">Body SM</option>
        <option value="caption">Caption</option>
        <option value="code">Code</option>
      </select>
    </PropRow>
  );
}

function PropsSection({ title, children, defaultCollapsed = false }: { title: string; children: React.ReactNode; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div style={{ borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
      <button onClick={() => setCollapsed(!collapsed)} style={sectionTitleStyle}>
        <span style={{ fontSize: "10px", opacity: 0.5, transition: "transform 0.15s", transform: collapsed ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
        <span>{title}</span>
      </button>
      {!collapsed && <div style={{ padding: "4px 0 8px" }}>{children}</div>}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 12px", fontSize: "12px" }}>
      <span style={{ width: "70px", flexShrink: 0, color: "var(--orqui-colors-text-muted, #8b8b96)", fontSize: "11px" }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
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
  borderLeft: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const emptyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "13px",
  color: "var(--orqui-colors-text-dim, #5b5b66)",
};

const sectionHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const sectionTitleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  width: "100%",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--orqui-colors-text-muted, #8b8b96)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "12px",
  color: "var(--orqui-colors-text, #e4e4e7)",
  outline: "none",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const gridBtnStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  color: "var(--orqui-colors-text-muted, #8b8b96)",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const varBtnStyle: CSSProperties = {
  padding: "4px 6px",
  borderRadius: "4px",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  background: "var(--orqui-colors-surface-2, #1c1c21)",
  color: "var(--orqui-colors-accent, #6d9cff)",
  fontSize: "10px",
  fontFamily: "monospace",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const deleteButtonStyle: CSSProperties = {
  width: "24px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "4px",
  border: "none",
  background: "none",
  color: "var(--orqui-colors-danger, #ff6b6b)",
  cursor: "pointer",
  fontSize: "14px",
};
