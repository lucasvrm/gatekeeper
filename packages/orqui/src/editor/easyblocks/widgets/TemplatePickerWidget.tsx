// ============================================================================
// TemplatePickerWidget — Easyblocks sidebar widget for orqui-template type
//
// This widget wraps the existing TemplateField component from the Orqui
// page editor, providing {{}} autocomplete and variable picker inside
// the Easyblocks sidebar.
//
// Phase 1: Scaffold with basic string input
// Phase 2: Full integration with TemplateField, variable picker, formatter picker
//
// Registration in Easyblocks:
//   Config.types["orqui-template"].widget.id = "orqui-template-picker"
//   → Easyblocks renders this widget when a prop of type "orqui-template" is selected
// ============================================================================

import React, { useState, useCallback } from "react";

// ============================================================================
// Widget Props — provided by Easyblocks
// ============================================================================

interface WidgetProps {
  /** Current value of the prop */
  value: string;
  /** Callback to update the value */
  onChange: (value: string) => void;
  /** Schema definition for this prop */
  schema: {
    prop: string;
    label?: string;
    defaultValue?: unknown;
  };
}

// ============================================================================
// Widget Component
// ============================================================================

/**
 * Phase 1: Simple text input with {{ }} hint.
 * Phase 2: Will wrap TemplateField with full variable autocomplete.
 */
export function TemplatePickerWidget({ value, onChange, schema }: WidgetProps) {
  const [focused, setFocused] = useState(false);
  const hasTemplate = typeof value === "string" && value.includes("{{");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        border: `1px solid ${focused ? "#6d9cff" : "#2a2a33"}`,
        borderRadius: 6, background: "#1c1c21",
        transition: "border-color 0.15s",
      }}>
        <input
          type="text"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={schema.label || "Texto ou {{variável}}"}
          style={{
            flex: 1, padding: "6px 10px", border: "none", outline: "none",
            background: "transparent", color: "#e4e4e7", fontSize: 13,
            fontFamily: hasTemplate
              ? "'JetBrains Mono', monospace"
              : "'Inter', sans-serif",
          }}
        />
        {/* Template indicator */}
        {hasTemplate && (
          <span style={{
            padding: "2px 6px", marginRight: 6, borderRadius: 3,
            background: "#6d9cff15", color: "#6d9cff",
            fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {"{{ }}"}
          </span>
        )}
      </div>

      {/* Help text */}
      <div style={{ fontSize: 10, color: "#5b5b66", lineHeight: 1.4 }}>
        Use <code style={{ color: "#6d9cff", fontSize: 10 }}>{"{{variável}}"}</code> para dados dinâmicos.
        Pipes: <code style={{ color: "#6d9cff", fontSize: 10 }}>{"{{x | uppercase}}"}</code>
      </div>
    </div>
  );
}

// ============================================================================
// Widget registration map — for Easyblocks
// ============================================================================

/**
 * Map of widget IDs to widget components.
 * Pass this to EasyblocksEditor's `widgets` prop.
 */
export const ORQUI_WIDGETS: Record<string, React.ComponentType<any>> = {
  "orqui-template-picker": TemplatePickerWidget,
  // Phase 2: "orqui-entity-picker": EntityPickerWidget,
};
