import { useState, useCallback, useMemo, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================
type TokenValue = { value: number; unit: string };
type FontFamilyToken = { family: string; fallbacks: string[] };
type FontWeightToken = { value: number };
type UnitlessToken = { value: number };
type Container = { name: string; description: string; order: number };
type RegionBehavior = { fixed: boolean; collapsible: boolean; scrollable: boolean };
type Region = {
  enabled: boolean;
  position?: string;
  dimensions?: Record<string, string>;
  padding?: Record<string, string>;
  containers?: Container[];
  behavior?: RegionBehavior;
};
type Tokens = {
  spacing: Record<string, TokenValue>;
  sizing: Record<string, TokenValue>;
  fontFamilies: Record<string, FontFamilyToken>;
  fontSizes: Record<string, TokenValue>;
  fontWeights: Record<string, FontWeightToken>;
  lineHeights: Record<string, UnitlessToken>;
  letterSpacings: Record<string, TokenValue>;
  [key: string]: any;
};
type TextStyle = {
  description?: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
};
type LayoutContract = {
  structure: { regions: Record<string, Region> };
  tokens: Tokens;
  textStyles: Record<string, TextStyle>;
};
type ComponentProp = {
  type: string;
  required: boolean;
  description: string;
  default?: any;
  enumValues?: string[];
  items?: any;
  shape?: any;
};
type ComponentSlot = { description: string; required: boolean; acceptedComponents: string[] };
type ComponentDef = {
  name: string;
  category: string;
  description: string;
  source: string;
  props: Record<string, ComponentProp>;
  slots: Record<string, ComponentSlot>;
  variants: Array<{ name: string; props: Record<string, any> }>;
  examples: Array<{ name: string; props: Record<string, any>; slots?: Record<string, any> }>;
  tags: string[];
};
type UIRegistry = { components: Record<string, ComponentDef> };

// ============================================================================
// Hash computation (canonical SHA-256)
// ============================================================================
function sortKeysRecursively(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysRecursively);
  if (obj !== null && typeof obj === "object") {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysRecursively(obj[key]);
    }
    return sorted;
  }
  return obj;
}

async function computeHash(data: any) {
  const sorted = sortKeysRecursively(data);
  const canonical = JSON.stringify(sorted);
  const encoded = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Token resolution
// ============================================================================
function resolveToken(ref: string | undefined, tokens: Tokens) {
  if (!ref || !ref.startsWith("$tokens.")) return undefined;
  const parts = ref.replace("$tokens.", "").split(".");
  const cat = parts[0];
  const key = parts.slice(1).join(".");
  const tok = tokens?.[cat]?.[key];
  if (!tok) return undefined;
  return `${tok.value}${tok.unit}`;
}

function resolveTokenNum(ref: string | undefined, tokens: Tokens) {
  if (!ref || !ref.startsWith("$tokens.")) return 0;
  const parts = ref.replace("$tokens.", "").split(".");
  const cat = parts[0];
  const key = parts.slice(1).join(".");
  return tokens?.[cat]?.[key]?.value || 0;
}

// ============================================================================
// Default data
// ============================================================================
const DEFAULT_LAYOUT = {
  structure: {
    regions: {
      sidebar: {
        enabled: true,
        position: "left",
        dimensions: { width: "$tokens.sizing.sidebar-width", height: "$tokens.sizing.full-height" },
        padding: { top: "$tokens.spacing.md", right: "$tokens.spacing.sm", bottom: "$tokens.spacing.md", left: "$tokens.spacing.sm" },
        containers: [
          { name: "logo", description: "Logo ou título da aplicação", order: 0 },
          { name: "navLinks", description: "Links de navegação principal", order: 1 },
          { name: "sidebarFooter", description: "Conteúdo fixo no rodapé da sidebar", order: 2 },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: true },
      },
      header: {
        enabled: true,
        position: "top",
        dimensions: { height: "$tokens.sizing.header-height" },
        padding: { top: "$tokens.spacing.sm", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.sm", left: "$tokens.spacing.lg" },
        containers: [
          { name: "pageHeader", description: "Título da página atual e breadcrumbs", order: 0 },
          { name: "headerActions", description: "Ações contextuais do header", order: 1 },
        ],
        behavior: { fixed: true, collapsible: false, scrollable: false },
      },
      main: {
        enabled: true,
        position: "center",
        padding: { top: "$tokens.spacing.lg", right: "$tokens.spacing.lg", bottom: "$tokens.spacing.lg", left: "$tokens.spacing.lg" },
        containers: [{ name: "contentBody", description: "Área principal de conteúdo", order: 0 }],
        behavior: { fixed: false, collapsible: false, scrollable: true },
      },
      footer: { enabled: false },
    },
    breadcrumbs: {
      enabled: true,
      position: "header",
      alignment: "left",
      separator: "/",
      clickable: true,
    },
  },
  tokens: {
    spacing: {
      xs: { value: 4, unit: "px" },
      sm: { value: 8, unit: "px" },
      md: { value: 16, unit: "px" },
      lg: { value: 24, unit: "px" },
      xl: { value: 32, unit: "px" },
    },
    sizing: {
      "sidebar-width": { value: 240, unit: "px" },
      "header-height": { value: 56, unit: "px" },
      "full-height": { value: 100, unit: "vh" },
    },
    fontFamilies: {
      primary: { family: "Inter", fallbacks: ["-apple-system", "BlinkMacSystemFont", "sans-serif"] },
      mono: { family: "JetBrains Mono", fallbacks: ["SF Mono", "Fira Code", "monospace"] },
      display: { family: "Inter", fallbacks: ["-apple-system", "BlinkMacSystemFont", "sans-serif"] },
    },
    fontSizes: {
      xs: { value: 11, unit: "px" },
      sm: { value: 13, unit: "px" },
      md: { value: 14, unit: "px" },
      lg: { value: 16, unit: "px" },
      xl: { value: 18, unit: "px" },
      "2xl": { value: 22, unit: "px" },
      "3xl": { value: 28, unit: "px" },
      "4xl": { value: 36, unit: "px" },
    },
    fontWeights: {
      regular: { value: 400 },
      medium: { value: 500 },
      semibold: { value: 600 },
      bold: { value: 700 },
    },
    lineHeights: {
      tight: { value: 1.2 },
      normal: { value: 1.5 },
      relaxed: { value: 1.7 },
    },
    letterSpacings: {
      tight: { value: -0.02, unit: "em" },
      normal: { value: 0, unit: "em" },
      wide: { value: 0.05, unit: "em" },
    },
  },
  textStyles: {
    "heading-1": { description: "Título principal", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.3xl", fontWeight: "$tokens.fontWeights.bold", lineHeight: "$tokens.lineHeights.tight", letterSpacing: "$tokens.letterSpacings.tight" },
    "heading-2": { description: "Subtítulo de seção", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.2xl", fontWeight: "$tokens.fontWeights.semibold", lineHeight: "$tokens.lineHeights.tight", letterSpacing: "$tokens.letterSpacings.tight" },
    "heading-3": { description: "Título de card", fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.lg", fontWeight: "$tokens.fontWeights.semibold", lineHeight: "$tokens.lineHeights.tight" },
    body: { description: "Texto padrão", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.md", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.normal" },
    "body-sm": { description: "Texto secundário", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.sm", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.normal" },
    caption: { description: "Labels e metadados", fontFamily: "$tokens.fontFamilies.primary", fontSize: "$tokens.fontSizes.xs", fontWeight: "$tokens.fontWeights.medium", lineHeight: "$tokens.lineHeights.normal", letterSpacing: "$tokens.letterSpacings.wide" },
    code: { description: "Código e valores técnicos", fontFamily: "$tokens.fontFamilies.mono", fontSize: "$tokens.fontSizes.sm", fontWeight: "$tokens.fontWeights.regular", lineHeight: "$tokens.lineHeights.relaxed" },
  },
};

const DEFAULT_UI_REGISTRY = {
  components: {
    Button: {
      name: "Button",
      category: "primitive",
      description: "Botão de ação. Suporta variantes visuais e estados de loading.",
      source: "shadcn-ui",
      props: {
        variant: { type: "enum", required: false, description: "Variante visual", default: "default", enumValues: ["default", "destructive", "outline", "secondary", "ghost", "link"] },
        size: { type: "enum", required: false, description: "Tamanho do botão", default: "default", enumValues: ["default", "sm", "lg", "icon"] },
        disabled: { type: "boolean", required: false, description: "Desabilita o botão", default: false },
        loading: { type: "boolean", required: false, description: "Exibe spinner", default: false },
      },
      slots: { children: { description: "Conteúdo do botão", required: true, acceptedComponents: [] } },
      variants: [{ name: "primary", props: { variant: "default" } }, { name: "danger", props: { variant: "destructive" } }],
      examples: [{ name: "Botão padrão", props: { variant: "default" }, slots: { children: "Salvar" } }],
      tags: ["action", "form"],
    },
  },
};

// ============================================================================
// Shared UI Components
// ============================================================================
const COLORS = {
  bg: "#0a0a0b",
  surface: "#141417",
  surface2: "#1c1c21",
  surface3: "#24242b",
  border: "#2a2a33",
  border2: "#3a3a45",
  text: "#e4e4e7",
  textMuted: "#8b8b96",
  textDim: "#5b5b66",
  accent: "#6d9cff",
  accentDim: "#4a7adf",
  danger: "#ff6b6b",
  success: "#4ade80",
  warning: "#fbbf24",
};

const s = {
  input: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "'JetBrains Mono', 'SF Mono', monospace" },
  select: { background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none", width: "100%", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", cursor: "pointer" },
  btn: { background: COLORS.accent, border: "none", borderRadius: 6, padding: "7px 14px", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: "'Inter', sans-serif" },
  btnGhost: { background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 12px", color: COLORS.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  btnDanger: { background: "transparent", border: `1px solid ${COLORS.danger}33`, borderRadius: 6, padding: "5px 10px", color: COLORS.danger, fontSize: 12, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  btnSmall: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "4px 8px", color: COLORS.textMuted, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  label: { fontSize: 11, color: COLORS.textMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" },
  card: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 },
  tag: { background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 11, color: COLORS.textMuted, display: "inline-block" },
};

function Field({ label, children, style: st }) {
  return (
    <div style={{ marginBottom: 12, ...st }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

function Row({ children, gap = 8 }) {
  return <div style={{ display: "flex", gap, alignItems: "flex-end" }}>{children}</div>;
}

// localStorage helper for accordion persistence
function usePersistentState(key: string, defaultValue: any) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`orqui-accordion-${key}`);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v) => {
    setValue(v);
    try { localStorage.setItem(`orqui-accordion-${key}`, JSON.stringify(v)); } catch {}
  }, [key]);
  return [value, set] as const;
}

function usePersistentTab(key: string, defaultValue: string) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(`orqui-tab-${key}`);
      return stored || defaultValue;
    } catch { return defaultValue; }
  });
  const set = useCallback((v: string) => {
    setValue(v);
    try { localStorage.setItem(`orqui-tab-${key}`, v); } catch {}
  }, [key]);
  return [value, set] as const;
}

function Section({ title, children, actions, defaultOpen = false, id }: { title: any; children: any; actions?: any; defaultOpen?: boolean; id?: string }) {
  const storageKey = id || (typeof title === "string" ? title : "section");
  const [open, setOpen] = usePersistentState(storageKey, defaultOpen);
  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? 12 : 0, cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{open ? "▾" : "▸"} {title}</span>
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>{actions}</div>
      </div>
      {open && children}
    </div>
  );
}

