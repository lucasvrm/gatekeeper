// ============================================================================
// PropsEditor — right panel: edit selected node properties
// ============================================================================

import React, { type CSSProperties } from "react";
import { usePageEditor } from "./PageEditorProvider";
import type { NodeDef } from "./nodeDefaults";
import { getNodeMeta, isContainerType } from "./nodeDefaults";
import { findParent } from "./treeUtils";
import { C, MONO } from "./styles";
import { TemplateField } from "./TemplateField";

export function PropsEditor() {
  const { selectedNode, currentContent, state } = usePageEditor();

  if (!selectedNode) {
    return (
      <div style={panelStyle}>
        <div style={emptyStyle}>
          <span style={{ fontSize: 20, opacity: 0.2 }}>🎯</span>
          <span>Selecione um elemento</span>
          <span style={{ fontSize: 11, color: C.textDim, textAlign: "center", lineHeight: 1.5 }}>
            Clique em um elemento no canvas para editar suas propriedades
          </span>
        </div>
      </div>
    );
  }

  const meta = getNodeMeta(selectedNode.type);
  const isRoot = currentContent?.id === selectedNode.id;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <NodeHeader node={selectedNode} isRoot={isRoot} />

      <div style={{ flex: 1, overflow: "auto", padding: "0 0 16px" }}>
        {/* Type-specific props */}
        <Section title="Propriedades">
          <TypeProps node={selectedNode} />
        </Section>

        {/* Layout props (for containers) */}
        {isContainerType(selectedNode.type) && (
          <Section title="Layout">
            <LayoutProps node={selectedNode} />
          </Section>
        )}

        {/* Style overrides */}
        <Section title="Estilo" defaultCollapsed>
          <StyleProps node={selectedNode} />
        </Section>

        {/* Actions */}
        {!isRoot && (
          <Section title="Ações">
            <NodeActions node={selectedNode} />
          </Section>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Header
// ============================================================================

function NodeHeader({ node, isRoot }: { node: NodeDef; isRoot: boolean }) {
  const meta = getNodeMeta(node.type);
  return (
    <div style={headerStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{meta?.icon || "?"}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase" as const }}>
            {node.type}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, fontFamily: MONO }}>{node.id}</div>
        </div>
      </div>
      {isRoot && (
        <span style={tagStyle}>raiz</span>
      )}
    </div>
  );
}

// ============================================================================
// Section wrapper
// ============================================================================

function Section({ title, children, defaultCollapsed }: { title: string; children: React.ReactNode; defaultCollapsed?: boolean }) {
  const [open, setOpen] = React.useState(!defaultCollapsed);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(!open)} style={sectionBtnStyle}>
        <span style={{ fontSize: 9, transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.15s" }}>▼</span>
        <span>{title}</span>
      </button>
      {open && <div style={{ padding: "0 14px 12px" }}>{children}</div>}
    </div>
  );
}

// ============================================================================
// Type-specific props
// ============================================================================

function TypeProps({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const set = (key: string, val: any) => updateProps(node.id, { [key]: val });

  switch (node.type) {
    case "heading":
      return <>
        <Field label="Conteúdo"><TemplateField value={p.content || ""} onChange={v => set("content", v)} /></Field>
        <Field label="Nível (H1–H6)">
          <select value={p.level || 2} onChange={e => set("level", Number(e.target.value))} style={selectStyle}>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>H{n}</option>)}
          </select>
        </Field>
      </>;

    case "text":
      return <>
        <Field label="Conteúdo">
          <TemplateField value={p.content || ""} onChange={v => set("content", v)} multiline />
        </Field>
      </>;

    case "button":
      return <>
        <Field label="Label"><TemplateField value={p.label || ""} onChange={v => set("label", v)} /></Field>
        <Field label="Variante">
          <select value={p.variant || "primary"} onChange={e => set("variant", e.target.value)} style={selectStyle}>
            {["primary", "secondary", "outline", "ghost", "destructive"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Ícone"><Input value={p.icon || ""} onChange={v => set("icon", v)} placeholder="Ex: Plus, ArrowRight" /></Field>
        <Field label="Rota"><Input value={p.route || ""} onChange={v => set("route", v)} placeholder="/rota" /></Field>
      </>;

    case "badge":
      return <>
        <Field label="Conteúdo"><TemplateField value={p.content || ""} onChange={v => set("content", v)} /></Field>
        <Field label="Cor">
          <select value={p.color || "accent"} onChange={e => set("color", e.target.value)} style={selectStyle}>
            {["accent", "success", "danger", "warning", "muted"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </>;

    case "icon":
      return <>
        <Field label="Nome"><Input value={p.name || ""} onChange={v => set("name", v)} placeholder="Star, Bell, User..." /></Field>
        <Field label="Tamanho (px)"><NumberInput value={p.size || 20} onChange={v => set("size", v)} min={8} max={64} /></Field>
      </>;

    case "image":
      return <>
        <Field label="src (URL)"><Input value={p.src || ""} onChange={v => set("src", v)} placeholder="https://..." /></Field>
        <Field label="alt"><Input value={p.alt || ""} onChange={v => set("alt", v)} /></Field>
        <Field label="Tamanho (px)"><NumberInput value={p.size || 48} onChange={v => set("size", v)} min={16} max={512} /></Field>
        <Field label="Arredondado"><Toggle checked={p.rounded || false} onChange={v => set("rounded", v)} /></Field>
      </>;

    case "divider":
      return <>
        <Field label="Cor"><Input value={p.color || "#2a2a33"} onChange={v => set("color", v)} /></Field>
        <Field label="Estilo">
          <select value={p.style || "solid"} onChange={e => set("style", e.target.value)} style={selectStyle}>
            {["solid", "dashed", "dotted"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
      </>;

    case "spacer":
      return <>
        <Field label="Tamanho"><Input value={p.size || "24px"} onChange={v => set("size", v)} placeholder="24px" /></Field>
      </>;

    case "stat-card":
      return <>
        <Field label="Label"><TemplateField value={p.label || ""} onChange={v => set("label", v)} /></Field>
        <Field label="Valor"><TemplateField value={p.value || ""} onChange={v => set("value", v)} /></Field>
        <Field label="Ícone"><Input value={p.icon || ""} onChange={v => set("icon", v)} placeholder="TrendUp, Users..." /></Field>
      </>;

    case "card":
      return <>
        <Field label="Título"><TemplateField value={p.title || ""} onChange={v => set("title", v)} /></Field>
        <Field label="Padding"><Input value={p.padding || "16px"} onChange={v => set("padding", v)} /></Field>
      </>;

    case "table":
      return <TableColumnsEditor node={node} />;

    case "list":
      return <>
        <Field label="Data source"><Input value={p.dataSource || ""} onChange={v => set("dataSource", v)} placeholder="nome da coleção" /></Field>
        <Field label="Max items"><NumberInput value={p.maxItems || 10} onChange={v => set("maxItems", v)} min={1} max={100} /></Field>
      </>;

    case "key-value":
      return <KeyValueEditor node={node} />;

    case "tabs":
      return <TabsEditor node={node} />;

    case "search":
      return <>
        <Field label="Placeholder"><Input value={p.placeholder || ""} onChange={v => set("placeholder", v)} /></Field>
      </>;

    case "select":
      return <SelectEditor node={node} />;

    case "slot":
      return <>
        <Field label="Nome do slot"><Input value={p.name || ""} onChange={v => set("name", v)} placeholder="custom-slot" /></Field>
      </>;

    case "grid":
      return <>
        <Field label="Colunas"><NumberInput value={p.columns || 2} onChange={v => set("columns", v)} min={1} max={12} /></Field>
        <Field label="Gap"><Input value={p.gap || "16px"} onChange={v => set("gap", v)} /></Field>
      </>;

    case "stack":
      return <>
        <Field label="Gap"><Input value={p.gap || "16px"} onChange={v => set("gap", v)} /></Field>
      </>;

    case "row":
      return <>
        <Field label="Gap"><Input value={p.gap || "8px"} onChange={v => set("gap", v)} /></Field>
        <Field label="Alinhamento vertical">
          <select value={p.align || "center"} onChange={e => set("align", e.target.value)} style={selectStyle}>
            {["stretch", "flex-start", "center", "flex-end", "baseline"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Justificação">
          <select value={p.justify || "flex-start"} onChange={e => set("justify", e.target.value)} style={selectStyle}>
            {["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"].map(v => <option key={v}>{v}</option>)}
          </select>
        </Field>
        <Field label="Wrap"><Toggle checked={p.wrap || false} onChange={v => set("wrap", v)} /></Field>
      </>;

    case "container":
      return <>
        <Field label="Padding"><Input value={p.padding || "16px"} onChange={v => set("padding", v)} /></Field>
      </>;

    default:
      return <div style={{ fontSize: 12, color: C.textDim }}>Sem propriedades específicas</div>;
  }
}

// ============================================================================
// Layout props (containers only)
// ============================================================================

function LayoutProps({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const set = (key: string, val: any) => updateProps(node.id, { [key]: val });

  if (node.type === "grid") {
    return <>
      <Field label="Colunas"><NumberInput value={p.columns || 2} onChange={v => set("columns", v)} min={1} max={12} /></Field>
      <Field label="Gap"><Input value={p.gap || "16px"} onChange={v => set("gap", v)} /></Field>
      <Field label="Column gap"><Input value={p.columnGap || ""} onChange={v => set("columnGap", v)} placeholder="herda do gap" /></Field>
      <Field label="Row gap"><Input value={p.rowGap || ""} onChange={v => set("rowGap", v)} placeholder="herda do gap" /></Field>
    </>;
  }

  return null; // Other containers don't need extra layout props beyond TypeProps
}

// ============================================================================
// Style overrides
// ============================================================================

function StyleProps({ node }: { node: NodeDef }) {
  const { updateStyle } = usePageEditor();
  const s = node.style || {};
  const set = (key: string, val: string) => updateStyle(node.id, { [key]: val });

  return <>
    <Field label="Background"><Input value={s.background || ""} onChange={v => set("background", v)} placeholder="cor ou token" /></Field>
    <Field label="Padding"><Input value={s.padding || ""} onChange={v => set("padding", v)} placeholder="ex: 16px" /></Field>
    <Field label="Margin"><Input value={s.margin || ""} onChange={v => set("margin", v)} placeholder="ex: 8px 0" /></Field>
    <Field label="Border radius"><Input value={s.borderRadius || ""} onChange={v => set("borderRadius", v)} placeholder="ex: 8px" /></Field>
    <Field label="Border"><Input value={s.border || ""} onChange={v => set("border", v)} placeholder="ex: 1px solid #333" /></Field>
    <Field label="Max width"><Input value={s.maxWidth || ""} onChange={v => set("maxWidth", v)} placeholder="ex: 800px" /></Field>
    <Field label="Min height"><Input value={s.minHeight || ""} onChange={v => set("minHeight", v)} placeholder="ex: 200px" /></Field>
  </>;
}

// ============================================================================
// Node actions (duplicate, wrap, delete)
// ============================================================================

function NodeActions({ node }: { node: NodeDef }) {
  const { removeNode, duplicateNode, dispatch, currentContent } = usePageEditor();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <ActionBtn label="Duplicar" icon="⊕" onClick={() => duplicateNode(node.id)} />
      <ActionBtn label="Envolver em Stack" icon="☰" onClick={() => dispatch({ type: "WRAP_IN_CONTAINER", nodeId: node.id, containerType: "stack" })} />
      <ActionBtn label="Envolver em Row" icon="≡" onClick={() => dispatch({ type: "WRAP_IN_CONTAINER", nodeId: node.id, containerType: "row" })} />
      <ActionBtn label="Envolver em Grid" icon="⊞" onClick={() => dispatch({ type: "WRAP_IN_CONTAINER", nodeId: node.id, containerType: "grid" })} />
      <div style={{ height: 8 }} />
      <ActionBtn label="Excluir" icon="✕" onClick={() => removeNode(node.id)} danger />
    </div>
  );
}

function ActionBtn({ label, icon, onClick, danger }: { label: string; icon: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 5,
        border: `1px solid ${danger ? C.danger + "30" : C.border}`,
        background: "transparent",
        color: danger ? C.danger : C.textMuted,
        fontSize: 12, cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? C.danger + "15" : C.surface2;
        e.currentTarget.style.color = danger ? C.danger : C.text;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger ? C.danger : C.textMuted;
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ============================================================================
// Complex sub-editors
// ============================================================================

function TableColumnsEditor({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const columns = (p.columns || []) as Array<{ key: string; label: string; width: string; content?: string; align?: string }>;

  const setColumns = (cols: typeof columns) => updateProps(node.id, { columns: cols });
  const updateCol = (i: number, field: string, val: string) => {
    const next = [...columns];
    next[i] = { ...next[i], [field]: val };
    setColumns(next);
  };
  const addCol = () => setColumns([...columns, { key: `col${columns.length + 1}`, label: `Coluna ${columns.length + 1}`, width: "auto" }]);
  const removeCol = (i: number) => setColumns(columns.filter((_, idx) => idx !== i));

  return <>
    <Field label="Data source"><Input value={p.dataSource || ""} onChange={v => updateProps(node.id, { dataSource: v })} placeholder="nome da coleção" /></Field>
    <div style={{ marginTop: 8, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Colunas ({columns.length})</span>
      <button onClick={addCol} style={smallBtnStyle}>+ Coluna</button>
    </div>
    {columns.map((col, i) => (
      <div key={i} style={{ padding: "6px 8px", background: C.surface2, borderRadius: 5, marginBottom: 4, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim }}>#{i + 1}</span>
          <button onClick={() => removeCol(i)} style={{ ...smallBtnStyle, color: C.danger, borderColor: C.danger + "30" }}>✕</button>
        </div>
        <MiniField label="Key"><Input value={col.key} onChange={v => updateCol(i, "key", v)} /></MiniField>
        <MiniField label="Label"><Input value={col.label} onChange={v => updateCol(i, "label", v)} /></MiniField>
        <MiniField label="Width"><Input value={col.width} onChange={v => updateCol(i, "width", v)} placeholder="auto, 20%, 200px" /></MiniField>
        <MiniField label="Alinhamento">
          <select value={col.align || "left"} onChange={e => updateCol(i, "align", e.target.value)} style={{ ...selectStyle, fontSize: 11 }}>
            {["left", "center", "right"].map(v => <option key={v}>{v}</option>)}
          </select>
        </MiniField>
      </div>
    ))}
  </>;
}

function KeyValueEditor({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const items = (p.items || []) as Array<{ label: string; value: string }>;

  const setItems = (arr: typeof items) => updateProps(node.id, { items: arr });
  const updateItem = (i: number, field: string, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };
  const addItem = () => setItems([...items, { label: "Chave", value: "Valor" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return <>
    <Field label="Layout">
      <select value={p.layout || "horizontal"} onChange={e => updateProps(node.id, { layout: e.target.value })} style={selectStyle}>
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
      </select>
    </Field>
    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Items ({items.length})</span>
      <button onClick={addItem} style={smallBtnStyle}>+ Item</button>
    </div>
    {items.map((item, i) => (
      <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3, alignItems: "center" }}>
        <input value={item.label} onChange={e => updateItem(i, "label", e.target.value)} placeholder="chave" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <input value={item.value} onChange={e => updateItem(i, "value", e.target.value)} placeholder="valor" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <button onClick={() => removeItem(i)} style={{ ...smallBtnStyle, padding: "2px 5px", color: C.danger, borderColor: C.danger + "30" }}>✕</button>
      </div>
    ))}
  </>;
}

function TabsEditor({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const items = (p.items || []) as Array<{ id: string; label: string }>;

  const setItems = (arr: typeof items) => updateProps(node.id, { items: arr });
  const updateItem = (i: number, field: string, val: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };
  const addItem = () => {
    const id = `tab${items.length + 1}`;
    setItems([...items, { id, label: `Tab ${items.length + 1}` }]);
  };
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return <>
    <Field label="Default tab"><Input value={p.defaultTab || ""} onChange={v => updateProps(node.id, { defaultTab: v })} /></Field>
    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Tabs ({items.length})</span>
      <button onClick={addItem} style={smallBtnStyle}>+ Tab</button>
    </div>
    {items.map((item, i) => (
      <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3, alignItems: "center" }}>
        <input value={item.id} onChange={e => updateItem(i, "id", e.target.value)} placeholder="id" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <input value={item.label} onChange={e => updateItem(i, "label", e.target.value)} placeholder="label" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <button onClick={() => removeItem(i)} style={{ ...smallBtnStyle, padding: "2px 5px", color: C.danger, borderColor: C.danger + "30" }}>✕</button>
      </div>
    ))}
  </>;
}

function SelectEditor({ node }: { node: NodeDef }) {
  const { updateProps } = usePageEditor();
  const p = node.props || {};
  const options = (p.options || []) as Array<{ value: string; label: string }>;

  const setOptions = (arr: typeof options) => updateProps(node.id, { options: arr });
  const updateOpt = (i: number, field: string, val: string) => {
    const next = [...options];
    next[i] = { ...next[i], [field]: val };
    setOptions(next);
  };
  const addOpt = () => setOptions([...options, { value: `opt${options.length + 1}`, label: `Opção ${options.length + 1}` }]);
  const removeOpt = (i: number) => setOptions(options.filter((_, idx) => idx !== i));

  return <>
    <Field label="Placeholder"><Input value={p.placeholder || ""} onChange={v => updateProps(node.id, { placeholder: v })} /></Field>
    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>Opções ({options.length})</span>
      <button onClick={addOpt} style={smallBtnStyle}>+ Opção</button>
    </div>
    {options.map((opt, i) => (
      <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3, alignItems: "center" }}>
        <input value={opt.value} onChange={e => updateOpt(i, "value", e.target.value)} placeholder="value" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <input value={opt.label} onChange={e => updateOpt(i, "label", e.target.value)} placeholder="label" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
        <button onClick={() => removeOpt(i)} style={{ ...smallBtnStyle, padding: "2px 5px", color: C.danger, borderColor: C.danger + "30" }}>✕</button>
      </div>
    ))}
  </>;
}

// ============================================================================
// Reusable form primitives
// ============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: C.textDim, minWidth: 40 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min} max={max}
      style={{ ...inputStyle, width: 80 }}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: C.textMuted }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {checked ? "Sim" : "Não"}
    </label>
  );
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: CSSProperties = {
  width: "100%", height: "100%",
  display: "flex", flexDirection: "column",
  background: C.surface,
  borderLeft: `1px solid ${C.border}`,
  fontFamily: "'Inter', sans-serif",
};

const emptyStyle: CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: 8,
  color: C.textDim, padding: 24,
};

const headerStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: `1px solid ${C.border}`,
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const tagStyle: CSSProperties = {
  fontSize: 9, padding: "2px 6px", borderRadius: 3,
  background: C.accent + "15", color: C.accent,
  border: `1px solid ${C.accent}30`,
  fontWeight: 600, textTransform: "uppercase" as const,
};

const sectionBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  width: "100%", padding: "8px 14px",
  fontSize: 11, fontWeight: 600,
  color: C.textMuted, textTransform: "uppercase" as const,
  letterSpacing: "0.4px",
  background: "none", border: "none", cursor: "pointer",
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "5px 8px",
  borderRadius: 4, border: `1px solid ${C.border}`,
  background: C.surface2, color: C.text,
  fontSize: 12, fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const smallBtnStyle: CSSProperties = {
  padding: "2px 8px", borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: "transparent", color: C.accent,
  fontSize: 10, fontWeight: 600, cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};
