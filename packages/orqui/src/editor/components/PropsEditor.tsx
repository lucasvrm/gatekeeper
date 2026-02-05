// ============================================================================
// PropsEditor — Dynamic props editor for selected grid item
// ============================================================================

import React from "react";
import type { GridItem } from "@/runtime/types";
import type { ComponentMetadata } from "../types/ComponentMetadata";

interface PropsEditorProps {
  selectedItem: GridItem | null;
  componentMetadata: ComponentMetadata | null;
  onUpdateProps: (itemId: string, props: Record<string, any>) => void;
}

export function PropsEditor({ selectedItem, componentMetadata, onUpdateProps }: PropsEditorProps) {
  if (!selectedItem || !componentMetadata) {
    return (
      <div data-testid="props-editor" style={{ padding: "16px" }}>
        <div
          data-testid="props-editor-empty-state"
          style={{
            textAlign: "center",
            color: "#888",
            padding: "32px 16px",
          }}
        >
          Selecione um item para editar propriedades
        </div>
      </div>
    );
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    const newProps = { ...selectedItem.props, [fieldName]: value };
    onUpdateProps(selectedItem.component, newProps);
  };

  return (
    <div data-testid="props-editor" style={{ padding: "16px", maxHeight: "40%", overflowY: "auto" }}>
      <div data-testid="props-editor-form">
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px" }}>
          {componentMetadata.componentType}
        </h3>

        {componentMetadata.propFields.map((field) => {
          const currentValue = selectedItem.props?.[field.name] ?? field.defaultValue;
          const isTemplate = typeof currentValue === "string" && currentValue.startsWith("$");

          return (
            <div
              key={field.name}
              data-testid={`prop-field-${field.name}`}
              style={{ marginBottom: "16px" }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  marginBottom: "4px",
                  color: "#ccc",
                }}
              >
                {field.label}
              </label>

              {isTemplate && (
                <span
                  data-testid="template-badge"
                  style={{
                    display: "inline-block",
                    background: "#3b82f6",
                    color: "#fff",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    marginBottom: "4px",
                  }}
                >
                  $
                </span>
              )}

              {field.type === "text" && (
                <input
                  data-testid="prop-input"
                  type="text"
                  value={currentValue || ""}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "4px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              )}

              {field.type === "number" && (
                <input
                  data-testid="prop-input"
                  type="number"
                  value={currentValue || 0}
                  onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "4px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              )}

              {field.type === "select" && field.options && (
                <select
                  value={currentValue || ""}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "4px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "boolean" && (
                <input
                  type="checkbox"
                  checked={currentValue || false}
                  onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                  style={{
                    width: "16px",
                    height: "16px",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