// ============================================================================
// Google Fonts Loader
// ============================================================================
const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway",
  "Nunito", "Source Sans 3", "Ubuntu", "Rubik", "Work Sans", "Noto Sans",
  "Fira Sans", "DM Sans", "Manrope", "Space Grotesk", "Plus Jakarta Sans",
  "Outfit", "Geist", "Sora", "Lexend", "Onest", "Figtree",
  // Serif
  "Playfair Display", "Merriweather", "Lora", "Source Serif 4", "Noto Serif",
  "Crimson Text", "Libre Baskerville", "EB Garamond", "Bitter", "DM Serif Display",
  // Mono
  "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono", "Roboto Mono",
  "Ubuntu Mono", "Space Mono", "Inconsolata", "Cascadia Code", "Geist Mono",
];

const _loadedFonts = new Set<string>();
function loadGoogleFont(family: string) {
  if (!family || _loadedFonts.has(family)) return;
  _loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

// Load a font on demand when referenced
function useGoogleFont(family: string | undefined) {
  useEffect(() => {
    if (family) loadGoogleFont(family);
  }, [family]);
}

function EmptyState({ message, action }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
      <div style={{ marginBottom: 8 }}>{message}</div>
      {action}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, background: COLORS.surface, borderRadius: 8, padding: 3, marginBottom: 16 }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: active === t.id ? COLORS.surface3 : "transparent", color: active === t.id ? COLORS.text : COLORS.textMuted, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// ============================================================================
// Color Token Editor
// ============================================================================
const COLOR_PRESETS = {
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

const COLOR_GROUPS = [
  { label: "Backgrounds", keys: ["bg", "surface", "surface-2", "surface-3", "sidebar-bg", "header-bg", "card-bg", "input-bg"] },
  { label: "Text", keys: ["text", "text-muted", "text-dim"] },
  { label: "Borders", keys: ["border", "border-2", "card-border", "input-border", "ring"] },
  { label: "Accent", keys: ["accent", "accent-dim", "accent-fg"] },
  { label: "Status", keys: ["danger", "danger-dim", "success", "success-dim", "warning", "warning-dim"] },
];

function ColorTokenEditor({ colors, onChange }) {
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
    <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input
        type="color"
        value={tok.value?.startsWith("#") && tok.value.length <= 7 ? tok.value : "#888888"}
        onChange={(e) => updateColor(key, e.target.value)}
        style={{ width: 32, height: 28, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent", padding: 0 }}
      />
      <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 120 }}>{key}</span>
      <input
        value={tok.value || ""}
        onChange={(e) => updateColor(key, e.target.value)}
        style={{ ...s.input, width: 120, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}
      />
      <div style={{ width: 48, height: 24, borderRadius: 4, border: `1px solid ${COLORS.border}`, background: tok.value || "#888", flexShrink: 0 }} />
      <button onClick={() => removeColor(key)} style={s.btnDanger}>✕</button>
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
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Color Tokens</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0, marginBottom: 12 }}>
          Cores do sistema. Altere aqui → todos os componentes atualizam automaticamente.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Object.keys(COLOR_PRESETS).map((name) => (
            <button key={name} onClick={() => loadPreset(name)} style={s.btnSmall}>
              Preset: {name}
            </button>
          ))}
        </div>
      </div>

      {availableTabs.length > 0 && (
        <TabBar tabs={availableTabs} active={safeActive} onChange={setActiveGroup} />
      )}

      {activeEntries.map(renderColorRow)}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nova cor (ex: brand-primary)" style={s.input} onKeyDown={(e) => e.key === "Enter" && addColor()} />
        <button onClick={addColor} style={s.btn}>+ Cor</button>
      </div>
    </div>
  );
}

