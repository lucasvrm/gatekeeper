import React, { useState, useMemo, useCallback } from "react";
import { COLORS, s, GOOGLE_FONTS } from "../lib/constants";
import { resolveTextStyleCSS } from "../lib/utils";
import { Field, TabBar } from "../components/shared";
import { loadGoogleFont, useGoogleFont } from "../hooks/useGoogleFont";
import { usePersistentTab } from "../hooks/usePersistentState";

// ============================================================================
// Font Family Editor
// ============================================================================
export function FontFamilyEditor({ families, onChange }) {
  const [newKey, setNewKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...families, [newKey.trim()]: { family: "Inter", fallbacks: ["sans-serif"] } });
    setNewKey("");
  };
  const update = (key, field, val) => {
    if (field === "family") loadGoogleFont(val);
    onChange({ ...families, [key]: { ...families[key], [field]: val } });
  };
  const remove = (key) => {
    const u = { ...families }; delete u[key]; onChange(u);
  };

  // Load all currently selected fonts
  Object.values(families || {}).forEach((tok: any) => {
    if (tok.family) loadGoogleFont(tok.family);
  });

  const filteredFonts = searchQuery
    ? GOOGLE_FONTS.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
    : GOOGLE_FONTS;

  return (
    <div>
      {Object.entries(families || {}).map(([key, tok]) => (
        <div key={key} style={{ padding: 10, marginBottom: 8, background: COLORS.surface2, borderRadius: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80, fontWeight: 600 }}>{key}</span>
            <button onClick={() => remove(key)} style={{ ...s.btnDanger, marginLeft: "auto" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <Field label="Google Font" style={{ flex: 1 }}>
              <div style={{ position: "relative" }}>
                <select
                  value={tok.family}
                  onChange={(e) => update(key, "family", e.target.value)}
                  style={{ ...s.select, fontFamily: `'${tok.family}', sans-serif` }}
                >
                  {!GOOGLE_FONTS.includes(tok.family) && <option value={tok.family}>{tok.family} (custom)</option>}
                  {GOOGLE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
                </select>
              </div>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: COLORS.textDim, minWidth: 60 }}>fallbacks:</span>
            <input value={(tok.fallbacks || []).join(", ")} onChange={(e) => update(key, "fallbacks", e.target.value.split(",").map(f => f.trim()).filter(Boolean))} style={{ ...s.input, fontSize: 11 }} placeholder="sans-serif, Arial" />
          </div>
          {/* Live preview */}
          <div style={{ background: COLORS.surface, borderRadius: 4, padding: 8, fontFamily: `'${tok.family}', ${(tok.fallbacks || []).join(", ")}`, color: COLORS.text, fontSize: 14 }}>
            The quick brown fox jumps over the lazy dog — 0123456789
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome (ex: primary)" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btnSmall}>+ Family</button>
      </div>
    </div>
  );
}


export function FontSizeEditor({ sizes, onChange }) {
  const [newKey, setNewKey] = useState("");
  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...sizes, [newKey.trim()]: { value: 14, unit: "px" } });
    setNewKey("");
  };
  const update = (key, field, val) => {
    onChange({ ...sizes, [key]: { ...sizes[key], [field]: field === "value" ? Number(val) : val } });
  };
  const remove = (key) => {
    const u = { ...sizes }; delete u[key]; onChange(u);
  };

  return (
    <div>
      {Object.entries(sizes || {}).sort((a, b) => a[1].value - b[1].value).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 50 }}>{key}</span>
          <input type="number" value={tok.value} onChange={(e) => update(key, "value", e.target.value)} style={{ ...s.input, width: 70 }} />
          <select value={tok.unit} onChange={(e) => update(key, "unit", e.target.value)} style={{ ...s.select, width: 70 }}>
            {["px", "rem", "em"].map(u => <option key={u}>{u}</option>)}
          </select>
          <span style={{ fontSize: tok.value, fontFamily: "'Inter', sans-serif", color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", maxWidth: 120 }}>Aa</span>
          <button onClick={() => remove(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome (ex: 2xl)" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btnSmall}>+ Size</button>
      </div>
    </div>
  );
}


export function FontWeightEditor({ weights, onChange }) {
  const [newKey, setNewKey] = useState("");
  const WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...weights, [newKey.trim()]: { value: 400 } });
    setNewKey("");
  };
  const update = (key, val) => {
    onChange({ ...weights, [key]: { value: Number(val) } });
  };
  const remove = (key) => {
    const u = { ...weights }; delete u[key]; onChange(u);
  };

  return (
    <div>
      {Object.entries(weights || {}).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80 }}>{key}</span>
          <select value={tok.value} onChange={(e) => update(key, e.target.value)} style={{ ...s.select, width: 80 }}>
            {WEIGHT_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <span style={{ fontWeight: tok.value, fontSize: 14, color: COLORS.text }}>Sample text</span>
          <button onClick={() => remove(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome (ex: semibold)" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btnSmall}>+ Weight</button>
      </div>
    </div>
  );
}


export function LineHeightEditor({ lineHeights, onChange }) {
  const [newKey, setNewKey] = useState("");
  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...lineHeights, [newKey.trim()]: { value: 1.5 } });
    setNewKey("");
  };
  const update = (key, val) => {
    onChange({ ...lineHeights, [key]: { value: Number(val) } });
  };
  const remove = (key) => {
    const u = { ...lineHeights }; delete u[key]; onChange(u);
  };

  return (
    <div>
      {Object.entries(lineHeights || {}).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80 }}>{key}</span>
          <input type="number" step="0.1" value={tok.value} onChange={(e) => update(key, e.target.value)} style={{ ...s.input, width: 70 }} />
          <span style={{ fontSize: 12, lineHeight: tok.value, color: COLORS.textMuted, maxWidth: 180 }}>Line height {tok.value}× preview text sample</span>
          <button onClick={() => remove(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btnSmall}>+ Line Height</button>
      </div>
    </div>
  );
}


