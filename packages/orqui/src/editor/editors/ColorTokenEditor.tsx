import React, { useState, useMemo } from "react";
import { COLORS, s } from "../lib/constants";
import { TabBar } from "../components/shared";
import { usePersistentTab } from "../hooks/usePersistentState";

export const COLOR_PRESETS = {
  "Orqui Dark": {
    "bg": { value: "#0a0a0b" },
    "surface": { value: "#141417" },
    "surface-2": { value: "#1c1c21" },
    "surface-3": { value: "#24242b" },
    "border": { value: "#2a2a33" },
    "border-2": { value: "#3a3a45" },
    "text": { value: "#e4e4e7" },
    "text-muted": { value: "#8b8b96" },
    "text-dim": { value: "#5b5b66" },
    "accent": { value: "#6d9cff" },
    "accent-dim": { value: "#4a7adf" },
    "accent-fg": { value: "#ffffff" },
    "danger": { value: "#ff6b6b" },
    "danger-dim": { value: "#cc5555" },
    "success": { value: "#4ade80" },
    "success-dim": { value: "#22c55e" },
    "warning": { value: "#fbbf24" },
    "warning-dim": { value: "#d4a017" },
    "sidebar-bg": { value: "#111114" },
    "header-bg": { value: "#0a0a0b" },
    "input-bg": { value: "#1c1c21" },
    "input-border": { value: "#2a2a33" },
    "card-bg": { value: "#141417" },
    "card-border": { value: "#2a2a33" },
    "ring": { value: "#6d9cff44" },
  },
};

export const COLOR_GROUPS = [
  { label: "Backgrounds", keys: ["bg", "surface", "surface-2", "surface-3", "sidebar-bg", "header-bg", "card-bg", "input-bg"] },
  { label: "Text", keys: ["text", "text-muted", "text-dim"] },
  { label: "Borders", keys: ["border", "border-2", "card-border", "input-border", "ring"] },
  { label: "Accent", keys: ["accent", "accent-dim", "accent-fg"] },
  { label: "Status", keys: ["danger", "danger-dim", "success", "success-dim", "warning", "warning-dim"] },
];

export function ColorTokenEditor({ colors, onChange }) {
  const [newKey, setNewKey] = useState("");
  const [activeGroup, setActiveGroup] = usePersistentTab("color-group", "Backgrounds");

  const updateColor = (key, value) => {
    onChange({ ...colors, [key]: { value } });
  };

  const removeColor = (key) => {
    const updated = { ...colors };
    delete updated[key];
    onChange(updated);
  };

  const addColor = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, "-").toLowerCase();
    onChange({ ...colors, [key]: { value: "#888888" } });
    setNewKey("");
  };

  const loadPreset = (name) => {
    onChange({ ...colors, ...COLOR_PRESETS[name] });
  };

  const grouped = COLOR_GROUPS.map((g) => ({
    ...g,
    entries: g.keys.filter((k) => colors[k]).map((k) => [k, colors[k]]),
  }));

  const allGroupedKeys = new Set(COLOR_GROUPS.flatMap((g) => g.keys));
  const ungrouped = Object.entries(colors).filter(([k]) => !allGroupedKeys.has(k));

  const renderColorRow = ([key, tok]) => (
    <div key={key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
      <input
        type="color"
        value={tok.value?.startsWith("#") && tok.value.length <= 7 ? tok.value : "#888888"}
        onChange={(e) => updateColor(key, e.target.value)}
        aria-label={`Color picker for ${key}`}
        style={{ width: 24, height: 22, border: "none", borderRadius: 3, cursor: "pointer", background: "transparent", padding: 0, flexShrink: 0 }}
      />
      <span style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 100, flexShrink: 0 }}>{key}</span>
      <input
        value={tok.value || ""}
        onChange={(e) => updateColor(key, e.target.value)}
        style={{ ...s.input, width: 100, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "3px 6px" }}
      />
      <div style={{ width: 36, height: 18, borderRadius: 3, border: `1px solid ${COLORS.border}`, background: tok.value || "#888", flexShrink: 0 }} />
      <button onClick={() => removeColor(key)} style={{ ...s.btnDanger, padding: "2px 6px", fontSize: 10 }}>✕</button>
    </div>
  );

  // Build tabs from groups that have entries + Other
  const availableTabs = [
    ...grouped.filter(g => g.entries.length > 0).map(g => ({ id: g.label, label: `${g.label} (${g.entries.length})` })),
    ...(ungrouped.length > 0 ? [{ id: "Other", label: `Other (${ungrouped.length})` }] : []),
  ];

  // If active group no longer exists, default to first
  const safeActive = availableTabs.find(t => t.id === activeGroup) ? activeGroup : (availableTabs[0]?.id || "Backgrounds");

  const activeEntries = safeActive === "Other"
    ? ungrouped
    : grouped.find(g => g.label === safeActive)?.entries || [];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: COLORS.textDim, margin: 0 }}>
            Altere aqui — todos os componentes atualizam automaticamente.
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.keys(COLOR_PRESETS).map((name) => (
              <button key={name} onClick={() => loadPreset(name)} style={s.btnSmall}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {availableTabs.length > 0 && (
        <TabBar tabs={availableTabs} active={safeActive} onChange={setActiveGroup} />
      )}

      {activeEntries.map(renderColorRow)}

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nova cor (ex: brand-primary)" style={{ ...s.input, fontSize: 11 }} onKeyDown={(e) => e.key === "Enter" && addColor()} />
        <button onClick={addColor} style={{ ...s.btn, whiteSpace: "nowrap" as any, flexShrink: 0, padding: "4px 10px", fontSize: 11 }}>+ Cor</button>
      </div>
    </div>
  );
}