// Token Editor (shared by Layout Editor)
// ============================================================================
function TokenEditor({ tokens, onChange }) {
  const [newKey, setNewKey] = useState("");
  const [activeCat, setActiveCat] = usePersistentTab("token-editor", "spacing");

  const addToken = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim().replace(/\s+/g, "-");
    const updated = { ...tokens };
    updated[activeCat] = { ...updated[activeCat], [key]: { value: 0, unit: "px" } };
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
      <TabBar
        tabs={[
          { id: "spacing", label: `Spacing (${Object.keys(tokens.spacing || {}).length})` },
          { id: "sizing", label: `Sizing (${Object.keys(tokens.sizing || {}).length})` },
        ]}
        active={activeCat}
        onChange={setActiveCat}
      />

      {Object.entries(tokens[activeCat] || {}).map(([key, tok]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 120 }}>{key}</span>
          <input type="number" value={tok.value} onChange={(e) => updateToken(activeCat, key, "value", e.target.value)} style={{ ...s.input, width: 80 }} />
          <select value={tok.unit} onChange={(e) => updateToken(activeCat, key, "unit", e.target.value)} style={{ ...s.select, width: 70 }}>
            {["px", "rem", "%", "vh", "vw"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => removeToken(activeCat, key)} style={s.btnDanger}>✕</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do token" style={s.input} onKeyDown={(e) => e.key === "Enter" && addToken()} />
        <button onClick={addToken} style={s.btn}>+ Token</button>
      </div>
    </div>
  );
}

// ============================================================================
// Token Reference Selector
// ============================================================================
function TokenRefSelect({ value, tokens, category, onChange }) {
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

// ============================================================================
// Typography Token Editors
// ============================================================================
function FontFamilyEditor({ families, onChange }) {
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

function FontSizeEditor({ sizes, onChange }) {
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

function FontWeightEditor({ weights, onChange }) {
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

function LineHeightEditor({ lineHeights, onChange }) {
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

function LetterSpacingEditor({ spacings, onChange }) {
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
// Text Style Editor
// ============================================================================
function resolveTextStyleCSS(style: TextStyle, tokens: Tokens) {
  const result = {};
  if (style.fontFamily) {
    const ref = style.fontFamily.replace("$tokens.fontFamilies.", "");
    const fam = tokens.fontFamilies?.[ref];
    if (fam) result.fontFamily = `'${fam.family}', ${fam.fallbacks.join(", ")}`;
  }
  if (style.fontSize) {
    const ref = style.fontSize.replace("$tokens.fontSizes.", "");
    const tok = tokens.fontSizes?.[ref];
    if (tok) result.fontSize = `${tok.value}${tok.unit}`;
  }
  if (style.fontWeight) {
    const ref = style.fontWeight.replace("$tokens.fontWeights.", "");
    const tok = tokens.fontWeights?.[ref];
    if (tok) result.fontWeight = tok.value;
  }
  if (style.lineHeight) {
    const ref = style.lineHeight.replace("$tokens.lineHeights.", "");
    const tok = tokens.lineHeights?.[ref];
    if (tok) result.lineHeight = tok.value;
  }
  if (style.letterSpacing) {
    const ref = style.letterSpacing.replace("$tokens.letterSpacings.", "");
    const tok = tokens.letterSpacings?.[ref];
    if (tok) result.letterSpacing = `${tok.value}${tok.unit}`;
  }
  return result;
}

function TypoRefSelect({ value, tokens, category, onChange }) {
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

function TextStyleEditor({ textStyles, tokens, onChange }) {
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
// Container Editor
// ============================================================================
function ContainerEditor({ containers, onChange }) {
  const add = () => {
    onChange([...containers, { name: `container${containers.length}`, description: "", order: containers.length, padding: { top: "$tokens.spacing.xs", right: "$tokens.spacing.xs", bottom: "$tokens.spacing.xs", left: "$tokens.spacing.xs" } }]);
  };
  const update = (i, field, val) => {
    const updated = [...containers];
    updated[i] = { ...updated[i], [field]: field === "order" ? Number(val) : val };
    onChange(updated);
  };
  const updatePad = (i, side, val) => {
    const updated = [...containers];
    updated[i] = { ...updated[i], padding: { ...(updated[i].padding || {}), [side]: val } };
    onChange(updated);
  };
  const remove = (i) => onChange(containers.filter((_, idx) => idx !== i));
  const [expandedPadding, setExpandedPadding] = useState<number | null>(null);

  return (
    <div>
      {containers.map((c, i) => (
        <div key={i} style={{ marginBottom: 8, padding: 8, background: COLORS.surface2, borderRadius: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={c.name} onChange={(e) => update(i, "name", e.target.value)} style={{ ...s.input, width: 120, fontWeight: 600 }} placeholder="name" />
            <input value={c.description} onChange={(e) => update(i, "description", e.target.value)} style={{ ...s.input, flex: 1 }} placeholder="descrição" />
            <input type="number" value={c.order} onChange={(e) => update(i, "order", e.target.value)} style={{ ...s.input, width: 50 }} />
            <button onClick={() => setExpandedPadding(expandedPadding === i ? null : i)} style={{ ...s.btnSmall, fontSize: 10 }} title="Padding">⊞</button>
            <button onClick={() => remove(i)} style={s.btnDanger}>✕</button>
          </div>
          {expandedPadding === i && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, paddingLeft: 4 }}>
              {["top", "right", "bottom", "left"].map(side => (
                <div key={side} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", marginBottom: 2 }}>{side}</div>
                  <select value={c.padding?.[side] || ""} onChange={(e) => updatePad(i, side, e.target.value)} style={{ ...s.select, fontSize: 10, padding: "2px 4px" }}>
                    <option value="">—</option>
                    {Object.keys(SPACING_PRESETS).map(k => <option key={k} value={`$tokens.spacing.${k}`}>{k}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={add} style={s.btnSmall}>+ Container</button>
    </div>
  );
}

const SPACING_PRESETS = { "2xs": 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48, "3xl": 64 };

// ============================================================================
// Separator Editor
// ============================================================================
function SeparatorEditor({ separator, tokens, onChange }) {
  const update = (field, val) => onChange({ ...separator, [field]: val });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, background: COLORS.surface2, borderRadius: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", minWidth: 60 }}>
        <input type="checkbox" checked={separator?.enabled ?? false} onChange={(e) => update("enabled", e.target.checked)} /> Visible
      </label>
      {separator?.enabled && (
        <>
          <Field label="Color" style={{ flex: 1 }}>
            <TokenRefSelect value={separator.color} tokens={tokens} category="colors" onChange={(v) => update("color", v)} />
          </Field>
          <Field label="Width" style={{ width: 110 }}>
            <TokenRefSelect value={separator.width} tokens={tokens} category="borderWidth" onChange={(v) => update("width", v)} />
          </Field>
          <Field label="Style" style={{ width: 80 }}>
            <select value={separator.style || "solid"} onChange={(e) => update("style", e.target.value)} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
              {["solid", "dashed", "dotted", "none"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Breadcrumb Config Editor
// ============================================================================
function BreadcrumbEditor({ breadcrumbs, onChange }) {
  const bc = breadcrumbs || { enabled: false, position: "header", alignment: "left", separator: "/", clickable: true };
  const update = (field, val) => onChange({ ...bc, [field]: val });

  const SEPARATORS = [
    { value: "/", label: "/ (slash)" },
    { value: ">", label: "> (chevron)" },
    { value: "|", label: "| (pipe)" },
    { value: "→", label: "→ (arrow)" },
    { value: "·", label: "· (dot)" },
  ];

  // Preview items
  const items = ["Home", "Editor", "Preview"];

  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          Breadcrumbs <span style={{ ...s.tag, marginLeft: 6 }}>{bc.enabled ? "ativo" : "inativo"}</span>
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={bc.enabled} onChange={(e) => update("enabled", e.target.checked)} /> Enabled
        </label>
      </div>

      {bc.enabled && (
        <div>
          {/* Live preview */}
          <div style={{ background: COLORS.surface2, borderRadius: 6, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: bc.alignment === "right" ? "flex-end" : bc.alignment === "center" ? "center" : "flex-start" }}>
            {items.map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{
                  fontSize: 13,
                  color: i < items.length - 1 ? (bc.clickable ? COLORS.accent : COLORS.textMuted) : COLORS.text,
                  cursor: i < items.length - 1 && bc.clickable ? "pointer" : "default",
                  fontWeight: i === items.length - 1 ? 500 : 400,
                  textDecoration: i < items.length - 1 && bc.clickable ? "underline" : "none",
                  textDecorationColor: i < items.length - 1 && bc.clickable ? COLORS.accent + "40" : undefined,
                }}>
                  {item}
                </span>
                {i < items.length - 1 && (
                  <span style={{ color: COLORS.textDim, margin: "0 6px", fontSize: 12 }}>{bc.separator}</span>
                )}
              </span>
            ))}
          </div>

          <Row gap={12}>
            <Field label="Position" style={{ flex: 1 }}>
              <select value={bc.position} onChange={(e) => update("position", e.target.value)} style={s.select}>
                <option value="header">Header</option>
                <option value="sidebar-top">Sidebar (topo)</option>
                <option value="sidebar-bottom">Sidebar (bottom)</option>
              </select>
            </Field>
            {bc.position === "header" && (
              <Field label="Alignment" style={{ flex: 1 }}>
                <select value={bc.alignment || "left"} onChange={(e) => update("alignment", e.target.value)} style={s.select}>
                  <option value="left">Esquerda</option>
                  <option value="center">Centralizado</option>
                  <option value="right">Direita</option>
                </select>
              </Field>
            )}
          </Row>

          <Row gap={12}>
            <Field label="Separator" style={{ flex: 1 }}>
              <select value={bc.separator} onChange={(e) => update("separator", e.target.value)} style={s.select}>
                {SEPARATORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Clickable" style={{ flex: 1 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={bc.clickable ?? true} onChange={(e) => update("clickable", e.target.checked)} />
                Itens anteriores redirecionam
              </label>
            </Field>
          </Row>

          <div style={{ marginTop: 8, padding: 8, background: COLORS.surface2, borderRadius: 4, fontSize: 11, color: COLORS.textDim }}>
            {bc.position === "header" && `Breadcrumbs renderizados no header, alinhados à ${bc.alignment === "right" ? "direita" : bc.alignment === "center" ? "centro" : "esquerda"}.`}
            {bc.position === "sidebar-top" && "Breadcrumbs renderizados no topo da sidebar, acima da logo."}
            {bc.position === "sidebar-bottom" && "Breadcrumbs renderizados no final da sidebar."}
            {bc.clickable ? " Itens anteriores são clicáveis e redirecionam." : " Itens não são clicáveis (apenas visual)."}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sidebar Config Editor (icons, collapse, separators)
// ============================================================================
function SidebarConfigEditor({ region, tokens, onChange }) {
  const nav = region.navigation || { icons: { enabled: true, size: "$tokens.sizing.icon-md", gap: "$tokens.spacing.sm" } };
  const behavior = region.behavior || {};
  const cb = region.collapseButton || { icon: "chevron", position: "header-end" };
  const seps = region.separators || {};

  const updateNav = (field, val) => onChange({ ...region, navigation: { ...nav, icons: { ...nav.icons, [field]: val } } });
  const updateBehavior = (field, val) => onChange({ ...region, behavior: { ...behavior, [field]: val } });
  const updateCB = (field, val) => onChange({ ...region, collapseButton: { ...cb, [field]: val } });
  const updateSep = (name, val) => onChange({ ...region, separators: { ...seps, [name]: val } });

  return (
    <div>
      {/* Navigation Icons */}
      <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation Icons</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={16}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={nav.icons?.enabled ?? true} onChange={(e) => updateNav("enabled", e.target.checked)} /> Icons enabled
          </label>
        </Row>
        {nav.icons?.enabled && (
          <Row gap={8}>
            <Field label="Icon Size" style={{ flex: 1 }}>
              <TokenRefSelect value={nav.icons.size} tokens={tokens} category="sizing" onChange={(v) => updateNav("size", v)} />
            </Field>
            <Field label="Gap" style={{ flex: 1 }}>
              <TokenRefSelect value={nav.icons.gap} tokens={tokens} category="spacing" onChange={(v) => updateNav("gap", v)} />
            </Field>
          </Row>
        )}
      </div>

      {/* Collapsed Display */}
      {behavior.collapsible && (
        <>
          <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Collapsed Display</div>
          <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
            <Field label="Mode when collapsed">
              <select value={behavior.collapsedDisplay || "icon-only"} onChange={(e) => updateBehavior("collapsedDisplay", e.target.value)} style={s.select}>
                <option value="icon-only">Icon only</option>
                <option value="icon-letter">Icon + first letter</option>
                <option value="letter-only">First letter only</option>
              </select>
            </Field>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
              {behavior.collapsedDisplay === "icon-only" && "Mostra apenas o ícone de cada item de navegação"}
              {behavior.collapsedDisplay === "icon-letter" && "Mostra ícone + primeira letra do label"}
              {behavior.collapsedDisplay === "letter-only" && "Mostra apenas a primeira letra do label (como avatar)"}
              {!behavior.collapsedDisplay && "Mostra apenas o ícone de cada item de navegação"}
            </div>
          </div>

          {/* Collapse Button */}
          <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Collapse Button</div>
          <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
            <Row gap={12}>
              <Field label="Icon" style={{ flex: 1 }}>
                <select value={cb.icon || "chevron"} onChange={(e) => updateCB("icon", e.target.value)} style={s.select}>
                  <option value="chevron">Chevron ◂ ▸</option>
                  <option value="arrow">Arrow ← →</option>
                  <option value="hamburger">Hamburger ✕ ☰</option>
                  <option value="dots">Dots ⋮ ⋯</option>
                </select>
              </Field>
              <Field label="Position" style={{ flex: 1 }}>
                <select value={cb.position || "header-end"} onChange={(e) => updateCB("position", e.target.value)} style={s.select}>
                  <option value="header-end">Header (end)</option>
                  <option value="center">Center (between nav and footer)</option>
                  <option value="bottom">Bottom (footer area)</option>
                </select>
              </Field>
            </Row>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
              {cb.position === "header-end" && "Botão posicionado ao lado do brand/header do sidebar"}
              {cb.position === "center" && "Botão centralizado entre a navegação e o footer"}
              {cb.position === "bottom" && "Botão posicionado na área do footer do sidebar"}
            </div>
          </div>
        </>
      )}

      {/* Separators */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Separators</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Field label="Header separator">
          <SeparatorEditor separator={seps.header || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("header", v)} />
        </Field>
        <Field label="Footer separator">
          <SeparatorEditor separator={seps.footer || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("footer", v)} />
        </Field>
        <Field label="Nav group separators">
          <SeparatorEditor separator={seps.navGroups || { enabled: false, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }} tokens={tokens} onChange={(v) => updateSep("navGroups", v)} />
        </Field>
      </div>
    </div>
  );
}

// ============================================================================
// Region Editor
// ============================================================================
function RegionEditor({ name, region, tokens, onChange }) {
  const update = (field, val) => onChange({ ...region, [field]: val });
  const updateDim = (field, val) => onChange({ ...region, dimensions: { ...region.dimensions, [field]: val } });
  const updatePad = (field, val) => onChange({ ...region, padding: { ...region.padding, [field]: val } });
  const updateBehavior = (field, val) => onChange({ ...region, behavior: { ...region.behavior, [field]: val } });

  const regionLabel = { sidebar: "Sidebar", header: "Header", main: "Main", footer: "Footer" }[name] || name;

  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {regionLabel} <span style={{ ...s.tag, marginLeft: 6 }}>{region.enabled ? "ativo" : "inativo"}</span>
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={region.enabled} onChange={(e) => {
            if (e.target.checked) {
              onChange({ enabled: true, position: name === "sidebar" ? "left" : name === "header" ? "top" : name === "footer" ? "bottom" : "center", containers: [{ name: "content", description: "", order: 0 }], behavior: { fixed: true, collapsible: false, scrollable: false }, dimensions: {}, padding: {} });
            } else {
              onChange({ enabled: false });
            }
          }} /> Enabled
        </label>
      </div>
      {region.enabled && (
        <div>
          <Row gap={12}>
            <Field label="Position" style={{ flex: 1 }}>
              <select value={region.position} onChange={(e) => update("position", e.target.value)} style={s.select}>
                {["top", "left", "right", "bottom", "center"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </Row>

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dimensions</div>
          <Row gap={8}>
            <Field label="Width" style={{ flex: 1 }}>
              <TokenRefSelect value={region.dimensions?.width} tokens={tokens} category="sizing" onChange={(v) => updateDim("width", v)} />
            </Field>
            <Field label="Height" style={{ flex: 1 }}>
              <TokenRefSelect value={region.dimensions?.height} tokens={tokens} category="sizing" onChange={(v) => updateDim("height", v)} />
            </Field>
          </Row>

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Padding</div>
          <Row gap={8}>
            {["top", "right", "bottom", "left"].map((side) => (
              <Field key={side} label={side} style={{ flex: 1 }}>
                <TokenRefSelect value={region.padding?.[side]} tokens={tokens} category="spacing" onChange={(v) => updatePad(side, v)} />
              </Field>
            ))}
          </Row>

          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Behavior</div>
          <Row gap={16}>
            {["fixed", "collapsible", "scrollable"].map((b) => (
              <label key={b} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                <input type="checkbox" checked={region.behavior?.[b] || false} onChange={(e) => updateBehavior(b, e.target.checked)} /> {b}
              </label>
            ))}
          </Row>

          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Containers</div>
          <ContainerEditor containers={region.containers || []} onChange={(c) => update("containers", c)} />

          {/* Sidebar-specific config */}
          {name === "sidebar" && (
            <SidebarConfigEditor region={region} tokens={tokens} onChange={onChange} />
          )}

          {/* Header/Footer separator config */}
          {(name === "header" || name === "footer") && (
            <>
              <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Separators</div>
              {name === "header" && (
                <Field label="Bottom separator">
                  <SeparatorEditor
                    separator={(region as any).separators?.bottom || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...(region as any).separators, bottom: v } })}
                  />
                </Field>
              )}
              {name === "footer" && (
                <Field label="Top separator">
                  <SeparatorEditor
                    separator={(region as any).separators?.top || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...(region as any).separators, top: v } })}
                  />
                </Field>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Layout Editor
// ============================================================================
function LayoutEditor({ layout, onChange }) {
  const [section, setSection] = usePersistentTab("layout-section", "regions");
  const [activeRegion, setActiveRegion] = usePersistentTab("layout-region", "sidebar");
  const [typoTab, setTypoTab] = usePersistentTab("layout-typo", "families");
  const [activeTextStyle, setActiveTextStyle] = usePersistentTab("layout-textstyle", "");

  const updateRegion = (name, region) => {
    onChange({ ...layout, structure: { ...layout.structure, regions: { ...layout.structure.regions, [name]: region } } });
  };
  const updateTokenCat = (cat, val) => {
    onChange({ ...layout, tokens: { ...layout.tokens, [cat]: val } });
  };

  const textStyleKeys = Object.keys(layout.textStyles || {});
  const safeActiveTS = textStyleKeys.includes(activeTextStyle) ? activeTextStyle : (textStyleKeys[0] || "");

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>Layout Contract Editor</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Edite regiões, containers, tokens e tipografia</p>
      </div>

      <TabBar
        tabs={[
          { id: "regions", label: "Regions" },
          { id: "colors", label: "Colors" },
          { id: "tokens", label: "Spacing / Sizing" },
          { id: "typography", label: "Typography" },
          { id: "textStyles", label: "Text Styles" },
        ]}
        active={section}
        onChange={setSection}
      />

      {/* REGIONS — sub-tabs instead of accordeons */}
      {section === "regions" && (
        <>
          <TabBar
            tabs={[
              ...["sidebar", "header", "main", "footer"].map(n => ({
                id: n,
                label: `${n.charAt(0).toUpperCase() + n.slice(1)} ${layout.structure.regions[n]?.enabled ? "●" : "○"}`,
              })),
              { id: "breadcrumbs", label: `Breadcrumbs ${layout.structure.breadcrumbs?.enabled ? "●" : "○"}` },
            ]}
            active={activeRegion}
            onChange={setActiveRegion}
          />
          {activeRegion === "breadcrumbs" ? (
            <BreadcrumbEditor
              breadcrumbs={layout.structure.breadcrumbs}
              onChange={(bc) => onChange({ ...layout, structure: { ...layout.structure, breadcrumbs: bc } })}
            />
          ) : (
            <RegionEditor
              name={activeRegion}
              region={layout.structure.regions[activeRegion]}
              tokens={layout.tokens}
              onChange={(r) => updateRegion(activeRegion, r)}
            />
          )}
        </>
      )}

      {section === "colors" && (
        <ColorTokenEditor colors={layout.tokens.colors || {}} onChange={(v) => updateTokenCat("colors", v)} />
      )}

      {section === "tokens" && (
        <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} />
      )}

      {/* TYPOGRAPHY — sub-tabs */}
      {section === "typography" && (
        <>
          <TabBar
            tabs={[
              { id: "families", label: `Families (${Object.keys(layout.tokens.fontFamilies || {}).length})` },
              { id: "sizes", label: `Sizes (${Object.keys(layout.tokens.fontSizes || {}).length})` },
              { id: "weights", label: `Weights (${Object.keys(layout.tokens.fontWeights || {}).length})` },
              { id: "lineHeights", label: `Line Heights (${Object.keys(layout.tokens.lineHeights || {}).length})` },
              { id: "spacings", label: `Letter Sp. (${Object.keys(layout.tokens.letterSpacings || {}).length})` },
            ]}
            active={typoTab}
            onChange={setTypoTab}
          />
          {typoTab === "families" && <FontFamilyEditor families={layout.tokens.fontFamilies || {}} onChange={(v) => updateTokenCat("fontFamilies", v)} />}
          {typoTab === "sizes" && <FontSizeEditor sizes={layout.tokens.fontSizes || {}} onChange={(v) => updateTokenCat("fontSizes", v)} />}
          {typoTab === "weights" && <FontWeightEditor weights={layout.tokens.fontWeights || {}} onChange={(v) => updateTokenCat("fontWeights", v)} />}
          {typoTab === "lineHeights" && <LineHeightEditor lineHeights={layout.tokens.lineHeights || {}} onChange={(v) => updateTokenCat("lineHeights", v)} />}
          {typoTab === "spacings" && <LetterSpacingEditor spacings={layout.tokens.letterSpacings || {}} onChange={(v) => updateTokenCat("letterSpacings", v)} />}
        </>
      )}

      {/* TEXT STYLES — sub-tabs per style */}
      {section === "textStyles" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Composições tipográficas nomeadas. Cada text style combina referências a tokens de tipografia.</p>
          </div>

          {textStyleKeys.length > 0 && (
            <TabBar
              tabs={textStyleKeys.map(k => ({ id: k, label: k }))}
              active={safeActiveTS}
              onChange={setActiveTextStyle}
            />
          )}

          {safeActiveTS && layout.textStyles?.[safeActiveTS] && (() => {
            const key = safeActiveTS;
            const style = layout.textStyles[key];
            const css = resolveTextStyleCSS(style, layout.tokens);
            const update = (field, val) => {
              onChange({ ...layout, textStyles: { ...layout.textStyles, [key]: { ...layout.textStyles[key], [field]: val } } });
            };
            const remove = () => {
              const u = { ...layout.textStyles };
              delete u[key];
              onChange({ ...layout, textStyles: u });
              setActiveTextStyle(Object.keys(u)[0] || "");
            };
            return (
              <div style={{ ...s.card }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</div>
                    <input value={style.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="descrição" style={{ ...s.input, fontSize: 11, marginTop: 4, width: 250 }} />
                  </div>
                  <button onClick={remove} style={s.btnDanger}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <Field label="Font Family" style={{ marginBottom: 0 }}>
                    <TypoRefSelect value={style.fontFamily} tokens={layout.tokens} category="fontFamilies" onChange={(v) => update("fontFamily", v)} />
                  </Field>
                  <Field label="Font Size" style={{ marginBottom: 0 }}>
                    <TypoRefSelect value={style.fontSize} tokens={layout.tokens} category="fontSizes" onChange={(v) => update("fontSize", v)} />
                  </Field>
                  <Field label="Font Weight" style={{ marginBottom: 0 }}>
                    <TypoRefSelect value={style.fontWeight} tokens={layout.tokens} category="fontWeights" onChange={(v) => update("fontWeight", v)} />
                  </Field>
                  <Field label="Line Height" style={{ marginBottom: 0 }}>
                    <TypoRefSelect value={style.lineHeight} tokens={layout.tokens} category="lineHeights" onChange={(v) => update("lineHeight", v)} />
                  </Field>
                  <Field label="Letter Spacing" style={{ marginBottom: 0 }}>
                    <TypoRefSelect value={style.letterSpacing} tokens={layout.tokens} category="letterSpacings" onChange={(v) => update("letterSpacing", v)} />
                  </Field>
                </div>

                <div style={{ background: COLORS.surface2, borderRadius: 6, padding: 12, ...css, color: COLORS.text }}>
                  The quick brown fox jumps over the lazy dog. 0123456789
                </div>
              </div>
            );
          })()}

          <TextStyleAddButton textStyles={layout.textStyles || {}} tokens={layout.tokens} onChange={(ts) => {
            onChange({ ...layout, textStyles: ts });
            const keys = Object.keys(ts);
            setActiveTextStyle(keys[keys.length - 1] || "");
          }} />
        </div>
      )}
    </div>
  );
}

function TextStyleAddButton({ textStyles, tokens, onChange }) {
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

// ============================================================================
// Prop Editor (UI Registry)
// ============================================================================
function PropEditor({ props, onChange }) {
  const [newPropKey, setNewPropKey] = useState("");

  const addProp = () => {
    if (!newPropKey.trim()) return;
    const key = newPropKey.trim();
    onChange({ ...props, [key]: { type: "string", required: false, description: "" } });
    setNewPropKey("");
  };

  const updateProp = (key, field, val) => {
    const updated = { ...props, [key]: { ...props[key], [field]: val } };
    // Auto-add enumValues for enum type
    if (field === "type" && val === "enum" && !updated[key].enumValues) {
      updated[key].enumValues = [""];
    }
    if (field === "type" && val === "array" && !updated[key].items) {
      updated[key].items = { type: "string" };
    }
    if (field === "type" && val === "object" && !updated[key].shape) {
      updated[key].shape = {};
    }
    onChange(updated);
  };

  const removeProp = (key) => {
    const updated = { ...props };
    delete updated[key];
    onChange(updated);
  };

  const updateEnumValues = (key, valStr) => {
    const vals = valStr.split(",").map((v) => v.trim()).filter(Boolean);
    onChange({ ...props, [key]: { ...props[key], enumValues: vals } });
  };

  return (
    <div>
      {Object.entries(props).map(([key, prop]) => (
        <div key={key} style={{ padding: 10, marginBottom: 8, background: COLORS.surface2, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 100 }}>{key}</span>
            <select value={prop.type} onChange={(e) => updateProp(key, "type", e.target.value)} style={{ ...s.select, width: 100 }}>
              {["string", "number", "boolean", "enum", "ReactNode", "function", "object", "array"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={prop.required} onChange={(e) => updateProp(key, "required", e.target.checked)} /> required
            </label>
            <button onClick={() => removeProp(key)} style={s.btnDanger}>✕</button>
          </div>
          <input value={prop.description} onChange={(e) => updateProp(key, "description", e.target.value)} placeholder="descrição da prop" style={{ ...s.input, marginBottom: 6 }} />
          {prop.type === "enum" && (
            <input value={(prop.enumValues || []).join(", ")} onChange={(e) => updateEnumValues(key, e.target.value)} placeholder="valores separados por vírgula" style={{ ...s.input, fontSize: 11, color: COLORS.warning }} />
          )}
          {!prop.required && prop.type !== "function" && prop.type !== "ReactNode" && (
            <input value={prop.default ?? ""} onChange={(e) => updateProp(key, "default", prop.type === "number" ? Number(e.target.value) : prop.type === "boolean" ? e.target.value === "true" : e.target.value)} placeholder="default" style={{ ...s.input, marginTop: 4, fontSize: 11 }} />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={newPropKey} onChange={(e) => setNewPropKey(e.target.value)} placeholder="nome da prop (camelCase)" style={s.input} onKeyDown={(e) => e.key === "Enter" && addProp()} />
        <button onClick={addProp} style={s.btnSmall}>+ Prop</button>
      </div>
    </div>
  );
}

// ============================================================================
// Slot Editor (UI Registry component slots)
// ============================================================================
function SlotEditor({ slots, onChange }) {
  const [newKey, setNewKey] = useState("");

  const addSlot = () => {
    if (!newKey.trim()) return;
    onChange({ ...slots, [newKey.trim()]: { description: "", required: false, acceptedComponents: [] } });
    setNewKey("");
  };

  const updateSlot = (key, field, val) => {
    onChange({ ...slots, [key]: { ...slots[key], [field]: val } });
  };

  const removeSlot = (key) => {
    const updated = { ...slots };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div>
      {Object.entries(slots || {}).map(([key, slot]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: 8, background: COLORS.surface2, borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80 }}>{key}</span>
          <input value={slot.description} onChange={(e) => updateSlot(key, "description", e.target.value)} placeholder="descrição" style={{ ...s.input, flex: 1 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={slot.required} onChange={(e) => updateSlot(key, "required", e.target.checked)} /> req
          </label>
          <button onClick={() => removeSlot(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do slot" style={s.input} onKeyDown={(e) => e.key === "Enter" && addSlot()} />
        <button onClick={addSlot} style={s.btnSmall}>+ Slot</button>
      </div>
    </div>
  );
}

// ============================================================================
// Component Editor (single component in UI Registry)
// ============================================================================
function ComponentEditor({ comp, onChange }) {
  const update = (field, val) => onChange({ ...comp, [field]: val });

  const updateTags = (val) => {
    update("tags", val.split(",").map((t) => t.trim()).filter(Boolean));
  };

  const addVariant = () => {
    update("variants", [...(comp.variants || []), { name: "", props: {} }]);
  };

  const updateVariant = (i, field, val) => {
    const variants = [...comp.variants];
    variants[i] = { ...variants[i], [field]: val };
    update("variants", variants);
  };

  const removeVariant = (i) => {
    update("variants", comp.variants.filter((_, idx) => idx !== i));
  };

  const addExample = () => {
    update("examples", [...(comp.examples || []), { name: "", props: {} }]);
  };

  const updateExample = (i, field, val) => {
    const examples = [...comp.examples];
    examples[i] = { ...examples[i], [field]: val };
    update("examples", examples);
  };

  const removeExample = (i) => {
    update("examples", comp.examples.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <Row gap={12}>
        <Field label="Category" style={{ flex: 1 }}>
          <select value={comp.category} onChange={(e) => update("category", e.target.value)} style={s.select}>
            {["primitive", "semantic", "layout", "feedback", "navigation", "data-display", "form"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Source" style={{ flex: 1 }}>
          <select value={comp.source || "custom"} onChange={(e) => update("source", e.target.value)} style={s.select}>
            {["shadcn-ui", "custom", "html-native"].map((s2) => <option key={s2}>{s2}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Description">
        <input value={comp.description} onChange={(e) => update("description", e.target.value)} style={s.input} />
      </Field>
      <Field label="Tags (vírgula)">
        <input value={(comp.tags || []).join(", ")} onChange={(e) => updateTags(e.target.value)} style={s.input} />
      </Field>

      <Section title={`Props (${Object.keys(comp.props || {}).length})`}>
        <PropEditor props={comp.props || {}} onChange={(p) => update("props", p)} />
      </Section>

      <Section title={`Slots (${Object.keys(comp.slots || {}).length})`} defaultOpen={false}>
        <SlotEditor slots={comp.slots || {}} onChange={(sl) => update("slots", sl)} />
      </Section>

      <Section title={`Variants (${(comp.variants || []).length})`} defaultOpen={false}>
        {(comp.variants || []).map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} placeholder="nome" style={{ ...s.input, width: 150 }} />
            <input value={JSON.stringify(v.props)} onChange={(e) => { try { updateVariant(i, "props", JSON.parse(e.target.value)); } catch {} }} placeholder='{"prop": "value"}' style={{ ...s.input, flex: 1, fontSize: 11 }} />
            <button onClick={() => removeVariant(i)} style={s.btnDanger}>✕</button>
          </div>
        ))}
        <button onClick={addVariant} style={s.btnSmall}>+ Variant</button>
      </Section>

      <Section title={`Examples (${(comp.examples || []).length})`} defaultOpen={false}>
        {(comp.examples || []).map((ex, i) => (
          <div key={i} style={{ padding: 8, marginBottom: 6, background: COLORS.surface2, borderRadius: 6 }}>
            <input value={ex.name} onChange={(e) => updateExample(i, "name", e.target.value)} placeholder="nome do exemplo" style={{ ...s.input, marginBottom: 4 }} />
            <input value={JSON.stringify(ex.props)} onChange={(e) => { try { updateExample(i, "props", JSON.parse(e.target.value)); } catch {} }} placeholder='{"prop": "value"}' style={{ ...s.input, fontSize: 11 }} />
            <button onClick={() => removeExample(i)} style={{ ...s.btnDanger, marginTop: 4 }}>✕</button>
          </div>
        ))}
        <button onClick={addExample} style={s.btnSmall}>+ Example</button>
      </Section>
    </div>
  );
}

// ============================================================================
// UI Registry Editor
// ============================================================================
function UIRegistryEditor({ registry, onChange }) {
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState("");

  const componentNames = Object.keys(registry.components || {});

  useEffect(() => {
    if (selected && !registry.components[selected]) setSelected(null);
  }, [registry, selected]);

  const addComponent = () => {
    if (!newName.trim()) return;
    const name = newName.trim().replace(/^./, (c) => c.toUpperCase());
    if (registry.components[name]) return;
    onChange({
      ...registry,
      components: {
        ...registry.components,
        [name]: {
          name,
          category: "primitive",
          description: "",
          source: "custom",
          props: {},
          slots: {},
          variants: [],
          examples: [{ name: "Default", props: {} }],
          tags: [],
        },
      },
    });
    setSelected(name);
    setNewName("");
  };

  const removeComponent = (name) => {
    const updated = { ...registry.components };
    delete updated[name];
    onChange({ ...registry, components: updated });
    if (selected === name) setSelected(null);
  };

  const updateComponent = (comp) => {
    onChange({ ...registry, components: { ...registry.components, [comp.name]: comp } });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>UI Registry Contract Editor</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Gerencie componentes, props, slots e variantes</p>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Component list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="NovoComponente" style={{ ...s.input, fontSize: 12 }} onKeyDown={(e) => e.key === "Enter" && addComponent()} />
            <button onClick={addComponent} style={s.btnSmall}>+</button>
          </div>
          {componentNames.map((name) => (
            <div key={name} onClick={() => setSelected(name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", marginBottom: 2, borderRadius: 6, background: selected === name ? COLORS.surface3 : "transparent", cursor: "pointer", border: selected === name ? `1px solid ${COLORS.border2}` : "1px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 13, color: selected === name ? COLORS.text : COLORS.textMuted, fontWeight: selected === name ? 600 : 400 }}>{name}</span>
              <button onClick={(e) => { e.stopPropagation(); removeComponent(name); }} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 11, padding: "2px 4px" }}>✕</button>
            </div>
          ))}
          {componentNames.length === 0 && <div style={{ fontSize: 12, color: COLORS.textDim, padding: 8 }}>Nenhum componente</div>}
        </div>

        {/* Component editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selected && registry.components[selected] ? (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent, margin: 0, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>{selected}</h3>
              <ComponentEditor comp={registry.components[selected]} onChange={updateComponent} />
            </div>
          ) : (
            <EmptyState message="Selecione um componente para editar" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Layout Preview
// ============================================================================
function LayoutPreview({ layout }) {
  const { regions } = layout.structure;
  const tokens = layout.tokens;

  const sidebarW = resolveTokenNum(regions.sidebar?.dimensions?.width, tokens);
  const headerH = resolveTokenNum(regions.header?.dimensions?.height, tokens);

  const PREVIEW_H = 500;
  const SCALE = PREVIEW_H / 800;

  const regionColors = {
    sidebar: { bg: "#6d9cff12", border: "#6d9cff40", text: "#6d9cff" },
    header: { bg: "#4ade8012", border: "#4ade8040", text: "#4ade80" },
    main: { bg: "#fbbf2408", border: "#fbbf2430", text: "#fbbf24" },
    footer: { bg: "#ff6b6b12", border: "#ff6b6b40", text: "#ff6b6b" },
  };

  const renderContainer = (container, color, isVertical = true) => (
    <div key={container.name} style={{
      border: `1px dashed ${color}40`,
      borderRadius: 4,
      padding: "6px 8px",
      marginBottom: isVertical ? 4 : 0,
      marginRight: isVertical ? 0 : 4,
      flex: isVertical ? undefined : 1,
    }}>
      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color, opacity: 0.8 }}>{container.name}</div>
      {container.description && <div style={{ fontSize: 8, color: COLORS.textDim, marginTop: 2 }}>{container.description}</div>}
    </div>
  );

  const renderPadding = (region, name) => {
    const pad = region.padding || {};
    const vals = ["top", "right", "bottom", "left"].map(side => resolveTokenNum(pad[side], tokens));
    if (vals.every(v => v === 0)) return null;
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* Top */}
        {vals[0] > 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: Math.max(vals[0] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Bottom */}
        {vals[2] > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: Math.max(vals[2] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Left */}
        {vals[3] > 0 && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: Math.max(vals[3] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
        {/* Right */}
        {vals[1] > 0 && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: Math.max(vals[1] * SCALE, 2), background: regionColors[name]?.border || "#fff2", opacity: 0.3 }} />}
      </div>
    );
  };

  const renderRegionLabel = (name, region) => {
    const c = regionColors[name];
    const dims = region.dimensions || {};
    const w = resolveToken(dims.width, tokens);
    const h = resolveToken(dims.height, tokens);
    const dimStr = [w && `W:${w}`, h && `H:${h}`].filter(Boolean).join(" ");
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: c.text, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{name}</span>
          {region.behavior?.scrollable && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: `${c.text}15`, color: c.text, border: `1px solid ${c.text}25` }}>scroll</span>}
          {region.behavior?.fixed && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: `${c.text}15`, color: c.text, border: `1px solid ${c.text}25` }}>fixed</span>}
        </div>
        {dimStr && <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{dimStr}</span>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Layout Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Estrutura do AppShell renderizada a partir do Layout Contract</p>
      </div>

      {/* AppShell preview */}
      <div style={{
        border: `1px solid ${COLORS.border2}`,
        borderRadius: 10,
        overflow: "hidden",
        background: COLORS.bg,
        height: PREVIEW_H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {/* Header */}
        {regions.header?.enabled && (
          <div style={{
            height: headerH * SCALE || 40,
            minHeight: 40,
            background: regionColors.header.bg,
            borderBottom: `1px solid ${regionColors.header.border}`,
            padding: 8,
            position: "relative",
            flexShrink: 0,
          }}>
            {renderPadding(regions.header, "header")}
            {renderRegionLabel("header", regions.header)}
            <div style={{ display: "flex", gap: 4 }}>
              {(regions.header.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.header.text, false))}
            </div>
          </div>
        )}

        {/* Middle: sidebar + main */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Sidebar */}
          {regions.sidebar?.enabled && (
            <div style={{
              width: Math.max(sidebarW * SCALE, 120),
              background: regionColors.sidebar.bg,
              borderRight: `1px solid ${regionColors.sidebar.border}`,
              padding: 8,
              position: "relative",
              overflow: "auto",
              flexShrink: 0,
              order: regions.sidebar.position === "right" ? 2 : 0,
              ...(regions.sidebar.position === "right" ? { borderRight: "none", borderLeft: `1px solid ${regionColors.sidebar.border}` } : {}),
            }}>
              {renderPadding(regions.sidebar, "sidebar")}
              {renderRegionLabel("sidebar", regions.sidebar)}
              {(regions.sidebar.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.sidebar.text))}
            </div>
          )}

          {/* Main */}
          {regions.main?.enabled && (
            <div style={{
              flex: 1,
              background: regionColors.main.bg,
              padding: 8,
              position: "relative",
              overflow: "auto",
              order: 1,
            }}>
              {renderPadding(regions.main, "main")}
              {renderRegionLabel("main", regions.main)}
              {(regions.main.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.main.text))}
            </div>
          )}
        </div>

        {/* Footer */}
        {regions.footer?.enabled && (
          <div style={{
            minHeight: 36,
            background: regionColors.footer.bg,
            borderTop: `1px solid ${regionColors.footer.border}`,
            padding: 8,
            position: "relative",
            flexShrink: 0,
          }}>
            {renderPadding(regions.footer, "footer")}
            {renderRegionLabel("footer", regions.footer)}
            <div style={{ display: "flex", gap: 4 }}>
              {(regions.footer.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.footer.text, false))}
            </div>
          </div>
        )}

        {/* Empty state overlay */}
        {!Object.values(regions).some(r => r.enabled) && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 13, color: COLORS.textDim }}>Nenhuma região ativa</span>
          </div>
        )}
      </div>

      {/* Token summary */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {Object.entries(layout.tokens.spacing || {}).map(([key, tok]) => (
          <div key={`sp-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.accent }}>spacing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
        {Object.entries(layout.tokens.sizing || {}).map(([key, tok]) => (
          <div key={`sz-${key}`} style={{ ...s.tag, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: COLORS.success }}>sizing.</span>{key}: {tok.value}{tok.unit}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component Preview
// ============================================================================
const MOCK_COMPONENT_STYLES = {
  Button: (props) => ({
    base: {
      padding: props.size === "sm" ? "4px 10px" : props.size === "lg" ? "10px 20px" : props.size === "icon" ? "8px" : "6px 14px",
      borderRadius: 6, fontSize: props.size === "sm" ? 12 : props.size === "lg" ? 15 : 13, fontWeight: 500,
      cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled || props.loading ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif", border: "none", transition: "all 0.15s",
      ...(props.variant === "destructive" ? { background: COLORS.danger, color: "#fff" }
        : props.variant === "outline" ? { background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border2}` }
        : props.variant === "secondary" ? { background: COLORS.surface3, color: COLORS.text }
        : props.variant === "ghost" ? { background: "transparent", color: COLORS.textMuted }
        : props.variant === "link" ? { background: "transparent", color: COLORS.accent, textDecoration: "underline", padding: 0 }
        : { background: COLORS.accent, color: "#fff" }),
    },
  }),
  Badge: (props) => ({
    base: {
      display: "inline-flex", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 500, fontFamily: "'Inter', sans-serif",
      ...(props.variant === "destructive" ? { background: "#dc262620", color: COLORS.danger, border: "1px solid #dc262640" }
        : props.variant === "secondary" ? { background: COLORS.surface3, color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }
        : props.variant === "outline" ? { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.border2}` }
        : { background: `${COLORS.accent}20`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }),
    },
  }),
  Card: () => ({ base: { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 200 } }),
  DataTable: () => ({ base: { width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Inter', sans-serif" } }),
};

// ============================================================================
// Extended Mock Components for full preview coverage
// ============================================================================
function MockComponent({ comp, propValues, slotContent, compName }: { comp: any; propValues: any; slotContent: any; compName?: string }) {
  const name = compName || comp.name || "Unknown";
  const styleFn = MOCK_COMPONENT_STYLES[name];

  // --- DataTable ---
  if (name === "DataTable") {
    const cols = propValues.columns || [{ key: "col1", label: "Column 1" }, { key: "col2", label: "Column 2" }];
    const data = propValues.data || [{ col1: "value 1", col2: "value 2" }, { col1: "value 3", col2: "value 4" }];
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border2}`, color: COLORS.textMuted, fontWeight: 600, fontSize: 11 }}>{c.label}</th>)}</tr></thead>
        <tbody>{data.map((row, ri) => <tr key={ri}>{cols.map((c, ci) => <td key={ci} style={{ padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }}>{String(row[c.key] ?? "")}</td>)}</tr>)}</tbody>
      </table>
    );
  }

  // --- Card ---
  if (name === "Card") {
    return (
      <div style={styleFn?.()?.base || {}}>
        {slotContent?.header && <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: COLORS.text }}>{slotContent.header}</div>}
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>{slotContent?.content || "Card content"}</div>
        {slotContent?.footer && <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textDim }}>{slotContent.footer}</div>}
      </div>
    );
  }

  // --- Dialog / AlertDialog ---
  if (name === "Dialog" || name === "AlertDialog") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, minWidth: 280, maxWidth: 360, boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.text, marginBottom: 8 }}>{propValues.title || "Dialog Title"}</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20 }}>{propValues.description || "Are you sure you want to continue? This action cannot be undone."}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: name === "AlertDialog" ? COLORS.danger : COLORS.accent, color: "#fff", border: "none", fontSize: 13, cursor: "pointer" }}>Confirm</button>
        </div>
      </div>
    );
  }

  // --- Sheet ---
  if (name === "Sheet") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "12px 0 0 12px", padding: 20, minWidth: 260, minHeight: 200, boxShadow: "-4px 0 24px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 4 }}>{propValues.title || "Sheet Title"}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16 }}>Sheet description</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 500 }}>Name</label>
            <input value="John Doe" readOnly style={{ padding: "6px 10px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13 }} />
          </div>
          <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.accent, color: "#fff", border: "none", fontSize: 13 }}>Save changes</button>
        </div>
      </div>
    );
  }

  // --- Accordion ---
  if (name === "Accordion") {
    const items = ["Is it accessible?", "Is it styled?", "Is it animated?"];
    return (
      <div style={{ width: "100%", minWidth: 260 }}>
        {items.map((item, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{item}</span>
              <span style={{ color: COLORS.textMuted, fontSize: 14 }}>{i === 0 ? "▾" : "▸"}</span>
            </div>
            {i === 0 && <div style={{ paddingBottom: 12, fontSize: 12, color: COLORS.textMuted }}>Yes. It adheres to the WAI-ARIA design pattern.</div>}
          </div>
        ))}
      </div>
    );
  }

  // --- Tabs ---
  if (name === "Tabs") {
    return (
      <div style={{ minWidth: 280 }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 12 }}>
          {["Account", "Password", "Settings"].map((t, i) => (
            <div key={t} style={{ padding: "8px 16px", fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? COLORS.text : COLORS.textMuted, borderBottom: i === 0 ? `2px solid ${COLORS.accent}` : "2px solid transparent", cursor: "pointer" }}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>Make changes to your account here.</div>
      </div>
    );
  }

  // --- Input ---
  if (name === "Input") {
    return (
      <input
        placeholder={propValues.placeholder || "Type here..."}
        disabled={propValues.disabled}
        style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 240, outline: "none", fontFamily: "'Inter', sans-serif", opacity: propValues.disabled ? 0.5 : 1 }}
      />
    );
  }

  // --- Textarea ---
  if (name === "Textarea") {
    return (
      <textarea
        placeholder={propValues.placeholder || "Type your message..."}
        rows={3}
        style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 260, resize: "vertical", outline: "none", fontFamily: "'Inter', sans-serif" }}
      />
    );
  }

  // --- Select ---
  if (name === "Select") {
    return (
      <div style={{ padding: "8px 12px", borderRadius: 6, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13, width: 200, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <span style={{ color: COLORS.textMuted }}>{propValues.placeholder || "Select option..."}</span>
        <span style={{ color: COLORS.textDim }}>▾</span>
      </div>
    );
  }

  // --- Checkbox ---
  if (name === "Checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${propValues.checked ? COLORS.accent : COLORS.border2}`, background: propValues.checked ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {propValues.checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
        </div>
        {propValues.label || "Accept terms"}
      </label>
    );
  }

  // --- Switch ---
  if (name === "Switch") {
    const on = propValues.checked ?? true;
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
        <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? COLORS.accent : COLORS.surface3, padding: 2, transition: "all 0.2s", position: "relative" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "all 0.2s", transform: on ? "translateX(18px)" : "translateX(0)" }} />
        </div>
        {propValues.label || "Airplane Mode"}
      </label>
    );
  }

  // --- RadioGroup ---
  if (name === "RadioGroup") {
    const options = ["Default", "Comfortable", "Compact"];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((opt, i) => (
          <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.text, cursor: "pointer" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${i === 0 ? COLORS.accent : COLORS.border2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent }} />}
            </div>
            {opt}
          </label>
        ))}
      </div>
    );
  }

  // --- Slider ---
  if (name === "Slider") {
    const pct = propValues.value ?? 50;
    return (
      <div style={{ width: 240 }}>
        <div style={{ height: 6, borderRadius: 3, background: COLORS.surface3, position: "relative" }}>
          <div style={{ height: "100%", borderRadius: 3, background: COLORS.accent, width: `${pct}%` }} />
          <div style={{ position: "absolute", top: -5, left: `${pct}%`, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: COLORS.accent, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
        </div>
      </div>
    );
  }

  // --- Progress ---
  if (name === "Progress") {
    const pct = propValues.value ?? 60;
    return (
      <div style={{ width: 240 }}>
        <div style={{ height: 8, borderRadius: 4, background: COLORS.surface3, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, background: COLORS.accent, width: `${pct}%`, transition: "width 0.5s" }} />
        </div>
      </div>
    );
  }

  // --- Toast / Sonner ---
  if (name === "Toast" || name === "Sonner") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", minWidth: 280, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{propValues.title || "Event created"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{propValues.description || "Sunday, December 03, 2023 at 9:00 AM"}</div>
        </div>
      </div>
    );
  }

  // --- Tooltip ---
  if (name === "Tooltip") {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <button style={{ padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.text, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Hover me</button>
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: COLORS.text, color: COLORS.bg, padding: "4px 8px", borderRadius: 4, fontSize: 12, whiteSpace: "nowrap" }}>
          {propValues.content || "Tooltip content"}
        </div>
      </div>
    );
  }

  // --- Popover ---
  if (name === "Popover") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Dimensions</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>Set the dimensions for the layer.</div>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Width</span>
          <input value="100%" readOnly style={{ padding: "4px 8px", borderRadius: 4, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }} />
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Height</span>
          <input value="25px" readOnly style={{ padding: "4px 8px", borderRadius: 4, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 12 }} />
        </div>
      </div>
    );
  }

  // --- DropdownMenu / ContextMenu ---
  if (name === "DropdownMenu" || name === "ContextMenu") {
    const items = ["Profile", "Settings", "Keyboard shortcuts", "—", "Log out"];
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 0", minWidth: 180, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        {items.map((item, i) => item === "—"
          ? <div key={i} style={{ height: 1, background: COLORS.border, margin: "4px 0" }} />
          : <div key={i} style={{ padding: "6px 12px", fontSize: 13, color: item === "Log out" ? COLORS.danger : COLORS.text, cursor: "pointer" }}>{item}</div>
        )}
      </div>
    );
  }

  // --- NavigationMenu ---
  if (name === "NavigationMenu") {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {["Getting Started", "Components", "Docs"].map((item, i) => (
          <div key={item} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 6, color: i === 0 ? COLORS.text : COLORS.textMuted, background: i === 0 ? COLORS.surface3 : "transparent", fontWeight: i === 0 ? 500 : 400, cursor: "pointer" }}>{item}</div>
        ))}
      </div>
    );
  }

  // --- Breadcrumb ---
  if (name === "Breadcrumb") {
    const parts = ["Home", "Components", "Breadcrumb"];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {parts.map((p, i) => (
          <span key={p}>
            <span style={{ fontSize: 13, color: i < parts.length - 1 ? COLORS.accent : COLORS.text, cursor: i < parts.length - 1 ? "pointer" : "default", fontWeight: i === parts.length - 1 ? 500 : 400 }}>{p}</span>
            {i < parts.length - 1 && <span style={{ color: COLORS.textDim, margin: "0 2px" }}>/</span>}
          </span>
        ))}
      </div>
    );
  }

  // --- Pagination ---
  if (name === "Pagination") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>← Prev</button>
        {[1, 2, 3, "...", 10].map((p, i) => (
          <button key={i} style={{ padding: "4px 10px", borderRadius: 6, background: p === 2 ? COLORS.accent : "transparent", border: p === 2 ? "none" : `1px solid ${COLORS.border}`, color: p === 2 ? "#fff" : COLORS.textMuted, fontSize: 12, cursor: "pointer", minWidth: 32 }}>{p}</button>
        ))}
        <button style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>Next →</button>
      </div>
    );
  }

  // --- Avatar ---
  if (name === "Avatar") {
    const size = propValues.size === "sm" ? 24 : propValues.size === "lg" ? 48 : 36;
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: `${COLORS.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 600, color: COLORS.accent }}>
        {propValues.fallback || "CN"}
      </div>
    );
  }

  // --- Separator ---
  if (name === "Separator") {
    return (
      <div style={{ width: 240 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Radix Primitives</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>An open-source UI component library.</div>
        <div style={{ height: 1, background: COLORS.border, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, color: COLORS.textMuted }}>
          <span>Blog</span>
          <div style={{ width: 1, height: 16, background: COLORS.border }} />
          <span>Docs</span>
          <div style={{ width: 1, height: 16, background: COLORS.border }} />
          <span>Source</span>
        </div>
      </div>
    );
  }

  // --- Skeleton ---
  if (name === "Skeleton") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.surface3 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ width: 180, height: 14, borderRadius: 4, background: COLORS.surface3 }} />
          <div style={{ width: 120, height: 12, borderRadius: 4, background: COLORS.surface2 }} />
        </div>
      </div>
    );
  }

  // --- Alert ---
  if (name === "Alert") {
    return (
      <div style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${propValues.variant === "destructive" ? COLORS.danger + "40" : COLORS.border}`, background: propValues.variant === "destructive" ? COLORS.danger + "10" : COLORS.surface, minWidth: 280 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: propValues.variant === "destructive" ? COLORS.danger : COLORS.text, marginBottom: 4 }}>⚠ {propValues.title || "Heads up!"}</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{propValues.description || "You can add components to your app using the CLI."}</div>
      </div>
    );
  }

  // --- ScrollArea ---
  if (name === "ScrollArea") {
    return (
      <div style={{ width: 200, height: 150, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", position: "relative" }}>
        <div style={{ padding: 12, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
          {Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`).map((t, i) => <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${COLORS.border}` }}>{t}</div>)}
        </div>
        <div style={{ position: "absolute", right: 2, top: 8, width: 6, height: 60, borderRadius: 3, background: COLORS.surface3 }} />
      </div>
    );
  }

  // --- Collapsible ---
  if (name === "Collapsible") {
    return (
      <div style={{ width: 260, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>@peduarte starred 3 repositories</span>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>▾</span>
        </div>
        {["@radix-ui/primitives", "@radix-ui/colors", "@stitches/react"].map(r => (
          <div key={r} style={{ padding: "6px 10px", background: COLORS.surface2, borderRadius: 6, marginBottom: 4, fontSize: 12, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{r}</div>
        ))}
      </div>
    );
  }

  // --- Command ---
  if (name === "Command") {
    return (
      <div style={{ width: 280, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: COLORS.textDim }}>🔍</span>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Type a command...</span>
        </div>
        <div style={{ padding: "6px 0" }}>
          <div style={{ padding: "4px 12px", fontSize: 10, color: COLORS.textDim, fontWeight: 600, textTransform: "uppercase" }}>Suggestions</div>
          {["Calendar", "Search Emoji", "Calculator"].map(item => (
            <div key={item} style={{ padding: "6px 12px", fontSize: 13, color: COLORS.text, cursor: "pointer" }}>{item}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- Calendar ---
  if (name === "Calendar") {
    const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, width: 260 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>◂</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>January 2026</span>
          <span style={{ color: COLORS.textMuted, cursor: "pointer" }}>▸</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
          {days.map(d => <div key={d} style={{ fontSize: 10, color: COLORS.textDim, padding: 4, fontWeight: 600 }}>{d}</div>)}
          {Array.from({ length: 31 }, (_, i) => (
            <div key={i} style={{ fontSize: 12, padding: 4, borderRadius: 4, color: i === 14 ? "#fff" : COLORS.text, background: i === 14 ? COLORS.accent : "transparent", cursor: "pointer" }}>{i + 1}</div>
          ))}
        </div>
      </div>
    );
  }

  // --- Table ---
  if (name === "Table") {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 280 }}>
        <thead><tr>
          {["Invoice", "Status", "Amount"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${COLORS.border2}`, color: COLORS.textMuted, fontWeight: 600, fontSize: 11 }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {[["INV001", "Paid", "$250.00"], ["INV002", "Pending", "$150.00"], ["INV003", "Unpaid", "$350.00"]].map(([inv, st, amt], i) => (
            <tr key={i}><td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>{inv}</td>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}` }}><span style={{ padding: "2px 6px", borderRadius: 10, fontSize: 10, background: st === "Paid" ? `${COLORS.success}20` : st === "Pending" ? `${COLORS.warning}20` : `${COLORS.danger}20`, color: st === "Paid" ? COLORS.success : st === "Pending" ? COLORS.warning : COLORS.danger }}>{st}</span></td>
            <td style={{ padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, textAlign: "right" }}>{amt}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  // --- HoverCard ---
  if (name === "HoverCard") {
    return (
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, minWidth: 240, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${COLORS.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: COLORS.accent, flexShrink: 0 }}>@</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>@nextjs</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>The React Framework — created and maintained by @vercel.</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6 }}>Joined December 2021</div>
          </div>
        </div>
      </div>
    );
  }

  // --- Fallback for all other components ---
  const styles = styleFn ? styleFn(propValues) : { base: { padding: "6px 14px", borderRadius: 6, background: COLORS.surface3, color: COLORS.text, fontSize: 13, fontFamily: "'Inter', sans-serif", display: "inline-flex" } };
  const content = slotContent?.children || comp.name;
  return (
    <div style={styles.base}>
      {propValues.loading && <span style={{ marginRight: 4 }}>⏳</span>}
      {content}
    </div>
  );
}

// Components with dedicated mock renderers
const SUPPORTED_PREVIEW_COMPONENTS = new Set([
  "Accordion", "Alert", "AlertDialog", "Avatar", "Badge", "Breadcrumb", "Button",
  "Calendar", "Card", "Checkbox", "Collapsible", "Command", "ContextMenu", "DataTable",
  "Dialog", "DropdownMenu", "HoverCard", "Input", "NavigationMenu", "Pagination",
  "Popover", "Progress", "RadioGroup", "ScrollArea", "Select", "Separator", "Sheet",
  "Skeleton", "Slider", "Sonner", "Switch", "Table", "Tabs", "Textarea", "Toast", "Tooltip",
]);

function ComponentPreview({ registry }) {
  const [selectedComp, setSelectedComp] = useState(null);
  const [activeVariant, setActiveVariant] = useState(null);
  const [customProps, setCustomProps] = useState({});

  const componentNames = Object.keys(registry.components || {});

  useEffect(() => {
    if (!selectedComp && componentNames.length > 0) {
      const first = componentNames.find(n => SUPPORTED_PREVIEW_COMPONENTS.has(n)) || componentNames[0];
      setSelectedComp(first);
    }
  }, [componentNames]);

  useEffect(() => {
    setActiveVariant(null);
    setCustomProps({});
  }, [selectedComp]);

  const comp = selectedComp ? registry.components[selectedComp] : null;
  const isSupported = selectedComp ? SUPPORTED_PREVIEW_COMPONENTS.has(selectedComp) : false;

  const resolvedProps = useMemo(() => {
    if (!comp) return {};
    const base = {};
    Object.entries(comp.props || {}).forEach(([key, def]) => {
      if (def.default !== undefined) base[key] = def.default;
    });
    if (activeVariant !== null && comp.variants?.[activeVariant]) {
      Object.assign(base, comp.variants[activeVariant].props);
    }
    Object.assign(base, customProps);
    return base;
  }, [comp, activeVariant, customProps]);

  const resolvedSlots = useMemo(() => {
    if (!comp) return {};
    const ex = comp.examples?.[0];
    return ex?.slots || {};
  }, [comp]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Component Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Renderização dos componentes do UI Registry</p>
      </div>

      {componentNames.length === 0 ? (
        <EmptyState message="Nenhum componente no registry" />
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Component list */}
          <div style={{ width: 160, flexShrink: 0 }}>
            {componentNames.map(name => {
              const supported = SUPPORTED_PREVIEW_COMPONENTS.has(name);
              return (
                <div key={name}
                  onClick={supported ? () => setSelectedComp(name) : undefined}
                  style={{
                    padding: "8px 10px", marginBottom: 2, borderRadius: 6,
                    cursor: supported ? "pointer" : "not-allowed",
                    opacity: supported ? 1 : 0.4,
                    background: selectedComp === name ? COLORS.surface3 : "transparent",
                    border: selectedComp === name ? `1px solid ${COLORS.border2}` : "1px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 13, color: selectedComp === name ? COLORS.text : supported ? COLORS.textMuted : COLORS.textDim, fontWeight: selectedComp === name ? 600 : 400 }}>{name}</span>
                  <div style={{ fontSize: 10, color: COLORS.textDim }}>{registry.components[name].category}{!supported ? " · sem preview" : ""}</div>
                </div>
              );
            })}
          </div>

          {/* Preview area */}
          {comp && isSupported && (
            <div style={{ flex: 1 }}>
              {/* Render preview */}
              <div style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 32,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 100,
              }}>
                <MockComponent comp={comp} compName={selectedComp} propValues={resolvedProps} slotContent={resolvedSlots} />
              </div>

              {/* Variants */}
              {comp.variants && comp.variants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Variants</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <button onClick={() => setActiveVariant(null)} style={{ ...s.btnSmall, background: activeVariant === null ? COLORS.accent : COLORS.surface3, color: activeVariant === null ? "#fff" : COLORS.textMuted }}>default</button>
                    {comp.variants.map((v, i) => (
                      <button key={i} onClick={() => setActiveVariant(i)} style={{ ...s.btnSmall, background: activeVariant === i ? COLORS.accent : COLORS.surface3, color: activeVariant === i ? "#fff" : COLORS.textMuted }}>
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All variants grid */}
              {comp.variants && comp.variants.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Todas as variantes</div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150, 1fr))",
                    gap: 8,
                  }}>
                    {comp.variants.map((v, i) => {
                      const vProps = { ...Object.fromEntries(Object.entries(comp.props || {}).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default])), ...v.props };
                      return (
                        <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
                          <div style={{ marginBottom: 8 }}>
                            <MockComponent comp={comp} compName={selectedComp} propValues={vProps} slotContent={resolvedSlots} />
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{v.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Prop playground */}
              <div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Playground</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(comp.props || {}).map(([key, def]) => {
                    if (def.type === "function" || def.type === "ReactNode") return null;
                    const val = customProps[key] ?? resolvedProps[key] ?? "";
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", minWidth: 80 }}>{key}</label>
                        {def.type === "boolean" ? (
                          <input type="checkbox" checked={!!val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: e.target.checked }))} />
                        ) : def.type === "enum" ? (
                          <select value={val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: e.target.value }))} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
                            {(def.enumValues || []).map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input value={val} onChange={(e) => setCustomProps(p => ({ ...p, [key]: def.type === "number" ? Number(e.target.value) : e.target.value }))} style={{ ...s.input, fontSize: 11, padding: "3px 6px" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Examples */}
              {comp.examples && comp.examples.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Examples</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {comp.examples.map((ex, i) => {
                      const exProps = { ...Object.fromEntries(Object.entries(comp.props || {}).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default])), ...ex.props };
                      return (
                        <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
                          <div style={{ marginBottom: 6 }}>
                            <MockComponent comp={comp} compName={selectedComp} propValues={exProps} slotContent={ex.slots || {}} />
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim }}>{ex.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Preview Panel (combines Layout + Component preview)
// ============================================================================
function TypographyPreview({ layout }) {
  const tokens = layout.tokens;
  const textStyles = layout.textStyles || {};

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Typography Preview</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Todos os text styles renderizados com tokens reais</p>
      </div>

      {/* Type scale overview */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Escala tipográfica</div>
        {Object.entries(tokens.fontSizes || {}).sort((a, b) => a[1].value - b[1].value).map(([key, tok]) => {
          const fam = tokens.fontFamilies?.primary;
          const famStr = fam ? `'${fam.family}', ${fam.fallbacks.join(", ")}` : "sans-serif";
          return (
            <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <span style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 40, textAlign: "right" }}>{key}</span>
              <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", minWidth: 50 }}>{tok.value}{tok.unit}</span>
              <span style={{ fontSize: `${tok.value}${tok.unit}`, fontFamily: famStr, color: COLORS.text, lineHeight: 1.3 }}>The quick brown fox</span>
            </div>
          );
        })}
      </div>

      {/* Text styles rendered */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Text Styles</div>
        {Object.entries(textStyles).map(([key, style]) => {
          const css = resolveTextStyleCSS(style, tokens);
          return (
            <div key={key} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{key}</span>
                {style.description && <span style={{ fontSize: 11, color: COLORS.textDim }}>— {style.description}</span>}
              </div>
              <div style={{ ...css, color: COLORS.text, marginBottom: 8 }}>
                The quick brown fox jumps over the lazy dog. 0123456789
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {style.fontFamily && <span style={s.tag}>{style.fontFamily.split(".").pop()}</span>}
                {style.fontSize && <span style={s.tag}>{style.fontSize.split(".").pop()}</span>}
                {style.fontWeight && <span style={s.tag}>{style.fontWeight.split(".").pop()}</span>}
                {style.lineHeight && <span style={s.tag}>lh: {style.lineHeight.split(".").pop()}</span>}
                {style.letterSpacing && <span style={s.tag}>ls: {style.letterSpacing.split(".").pop()}</span>}
              </div>
            </div>
          );
        })}
        {Object.keys(textStyles).length === 0 && <EmptyState message="Nenhum text style definido" />}
      </div>

      {/* Simulated page */}
      <div style={{ ...s.card }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Simulação de página</div>
        <div style={{ background: COLORS.surface2, borderRadius: 8, padding: 24 }}>
          {textStyles["heading-1"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-1"], tokens), color: COLORS.text, marginBottom: 8 }}>Dashboard Overview</div>
          )}
          {textStyles["heading-2"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-2"], tokens), color: COLORS.text, marginBottom: 12 }}>Métricas do sistema</div>
          )}
          {textStyles.body && (
            <div style={{ ...resolveTextStyleCSS(textStyles.body, tokens), color: COLORS.textMuted, marginBottom: 16 }}>
              Este painel mostra as métricas principais do sistema de validação. Todos os dados são atualizados em tempo real e refletem o estado atual dos validators ativos.
            </div>
          )}
          {textStyles["heading-3"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["heading-3"], tokens), color: COLORS.text, marginBottom: 8 }}>Validators ativos</div>
          )}
          {textStyles["body-sm"] && (
            <div style={{ ...resolveTextStyleCSS(textStyles["body-sm"], tokens), color: COLORS.textMuted, marginBottom: 12 }}>
              24 validators em 6 gates • Última execução: há 2 minutos
            </div>
          )}
          {textStyles.caption && (
            <div style={{ ...resolveTextStyleCSS(textStyles.caption, tokens), color: COLORS.textDim, marginBottom: 8, textTransform: "uppercase" }}>
              Status: operacional
            </div>
          )}
          {textStyles.code && (
            <div style={{ ...resolveTextStyleCSS(textStyles.code, tokens), color: COLORS.accent, background: COLORS.surface, padding: 12, borderRadius: 6 }}>
              TestFailsBeforeImplementation: PASSED (120ms)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ layout, registry }) {
  const [previewTab, setPreviewTab] = useState("layout");
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>Live Preview</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Visualize o que os contratos descrevem antes de exportar</p>
      </div>
      <TabBar
        tabs={[{ id: "layout", label: "Layout" }, { id: "typography", label: "Typography" }, { id: "components", label: "Components" }]}
        active={previewTab}
        onChange={setPreviewTab}
      />
      {previewTab === "layout" && <LayoutPreview layout={layout} />}
      {previewTab === "typography" && <TypographyPreview layout={layout} />}
      {previewTab === "components" && <ComponentPreview registry={registry} />}
    </div>
  );
}

// ============================================================================
// Export Panel
// ============================================================================
function ExportPanel({ layout, registry }) {
  const [version, setVersion] = useState("1.0.0");
  const [exported, setExported] = useState(null);
  const [activeExport, setActiveExport] = useState("layout");

  const doExport = async (type) => {
    const data = type === "layout" ? { ...layout } : { ...registry };
    const hash = await computeHash(data);
    const contract = {
      $orqui: { schema: type === "layout" ? "layout-contract" : "ui-registry-contract", version, hash, generatedAt: new Date().toISOString() },
      ...data,
    };
    setExported({ type, contract, json: JSON.stringify(contract, null, 2) });
  };

  const download = () => {
    if (!exported) return;
    const blob = new Blob([exported.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exported.type === "layout" ? "layout-contract" : "ui-registry-contract"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!exported) return;
    navigator.clipboard.writeText(exported.json);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>Export Contracts</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Gere contratos versionados com hash canônico</p>
      </div>

      <Field label="Version (semver)">
        <input value={version} onChange={(e) => setVersion(e.target.value)} style={{ ...s.input, width: 150 }} placeholder="1.0.0" />
      </Field>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setActiveExport("layout"); doExport("layout"); }} style={{ ...s.btn, background: activeExport === "layout" ? COLORS.accent : COLORS.surface3 }}>Export Layout Contract</button>
        <button onClick={() => { setActiveExport("registry"); doExport("registry"); }} style={{ ...s.btn, background: activeExport === "registry" ? COLORS.accent : COLORS.surface3 }}>Export UI Registry Contract</button>
      </div>

      {exported && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={s.tag}>{exported.contract.$orqui.schema}</span>
            <span style={s.tag}>v{exported.contract.$orqui.version}</span>
            <span style={{ ...s.tag, fontFamily: "monospace", fontSize: 10 }}>{exported.contract.$orqui.hash.slice(0, 28)}…</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={download} style={s.btn}>⬇ Download</button>
            <button onClick={copyToClipboard} style={s.btnGhost}>📋 Copiar JSON</button>
          </div>
          <pre style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {exported.json}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Import Panel
// ============================================================================
function ImportPanel({ onImportLayout, onImportRegistry }) {
  const [json, setJson] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const doImport = () => {
    setError(null);
    setSuccess(null);
    try {
      const data = JSON.parse(json);
      if (data.$orqui?.schema === "layout-contract") {
        const { $orqui, ...rest } = data;
        onImportLayout(rest);
        setSuccess("Layout Contract importado!");
      } else if (data.$orqui?.schema === "ui-registry-contract") {
        const { $orqui, ...rest } = data;
        onImportRegistry(rest);
        setSuccess("UI Registry Contract importado!");
      } else {
        setError("JSON não é um contrato Orqui válido (campo $orqui.schema não encontrado)");
      }
    } catch (e) {
      setError("JSON inválido: " + e.message);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Section title="Import Contract" defaultOpen={false}>
        <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 0, marginBottom: 8 }}>Cole um contrato Orqui existente para editar</p>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="Cole o JSON do contrato aqui..." style={{ ...s.input, height: 120, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={doImport} style={s.btn}>Import</button>
          {error && <span style={{ fontSize: 12, color: COLORS.danger }}>{error}</span>}
          {success && <span style={{ fontSize: 12, color: COLORS.success }}>{success}</span>}
        </div>
      </Section>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================
// Persistence: IndexedDB for auto-save, API for filesystem save
// ============================================================================
const DB_NAME = "orqui-editor";
const DB_VERSION = 1;
const STORE_NAME = "contracts";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

async function idbSet(key: string, value: any) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

async function apiLoadContracts() {
  try {
    const res = await fetch("/__orqui/api/contracts");
    if (!res.ok) return null;
    const data = await res.json();
    return data.contracts || null;
  } catch { return null; }
}

async function apiSaveContract(contract: any) {
  const type = contract.$orqui?.schema;
  if (!type) return { ok: false, error: "missing $orqui.schema" };
  try {
    const res = await fetch(`/__orqui/api/contract/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================================================
export function OrquiEditor() {
  const [activeTab, setActiveTab] = useState("layout");
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  // Normalize registry: ensure every component has name field matching its key
  const normalizeRegistry = useCallback((reg: any) => {
    if (!reg?.components) return reg;
    const normalized = { ...reg, components: { ...reg.components } };
    Object.keys(normalized.components).forEach(key => {
      if (!normalized.components[key].name || normalized.components[key].name !== key) {
        normalized.components[key] = { ...normalized.components[key], name: key };
      }
    });
    return normalized;
  }, []);

  const [registry, setRegistryRaw] = useState(() => normalizeRegistry(DEFAULT_UI_REGISTRY));
  const setRegistry = useCallback((r: any) => setRegistryRaw(normalizeRegistry(r)), [normalizeRegistry]);
  const [hasApi, setHasApi] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("preview");

  // Load: try API first (filesystem), then IndexedDB (draft), then defaults
  useEffect(() => {
    (async () => {
      const apiContracts = await apiLoadContracts();
      if (apiContracts) {
        setHasApi(true);
        if (apiContracts["layout-contract"]) {
          const { $orqui, ...data } = apiContracts["layout-contract"];
          setLayout(data);
        }
        if (apiContracts["ui-registry-contract"]) {
          const { $orqui, ...data } = apiContracts["ui-registry-contract"];
          setRegistry(data);
        }
        return;
      }
      // Fallback to IndexedDB
      const l = await idbGet("orqui-layout");
      if (l) setLayout(l);
      const r = await idbGet("orqui-registry");
      if (r) setRegistry(r);
    })();
  }, []);

  // Auto-save to IndexedDB on every change (draft persistence)
  useEffect(() => { idbSet("orqui-layout", layout); }, [layout]);
  useEffect(() => { idbSet("orqui-registry", registry); }, [registry]);

  // Save to filesystem via API
  const saveToFilesystem = useCallback(async () => {
    if (!hasApi) return;
    setSaveStatus("saving");
    const layoutHash = await computeHash(layout);
    const layoutContract = {
      $orqui: { schema: "layout-contract", version: "1.0.0", hash: layoutHash, generatedAt: new Date().toISOString() },
      ...layout,
    };
    const registryHash = await computeHash(registry);
    const registryContract = {
      $orqui: { schema: "ui-registry-contract", version: "1.0.0", hash: registryHash, generatedAt: new Date().toISOString() },
      ...registry,
    };
    const r1 = await apiSaveContract(layoutContract);
    const r2 = await apiSaveContract(registryContract);
    setSaveStatus(r1.ok && r2.ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [layout, registry, hasApi]);

  const mainTabs = [
    { id: "layout", label: "Layout" },
    { id: "registry", label: "Registry" },
    { id: "export", label: "Export" },
  ];

  const sidebarTabs = [
    { id: "preview", label: "Preview" },
    { id: "import", label: "Import" },
  ];

  const SIDEBAR_WIDTH = 525;

  return (
    <div style={{ background: COLORS.bg, height: "100vh", color: COLORS.text, fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Inter and JetBrains Mono loaded as base editor fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "12px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: COLORS.accent }}>Orqui</span>
          <span style={{ fontSize: 12, color: COLORS.textDim }}>Contract Editor</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ ...s.tag, background: `${COLORS.success}15`, color: COLORS.success, border: `1px solid ${COLORS.success}30` }}>
            {Object.values(layout.structure.regions).filter((r) => r.enabled).length} regions
          </span>
          <span style={{ ...s.tag, background: `${COLORS.accent}15`, color: COLORS.accent, border: `1px solid ${COLORS.accent}30` }}>
            {Object.keys(registry.components).length} components
          </span>
          <span style={{ ...s.tag, fontSize: 10 }}>IndexedDB ✓</span>
          {hasApi && (
            <button onClick={saveToFilesystem} disabled={saveStatus === "saving"} style={{
              ...s.btn,
              fontSize: 12,
              padding: "6px 12px",
              background: saveStatus === "saved" ? COLORS.success : saveStatus === "error" ? COLORS.danger : COLORS.accent,
              opacity: saveStatus === "saving" ? 0.6 : 1,
            }}>
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "✕ Error" : "Save to Project"}
            </button>
          )}
        </div>
      </div>

      {/* Body: Main + Sidebar */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>

        {/* Main content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          padding: 24,
          marginLeft: sidebarOpen ? SIDEBAR_WIDTH : 0,
          transition: "margin-left 0.25s ease",
        }}>
          <TabBar tabs={mainTabs} active={activeTab} onChange={setActiveTab} />

          {activeTab === "layout" && <LayoutEditor layout={layout} onChange={setLayout} />}
          {activeTab === "registry" && <UIRegistryEditor registry={registry} onChange={setRegistry} />}
          {activeTab === "export" && <ExportPanel layout={layout} registry={registry} />}
        </div>

        {/* Collapse toggle — centered vertically on the divider line */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: "absolute",
            left: sidebarOpen ? SIDEBAR_WIDTH - 1 : -1,
            top: "50%",
            transform: "translateY(-50%)",
            width: 20,
            height: 48,
            background: COLORS.surface2,
            border: `1px solid ${COLORS.border}`,
            borderRadius: sidebarOpen ? "0 6px 6px 0" : "6px 0 0 6px",
            color: COLORS.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            zIndex: 20,
            transition: "left 0.25s ease",
            padding: 0,
          }}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? "◂" : "▸"}
        </button>

        {/* Left sidebar */}
        <div style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          background: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          transform: sidebarOpen ? "translateX(0)" : `translateX(-${SIDEBAR_WIDTH}px)`,
          transition: "transform 0.25s ease",
          zIndex: 10,
        }}>
          {/* Sidebar tabs */}
          <div style={{ padding: "12px 16px 0 16px", flexShrink: 0 }}>
            <TabBar tabs={sidebarTabs} active={sidebarTab} onChange={setSidebarTab} />
          </div>

          {/* Sidebar content */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 16 }}>
            {sidebarTab === "preview" && <PreviewPanel layout={layout} registry={registry} />}
            {sidebarTab === "import" && <ImportPanel onImportLayout={setLayout} onImportRegistry={setRegistry} />}
          </div>
        </div>

      </div>
    </div>
  );
}
