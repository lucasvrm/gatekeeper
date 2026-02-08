// ============================================================================
// Orqui TableBuilder
// P4.1 — Drag columns to reorder
// P4.2 — Per-column config: width, label, {{content}}, alignment, link, formatter
// P4.3 — Row height and density control
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from "react";
import { useEditor } from "../../EditorProvider.js";

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  content: string;
  align?: "left" | "center" | "right";
  link?: string;
  sortable?: boolean;
}

export interface TableBuilderProps {
  nodeId: string;
}

export function TableBuilder({ nodeId }: TableBuilderProps) {
  // ---- All hooks MUST be called before any early return ----
  const { state, updateNodeProps, openVariablePicker } = useEditor();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [expandedCol, setExpandedCol] = useState<number | null>(null);

  // Derive values (may be undefined/null)
  const page = state.contract.pages[state.currentPage];
  const node = page ? findNode(page.content, nodeId) : null;
  const isTableNode = node && node.type === "table";
  const p = isTableNode ? (node.props || {}) : {};
  const columns: TableColumn[] = p.columns || [];

  // ---- Column operations (useCallback before early return) ----

  const updateColumns = useCallback((newCols: TableColumn[]) => {
    updateNodeProps(nodeId, { columns: newCols });
  }, [nodeId, updateNodeProps]);

  const updateColumn = useCallback((idx: number, updates: Partial<TableColumn>) => {
    const newCols = columns.map((col, i) => i === idx ? { ...col, ...updates } : col);
    updateColumns(newCols);
  }, [columns, updateColumns]);

  const addColumn = useCallback(() => {
    const key = `col_${Date.now().toString(36)}`;
    const newCol: TableColumn = { key, label: "Nova Coluna", content: "", width: "auto", align: "left" };
    updateColumns([...columns, newCol]);
    setExpandedCol(columns.length);
  }, [columns, updateColumns]);

  const removeColumn = useCallback((idx: number) => {
    updateColumns(columns.filter((_, i) => i !== idx));
    setExpandedCol(null);
  }, [columns, updateColumns]);

  const duplicateColumn = useCallback((idx: number) => {
    const original = columns[idx];
    if (!original) return;
    const key = `${original.key}_copy_${Date.now().toString(36)}`;
    const copy = { ...original, key, label: `${original.label} (cópia)` };
    const newCols = [...columns];
    newCols.splice(idx + 1, 0, copy);
    updateColumns(newCols);
    setExpandedCol(idx + 1);
  }, [columns, updateColumns]);

  // ---- Drag to reorder ----

  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...columns];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    updateColumns(reordered);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, columns, updateColumns]);

  // ---- Early return AFTER all hooks ----
  if (!page || !isTableNode) return null;

  return (
    <div style={builderStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: "12px" }}>Table Builder</span>
        <button onClick={addColumn} style={addBtnStyle}>+ Coluna</button>
      </div>

      {/* Data source */}
      <div style={{ padding: "8px 12px" }}>
        <FieldRow label="DataSource">
          <input
            value={p.dataSource || ""}
            onChange={(e) => updateNodeProps(nodeId, { dataSource: e.target.value })}
            style={inputStyle}
            placeholder="runs"
          />
        </FieldRow>
      </div>

      {/* P4.3 — Row height / density */}
      <div style={{ padding: "0 12px 8px", display: "flex", gap: "8px" }}>
        <FieldRow label="Altura">
          <input
            type="number"
            value={p.rowHeight || 48}
            onChange={(e) => updateNodeProps(nodeId, { rowHeight: parseInt(e.target.value) || 48 })}
            style={{ ...inputStyle, width: "60px" }}
            min={24}
            max={96}
          />
        </FieldRow>
        <FieldRow label="Density">
          <div style={{ display: "flex", gap: "2px" }}>
            {(["compact", "normal", "comfortable"] as const).map((d) => {
              const heights = { compact: 36, normal: 48, comfortable: 60 };
              const isActive = (p.rowHeight || 48) === heights[d];
              return (
                <button
                  key={d}
                  onClick={() => updateNodeProps(nodeId, { rowHeight: heights[d], compact: d === "compact" })}
                  style={{
                    ...densityBtnStyle,
                    background: isActive ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                    color: isActive ? "#fff" : "var(--orqui-colors-text-dim, #5b5b66)",
                  }}
                >
                  {d.charAt(0).toUpperCase()}
                </button>
              );
            })}
          </div>
        </FieldRow>
      </div>

      {/* Empty message */}
      <div style={{ padding: "0 12px 8px" }}>
        <FieldRow label="Vazio">
          <input
            value={p.emptyMessage || ""}
            onChange={(e) => updateNodeProps(nodeId, { emptyMessage: e.target.value })}
            style={inputStyle}
            placeholder="Nenhum item encontrado"
          />
        </FieldRow>
      </div>

      {/* Columns list */}
      <div style={{ borderTop: "1px solid var(--orqui-colors-border, #2a2a33)", padding: "8px" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--orqui-colors-text-dim, #5b5b66)", padding: "4px", marginBottom: "4px" }}>
          Colunas ({columns.length})
        </div>

        {columns.map((col, idx) => (
          <div key={col.key} style={{ marginBottom: "4px" }}>
            {/* Column header row — draggable */}
            <div
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              style={{
                ...colHeaderStyle,
                opacity: dragIdx === idx ? 0.4 : 1,
                borderLeft: overIdx === idx && dragIdx !== null ? "3px solid var(--orqui-colors-accent, #6d9cff)" : "3px solid transparent",
                background: expandedCol === idx ? "rgba(109,156,255,0.08)" : "var(--orqui-colors-surface-2, #1c1c21)",
              }}
            >
              <span style={dragHandleStyle}>⋮⋮</span>
              <span style={{ flex: 1, fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {col.label || col.key}
              </span>
              <span style={{ fontSize: "10px", color: "var(--orqui-colors-text-dim, #5b5b66)", fontFamily: "monospace" }}>
                {col.width || "auto"}
              </span>
              <button onClick={() => setExpandedCol(expandedCol === idx ? null : idx)} style={expandBtnStyle}>
                {expandedCol === idx ? "▲" : "▼"}
              </button>
              <button onClick={() => duplicateColumn(idx)} style={expandBtnStyle} title="Duplicar">⧉</button>
              <button onClick={() => removeColumn(idx)} style={{ ...expandBtnStyle, color: "var(--orqui-colors-danger, #ff6b6b)" }}>✕</button>
            </div>

            {/* Column expanded editor */}
            {expandedCol === idx && (
              <ColumnEditor
                col={col}
                idx={idx}
                entityName={p.dataSource?.replace(/s$/, "") || "item"}
                onUpdate={(updates) => updateColumn(idx, updates)}
                onOpenPicker={() => openVariablePicker(nodeId, `columns[${idx}].content`)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Column Editor (P4.2)
// ============================================================================

function ColumnEditor({
  col, idx, entityName, onUpdate, onOpenPicker,
}: {
  col: TableColumn;
  idx: number;
  entityName: string;
  onUpdate: (updates: Partial<TableColumn>) => void;
  onOpenPicker: () => void;
}) {
  const COMMON_TEMPLATES = [
    { label: "ID (truncado)", template: `{{${entityName}.id | truncate:8}}` },
    { label: "Status (badge)", template: `{{${entityName}.status | badge}}` },
    { label: "Data (relativa)", template: `{{${entityName}.created_at | date:relative}}` },
    { label: "Duração", template: `{{${entityName}.duration | duration}}` },
    { label: "Ações", template: `{{$actions: view, edit, delete}}` },
  ];

  return (
    <div style={colEditorStyle}>
      <FieldRow label="Label">
        <input value={col.label} onChange={(e) => onUpdate({ label: e.target.value })} style={inputStyle} />
      </FieldRow>

      <FieldRow label="Key">
        <input value={col.key} onChange={(e) => onUpdate({ key: e.target.value })} style={{ ...inputStyle, fontFamily: "monospace", fontSize: "11px" }} />
      </FieldRow>

      <FieldRow label="Content">
        <div style={{ display: "flex", gap: "4px" }}>
          <input
            value={col.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: "11px" }}
            placeholder={`{{${entityName}.field | formatter}}`}
          />
          <button onClick={onOpenPicker} style={varBtnStyle} title="Picker de variáveis">{"{{ }}"}</button>
        </div>
      </FieldRow>

      {/* Quick template suggestions */}
      <div style={{ padding: "4px 0" }}>
        <div style={{ fontSize: "10px", color: "var(--orqui-colors-text-dim, #5b5b66)", marginBottom: "4px" }}>Templates rápidos:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
          {COMMON_TEMPLATES.map(({ label, template }) => (
            <button
              key={label}
              onClick={() => onUpdate({ content: template })}
              style={quickTemplateStyle}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <FieldRow label="Width">
        <div style={{ display: "flex", gap: "4px" }}>
          <input value={col.width || ""} onChange={(e) => onUpdate({ width: e.target.value })} style={{ ...inputStyle, width: "80px" }} placeholder="auto" />
          <div style={{ display: "flex", gap: "2px" }}>
            {["80px", "120px", "180px", "auto", "1fr"].map((w) => (
              <button key={w} onClick={() => onUpdate({ width: w })} style={{
                ...densityBtnStyle, fontSize: "9px", padding: "2px 4px",
                background: col.width === w ? "rgba(109,156,255,0.2)" : "transparent",
                color: col.width === w ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-dim, #5b5b66)",
              }}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </FieldRow>

      <FieldRow label="Align">
        <div style={{ display: "flex", gap: "2px" }}>
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onUpdate({ align: a })}
              style={{
                ...densityBtnStyle,
                background: (col.align || "left") === a ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                color: (col.align || "left") === a ? "#fff" : "var(--orqui-colors-text-dim, #5b5b66)",
              }}
            >
              {a === "left" ? "◧" : a === "center" ? "◫" : "◨"}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Link">
        <input
          value={col.link || ""}
          onChange={(e) => onUpdate({ link: e.target.value })}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: "11px" }}
          placeholder={`/runs/{{${entityName}.id}}`}
        />
      </FieldRow>
    </div>
  );
}

// ============================================================================
// P4.4 — Table Preview with mock data
// ============================================================================

export function TablePreviewWithMock({ nodeId }: { nodeId: string }) {
  const { state } = useEditor();
  const page = state.contract.pages[state.currentPage];
  if (!page) return null;
  const node = findNode(page.content, nodeId);
  if (!node || node.type !== "table") return null;

  const p = node.props || {};
  const columns: TableColumn[] = p.columns || [];
  const entityName = p.dataSource?.replace(/s$/, "") || "item";
  const rowHeight = p.rowHeight || 48;
  const compact = p.compact || false;

  // Generate mock data from variable schema
  const mockRows = generateMockRows(state.variables, entityName, 5);

  return (
    <div style={previewStyle}>
      <div style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--orqui-colors-text-dim, #5b5b66)", marginBottom: "8px" }}>
        Preview ({mockRows.length} rows)
      </div>
      <div style={{ overflowX: "auto", borderRadius: "6px", border: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{
                  padding: compact ? "6px 10px" : "8px 14px",
                  textAlign: col.align || "left",
                  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
                  background: "var(--orqui-colors-surface, #141417)",
                  color: "var(--orqui-colors-text-muted, #8b8b96)",
                  fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
                  width: col.width || "auto",
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockRows.map((row: any, rowIdx: number) => (
              <tr key={rowIdx} style={{ height: rowHeight }}>
                {columns.map((col) => {
                  const displayValue = resolveTemplateMock(col.content, entityName, row);
                  return (
                    <td key={col.key} style={{
                      padding: compact ? "4px 10px" : "8px 14px",
                      textAlign: col.align || "left",
                      borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
                      fontSize: compact ? "12px" : "13px",
                      color: "var(--orqui-colors-text, #e4e4e7)",
                      maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {col.link ? (
                        <span style={{ color: "var(--orqui-colors-accent, #6d9cff)" }}>{displayValue}</span>
                      ) : (
                        displayValue
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// P4.5 — List View Alternative
// ============================================================================

export function ListViewBuilder({ nodeId }: { nodeId: string }) {
  const { state, updateNodeProps } = useEditor();
  const page = state.contract.pages[state.currentPage];
  if (!page) return null;
  const node = findNode(page.content, nodeId);
  if (!node || node.type !== "list") return null;

  const p = node.props || {};

  return (
    <div style={builderStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: "12px" }}>List Builder</span>
      </div>

      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <FieldRow label="DataSource">
          <input value={p.dataSource || ""} onChange={(e) => updateNodeProps(nodeId, { dataSource: e.target.value })} style={inputStyle} placeholder="runs" />
        </FieldRow>

        <FieldRow label="Max Items">
          <input type="number" value={p.maxItems || 10} onChange={(e) => updateNodeProps(nodeId, { maxItems: parseInt(e.target.value) || 10 })} style={inputStyle} min={1} max={100} />
        </FieldRow>

        <FieldRow label="Layout">
          <div style={{ display: "flex", gap: "4px" }}>
            {(["card", "row", "compact"] as const).map((layout) => (
              <button
                key={layout}
                onClick={() => updateNodeProps(nodeId, { listLayout: layout })}
                style={{
                  ...densityBtnStyle, flex: 1, textTransform: "capitalize",
                  background: (p.listLayout || "row") === layout ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                  color: (p.listLayout || "row") === layout ? "#fff" : "var(--orqui-colors-text-dim, #5b5b66)",
                }}
              >
                {layout}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Gap">
          <select value={p.gap || "8px"} onChange={(e) => updateNodeProps(nodeId, { gap: e.target.value })} style={inputStyle}>
            <option value="0">None</option>
            <option value="4px">4px</option>
            <option value="8px">8px</option>
            <option value="12px">12px</option>
            <option value="16px">16px</option>
          </select>
        </FieldRow>

        {p.listLayout === "card" && (
          <FieldRow label="Colunas">
            <div style={{ display: "flex", gap: "2px" }}>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => updateNodeProps(nodeId, { cardColumns: n })}
                  style={{
                    ...densityBtnStyle,
                    background: (p.cardColumns || 1) === n ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-surface-2, #1c1c21)",
                    color: (p.cardColumns || 1) === n ? "#fff" : "var(--orqui-colors-text-dim, #5b5b66)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </FieldRow>
        )}
      </div>

      {/* Template node hint */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
        <div style={{ fontSize: "11px", color: "var(--orqui-colors-text-dim, #5b5b66)", lineHeight: 1.5 }}>
          💡 Adicione um node filho como template do item. Use <code style={{ color: "var(--orqui-colors-accent, #6d9cff)", fontFamily: "monospace" }}>{"{{item.field}}"}</code> nos textos do template.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mock data generation from variable schema
// ============================================================================

function generateMockRows(variables: Record<string, any>, entityName: string, count: number): Record<string, any>[] {
  const entities = variables?.entities || {};
  const entity = entities[entityName];
  if (!entity) {
    return Array.from({ length: count }, (_, i) => ({ id: `mock_${i}`, name: `Item ${i + 1}` }));
  }

  const fields = entity.fields || {};
  return Array.from({ length: count }, (_, i) => {
    const row: Record<string, any> = {};
    for (const [fieldName, fieldDef] of Object.entries(fields) as [string, any][]) {
      row[fieldName] = generateMockValue(fieldDef, i);
    }
    return row;
  });
}

function generateMockValue(field: any, idx: number): any {
  if (field.example !== undefined) return field.example;
  switch (field.type) {
    case "string": return field.label ? `${field.label} ${idx + 1}` : `value_${idx}`;
    case "number": return Math.round(Math.random() * 1000);
    case "boolean": return idx % 2 === 0;
    case "date": return new Date(Date.now() - idx * 3600000).toISOString();
    case "enum": {
      const options = field.enum || field.options || ["a", "b", "c"];
      return options[idx % options.length];
    }
    case "ref": return { name: `Ref ${idx + 1}`, id: `ref_${idx}` };
    case "array": return [`item_${idx}_a`, `item_${idx}_b`];
    default: return `mock_${idx}`;
  }
}

function resolveTemplateMock(template: string, entityName: string, row: Record<string, any>): string {
  if (!template) return "—";
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const trimmed = expr.trim();
    // Handle formatters
    const pipeIdx = trimmed.indexOf("|");
    const path = pipeIdx > -1 ? trimmed.slice(0, pipeIdx).trim() : trimmed;
    const formatter = pipeIdx > -1 ? trimmed.slice(pipeIdx + 1).trim() : "";

    // Resolve path
    const parts = path.split(".");
    let value: any;
    if (parts[0] === entityName) {
      value = row;
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
      }
    } else {
      value = path;
    }

    // Apply formatter hint
    if (value == null) return "—";
    if (formatter.startsWith("badge")) return `[${value}]`;
    if (formatter.startsWith("date")) return new Date(value).toLocaleDateString("pt-BR");
    if (formatter.startsWith("truncate")) {
      const n = parseInt(formatter.split(":")[1]) || 8;
      return String(value).slice(0, n) + "…";
    }
    if (formatter.startsWith("duration")) {
      const ms = Number(value);
      if (isNaN(ms)) return String(value);
      const s = Math.floor(ms / 1000);
      return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
    }
    if (formatter.startsWith("currency")) return `R$ ${Number(value).toFixed(2)}`;
    if (formatter.startsWith("percent")) return `${Number(value).toFixed(1)}%`;

    return String(value);
  });
}

// ============================================================================
// Helpers
// ============================================================================

function findNode(node: any, id: string): any {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
      <span style={{ width: "65px", flexShrink: 0, color: "var(--orqui-colors-text-muted, #8b8b96)", fontSize: "11px" }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const builderStyle: CSSProperties = { display: "flex", flexDirection: "column" };

const headerStyle: CSSProperties = {
  padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const inputStyle: CSSProperties = {
  width: "100%", background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)", borderRadius: "4px",
  padding: "4px 8px", fontSize: "12px", color: "var(--orqui-colors-text, #e4e4e7)", outline: "none",
};

const addBtnStyle: CSSProperties = {
  padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
  background: "rgba(109,156,255,0.15)", color: "var(--orqui-colors-accent, #6d9cff)", border: "none",
};

const colHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px",
  borderRadius: "4px", cursor: "pointer", transition: "background 0.1s",
};

const dragHandleStyle: CSSProperties = {
  cursor: "grab", fontSize: "10px", color: "var(--orqui-colors-text-dim, #5b5b66)", letterSpacing: "-2px",
};

const expandBtnStyle: CSSProperties = {
  background: "none", border: "none", cursor: "pointer", fontSize: "10px",
  color: "var(--orqui-colors-text-dim, #5b5b66)", padding: "2px 4px",
};

const densityBtnStyle: CSSProperties = {
  padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500,
  border: "1px solid var(--orqui-colors-border, #2a2a33)", cursor: "pointer",
};

const varBtnStyle: CSSProperties = {
  padding: "4px 6px", borderRadius: "4px", border: "1px solid var(--orqui-colors-border, #2a2a33)",
  background: "var(--orqui-colors-surface-2, #1c1c21)", color: "var(--orqui-colors-accent, #6d9cff)",
  fontSize: "10px", fontFamily: "monospace", cursor: "pointer", whiteSpace: "nowrap",
};

const quickTemplateStyle: CSSProperties = {
  padding: "2px 6px", borderRadius: "3px", fontSize: "10px", cursor: "pointer",
  background: "var(--orqui-colors-surface-2, #1c1c21)", border: "1px solid var(--orqui-colors-border, #2a2a33)",
  color: "var(--orqui-colors-text-muted, #8b8b96)",
};

const colEditorStyle: CSSProperties = {
  padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px",
  background: "rgba(109,156,255,0.03)", borderRadius: "0 0 6px 6px",
};

const previewStyle: CSSProperties = { padding: "12px" };
