// ============================================================================
// Orqui VariablePicker
// Autocomplete popup for inserting {{entity.field | formatter}} into templates
// ============================================================================

import React, { useState, useMemo, useRef, useEffect, type CSSProperties } from "react";
import { useEditor } from "../EditorProvider.js";
import { getFormatterNames } from "../../engine/formatters.js";

interface VariableOption {
  path: string;           // "run.status"
  label: string;          // "Status"
  entity: string;         // "run"
  field: string;          // "status"
  type: string;           // "enum"
  example?: any;
  category: "entity" | "global" | "special";
  suggestedFormatters: string[];
}

export function VariablePicker() {
  const { state, dispatch, updateNodeProps } = useEditor();
  const [search, setSearch] = useState("");
  const [selectedFormatter, setSelectedFormatter] = useState("");
  const [formatterArg, setFormatterArg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = state.variablePickerOpen;
  const target = state.variablePickerTarget;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Build options from variable schema
  const options = useMemo(() => buildOptions(state.variables), [state.variables]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.path.toLowerCase().includes(q) ||
        opt.label.toLowerCase().includes(q) ||
        opt.entity.toLowerCase().includes(q) ||
        opt.field.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, VariableOption[]> = {};
    for (const opt of filtered) {
      const key = opt.category === "entity" ? opt.entity : opt.category;
      if (!groups[key]) groups[key] = [];
      groups[key].push(opt);
    }
    return groups;
  }, [filtered]);

  if (!isOpen || !target) return null;

  const close = () => {
    dispatch({ type: "CLOSE_VARIABLE_PICKER" });
    setSearch("");
    setSelectedFormatter("");
    setFormatterArg("");
  };

  const insertVariable = (opt: VariableOption) => {
    let template = `{{${opt.path}`;
    if (selectedFormatter) {
      template += ` | ${selectedFormatter}`;
      if (formatterArg) template += `:${formatterArg}`;
    }
    template += "}}";

    // Get current value and append
    const node = findNodeInPages(state.contract.pages, target.nodeId);
    if (node) {
      const currentValue = (node.props?.[target.propKey] || "") as string;
      updateNodeProps(target.nodeId, { [target.propKey]: currentValue + template });
    }
    close();
  };

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onClick={close} />

      {/* Picker panel */}
      <div style={pickerStyle}>
        {/* Header */}
        <div style={pickerHeaderStyle}>
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Inserir Variável</span>
          <button onClick={close} style={{ background: "none", border: "none", color: "var(--orqui-colors-text-muted)", cursor: "pointer", fontSize: "16px" }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: "0 12px 8px" }}>
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar variável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter" && filtered.length === 1) insertVariable(filtered[0]);
            }}
            style={searchInputStyle}
          />
        </div>

        {/* Options */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: "8px" }}>
              <div style={groupLabelStyle}>
                {group === "global" ? "Globals" : group === "special" ? "Especial" : group}
              </div>
              {items.map((opt) => (
                <button
                  key={opt.path}
                  onClick={() => insertVariable(opt)}
                  style={optionStyle}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--orqui-colors-accent, #6d9cff)" }}>
                      {`{{${opt.path}}}`}
                    </span>
                    <TypeBadge type={opt.type} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    <span style={{ fontSize: "11px", color: "var(--orqui-colors-text-muted, #8b8b96)" }}>{opt.label}</span>
                    {opt.example !== undefined && (
                      <span style={{ fontSize: "10px", color: "var(--orqui-colors-text-dim, #5b5b66)", fontFamily: "monospace" }}>
                        ex: {String(opt.example).slice(0, 20)}
                      </span>
                    )}
                  </div>
                  {opt.suggestedFormatters.length > 0 && (
                    <div style={{ display: "flex", gap: "3px", marginTop: "3px" }}>
                      {opt.suggestedFormatters.slice(0, 4).map((f) => (
                        <span
                          key={f}
                          onClick={(e) => { e.stopPropagation(); setSelectedFormatter(f); }}
                          style={formatterChipStyle(f === selectedFormatter)}
                        >
                          | {f}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "var(--orqui-colors-text-dim, #5b5b66)", fontSize: "13px" }}>
              Nenhuma variável encontrada
            </div>
          )}
        </div>

        {/* Formatter selector */}
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--orqui-colors-border, #2a2a33)" }}>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "11px" }}>
            <span style={{ color: "var(--orqui-colors-text-muted, #8b8b96)", flexShrink: 0 }}>Formatter:</span>
            <select
              value={selectedFormatter}
              onChange={(e) => setSelectedFormatter(e.target.value)}
              style={{ ...searchInputStyle, fontSize: "11px", padding: "3px 6px", flex: 1 }}
            >
              <option value="">Nenhum</option>
              {getFormatterNames().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {selectedFormatter && (
              <input
                value={formatterArg}
                onChange={(e) => setFormatterArg(e.target.value)}
                placeholder="arg"
                style={{ ...searchInputStyle, fontSize: "11px", padding: "3px 6px", width: "60px" }}
              />
            )}
          </div>
          {/* Preview */}
          <div style={{ marginTop: "4px", fontFamily: "monospace", fontSize: "11px", color: "var(--orqui-colors-accent, #6d9cff)" }}>
            {`{{variável${selectedFormatter ? ` | ${selectedFormatter}${formatterArg ? `:${formatterArg}` : ""}` : ""}}}`}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Build options from variable schema
// ============================================================================

function buildOptions(variables: Record<string, any>): VariableOption[] {
  const options: VariableOption[] = [];

  // Entities
  const entities = variables?.entities || {};
  for (const [entityName, entity] of Object.entries(entities) as [string, any][]) {
    const fields = entity.fields || {};
    for (const [fieldName, field] of Object.entries(fields) as [string, any][]) {
      if (field.type === "ref") {
        // For refs, add path through the referenced entity
        const refEntity = entities[field.entity];
        if (refEntity) {
          for (const [refField, refFieldDef] of Object.entries(refEntity.fields || {}) as [string, any][]) {
            options.push({
              path: `${entityName}.${fieldName}.${refField}`,
              label: `${field.label} → ${refFieldDef.label}`,
              entity: entityName,
              field: refField,
              type: refFieldDef.type,
              example: refFieldDef.example,
              category: "entity",
              suggestedFormatters: suggestFormatters(refFieldDef),
            });
          }
        }
      } else {
        options.push({
          path: `${entityName}.${fieldName}`,
          label: field.label,
          entity: entityName,
          field: fieldName,
          type: field.type,
          example: field.example,
          category: "entity",
          suggestedFormatters: suggestFormatters(field),
        });
      }
    }
  }

  // Globals
  const globals = variables?.globals || {};
  for (const [namespace, fields] of Object.entries(globals) as [string, any][]) {
    for (const [fieldName, field] of Object.entries(fields) as [string, any][]) {
      options.push({
        path: `${namespace}.${fieldName}`,
        label: field.label,
        entity: namespace,
        field: fieldName,
        type: field.type,
        example: field.example,
        category: "global",
        suggestedFormatters: suggestFormatters(field),
      });
    }
  }

  // Special variables
  options.push(
    { path: "$app.name", label: "Nome do App", entity: "$app", field: "name", type: "string", category: "special", suggestedFormatters: [] },
    { path: "$page.label", label: "Label da Página", entity: "$page", field: "label", type: "string", category: "special", suggestedFormatters: [] },
    { path: "$page.route", label: "Rota da Página", entity: "$page", field: "route", type: "string", category: "special", suggestedFormatters: [] },
  );

  return options;
}

function suggestFormatters(field: any): string[] {
  const suggestions: string[] = [];
  switch (field.type) {
    case "enum":
      suggestions.push("badge");
      if (field.iconMap) suggestions.push("icon");
      break;
    case "date":
      suggestions.push("date:relative", "date:short", "date:full");
      break;
    case "number":
      suggestions.push("number", "number:compact");
      if (field.unit === "ms") suggestions.push("duration");
      break;
    case "boolean":
      suggestions.push("boolean:Sim/Não", "boolean:icon");
      break;
    case "string":
      suggestions.push("truncate:20", "uppercase", "capitalize");
      break;
    case "array":
      suggestions.push("count", "join", "first");
      break;
  }
  suggestions.push("default:—");
  return suggestions;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: "#6d9cff", number: "#4ade80", boolean: "#fbbf24",
    date: "#a855f7", enum: "#f472b6", ref: "#22d3ee", array: "#fb923c",
  };
  const color = colors[type] || "#8b8b96";
  return (
    <span style={{
      fontSize: "9px", fontWeight: 600, padding: "1px 4px", borderRadius: "3px",
      background: `${color}22`, color, textTransform: "uppercase",
    }}>
      {type}
    </span>
  );
}

function findNodeInPages(pages: Record<string, any>, nodeId: string): any {
  for (const page of Object.values(pages)) {
    const found = findNode(page.content, nodeId);
    if (found) return found;
  }
  return null;
}

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

// ============================================================================
// Styles
// ============================================================================

const backdropStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
};

const pickerStyle: CSSProperties = {
  position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  width: "480px", maxHeight: "70vh", display: "flex", flexDirection: "column",
  background: "var(--orqui-colors-surface, #141417)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)",
  borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", zIndex: 101,
  overflow: "hidden",
};

const pickerHeaderStyle: CSSProperties = {
  padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
  borderBottom: "1px solid var(--orqui-colors-border, #2a2a33)",
};

const searchInputStyle: CSSProperties = {
  width: "100%", background: "var(--orqui-colors-surface-2, #1c1c21)",
  border: "1px solid var(--orqui-colors-border, #2a2a33)", borderRadius: "6px",
  padding: "6px 10px", fontSize: "13px", color: "var(--orqui-colors-text, #e4e4e7)", outline: "none",
};

const groupLabelStyle: CSSProperties = {
  fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
  color: "var(--orqui-colors-text-dim, #5b5b66)", padding: "4px 8px",
};

const optionStyle: CSSProperties = {
  display: "flex", flexDirection: "column", width: "100%", padding: "8px 10px",
  background: "none", border: "none", cursor: "pointer", borderRadius: "6px",
  textAlign: "left", color: "var(--orqui-colors-text, #e4e4e7)",
  transition: "background 0.1s",
};

function formatterChipStyle(active: boolean): CSSProperties {
  return {
    fontSize: "10px", padding: "1px 5px", borderRadius: "3px", cursor: "pointer",
    fontFamily: "monospace",
    background: active ? "rgba(109,156,255,0.2)" : "var(--orqui-colors-surface-2, #1c1c21)",
    color: active ? "var(--orqui-colors-accent, #6d9cff)" : "var(--orqui-colors-text-dim, #5b5b66)",
    border: active ? "1px solid var(--orqui-colors-accent, #6d9cff)" : "1px solid transparent",
  };
}
