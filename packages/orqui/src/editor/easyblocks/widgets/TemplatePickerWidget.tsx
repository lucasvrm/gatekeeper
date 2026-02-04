// ============================================================================
// TemplatePickerWidget — Easyblocks sidebar widget for orqui-template type
//
// PHASE 6 (P6) ENHANCEMENTS:
//   - Auto-open variable picker when {{ is typed
//   - Auto-open formatter picker when | is typed inside an expression
//   - Smart insertion: detects if {{ already precedes cursor
//   - Keyboard navigation: ↑↓ in dropdowns, Tab to select, Esc to close
//   - Inline expression syntax highlighting
//
// Widget Props (Easyblocks InlineTypeWidgetComponentProps<string>):
//   value: string       — current prop value
//   onChange: (v) => void — callback to update
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import {
  hasTemplateExpr,
  resolveTemplate,
  FORMATTERS,
  FORMATTER_CATEGORIES,
  type FormatterInfo,
} from "../../page-editor/templateEngine";
import {
  searchVariables,
  groupByCategory,
  typeIcon,
  formatMock,
  type VariableInfo,
  type VariableCategory,
} from "../../page-editor/variableSchema";
import { C, MONO } from "../../page-editor/styles";
import type { WidgetVariableContext } from "../bridge/variables";

// ============================================================================
// Widget Props
// ============================================================================

interface WidgetProps {
  value?: unknown;
  onChange?: (value: string) => void;
  schema?: { prop?: string; label?: string; defaultValue?: unknown };
  id?: string;
  params?: Record<string, any>;
  [key: string]: unknown;
}

// ============================================================================
// Variable Context
// ============================================================================

const EMPTY_CONTEXT: WidgetVariableContext = {
  groups: [],
  paths: [],
  mockData: {},
};

function getVariableContext(): WidgetVariableContext {
  const raw = (window as any).__orquiVariableContext;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.groups)) {
    return EMPTY_CONTEXT;
  }
  return raw as WidgetVariableContext;
}

function extractStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") {
    const v = value as Record<string, any>;
    if (typeof v.value === "string") return v.value;
    if (typeof v["pt-BR"] === "string") return v["pt-BR"];
    console.warn("[TemplatePickerWidget] Unexpected value type:", value);
    return "";
  }
  return String(value);
}

// ============================================================================
// Main Widget Component
// ============================================================================