// Token Editor (shared by Layout Editor)
// ============================================================================
const ALL_TOKEN_CATEGORIES = [
  { id: "spacing", label: "Spacing" },
  { id: "sizing", label: "Sizing" },
  { id: "borderRadius", label: "Radius" },
  { id: "borderWidth", label: "Border W" },
];

export function TokenEditor({ tokens, onChange, categories }: { tokens: any; onChange: (t: any) => void; categories?: string[] }) {
  const [newKey, setNewKey] = useState("");
  const visibleCats = categories
    ? ALL_TOKEN_CATEGORIES.filter(c => categories.includes(c.id))
    : ALL_TOKEN_CATEGORIES;
  const defaultCat = visibleCats[0]?.id || "spacing";
  const [activeCat, setActiveCat] = usePersistentTab("token-editor", defaultCat);
  const safeCat = visibleCats.some(c => c.id === activeCat) ? activeCat : defaultCat;

  const addToken = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, "-");
    const updated = { ...tokens };
    updated[safeCat] = { ...updated[safeCat], [key]: { value: 0, unit: "px" } };
    onChange(updated);
    setNewKey("");
  };

  const updateToken = (cat, key, field, val) => {
    const updated = { ...tokens, [cat]: { ...tokens[cat], [key]: { ...tokens[cat][key], [field]: field === "value" ? Number(val) : val } } };
    onChange(updated);
  };

  const removeToken = (cat, key) => {
    const updated = { ...tokens, [cat]: { ...tokens[cat] } };
    delete updated[cat][key];
    onChange(updated);
  };

  return (
    <div>
      {visibleCats.length > 1 && (
        <TabBar
          tabs={visibleCats.map(c => ({ id: c.id, label: `${c.label} (${Object.keys(tokens[c.id] || {}).length})` }))}
          active={safeCat}
          onChange={setActiveCat}
        />
      )}

      {Object.entries(tokens[safeCat] || {}).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 100, flexShrink: 0 }}>{key}</span>
          <input type="number" value={tok.value} onChange={(e) => updateToken(safeCat, key, "value", e.target.value)} style={{ ...s.input, width: 70, padding: "3px 6px", fontSize: 11 }} />
          <select value={tok.unit} onChange={(e) => updateToken(safeCat, key, "unit", e.target.value)} style={{ ...s.select, width: 60, padding: "3px 6px", fontSize: 11 }}>
            {["px", "rem", "%", "vh", "vw"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => removeToken(safeCat, key)} style={{ ...s.btnDanger, padding: "2px 6px", fontSize: 10 }}>✕</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do token" style={{ ...s.input, fontSize: 11 }} onKeyDown={(e) => e.key === "Enter" && addToken()} />
        <button onClick={addToken} style={{ ...s.btn, whiteSpace: "nowrap" as any, flexShrink: 0, padding: "4px 10px", fontSize: 11 }}>+ Token</button>
      </div>
    </div>
  );
}

// ============================================================================
// Token Reference Selector
// ============================================================================
export function TokenRefSelect({ value, tokens, category, onChange }) {
  const options = useMemo(() => {
    const refs = [];
    const cats = category ? [category] : ["spacing", "sizing"];
    cats.forEach((cat) => {
      Object.keys(tokens[cat] || {}).forEach((key) => {
        refs.push(`$tokens.${cat}.${key}`);
      });
    });
    return refs;
  }, [tokens, category]);

  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || undefined)} style={s.select}>
      <option value="">— nenhum —</option>
      {options.map((ref) => (
        <option key={ref} value={ref}>{ref.replace("$tokens.", "")}</option>
      ))}
    </select>
  );
}

