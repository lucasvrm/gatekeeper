// ============================================================================
// TemplatePickerWidget — Easyblocks sidebar widget for orqui-template type
//
// Full widget with:
//   1. Input with {{}} syntax highlighting (mono font + accent color)
//   2. Variable picker dropdown (searchable, grouped by category)
//   3. Formatter picker dropdown (16 formatters from templateEngine)
//   4. Live preview line (resolves against mockData)
//
// Variable data comes from window.__orquiVariableContext, populated by
// EasyblocksPageEditor before mounting the editor. This avoids React Context
// dependency (Easyblocks sidebar doesn't share the page-editor context tree).
//
// Registration:
//   Config.types["orqui-template"].widget.id = "orqui-template-picker"
//   → Easyblocks renders this widget for props of type "orqui-template"
//
// Widget Props (Easyblocks InlineTypeWidgetComponentProps<string>):
//   value: string       — current prop value
//   onChange: (v) => void — callback to update
//   (other props may vary by EB version — all access is guarded)
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
// Widget Props — provided by Easyblocks (InlineTypeWidgetComponentProps<T>)
//
// Easyblocks docs specify { value, onChange } for inline types.
// We accept `any` and normalize defensively, since:
//   - Different EB versions may add/change props
//   - The widget must never crash the sidebar
// ============================================================================

interface WidgetProps {
  /** Current value of the prop */
  value?: unknown;
  /** Callback to update the value */
  onChange?: (value: string) => void;
  /** Some EB versions pass these — all optional and guarded */
  schema?: { prop?: string; label?: string; defaultValue?: unknown };
  id?: string;
  params?: Record<string, any>;
  /** Catch-all for unknown props EB might inject */
  [key: string]: unknown;
}

// ============================================================================
// Variable Context — read from global channel
// ============================================================================

const EMPTY_CONTEXT: WidgetVariableContext = {
  groups: [],
  paths: [],
  mockData: {},
};

/**
 * Read the variable context injected by EasyblocksPageEditor.
 * Returns empty context if not yet populated (graceful fallback).
 * Validates the shape defensively — bad data must never crash the widget.
 */
function getVariableContext(): WidgetVariableContext {
  const raw = (window as any).__orquiVariableContext;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.groups)) {
    return EMPTY_CONTEXT;
  }
  return raw as WidgetVariableContext;
}

/**
 * Safely extract string value from widget props.
 * Easyblocks should pass a plain string for inline types, but we guard
 * against objects, numbers, undefined, etc.
 */
function extractStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  // Edge case: EB might wrap in locale-aware object { $res: true, "pt-BR": "..." }
  if (typeof value === "object") {
    const v = value as Record<string, any>;
    // Try common Easyblocks value wrapper patterns
    if (typeof v.value === "string") return v.value;
    if (typeof v["pt-BR"] === "string") return v["pt-BR"];
    // Last resort — log for debugging but return empty
    console.warn("[TemplatePickerWidget] Unexpected value type:", value);
    return "";
  }
  return String(value);
}

// ============================================================================
// Main Widget Component
// ============================================================================

export function TemplatePickerWidget(props: WidgetProps) {
  // ---- Defensive prop extraction ----
  const rawValue = props?.value;
  const rawOnChange = typeof props?.onChange === "function" ? props.onChange : undefined;

  // Extract label from wherever EB might put it
  const label = (props?.schema as any)?.label
    || (props?.params as any)?.label
    || (props as any)?.label
    || undefined;

  // One-time diagnostic log (dev only)
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

  // Safe onChange wrapper — noop if EB didn't pass onChange
  const safeOnChange = useCallback((v: string) => {
    rawOnChange?.(v);
  }, [rawOnChange]);

  // Flatten variable data from grouped context (with guards)
  const allItems = ctx.groups.flatMap(g =>
    Array.isArray(g?.items) ? g.items : []
  );
  const allCategories = ctx.groups
    .map(g => g?.category)
    .filter((c): c is VariableCategory =>
      c != null && typeof c === "object" && typeof c.id === "string"
    );

  // Live preview — resolve template against mock data (safe: catch any error)
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
    safeOnChange(before + text + after);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }, [safeValue, safeOnChange]);

  const handleSelectVariable = useCallback((path: string) => {
    insertAtCursor(`{{${path}}}`);
    setPickerOpen(false);
  }, [insertAtCursor]);

  const handleSelectFormatter = useCallback((name: string) => {
    // Insert pipe before the last closing }}
    const lastClose = safeValue.lastIndexOf("}}");
    if (lastClose > 0) {
      safeOnChange(safeValue.slice(0, lastClose) + ` | ${name}` + safeValue.slice(lastClose));
    }
    setFormatterOpen(false);
  }, [safeValue, safeOnChange]);

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
            onChange={e => safeOnChange(e.target.value)}
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
          title="Inserir variável"
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
            title="Adicionar formatador"
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
// ============================================================================

interface VariablePickerProps {
  items: VariableInfo[];
  categories: VariableCategory[];
  onSelect: (path: string) => void;
  onClose: () => void;
}

function WidgetVariablePicker({ items, categories, onSelect, onClose }: VariablePickerProps) {
  const [search, setSearch] = useState("");
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

  return (
    <div ref={ref} style={dropdownStyle}>
      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar variável..."
          style={dropdownSearchStyle}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered.length === 1) {
              onSelect(filtered[0].path);
            }
          }}
        />
      </div>

      {/* Variable list — grouped by category */}
      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {categories.filter(cat => cat?.id && grouped[cat.id]?.length).map(cat => (
          <div key={cat.id}>
            <div style={catLabelStyle}>
              <span>{cat.icon || "📦"}</span>
              <span>{cat.label || cat.id}</span>
            </div>
            {(grouped[cat.id] || []).map(v => v?.path ? (
              <button
                key={v.path}
                onClick={() => onSelect(v.path)}
                style={varItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
            ) : null)}
          </div>
        ))}

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
// ============================================================================

interface FormatterPickerProps {
  onSelect: (name: string) => void;
  onClose: () => void;
}

function WidgetFormatterPicker({ onSelect, onClose }: FormatterPickerProps) {
  const [search, setSearch] = useState("");
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

  return (
    <div ref={ref} style={dropdownStyle}>
      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar formatador..."
          style={dropdownSearchStyle}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered.length === 1) {
              const f = filtered[0];
              onSelect(f.args ? `${f.name}:` : f.name);
            }
          }}
        />
      </div>

      {/* Formatter list — grouped by category */}
      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {FORMATTER_CATEGORIES.filter(cat => cat?.id && grouped[cat.id]?.length).map(cat => (
          <div key={cat.id}>
            <div style={catLabelStyle}>
              <span>{cat.label || cat.id}</span>
            </div>
            {(grouped[cat.id] || []).map(f => f?.name ? (
              <button
                key={f.name}
                onClick={() => onSelect(f.args ? `${f.name}:` : f.name)}
                style={varItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
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
            ) : null)}
          </div>
        ))}

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
// Styles — Easyblocks sidebar dark theme (~#1c1c21 bg, #2a2a33 borders)
// Constants from page-editor/styles.ts are reused (same dark theme).
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
// Widget registration map — for Easyblocks
// ============================================================================

/**
 * Map of widget IDs to widget components.
 * Pass this to EasyblocksEditor's `widgets` prop.
 */
export const ORQUI_WIDGETS: Record<string, React.ComponentType<any>> = {
  "orqui-template-picker": TemplatePickerWidget,
  // Future: "orqui-entity-picker": EntityPickerWidget,
};
