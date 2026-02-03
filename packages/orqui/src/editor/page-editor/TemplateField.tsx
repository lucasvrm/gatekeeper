// ============================================================================
// TemplateField — input with {{}} syntax highlighting and variable picker
// ============================================================================

import React, { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { parseTemplate, hasTemplateExpr, resolveTemplate, FORMATTERS, FORMATTER_CATEGORIES, type FormatterInfo } from "./templateEngine";
import {
  searchVariables, groupByCategory, typeIcon, formatMock,
  type VariableInfo, type VariableCategory,
} from "./variableSchema";
import { useVariables } from "./VariablesContext";
import { C, MONO } from "./styles";

// ============================================================================
// TemplateField component
// ============================================================================

interface TemplateFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export function TemplateField({ value, onChange, placeholder, multiline }: TemplateFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formatterOpen, setFormatterOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasExpr = hasTemplateExpr(value);

  // Insert variable at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newVal = before + text + after;
    onChange(newVal);
    // Restore cursor after the inserted text
    requestAnimationFrame(() => {
      el.focus();
      const newPos = start + text.length;
      el.setSelectionRange(newPos, newPos);
    });
  }, [value, onChange]);

  const handleSelectVariable = useCallback((path: string) => {
    insertAtCursor(`{{${path}}}`);
    setPickerOpen(false);
  }, [insertAtCursor]);

  const handleSelectFormatter = useCallback((name: string) => {
    // Find last }} and insert pipe before it
    const lastClose = value.lastIndexOf("}}");
    if (lastClose > 0) {
      const newVal = value.slice(0, lastClose) + ` | ${name}` + value.slice(lastClose);
      onChange(newVal);
    }
    setFormatterOpen(false);
  }, [value, onChange]);

  // Mock preview from context
  const { mockData } = useVariables();
  const preview = hasExpr ? resolveTemplate(value, mockData) : null;

  const InputTag = multiline ? "textarea" : "input";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input row */}
      <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <InputTag
            ref={inputRef as any}
            value={value}
            onChange={(e: any) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={multiline ? 3 : undefined}
            style={{
              ...inputStyle,
              ...(multiline ? { resize: "vertical" as const } : {}),
              ...(hasExpr ? { color: C.accent, fontFamily: MONO, fontSize: 11 } : {}),
              paddingRight: 28,
            }}
          />
          {/* Inline template indicator */}
          {hasExpr && (
            <span style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              fontSize: 9, color: C.accent, opacity: 0.6, pointerEvents: "none",
              fontFamily: MONO, fontWeight: 700,
            }}>
              {"{{}}"}
            </span>
          )}
        </div>

        {/* Variable picker button */}
        <button
          onClick={() => { setPickerOpen(!pickerOpen); setFormatterOpen(false); }}
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

        {/* Formatter button (only when there are expressions) */}
        {hasExpr && (
          <button
            onClick={() => { setFormatterOpen(!formatterOpen); setPickerOpen(false); }}
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
          <span style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>PREVIEW:</span>
          <span style={{ fontSize: 11, color: C.success }}>{preview}</span>
        </div>
      )}

      {/* Variable Picker dropdown */}
      {pickerOpen && (
        <VariablePicker
          onSelect={handleSelectVariable}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Formatter Picker dropdown */}
      {formatterOpen && (
        <FormatterPicker
          onSelect={handleSelectFormatter}
          onClose={() => setFormatterOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// VariablePicker — dropdown with searchable variable catalog
// ============================================================================

function VariablePicker({ onSelect, onClose }: { onSelect: (path: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { items, categories } = useVariables();

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
          placeholder="Buscar variável..."
          style={dropdownSearchStyle}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered.length === 1) {
              onSelect(filtered[0].path);
            }
          }}
        />
      </div>

      {/* Variable list */}
      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {categories.filter(cat => grouped[cat.id]?.length).map(cat => (
          <div key={cat.id}>
            <div style={catLabelStyle}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </div>
            {grouped[cat.id]!.map(v => (
              <button
                key={v.path}
                onClick={() => onSelect(v.path)}
                style={varItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 9, fontFamily: MONO, color: C.textDim, width: 18, textAlign: "center", flexShrink: 0 }}>
                  {typeIcon(v.type)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, color: C.text, fontWeight: 500 }}>{v.path}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{v.label}</div>
                </div>
                <span style={{ fontSize: 9, color: C.textDim + "80", fontFamily: MONO, flexShrink: 0 }}>
                  {formatMock(v.mockValue)}
                </span>
              </button>
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 11, color: C.textDim }}>
            Nenhuma variável encontrada
          </div>
        )}
      </div>

      {/* Tip */}
      <div style={{ padding: "4px 8px", borderTop: `1px solid ${C.border}`, fontSize: 9, color: C.textDim }}>
        Dica: digite <span style={{ fontFamily: MONO, color: C.accent }}>{"{{"}</span> diretamente no campo
      </div>
    </div>
  );
}

// ============================================================================
// FormatterPicker — dropdown for pipe formatters
// ============================================================================

function FormatterPicker({ onSelect, onClose }: { onSelect: (name: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

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
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.description.toLowerCase().includes(search.toLowerCase())
      )
    : FORMATTERS;

  const grouped: Record<string, FormatterInfo[]> = {};
  for (const f of filtered) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  return (
    <div ref={ref} style={dropdownStyle}>
      <div style={{ padding: "8px 8px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar formatador..."
          style={dropdownSearchStyle}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
          }}
        />
      </div>

      <div style={{ maxHeight: 260, overflow: "auto", padding: "0 4px 4px" }}>
        {FORMATTER_CATEGORIES.filter(cat => grouped[cat.id]?.length).map(cat => (
          <div key={cat.id}>
            <div style={catLabelStyle}>
              <span>{cat.label}</span>
            </div>
            {grouped[cat.id]!.map(f => (
              <button
                key={f.name}
                onClick={() => onSelect(f.args ? `${f.name}:` : f.name)}
                style={varItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: MONO, color: C.accent, fontWeight: 600 }}>
                    | {f.name}{f.args ? `:${f.args}` : ""}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{f.description}</div>
                </div>
                <span style={{ fontSize: 9, color: C.textDim + "80", fontFamily: MONO, flexShrink: 0 }}>
                  {f.example}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ============================================================================
// Styles
// ============================================================================

const inputStyle: CSSProperties = {
  width: "100%", padding: "5px 8px",
  borderRadius: 4, border: `1px solid ${C.border}`,
  background: C.surface2, color: C.text,
  fontSize: 12, fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const btnStyle: CSSProperties = {
  padding: "0 6px",
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.textDim,
  cursor: "pointer",
  fontFamily: MONO,
  fontWeight: 700,
  fontSize: 11,
  transition: "all 0.12s",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
};

const previewStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "3px 6px", marginTop: 3,
  borderRadius: 3, background: C.surface2,
  border: `1px solid ${C.success}20`,
};

const dropdownStyle: CSSProperties = {
  position: "absolute" as const,
  top: "100%", left: 0, right: 0,
  marginTop: 4,
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  boxShadow: "0 8px 32px #0008",
  zIndex: 100,
  fontFamily: "'Inter', sans-serif",
};

const dropdownSearchStyle: CSSProperties = {
  width: "100%", padding: "6px 8px",
  borderRadius: 5, border: `1px solid ${C.border}`,
  background: C.surface2, color: C.text,
  fontSize: 12, outline: "none",
  fontFamily: "'Inter', sans-serif",
};

const catLabelStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  padding: "6px 8px 2px",
  fontSize: 10, fontWeight: 600,
  color: C.textDim,
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
};

const varItemStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "5px 8px",
  borderRadius: 4,
  background: "transparent",
  border: "none", cursor: "pointer",
  textAlign: "left" as const,
  fontFamily: "'Inter', sans-serif",
  transition: "background 0.1s",
};