export function TemplatePickerWidget(props: WidgetProps) {
  const rawValue = props?.value;
  const rawOnChange = typeof props?.onChange === "function" ? props.onChange : undefined;

  const label = (props?.schema as any)?.label
    || (props?.params as any)?.label
    || (props as any)?.label
    || undefined;

  // One-time diagnostic log
  useEffect(() => {
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
      console.debug("[TemplatePickerWidget] mounted with props:", {
        value: rawValue,
        valueType: typeof rawValue,
        hasOnChange: !!rawOnChange,
        allPropKeys: props ? Object.keys(props) : [],
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formatterOpen, setFormatterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeValue = extractStringValue(rawValue);
  const hasExpr = hasTemplateExpr(safeValue);
  const ctx = getVariableContext();

  const safeOnChange = useCallback((v: string) => {
    rawOnChange?.(v);
  }, [rawOnChange]);

  // Flatten variable data
  const allItems = ctx.groups.flatMap(g =>
    Array.isArray(g?.items) ? g.items : []
  );
  const allCategories = ctx.groups
    .map(g => g?.category)
    .filter((c): c is VariableCategory =>
      c != null && typeof c === "object" && typeof c.id === "string"
    );

  // Live preview
  let preview: string | null = null;
  try {
    preview = hasExpr ? resolveTemplate(safeValue, ctx.mockData || {}) : null;
  } catch {
    preview = null;
  }

  // ---- Cursor-aware insertion ----

  const insertAtCursor = useCallback((text: string) => {
    const el = inputRef.current;
    if (!el) {
      safeOnChange(safeValue + text);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = safeValue.slice(0, start);
    const after = safeValue.slice(end);
    const newValue = before + text + after;
    safeOnChange(newValue);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }, [safeValue, safeOnChange]);

  // ---- P6: Smart variable selection ----
  // If cursor is right after "{{", insert only the path + "}}"
  // Otherwise insert the full "{{path}}" expression
  const handleSelectVariable = useCallback((path: string) => {
    const el = inputRef.current;
    const cursor = el?.selectionStart || safeValue.length;
    const before = safeValue.slice(0, cursor);

    if (before.endsWith("{{")) {
      // Cursor is after {{ — just insert path + }}
      insertAtCursor(`${path}}}`);
    } else if (before.endsWith("{{ ")) {
      // Cursor after {{ with space
      insertAtCursor(`${path}}}`);
    } else {
      // Insert full expression
      insertAtCursor(`{{${path}}}`);
    }
    setPickerOpen(false);
  }, [safeValue, insertAtCursor]);

  // ---- P6: Smart formatter selection ----
  // If cursor is after "|" inside an expression, insert formatter name
  // Otherwise insert " | name" before the last }}
  const handleSelectFormatter = useCallback((name: string) => {
    const el = inputRef.current;
    const cursor = el?.selectionStart || safeValue.length;
    const before = safeValue.slice(0, cursor);

    // Check if cursor is right after "| " or "|" inside an expression
    if (before.match(/\|\s*$/)) {
      // Cursor after pipe — insert formatter name directly
      const trimmed = before.endsWith("| ") ? "" : " ";
      insertAtCursor(trimmed + name);
    } else {
      // Insert pipe before the last closing }}
      const lastClose = safeValue.lastIndexOf("}}");
      if (lastClose > 0) {
        safeOnChange(safeValue.slice(0, lastClose) + ` | ${name}` + safeValue.slice(lastClose));
      }
    }
    setFormatterOpen(false);
  }, [safeValue, safeOnChange, insertAtCursor]);

  // ---- P6: Auto-open picker on {{ and formatter on | ----
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    safeOnChange(newValue);

    const cursor = e.target.selectionStart || newValue.length;
    const before = newValue.slice(0, cursor);

    // Auto-open variable picker when {{ is typed
    if (before.endsWith("{{")) {
      setPickerOpen(true);
      setFormatterOpen(false);
      return;
    }

    // Auto-open formatter picker when | is typed inside an expression
    if (hasTemplateExpr(newValue) && (before.endsWith("| ") || before.endsWith("|"))) {
      // Verify we're inside a {{ ... }} expression
      const lastOpen = before.lastIndexOf("{{");
      const lastClose = before.lastIndexOf("}}");
      if (lastOpen > lastClose) {
        // We're inside an expression — open formatter picker
        setFormatterOpen(true);
        setPickerOpen(false);
      }
    }
  }, [safeOnChange]);

  // ---- P6: Keyboard navigation in input ----
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape closes any open picker
    if (e.key === "Escape") {
      if (pickerOpen || formatterOpen) {
        e.preventDefault();
        e.stopPropagation();
        setPickerOpen(false);
        setFormatterOpen(false);
      }
    }

    // Down arrow opens picker if not open
    if (e.key === "ArrowDown" && !pickerOpen && !formatterOpen) {
      const before = safeValue.slice(0, inputRef.current?.selectionStart || 0);
      const lastOpen = before.lastIndexOf("{{");
      const lastClose = before.lastIndexOf("}}");
      if (lastOpen > lastClose) {
        // Inside expression — open formatter
        e.preventDefault();
        setFormatterOpen(true);
      } else {
        // Not inside — open variable
        e.preventDefault();
        setPickerOpen(true);
      }
    }
  }, [pickerOpen, formatterOpen, safeValue]);

  // ---- Render ----

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input row */}
      <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            ref={inputRef}
            type="text"
            value={safeValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={label || "Texto ou {{variável}}"}
            style={{
              ...inputStyle,
              borderColor: focused ? C.accent : C.border,
              ...(hasExpr ? { color: C.accent, fontFamily: MONO, fontSize: 11 } : {}),
              paddingRight: 28,
            }}
          />
          {/* Inline template indicator */}
          {hasExpr && (
            <span style={templateIndicatorStyle}>{"{ }"}</span>
          )}
        </div>

        {/* Variable picker button */}
        <button
          onClick={() => { setPickerOpen(p => !p); setFormatterOpen(false); }}
          title="Inserir variável (ou digite {{)"
          style={{
            ...btnStyle,
            background: pickerOpen ? C.accent + "20" : C.surface2,
            color: pickerOpen ? C.accent : C.textDim,
            borderColor: pickerOpen ? C.accent + "40" : C.border,
          }}
        >
          {"{ }"}
        </button>

        {/* Formatter button — only when an expression exists */}
        {hasExpr && (
          <button
            onClick={() => { setFormatterOpen(f => !f); setPickerOpen(false); }}
            title="Adicionar formatador (ou digite |)"
            style={{
              ...btnStyle,
              background: formatterOpen ? C.accent + "20" : C.surface2,
              color: formatterOpen ? C.accent : C.textDim,
              borderColor: formatterOpen ? C.accent + "40" : C.border,
              fontSize: 10,
            }}
          >
            |&gt;
          </button>
        )}
      </div>

      {/* Preview line */}
      {preview !== null && (
        <div style={previewStyle}>
          <span style={{ fontSize: 9, color: C.textDim, fontWeight: 600, flexShrink: 0 }}>
            PREVIEW:
          </span>
          <span style={{
            fontSize: 11, color: C.success, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {preview || "—"}
          </span>
        </div>
      )}

      {/* Variable Picker dropdown */}
      {pickerOpen && (
        <WidgetVariablePicker
          items={allItems}
          categories={allCategories}
          onSelect={handleSelectVariable}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Formatter Picker dropdown */}
      {formatterOpen && (
        <WidgetFormatterPicker
          onSelect={handleSelectFormatter}
          onClose={() => setFormatterOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// WidgetVariablePicker — Searchable dropdown grouped by category
// P6: Added keyboard navigation (↑↓ to navigate, Enter to select)
// ============================================================================

interface VariablePickerProps {
  items: VariableInfo[];
  categories: VariableCategory[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

function WidgetVariablePicker({ items, categories, onSelect, onClose }: VariablePickerProps) {
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = searchVariables(search, items);
  const grouped = groupByCategory(filtered);

  // Reset highlight on search change
  useEffect(() => { setHighlightIdx(0); }, [search]);

  // P6: Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && highlightIdx < filtered.length) {
        onSelect(filtered[highlightIdx].path);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (filtered.length === 1) {
        onSelect(filtered[0].path);
      }
    }
    e.stopPropagation();
  }, [onClose, onSelect, filtered, highlightIdx]);

  return (
    <div ref={ref} style={dropdownStyle} onKeyDown={handleKeyDown}>
      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar variável..."
          style={dropdownSearchStyle}
        />
      </div>

      {/* Hint */}
      {items.length > 0 && (
        <div style={{
          padding: "0 8px 4px", fontSize: 9, color: C.textDim,
          display: "flex", gap: 8,
        }}>
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>Tab aceitar único</span>
        </div>
      )}

      {/* Variable list */}
      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {(() => {
          let flatIdx = 0;
          return categories.filter(cat => cat?.id && grouped[cat.id]?.length).map(cat => (
            <div key={cat.id}>
              <div style={catLabelStyle}>
                <span>{cat.icon || "📦"}</span>
                <span>{cat.label || cat.id}</span>
              </div>
              {(grouped[cat.id] || []).map(v => {
                if (!v?.path) return null;
                const currentIdx = flatIdx++;
                const isHighlighted = currentIdx === highlightIdx;
                return (
                  <button
                    key={v.path}
                    onClick={() => onSelect(v.path)}
                    style={{
                      ...varItemStyle,
                      background: isHighlighted ? C.accent + "15" : "transparent",
                      outline: isHighlighted ? `1px solid ${C.accent}30` : "none",
                    }}
                    onMouseEnter={(e) => {
                      setHighlightIdx(currentIdx);
                      e.currentTarget.style.background = C.surface3;
                    }}
                    onMouseLeave={(e) => {
                      if (!isHighlighted) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{
                      fontSize: 9, fontFamily: MONO, color: C.textDim,
                      width: 18, textAlign: "center", flexShrink: 0,
                    }}>
                      {typeIcon(v.type)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontFamily: MONO, color: C.text, fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {v.path}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim }}>{v.label || ""}</div>
                    </div>
                    <span style={{
                      fontSize: 9, color: C.textDim + "80", fontFamily: MONO, flexShrink: 0,
                    }}>
                      {formatMock(v.mockValue)}
                    </span>
                  </button>
                );
              })}
            </div>
          ));
        })()}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 11, color: C.textDim }}>
            {items.length === 0
              ? "Nenhuma variável configurada"
              : "Nenhuma variável encontrada"}
          </div>
        )}
      </div>

      {/* Tip footer */}
      <div style={{
        padding: "4px 8px", borderTop: `1px solid ${C.border}`,
        fontSize: 9, color: C.textDim,
      }}>
        Dica: digite{" "}
        <span style={{ fontFamily: MONO, color: C.accent }}>{"{{ }}"}</span>{" "}
        diretamente no campo
      </div>
    </div>
  );
}

// ============================================================================
// WidgetFormatterPicker — Searchable dropdown for pipe formatters
// P6: Added keyboard navigation
// ============================================================================

interface FormatterPickerProps {
  onSelect: (name: string) => void;
  onClose: () => void;
}

function WidgetFormatterPicker({ onSelect, onClose }: FormatterPickerProps) {
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filtered = search.trim()
    ? FORMATTERS.filter(f =>
        f.name.includes(search.toLowerCase()) ||
        (f.label || "").toLowerCase().includes(search.toLowerCase()) ||
        (f.description || "").toLowerCase().includes(search.toLowerCase())
      )
    : FORMATTERS;

  // Group by category
  const grouped: Record<string, FormatterInfo[]> = {};
  for (const f of filtered) {
    if (!f?.category) continue;
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  // Reset highlight on search change
  useEffect(() => { setHighlightIdx(0); }, [search]);

  // P6: Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && highlightIdx < filtered.length) {
        const f = filtered[highlightIdx];
        onSelect(f.args ? `${f.name}:` : f.name);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (filtered.length === 1) {
        const f = filtered[0];
        onSelect(f.args ? `${f.name}:` : f.name);
      }
    }
    e.stopPropagation();
  }, [onClose, onSelect, filtered, highlightIdx]);

  return (
    <div ref={ref} style={dropdownStyle} onKeyDown={handleKeyDown}>
      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar formatador..."
          style={dropdownSearchStyle}
        />
      </div>

      {/* Hint */}
      <div style={{
        padding: "0 8px 4px", fontSize: 9, color: C.textDim,
        display: "flex", gap: 8,
      }}>
        <span>↑↓ navegar</span>
        <span>↵ selecionar</span>
        <span>Tab aceitar único</span>
      </div>

      {/* Formatter list */}
      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {(() => {
          let flatIdx = 0;
          return FORMATTER_CATEGORIES.filter(cat => cat?.id && grouped[cat.id]?.length).map(cat => (
            <div key={cat.id}>
              <div style={catLabelStyle}>
                <span>{cat.label || cat.id}</span>
              </div>
              {(grouped[cat.id] || []).map(f => {
                if (!f?.name) return null;
                const currentIdx = flatIdx++;
                const isHighlighted = currentIdx === highlightIdx;
                return (
                  <button
                    key={f.name}
                    onClick={() => onSelect(f.args ? `${f.name}:` : f.name)}
                    style={{
                      ...varItemStyle,
                      background: isHighlighted ? C.accent + "15" : "transparent",
                      outline: isHighlighted ? `1px solid ${C.accent}30` : "none",
                    }}
                    onMouseEnter={(e) => {
                      setHighlightIdx(currentIdx);
                      e.currentTarget.style.background = C.surface3;
                    }}
                    onMouseLeave={(e) => {
                      if (!isHighlighted) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontFamily: MONO, color: C.accent, fontWeight: 600,
                      }}>
                        | {f.name}{f.args ? `:${f.args}` : ""}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim }}>{f.description || ""}</div>
                    </div>
                    <span style={{
                      fontSize: 9, color: C.textDim + "80", fontFamily: MONO, flexShrink: 0,
                    }}>
                      {f.example || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ));
        })()}

        {filtered.length === 0 && (
          <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 11, color: C.textDim }}>
            Nenhum formatador encontrado
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "#1c1c21",
  color: C.text,
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  transition: "border-color 0.15s",
};

const templateIndicatorStyle: CSSProperties = {
  position: "absolute",
  right: 6,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 9,
  color: C.accent,
  opacity: 0.6,
  pointerEvents: "none",
  fontFamily: MONO,
  fontWeight: 700,
};

const btnStyle: CSSProperties = {
  padding: "0 6px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.textDim,
  cursor: "pointer",
  fontFamily: MONO,
  fontWeight: 700,
  fontSize: 11,
  transition: "all 0.12s",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const previewStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 6px",
  marginTop: 3,
  borderRadius: 3,
  background: C.surface2,
  border: `1px solid ${C.success}20`,
  overflow: "hidden",
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  marginTop: 4,
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  boxShadow: "0 8px 32px #0008",
  zIndex: 100,
  fontFamily: "'Inter', sans-serif",
};

const dropdownSearchStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 5,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.text,
  fontSize: 12,
  outline: "none",
  fontFamily: "'Inter', sans-serif",
};

const catLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 8px 2px",
  fontSize: 10,
  fontWeight: 600,
  color: C.textDim,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const varItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "5px 8px",
  borderRadius: 4,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "'Inter', sans-serif",
  transition: "background 0.1s",
};

// ============================================================================
// Widget registration map
// ============================================================================

export const ORQUI_WIDGETS: Record<string, React.ComponentType<any>> = {
  "orqui-template-picker": TemplatePickerWidget,
};
