// ============================================================================
// VariableEditor — CRUD for user-defined variables, read-only for externals
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from "react";
import {
  type VariableInfo, type VariableCategory, type MergedVariables,
  type VariablesSection, groupByCategory, typeIcon, formatMock, defaultMockValue,
} from "./variableSchema";
import { C, MONO } from "./styles";

// ============================================================================
// Props
// ============================================================================

interface VariableEditorProps {
  merged: MergedVariables;
  /** User-owned section (what gets saved to contract) */
  userVariables: VariablesSection;
  onUserVariablesChange: (v: VariablesSection) => void;
}

// ============================================================================
// Component
// ============================================================================

export function VariableEditor({ merged, userVariables, onUserVariablesChange }: VariableEditorProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  const grouped = groupByCategory(
    search.trim()
      ? merged.items.filter(v =>
          v.path.toLowerCase().includes(search.toLowerCase()) ||
          v.label.toLowerCase().includes(search.toLowerCase()) ||
          (v.description || "").toLowerCase().includes(search.toLowerCase())
        )
      : merged.items
  );

  const handleAddVariable = useCallback((variable: VariableInfo) => {
    onUserVariablesChange({
      ...userVariables,
      items: [...userVariables.items, variable],
    });
    setAdding(false);
  }, [userVariables, onUserVariablesChange]);

  const handleUpdateVariable = useCallback((path: string, updates: Partial<VariableInfo>) => {
    onUserVariablesChange({
      ...userVariables,
      items: userVariables.items.map(v =>
        v.path === path ? { ...v, ...updates } : v
      ),
    });
  }, [userVariables, onUserVariablesChange]);

  const handleRemoveVariable = useCallback((path: string) => {
    onUserVariablesChange({
      ...userVariables,
      items: userVariables.items.filter(v => v.path !== path),
    });
    if (editingPath === path) setEditingPath(null);
  }, [userVariables, onUserVariablesChange, editingPath]);

  const handleAddCategory = useCallback((cat: VariableCategory) => {
    onUserVariablesChange({
      ...userVariables,
      categories: [...userVariables.categories, cat],
    });
    setAddingCategory(false);
  }, [userVariables, onUserVariablesChange]);

  const handleRemoveCategory = useCallback((catId: string) => {
    onUserVariablesChange({
      ...userVariables,
      categories: userVariables.categories.filter(c => c.id !== catId),
    });
  }, [userVariables, onUserVariablesChange]);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Variáveis</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{merged.items.length}</span>
      </div>

      {/* Search */}
      <div style={{ padding: "0 10px 8px" }}>
        <input
          type="search"
          placeholder="Buscar variável..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* Action bar */}
      <div style={{ padding: "0 10px 8px", display: "flex", gap: 4 }}>
        <button onClick={() => setAdding(true)} style={actionBtnStyle}>
          + Variável
        </button>
        <button onClick={() => setAddingCategory(true)} style={actionBtnStyle}>
          + Categoria
        </button>
      </div>

      {/* Add forms */}
      {adding && (
        <AddVariableForm
          categories={merged.categories}
          onAdd={handleAddVariable}
          onCancel={() => setAdding(false)}
          existingPaths={new Set(merged.items.map(v => v.path))}
        />
      )}
      {addingCategory && (
        <AddCategoryForm
          onAdd={handleAddCategory}
          onCancel={() => setAddingCategory(false)}
          existingIds={new Set(merged.categories.map(c => c.id))}
        />
      )}

      {/* Variable list by category */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 12px" }}>
        {merged.categories
          .filter(cat => grouped[cat.id]?.length)
          .map(cat => (
            <div key={cat.id} style={{ marginBottom: 4 }}>
              {/* Category header */}
              <div style={catHeaderStyle}>
                <span>{cat.icon || "📦"}</span>
                <span style={{ flex: 1 }}>{cat.label}</span>
                {cat.source === "external" && (
                  <span style={extBadge}>externo</span>
                )}
                {cat.source === "user" && (
                  <button
                    onClick={() => {
                      if (confirm(`Excluir categoria "${cat.label}"?`)) handleRemoveCategory(cat.id);
                    }}
                    style={tinyBtn}
                    title="Excluir categoria"
                  >✕</button>
                )}
                <span style={{ fontSize: 10, color: C.textDim + "80" }}>{grouped[cat.id]!.length}</span>
              </div>

              {/* Variables in this category */}
              {grouped[cat.id]!.map(v => (
                <div key={v.path}>
                  {editingPath === v.path && v.source === "user" ? (
                    <EditVariableRow
                      variable={v}
                      categories={merged.categories}
                      onSave={(updates) => { handleUpdateVariable(v.path, updates); setEditingPath(null); }}
                      onCancel={() => setEditingPath(null)}
                    />
                  ) : (
                    <VariableRow
                      variable={v}
                      onEdit={() => setEditingPath(v.path)}
                      onRemove={() => {
                        if (confirm(`Excluir variável "${v.path}"?`)) handleRemoveVariable(v.path);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

        {merged.items.length === 0 && (
          <div style={emptyStyle}>
            <span style={{ fontSize: 20, opacity: 0.2 }}>📦</span>
            <span>Nenhuma variável definida</span>
            <span style={{ fontSize: 11, color: C.textDim, textAlign: "center", lineHeight: 1.5 }}>
              Clique em "+ Variável" para criar variáveis que podem ser usadas como {"{{path}}"} nos campos de texto
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Variable row (display mode)
// ============================================================================

function VariableRow({
  variable: v,
  onEdit,
  onRemove,
}: {
  variable: VariableInfo;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isExternal = v.source === "external";

  return (
    <div
      style={varRowStyle}
      onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Type icon */}
      <span style={{ fontSize: 9, fontFamily: MONO, color: C.textDim, width: 18, textAlign: "center", flexShrink: 0 }}>
        {typeIcon(v.type)}
      </span>

      {/* Path + label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: MONO, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {v.path}
        </div>
        <div style={{ fontSize: 10, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {v.label}
        </div>
      </div>

      {/* Mock value */}
      <span style={{ fontSize: 9, color: C.textDim + "80", fontFamily: MONO, flexShrink: 0, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        {formatMock(v.mockValue)}
      </span>

      {/* Source badge */}
      {isExternal && <span style={extBadge}>ext</span>}

      {/* Actions */}
      {!isExternal && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={onEdit} style={tinyBtn} title="Editar">✎</button>
          <button onClick={onRemove} style={{ ...tinyBtn, color: C.danger }} title="Excluir">✕</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Add variable form
// ============================================================================

function AddVariableForm({
  categories, onAdd, onCancel, existingPaths,
}: {
  categories: VariableCategory[];
  onAdd: (v: VariableInfo) => void;
  onCancel: () => void;
  existingPaths: Set<string>;
}) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<VariableInfo["type"]>("string");
  const [category, setCategory] = useState(categories[0]?.id || "custom");
  const [mockValue, setMockValue] = useState("");
  const [description, setDescription] = useState("");

  const pathError = path.trim() && existingPaths.has(path.trim()) ? "Path já existe" : null;
  const canSubmit = path.trim() && label.trim() && !pathError;

  const handleSubmit = () => {
    if (!canSubmit) return;
    let mock: any = mockValue || defaultMockValue(type);
    // Try to parse as correct type
    if (type === "number") mock = Number(mockValue) || defaultMockValue("number");
    if (type === "boolean") mock = mockValue === "true" || mockValue === "1";
    if (type === "array") { try { mock = JSON.parse(mockValue); } catch { mock = []; } }
    if (type === "object") { try { mock = JSON.parse(mockValue); } catch { mock = {}; } }

    onAdd({
      path: path.trim(),
      label: label.trim(),
      type,
      category,
      description: description.trim() || undefined,
      mockValue: mock,
    });
  };

  return (
    <div style={formStyle}>
      <div style={formTitle}>Nova Variável</div>

      <Field label="Path *" error={pathError}>
        <input value={path} onChange={e => setPath(e.target.value)} placeholder="entity.field" style={inputStyle} autoFocus />
      </Field>

      <Field label="Nome *">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome legível" style={inputStyle} />
      </Field>

      <div style={{ display: "flex", gap: 6 }}>
        <Field label="Tipo" style={{ flex: 1 }}>
          <select value={type} onChange={e => setType(e.target.value as any)} style={selectStyle}>
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="array">Array</option>
            <option value="object">Object</option>
          </select>
        </Field>

        <Field label="Categoria" style={{ flex: 1 }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            <option value="custom">custom</option>
          </select>
        </Field>
      </div>

      <Field label="Mock Value">
        <input value={mockValue} onChange={e => setMockValue(e.target.value)} placeholder={String(defaultMockValue(type))} style={inputStyle} />
      </Field>

      <Field label="Descrição">
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" style={inputStyle} />
      </Field>

      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          ...submitBtn, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed",
        }}>Adicionar</button>
        <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
      </div>
    </div>
  );
}

// ============================================================================
// Edit variable form (inline)
// ============================================================================

function EditVariableRow({
  variable, categories, onSave, onCancel,
}: {
  variable: VariableInfo;
  categories: VariableCategory[];
  onSave: (updates: Partial<VariableInfo>) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(variable.label);
  const [type, setType] = useState(variable.type);
  const [category, setCategory] = useState(variable.category);
  const [mockValue, setMockValue] = useState(String(variable.mockValue ?? ""));
  const [description, setDescription] = useState(variable.description || "");

  const handleSave = () => {
    let mock: any = mockValue || defaultMockValue(type);
    if (type === "number") mock = Number(mockValue) || defaultMockValue("number");
    if (type === "boolean") mock = mockValue === "true" || mockValue === "1";
    if (type === "array") { try { mock = JSON.parse(mockValue); } catch { mock = []; } }
    if (type === "object") { try { mock = JSON.parse(mockValue); } catch { mock = {}; } }

    onSave({ label: label.trim(), type, category, mockValue: mock, description: description.trim() || undefined });
  };

  return (
    <div style={{ ...formStyle, margin: "0 0 4px", padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontFamily: MONO, color: C.accent, marginBottom: 4 }}>{variable.path}</div>

      <Field label="Nome">
        <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} autoFocus />
      </Field>

      <div style={{ display: "flex", gap: 6 }}>
        <Field label="Tipo" style={{ flex: 1 }}>
          <select value={type} onChange={e => setType(e.target.value as any)} style={selectStyle}>
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="array">Array</option>
            <option value="object">Object</option>
          </select>
        </Field>
        <Field label="Categoria" style={{ flex: 1 }}>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Mock">
        <input value={mockValue} onChange={e => setMockValue(e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Descrição">
        <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
      </Field>

      <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
        <button onClick={handleSave} style={submitBtn}>Salvar</button>
        <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
      </div>
    </div>
  );
}

// ============================================================================
// Add category form
// ============================================================================

function AddCategoryForm({
  onAdd, onCancel, existingIds,
}: {
  onAdd: (c: VariableCategory) => void;
  onCancel: () => void;
  existingIds: Set<string>;
}) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("📦");

  const idError = id.trim() && existingIds.has(id.trim()) ? "ID já existe" : null;
  const canSubmit = id.trim() && label.trim() && !idError;

  return (
    <div style={formStyle}>
      <div style={formTitle}>Nova Categoria</div>

      <div style={{ display: "flex", gap: 6 }}>
        <Field label="ID *" error={idError} style={{ flex: 1 }}>
          <input value={id} onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="minha_cat" style={inputStyle} autoFocus />
        </Field>
        <Field label="Ícone" style={{ width: 50 }}>
          <input value={icon} onChange={e => setIcon(e.target.value)} style={inputStyle} maxLength={2} />
        </Field>
      </div>

      <Field label="Nome *">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Minha Categoria" style={inputStyle} />
      </Field>

      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <button onClick={() => canSubmit && onAdd({ id: id.trim(), label: label.trim(), icon })} disabled={!canSubmit} style={{
          ...submitBtn, opacity: canSubmit ? 1 : 0.4,
        }}>Adicionar</button>
        <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
      </div>
    </div>
  );
}

// ============================================================================
// Tiny Field wrapper
// ============================================================================

function Field({ label, error, children, style }: { label: string; error?: string | null; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ marginBottom: 4, ...style }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: error ? C.danger : C.textDim, marginBottom: 2 }}>
        {label} {error && <span style={{ fontWeight: 400 }}>— {error}</span>}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: CSSProperties = {
  width: "100%", height: "100%",
  display: "flex", flexDirection: "column",
  background: C.surface,
  fontFamily: "'Inter', -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  padding: "12px 12px 8px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const searchStyle: CSSProperties = {
  width: "100%",
  background: C.surface2, border: `1px solid ${C.border}`,
  borderRadius: 5, padding: "6px 8px", fontSize: 12,
  color: C.text, outline: "none",
  fontFamily: "'Inter', sans-serif",
};

const emptyStyle: CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: 8,
  color: C.textDim, padding: 24,
};

const catHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "6px 6px 2px",
  fontSize: 10, fontWeight: 600,
  color: C.textMuted, textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
};

const varRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "4px 8px",
  borderRadius: 4,
  transition: "background 0.1s",
  cursor: "default",
};

const extBadge: CSSProperties = {
  fontSize: 8, padding: "1px 4px", borderRadius: 3,
  background: C.surface3, color: C.textDim,
  fontWeight: 600, textTransform: "uppercase" as const,
  flexShrink: 0,
};

const tinyBtn: CSSProperties = {
  width: 18, height: 18, borderRadius: 3, border: "none",
  background: "transparent", color: C.textDim, cursor: "pointer",
  fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0,
};

const formStyle: CSSProperties = {
  margin: "0 8px 8px", padding: "10px 12px",
  background: C.surface2, borderRadius: 8,
  border: `1px solid ${C.border}`,
};

const formTitle: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8,
  textTransform: "uppercase" as const, letterSpacing: "0.3px",
};

const actionBtnStyle: CSSProperties = {
  flex: 1, padding: "4px 8px", borderRadius: 4,
  fontSize: 10, fontWeight: 600,
  border: `1px dashed ${C.border}`,
  background: "transparent", color: C.textDim,
  cursor: "pointer", fontFamily: "'Inter', sans-serif",
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "4px 6px",
  borderRadius: 3, border: `1px solid ${C.border}`,
  background: C.surface, color: C.text,
  fontSize: 11, fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const selectStyle: CSSProperties = { ...inputStyle, cursor: "pointer" };

const submitBtn: CSSProperties = {
  flex: 1, padding: "4px 8px", borderRadius: 4,
  fontSize: 10, fontWeight: 600,
  background: C.accent, color: "#fff",
  border: "none", cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};

const cancelBtn: CSSProperties = {
  padding: "4px 8px", borderRadius: 4,
  fontSize: 10, fontWeight: 600,
  background: "transparent", color: C.textDim,
  border: `1px solid ${C.border}`, cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};