export function LetterSpacingEditor({ spacings, onChange }) {
  const [newKey, setNewKey] = useState("");
  const add = () => {
    if (!newKey.trim()) return;
    onChange({ ...spacings, [newKey.trim()]: { value: 0, unit: "em" } });
    setNewKey("");
  };
  const update = (key, field, val) => {
    onChange({ ...spacings, [key]: { ...spacings[key], [field]: field === "value" ? Number(val) : val } });
  };
  const remove = (key) => {
    const u = { ...spacings }; delete u[key]; onChange(u);
  };

  return (
    <div>
      {Object.entries(spacings || {}).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80 }}>{key}</span>
          <input type="number" step="0.01" value={tok.value} onChange={(e) => update(key, "value", e.target.value)} style={{ ...s.input, width: 80 }} />
          <select value={tok.unit} onChange={(e) => update(key, "unit", e.target.value)} style={{ ...s.select, width: 60 }}>
            {["em", "px", "rem"].map(u => <option key={u}>{u}</option>)}
          </select>
          <span style={{ letterSpacing: `${tok.value}${tok.unit}`, fontSize: 13, color: COLORS.text }}>SPACING</span>
          <button onClick={() => remove(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btnSmall}>+ Spacing</button>
      </div>
    </div>
  );
}


// ============================================================================
// Typography Reference Selector
// ============================================================================
export function TypoRefSelect({ value, tokens, category, onChange }) {
  const options = useMemo(() => {
    return Object.keys(tokens[category] || {}).map(key => `$tokens.${category}.${key}`);
  }, [tokens, category]);

  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || undefined)} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
      <option value="">—</option>
      {options.map(ref => (
        <option key={ref} value={ref}>{ref.replace(`$tokens.${category}.`, "")}</option>
      ))}
    </select>
  );
}


// ============================================================================
// Text Style Editor
// ============================================================================
export function TextStyleEditor({ textStyles, tokens, onChange }) {
  const [newKey, setNewKey] = useState("");

  const add = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, "-");
    const firstFamily = Object.keys(tokens.fontFamilies || {})[0];
    const firstSize = Object.keys(tokens.fontSizes || {})[0];
    const firstWeight = Object.keys(tokens.fontWeights || {})[0];
    const firstLH = Object.keys(tokens.lineHeights || {})[0];
    onChange({
      ...textStyles,
      [key]: {
        description: "",
        fontFamily: firstFamily ? `$tokens.fontFamilies.${firstFamily}` : "",
        fontSize: firstSize ? `$tokens.fontSizes.${firstSize}` : "",
        fontWeight: firstWeight ? `$tokens.fontWeights.${firstWeight}` : "",
        lineHeight: firstLH ? `$tokens.lineHeights.${firstLH}` : "",
      },
    });
    setNewKey("");
  };

  const update = (key, field, val) => {
    onChange({ ...textStyles, [key]: { ...textStyles[key], [field]: val } });
  };

  const remove = (key) => {
    const u = { ...textStyles }; delete u[key]; onChange(u);
  };

  return (
    <div>
      {Object.entries(textStyles || {}).map(([key, style]) => {
        const css = resolveTextStyleCSS(style, tokens);
        return (
          <div key={key} style={{ ...s.card, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</div>
                <input value={style.description || ""} onChange={(e) => update(key, "description", e.target.value)} placeholder="descrição" style={{ ...s.input, fontSize: 11, marginTop: 4, width: 250 }} />
              </div>
              <button onClick={() => remove(key)} style={s.btnDanger}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <Field label="Font Family" style={{ marginBottom: 0 }}>
                <TypoRefSelect value={style.fontFamily} tokens={tokens} category="fontFamilies" onChange={(v) => update(key, "fontFamily", v)} />
              </Field>
              <Field label="Font Size" style={{ marginBottom: 0 }}>
                <TypoRefSelect value={style.fontSize} tokens={tokens} category="fontSizes" onChange={(v) => update(key, "fontSize", v)} />
              </Field>
              <Field label="Font Weight" style={{ marginBottom: 0 }}>
                <TypoRefSelect value={style.fontWeight} tokens={tokens} category="fontWeights" onChange={(v) => update(key, "fontWeight", v)} />
              </Field>
              <Field label="Line Height" style={{ marginBottom: 0 }}>
                <TypoRefSelect value={style.lineHeight} tokens={tokens} category="lineHeights" onChange={(v) => update(key, "lineHeight", v)} />
              </Field>
              <Field label="Letter Spacing" style={{ marginBottom: 0 }}>
                <TypoRefSelect value={style.letterSpacing} tokens={tokens} category="letterSpacings" onChange={(v) => update(key, "letterSpacing", v)} />
              </Field>
            </div>

            {/* Live preview */}
            <div style={{ background: COLORS.surface2, borderRadius: 6, padding: 12, ...css, color: COLORS.text }}>
              The quick brown fox jumps over the lazy dog. 0123456789
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do text style (ex: heading-1)" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={s.btn}>+ Text Style</button>
      </div>
    </div>
  );
}


// ============================================================================
// Text Style Add Button
// ============================================================================
export function TextStyleAddButton({ textStyles, tokens, onChange }) {
  const [newKey, setNewKey] = useState("");
  const add = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, "-");
    const firstFamily = Object.keys(tokens.fontFamilies || {})[0];
    const firstSize = Object.keys(tokens.fontSizes || {})[0];
    const firstWeight = Object.keys(tokens.fontWeights || {})[0];
    const firstLH = Object.keys(tokens.lineHeights || {})[0];
    onChange({
      ...textStyles,
      [key]: {
        description: "",
        fontFamily: firstFamily ? `$tokens.fontFamilies.${firstFamily}` : "",
        fontSize: firstSize ? `$tokens.fontSizes.${firstSize}` : "",
        fontWeight: firstWeight ? `$tokens.fontWeights.${firstWeight}` : "",
        lineHeight: firstLH ? `$tokens.lineHeights.${firstLH}` : "",
      },
    });
    setNewKey("");
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do text style (ex: heading-1)" style={s.input} onKeyDown={(e) => e.key === "Enter" && add()} />
      <button onClick={add} style={s.btn}>+ Text Style</button>
    </div>
  );
}
