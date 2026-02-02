import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

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
      showHome: true,
      homeLabel: "Home",
      homeRoute: "/",
    },
    logo: {
      type: "text",
      text: "App",
      icon: "⬡",
      iconUrl: "",
      iconSize: 20,
      imageUrl: "",
      position: "sidebar",
      headerSlot: "left",
      sidebarAlign: "left",
      alignWithHeader: true,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      iconGap: 8,
      typography: { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 },
    },
    favicon: {
      type: "none" as const,
      url: "",
      emoji: "⬡",
    },
    headerElements: {
      search: { enabled: false, placeholder: "Buscar...", showIcon: true, icon: "ph:magnifying-glass" },
      cta: { enabled: false, label: "Novo", variant: "default" },
      ctas: [],
      icons: { enabled: true, items: [{ id: "bell", route: "/notifications" }, { id: "settings", route: "/settings" }] },
      order: ["search", "icons", "ctas"],
    },
    tableSeparator: {
      color: "$tokens.colors.border",
      width: "1px",
      style: "solid",
      headerColor: "",
      headerWidth: "2px",
      headerStyle: "solid",
    },
    pages: {},
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
    colors: {
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
    borderRadius: {
      none: { value: 0, unit: "px" },
      sm: { value: 4, unit: "px" },
      md: { value: 6, unit: "px" },
      lg: { value: 8, unit: "px" },
      xl: { value: 12, unit: "px" },
      full: { value: 9999, unit: "px" },
    },
    borderWidth: {
      thin: { value: 1, unit: "px" },
      medium: { value: 2, unit: "px" },
      thick: { value: 3, unit: "px" },
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

  // Listen for force-open events from Command Palette
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail === key || e.detail === `wb-${key}`) {
        setValue(true);
        try { localStorage.setItem(`orqui-accordion-${key}`, "true"); } catch {}
      }
    };
    window.addEventListener("orqui:open-accordion" as any, handler);
    return () => window.removeEventListener("orqui:open-accordion" as any, handler);
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
// Wireframe B — Collapsible outer sections with colored dot and tag
// ============================================================================
function WBSection({ title, dotColor, tag, children, defaultOpen = false, id }: { title: string; dotColor: string; tag?: string; children: any; defaultOpen?: boolean; id?: string }) {
  const [open, setOpen] = usePersistentState(`wb-${id || title}`, defaultOpen);
  return (
    <div id={id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none" as const,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{title}</span>
          {tag && (
            <span style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              background: dotColor + "15", color: dotColor,
            }}>{tag}</span>
          )}
        </div>
        <span style={{
          fontSize: 16, color: COLORS.textDim, lineHeight: "1",
          transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none",
        }}>⌄</span>
      </div>
      {open && <div style={{ padding: "0 24px 20px" }}>{children}</div>}
    </div>
  );
}

// Wireframe B subsection divider
function WBSub({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 10,
        textTransform: "uppercase" as const, letterSpacing: "0.04em",
      }}>{title}</div>
      {children}
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
          { id: "borderRadius", label: `Radius (${Object.keys(tokens.borderRadius || {}).length})` },
          { id: "borderWidth", label: `Border W (${Object.keys(tokens.borderWidth || {}).length})` },
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
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, background: COLORS.surface2, borderRadius: 6, flexWrap: "wrap" }}>
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
          <Field label="Extensão" style={{ width: 100 }}>
            <select value={separator.extend || "full"} onChange={(e) => update("extend", e.target.value)} style={{ ...s.select, fontSize: 11, padding: "3px 6px" }}>
              <option value="full">Total</option>
              <option value="inset">Com margem</option>
              <option value="none">Nenhuma</option>
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
function BreadcrumbEditor({ breadcrumbs, tokens, onChange }) {
  const bc = breadcrumbs || { enabled: false, position: "header", alignment: "left", separator: "/", clickable: true, showHome: true, homeLabel: "Home", homeRoute: "/" };
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

          <Row gap={12}>
            <Field label="Mostrar Home" style={{ flex: 0 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={bc.showHome !== false} onChange={(e) => update("showHome", e.target.checked)} />
                Exibir
              </label>
            </Field>
            {bc.showHome !== false && (
              <>
                <Field label="Label Home" style={{ flex: 1 }}>
                  <input value={bc.homeLabel || "Home"} onChange={(e) => update("homeLabel", e.target.value)} style={s.input} />
                </Field>
                <Field label="Rota Home" style={{ flex: 1 }}>
                  <input value={bc.homeRoute || "/"} onChange={(e) => update("homeRoute", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} />
                </Field>
              </>
            )}
          </Row>

          {/* Typography */}
          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipografia</div>
          <Row gap={12}>
            <Field label="Font Size" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontSize} category="fontSizes" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontSize: v } })} />
            </Field>
            <Field label="Font Weight" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontWeight} category="fontWeights" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontWeight: v } })} />
            </Field>
            <Field label="Font Family" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.fontFamily} category="fontFamilies" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, fontFamily: v } })} />
            </Field>
          </Row>
          <Row gap={12}>
            <Field label="Color (links)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.color} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, color: v } })} />
            </Field>
            <Field label="Color (ativo)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.activeColor} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, activeColor: v } })} />
            </Field>
            <Field label="Weight (ativo)" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.activeFontWeight} category="fontWeights" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, activeFontWeight: v } })} />
            </Field>
          </Row>
          <Row gap={12}>
            <Field label="Cor separador" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.typography?.separatorColor} category="colors" onChange={(v) => onChange({ ...bc, typography: { ...bc.typography, separatorColor: v } })} />
            </Field>
          </Row>

          {/* Padding */}
          <div style={{ marginTop: 12, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Padding</div>
          <Row gap={12}>
            <Field label="Top" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.top} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, top: v } })} />
            </Field>
            <Field label="Right" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.right} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, right: v } })} />
            </Field>
            <Field label="Bottom" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.bottom} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, bottom: v } })} />
            </Field>
            <Field label="Left" style={{ flex: 1 }}>
              <TokenRefSelect tokens={tokens} value={bc.padding?.left} category="spacing" onChange={(v) => onChange({ ...bc, padding: { ...bc.padding, left: v } })} />
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
// Sidebar Config Editor (icons, collapse, separators, typography, nav items)
// ============================================================================
function SidebarConfigEditor({ region, tokens, onChange }) {
  const nav = region.navigation || { icons: { enabled: true, size: "$tokens.sizing.icon-md", gap: "$tokens.spacing.sm" } };
  const navTypo = nav.typography || {};
  const behavior = region.behavior || {};
  const cb = region.collapseButton || { icon: "chevron", position: "header-end" };
  const seps = region.separators || {};
  const navItemsRaw = nav.items || [];
  // Ensure every item has an id (legacy migration)
  const navItems = navItemsRaw.map((item, i) => item.id ? item : { ...item, id: `nav-legacy-${i}` });
  if (navItemsRaw.some((item, i) => !item.id)) {
    // Auto-persist ids once
    setTimeout(() => updateNavItems(navItems), 0);
  }
  const navGroups = nav.groups || [];

  const updateNav = (field, val) => onChange({ ...region, navigation: { ...nav, icons: { ...nav.icons, [field]: val } } });
  const updateNavTypo = (field, val) => onChange({ ...region, navigation: { ...nav, typography: { ...navTypo, [field]: val } } });
  const updateNavItems = (items) => onChange({ ...region, navigation: { ...nav, items } });
  const updateNavGroups = (groups) => onChange({ ...region, navigation: { ...nav, groups } });
  const updateBehavior = (field, val) => onChange({ ...region, behavior: { ...behavior, [field]: val } });
  const updateCB = (field, val) => onChange({ ...region, collapseButton: { ...cb, [field]: val } });
  const updateSep = (name, val) => onChange({ ...region, separators: { ...seps, [name]: val } });

  // Nav item CRUD
  const addNavItem = () => {
    const id = `nav-${Date.now()}`;
    updateNavItems([...navItems, { id, icon: "ph:house", label: "Novo item", route: "/" }]);
  };
  const removeNavItem = (id) => updateNavItems(navItems.filter(i => i.id !== id));
  const updateNavItem = (id, field, val) => updateNavItems(navItems.map(i => i.id === id ? { ...i, [field]: val } : i));
  const moveNavItem = (idx, dir) => {
    const arr = [...navItems];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    updateNavItems(arr);
  };
  // Sub-items
  const addSubItem = (parentId) => {
    const subId = `sub-${Date.now()}`;
    updateNavItems(navItems.map(i => i.id === parentId ? { ...i, children: [...(i.children || []), { id: subId, label: "Sub-item", route: "" }] } : i));
  };
  const removeSubItem = (parentId, subId) => {
    updateNavItems(navItems.map(i => i.id === parentId ? { ...i, children: (i.children || []).filter(c => c.id !== subId) } : i));
  };
  const updateSubItem = (parentId, subId, field, val) => {
    updateNavItems(navItems.map(i => i.id === parentId ? {
      ...i, children: (i.children || []).map(c => c.id === subId ? { ...c, [field]: val } : c),
    } : i));
  };
  // Groups
  const addGroup = () => {
    const id = `grp-${Date.now()}`;
    updateNavGroups([...navGroups, { id, label: "Novo Grupo", collapsible: false }]);
  };
  const removeGroup = (id) => {
    updateNavGroups(navGroups.filter(g => g.id !== id));
    // Ungroup items that were in this group
    updateNavItems(navItems.map(i => i.group === id ? { ...i, group: undefined } : i));
  };
  const updateGroup = (id, field, val) => updateNavGroups(navGroups.map(g => g.id === id ? { ...g, [field]: val } : g));
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <div>
      {/* Navigation Typography */}
      <div style={{ marginTop: 16, marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation Typography</div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        <Row gap={8}>
          <Field label="Font Size" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontSize || ""} tokens={tokens} category="fontSizes" onChange={(v) => updateNavTypo("fontSize", v)} />
          </Field>
          <Field label="Font Weight" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("fontWeight", v)} />
          </Field>
        </Row>
        <Row gap={8}>
          <Field label="Color" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.color || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("color", v)} />
          </Field>
          <Field label="Font Family" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.fontFamily || ""} tokens={tokens} category="fontFamilies" onChange={(v) => updateNavTypo("fontFamily", v)} />
          </Field>
        </Row>
        <Row gap={8}>
          <Field label="Letter Spacing" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.letterSpacing || ""} tokens={tokens} category="letterSpacings" onChange={(v) => updateNavTypo("letterSpacing", v)} />
          </Field>
          <Field label="Line Height" style={{ flex: 1 }}>
            <TokenRefSelect value={navTypo.lineHeight || ""} tokens={tokens} category="lineHeights" onChange={(v) => updateNavTypo("lineHeight", v)} />
          </Field>
        </Row>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Nav Item Card</div>
          <Row gap={8}>
            <Field label="Card enabled" style={{ flex: 0, minWidth: 90 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                <input type="checkbox" checked={navTypo.cardEnabled ?? false} onChange={(e) => updateNavTypo("cardEnabled", e.target.checked)} />
                Ativo
              </label>
            </Field>
            <Field label="Border Radius" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.cardBorderRadius || ""} tokens={tokens} category="borderRadius" onChange={(v) => updateNavTypo("cardBorderRadius", v)} />
            </Field>
            <Field label="Padding" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.cardPadding || ""} tokens={tokens} category="spacing" onChange={(v) => updateNavTypo("cardPadding", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <>
              <Row gap={8}>
                <Field label="Background" style={{ flex: 1 }}>
                  <TokenRefSelect value={navTypo.cardBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("cardBackground", v)} />
                </Field>
                <Field label="Border" style={{ flex: 1 }}>
                  <TokenRefSelect value={navTypo.cardBorderColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("cardBorderColor", v)} />
                </Field>
                <Field label="Border Width" style={{ flex: 1 }}>
                  <select value={navTypo.cardBorderWidth || "0"} onChange={(e) => updateNavTypo("cardBorderWidth", e.target.value)} style={s.select}>
                    <option value="0">Nenhum</option>
                    <option value="1">1px</option>
                    <option value="2">2px</option>
                  </select>
                </Field>
              </Row>
            </>
          )}
        </div>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Active Item</div>
          <Row gap={8}>
            <Field label="Color" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeColor", v)} />
            </Field>
            <Field label="Weight" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeFontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("activeFontWeight", v)} />
            </Field>
            <Field label="Background" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.activeBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeBackground", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <Row gap={8}>
              <Field label="Card Border (active)" style={{ flex: 1 }}>
                <TokenRefSelect value={navTypo.activeCardBorder || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("activeCardBorder", v)} />
              </Field>
            </Row>
          )}
        </div>
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Hover</div>
          <Row gap={8}>
            <Field label="Color" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverColor || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverColor", v)} />
            </Field>
            <Field label="Weight" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverFontWeight || ""} tokens={tokens} category="fontWeights" onChange={(v) => updateNavTypo("hoverFontWeight", v)} />
            </Field>
            <Field label="Background" style={{ flex: 1 }}>
              <TokenRefSelect value={navTypo.hoverBackground || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverBackground", v)} />
            </Field>
          </Row>
          {navTypo.cardEnabled && (
            <Row gap={8}>
              <Field label="Card Border (hover)" style={{ flex: 1 }}>
                <TokenRefSelect value={navTypo.hoverCardBorder || ""} tokens={tokens} category="colors" onChange={(v) => updateNavTypo("hoverCardBorder", v)} />
              </Field>
            </Row>
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation Icons</div>
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

      {/* Navigation Groups */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Grupos de Navegação
      </div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        {navGroups.length === 0 && (
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>Sem grupos — todos os itens ficam no nível raiz.</div>
        )}
        {navGroups.map(g => (
          <div key={g.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
            <input value={g.label} onChange={(e) => updateGroup(g.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 12 }} placeholder="Nome do grupo" />
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={g.collapsible ?? false} onChange={(e) => updateGroup(g.id, "collapsible", e.target.checked)} />
              Colapsável
            </label>
            <span style={{ fontSize: 9, color: COLORS.textDim, fontFamily: "monospace" }}>{g.id}</span>
            <button onClick={() => removeGroup(g.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.error }}>✕</button>
          </div>
        ))}
        <button onClick={addGroup} style={{ ...s.btnSmall, width: "100%", padding: "5px 0", marginTop: 4, fontSize: 11, color: COLORS.accent }}>
          + Adicionar grupo
        </button>
      </div>

      {/* Navigation Items */}
      <div style={{ marginBottom: 8, fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Itens de Navegação
        <span style={{ fontSize: 10, color: COLORS.accent, fontWeight: 400, textTransform: "none", marginLeft: 8 }}>
          fonte da verdade
        </span>
      </div>
      <div style={{ padding: 12, background: COLORS.surface2, borderRadius: 6, marginBottom: 12 }}>
        {navItems.map((item, idx) => {
          const isExpanded = expandedItem === item.id;
          const subItems = item.children || [];
          return (
            <div key={item.id || idx} style={{ marginBottom: 6, borderRadius: 6, border: `1px solid ${isExpanded ? COLORS.accent + "40" : COLORS.border}`, background: isExpanded ? COLORS.surface3 : "transparent" }}>
              {/* Main row */}
              <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "6px 8px" }}>
                {/* Reorder */}
                <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                  <button onClick={() => moveNavItem(idx, -1)} disabled={idx === 0} style={{ ...s.btnSmall, padding: "0 3px", fontSize: 8, opacity: idx === 0 ? 0.2 : 0.7, lineHeight: "12px" }}>▲</button>
                  <button onClick={() => moveNavItem(idx, 1)} disabled={idx === navItems.length - 1} style={{ ...s.btnSmall, padding: "0 3px", fontSize: 8, opacity: idx === navItems.length - 1 ? 0.2 : 0.7, lineHeight: "12px" }}>▼</button>
                </div>
                {/* Icon */}
                <PhosphorIconSelect value={item.icon || ""} allowEmpty placeholder="—" onChange={(val) => updateNavItem(item.id, "icon", val)} />
                {/* Label */}
                <input value={item.label || ""} onChange={(e) => updateNavItem(item.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 12 }} placeholder="Label" />
                {/* Route */}
                <input value={item.route || ""} onChange={(e) => updateNavItem(item.id, "route", e.target.value)} style={{ ...s.input, width: 80, fontSize: 11, fontFamily: "monospace" }} placeholder="/rota" />
                {/* Expand toggle */}
                <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.textDim }} title="Mais opções">
                  {isExpanded ? "▲" : "⋯"}
                </button>
                {/* Remove */}
                <button onClick={() => removeNavItem(item.id)} style={{ ...s.btnSmall, padding: "2px 6px", fontSize: 10, color: COLORS.error }} title="Remover">✕</button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ padding: "4px 8px 8px 32px", borderTop: `1px solid ${COLORS.border}` }}>
                  <Row gap={8}>
                    <Field label="Grupo" style={{ flex: 1 }}>
                      <select value={item.group || ""} onChange={(e) => updateNavItem(item.id, "group", e.target.value || undefined)} style={s.select}>
                        <option value="">— Sem grupo —</option>
                        {navGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Badge" style={{ width: 80 }}>
                      <input value={item.badge?.text || ""} onChange={(e) => updateNavItem(item.id, "badge", e.target.value ? { ...item.badge, text: e.target.value } : undefined)} style={{ ...s.input, fontSize: 11 }} placeholder="Ex: 3" />
                    </Field>
                    <Field label="" style={{ width: 60 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, cursor: "pointer", marginTop: 4 }}>
                        <input type="checkbox" checked={item.badge?.dot ?? false} onChange={(e) => updateNavItem(item.id, "badge", e.target.checked ? { ...item.badge, dot: true } : item.badge?.text ? { text: item.badge.text } : undefined)} />
                        Dot
                      </label>
                    </Field>
                    <Field label="" style={{ width: 60 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textDim, cursor: "pointer", marginTop: 4 }}>
                        <input type="checkbox" checked={item.disabled ?? false} onChange={(e) => updateNavItem(item.id, "disabled", e.target.checked || undefined)} />
                        Off
                      </label>
                    </Field>
                  </Row>
                  {/* Sub-items */}
                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Sub-itens</div>
                  {subItems.map((sub, si) => (
                    <div key={sub.id || si} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3, paddingLeft: 8 }}>
                      <span style={{ fontSize: 10, color: COLORS.textDim }}>↳</span>
                      <PhosphorIconSelect value={sub.icon || ""} allowEmpty placeholder="—" onChange={(val) => updateSubItem(item.id, sub.id, "icon", val)} />
                      <input value={sub.label || ""} onChange={(e) => updateSubItem(item.id, sub.id, "label", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="Sub-label" />
                      <input value={sub.route || ""} onChange={(e) => updateSubItem(item.id, sub.id, "route", e.target.value)} style={{ ...s.input, width: 80, fontSize: 10, fontFamily: "monospace" }} placeholder="/sub-rota" />
                      <button onClick={() => removeSubItem(item.id, sub.id)} style={{ ...s.btnSmall, padding: "1px 5px", fontSize: 9, color: COLORS.error }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addSubItem(item.id)} style={{ ...s.btnSmall, fontSize: 10, color: COLORS.accent, marginTop: 2, padding: "3px 8px" }}>
                    + Sub-item
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addNavItem} style={{ ...s.btnSmall, width: "100%", padding: "6px 0", marginTop: 4, fontSize: 11, color: COLORS.accent }}>
          + Adicionar item
        </button>
        <div style={{ marginTop: 8, fontSize: 10, color: COLORS.textDim }}>
          O Orqui é a fonte da verdade para navegação. Se o app passar <code style={{ color: COLORS.accent }}>sidebarNav</code> como prop, ela terá prioridade.
        </div>
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
                  <option value="edge-center">Borda fixa (centro vertical da viewport)</option>
                </select>
              </Field>
            </Row>
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
              {cb.position === "header-end" && "Botão posicionado ao lado do brand/header do sidebar"}
              {cb.position === "center" && "Botão centralizado entre a navegação e o footer"}
              {cb.position === "bottom" && "Botão posicionado na área do footer do sidebar"}
              {cb.position === "edge-center" && "Botão fixo na borda da sidebar, centralizado verticalmente abaixo do header. Sempre visível."}
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
            {name === "sidebar" && (
              <Field label="Min Width (collapsed)" style={{ flex: 1 }}>
                <TokenRefSelect value={region.dimensions?.minWidth} tokens={tokens} category="sizing" onChange={(v) => updateDim("minWidth", v)} />
              </Field>
            )}
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
                    separator={region.separators?.bottom || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...region.separators, bottom: v } })}
                  />
                </Field>
              )}
              {name === "footer" && (
                <Field label="Top separator">
                  <SeparatorEditor
                    separator={region.separators?.top || { enabled: true, color: "$tokens.colors.border", width: "$tokens.borderWidth.thin", style: "solid" }}
                    tokens={tokens}
                    onChange={(v) => onChange({ ...region, separators: { ...region.separators, top: v } })}
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
// Favicon Editor
// ============================================================================
function FaviconEditor({ favicon, onChange }) {
  const cfg = favicon || { type: "none", url: "", emoji: "⬡" };
  const update = (field, val) => onChange({ ...cfg, [field]: val });
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...cfg, url: reader.result, type: "image" });
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...cfg, url: reader.result, type: "image" });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Favicon</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Ícone exibido na aba do navegador</p>
      </div>

      {/* Preview */}
      <div style={{
        background: COLORS.surface2, borderRadius: 8, padding: "12px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 12, border: `1px solid ${COLORS.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, background: COLORS.surface3,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${COLORS.border}`,
        }}>
          {cfg.type === "image" && cfg.url ? (
            <img src={cfg.url} alt="Favicon" style={{ width: 16, height: 16, objectFit: "contain" }} />
          ) : cfg.type === "emoji" ? (
            <span style={{ fontSize: 16 }}>{cfg.emoji || "⬡"}</span>
          ) : (
            <span style={{ fontSize: 10, color: COLORS.textDim }}>—</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surface3, borderRadius: 4, padding: "4px 12px" }}>
          {cfg.type === "image" && cfg.url ? (
            <img src={cfg.url} alt="" style={{ width: 12, height: 12 }} />
          ) : cfg.type === "emoji" ? (
            <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
          ) : null}
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>Minha Aplicação</span>
          <span style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 8 }}>✕</span>
        </div>
        <span style={{ fontSize: 11, color: COLORS.textDim }}>← preview da tab</span>
      </div>

      <Field label="Tipo">
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "none", label: "Nenhum" },
            { id: "emoji", label: "Emoji" },
            { id: "image", label: "Imagem" },
          ].map(opt => (
            <button key={opt.id} onClick={() => update("type", opt.id)} style={{
              ...s.btnSmall,
              background: cfg.type === opt.id ? COLORS.accent : COLORS.surface3,
              color: cfg.type === opt.id ? "#fff" : COLORS.textMuted,
              padding: "6px 14px",
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>

      {cfg.type === "emoji" && (
        <Field label="Emoji">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <input value={cfg.emoji || ""} onChange={(e) => update("emoji", e.target.value)} style={{ ...s.input, width: 60, textAlign: "center", fontSize: 18 }} />
            <IconPicker value={cfg.emoji || ""} onSelect={(ic) => update("emoji", ic)} />
          </div>
        </Field>
      )}

      {cfg.type === "emoji" && cfg.emoji?.startsWith("ph:") && (
        <Field label="Cor do ícone">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="color" value={cfg.color || "#ffffff"} onChange={(e) => update("color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
            <input value={cfg.color || "white"} onChange={(e) => update("color", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="white, #6d9cff, etc." />
            {cfg.color && cfg.color !== "white" && (
              <button onClick={() => update("color", "white")} style={{ ...s.btnSmall, fontSize: 10 }}>Reset</button>
            )}
          </div>
        </Field>
      )}

      {cfg.type === "image" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => document.getElementById("orqui-favicon-upload")?.click()}
            style={{
              border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
              borderRadius: 8, padding: 24, textAlign: "center", marginTop: 8,
              background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {cfg.url ? (
              <div>
                <img src={cfg.url} alt="Favicon" style={{ width: 32, height: 32, objectFit: "contain", marginBottom: 8 }} />
                <div style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                Arraste .ico, .png ou .svg aqui
              </div>
            )}
            <input id="orqui-favicon-upload" type="file" accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml" onChange={handleFileInput} style={{ display: "none" }} />
          </div>
          <Field label="Ou cole URL" style={{ marginTop: 8 }}>
            <input value={cfg.url || ""} onChange={(e) => update("url", e.target.value)} style={{ ...s.input, fontSize: 11 }} placeholder="https://example.com/favicon.ico" />
          </Field>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Logo Configuration Editor
// ============================================================================
const ICON_CATEGORIES: Record<string, string[]> = {
  "Geometric": ["⬡", "◆", "●", "■", "▲", "◇", "⬢", "◉", "◈", "⬟"],
  "Stars": ["★", "✦", "✧", "✶", "✴", "✹", "⭐", "🌟", "💫", "⚝"],
  "Symbols": ["⚡", "⟐", "⊚", "⊛", "⊕", "⊗", "⏣", "⎔", "◎", "☰"],
  "Tech": ["🔷", "🔶", "🔹", "🔸", "💎", "🧊", "⚙️", "🔧", "🛠️", "💻"],
  "Business": ["📊", "📈", "📋", "📁", "📂", "🗂️", "📑", "📌", "📎", "🏢"],
  "Creative": ["💡", "🎯", "🚀", "🔮", "🎨", "✏️", "🖊️", "🧩", "🔬", "🧪"],
  "Nature": ["🌊", "🔥", "🌱", "🍃", "☁️", "🌙", "🏔️", "🌀", "♾️", "🪐"],
  "Comms": ["💬", "🏠", "🔔", "📡", "🌐", "🔗", "📮", "✉️", "📢", "🎙️"],
  "Security": ["🛡️", "🔒", "🔑", "🏷️", "✅", "❌", "⚠️", "🚫", "🔐", "👁️"],
  "Animals": ["🐙", "🦊", "🐝", "🦋", "🐬", "🦄", "🐺", "🦅", "🐢", "🎪"],
};
const ICON_PRESETS = Object.values(ICON_CATEGORIES).flat();

// Phosphor Icons — SVG paths (256x256 viewBox, regular weight)
// Stored as { name: label, d: SVG path data }
const PHOSPHOR_CATEGORIES: Record<string, { name: string; d: string }[]> = {
  "Interface": [
    { name: "flow-arrow", d: "M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z" },
    { name: "house", d: "M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8H96a8,8,0,0,0,8-8V160h48v56a8,8,0,0,0,8,8h56a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H168V152a8,8,0,0,0-8-8H96a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z" },
    { name: "gear", d: "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.68l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.67a73.68,73.68,0,0,1-8.68,0,8,8,0,0,0-5.68,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64l-22.58-2.51a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.66,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.68L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69l2.51-22.58a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.66,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.68-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z" },
    { name: "magnifying-glass", d: "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" },
    { name: "bell", d: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" },
    { name: "user", d: "M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z" },
    { name: "list", d: "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z" },
    { name: "squares-four", d: "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48Z" },
    { name: "sliders", d: "M40,88H73.4a28,28,0,0,0,53.2,0H216a8,8,0,0,0,0-16H126.6a28,28,0,0,0-53.2,0H40a8,8,0,0,0,0,16Zm60-20A12,12,0,1,1,88,80,12,12,0,0,1,100,68ZM216,168H182.6a28,28,0,0,0-53.2,0H40a8,8,0,0,0,0,16h89.4a28,28,0,0,0,53.2,0H216a8,8,0,0,0,0-16Zm-60,20a12,12,0,1,1,12-12A12,12,0,0,1,156,188Z" },
    { name: "x", d: "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" },
    { name: "check", d: "M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" },
    { name: "plus", d: "M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" },
  ],
  "Security": [
    { name: "shield-check", d: "M208,40H48A16,16,0,0,0,32,56v58.77c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.52-80-30.69-80-109.18V56H208ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" },
    { name: "shield", d: "M208,40H48A16,16,0,0,0,32,56v58.77c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.52-80-30.69-80-109.18V56H208Z" },
    { name: "lock", d: "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208Zm-80-36V140a12,12,0,1,1,0-24h0a12,12,0,0,1,12,12v24a12,12,0,0,1-24,0Z" },
    { name: "barricade", d: "M224,64H32A16,16,0,0,0,16,80v72a16,16,0,0,0,16,16H56v32a8,8,0,0,0,16,0V168H184v32a8,8,0,0,0,16,0V168h24a16,16,0,0,0,16-16V80A16,16,0,0,0,224,64Zm0,64.69L175.31,80H224ZM80.69,80l72,72H103.31L32,80.69V80ZM32,103.31,80.69,152H32ZM224,152H175.31l-72-72h49.38L224,151.32V152Z" },
    { name: "door", d: "M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16ZM64,40H192V216H64Zm104,92a12,12,0,1,1-12-12A12,12,0,0,1,168,132Z" },
    { name: "door-open", d: "M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16Zm-40,0H176V40h16ZM64,40h96V216H64Zm80,92a12,12,0,1,1-12-12A12,12,0,0,1,144,132Z" },
    { name: "key", d: "M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A80,80,0,0,0,216.57,39.43ZM224,100a63.08,63.08,0,0,1-17.39,43.52L126.34,168H104a8,8,0,0,0-8,8v16H80a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,2.11-7.34A63.93,63.93,0,0,1,160.05,36,64.08,64.08,0,0,1,224,100Zm-44-20a12,12,0,1,1-12-12A12,12,0,0,1,180,80Z" },
    { name: "eye", d: "M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.29A169.47,169.47,0,0,1,24.7,128,169.47,169.47,0,0,1,48.07,97.29C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.29A169.47,169.47,0,0,1,231.3,128C223.94,141.44,192.22,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z" },
    { name: "warning", d: "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" },
  ],
  "Files": [
    { name: "folder", d: "M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V56H92.69l29.65,29.66A8,8,0,0,0,128,88h88Z" },
    { name: "file", d: "M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z" },
    { name: "clipboard", d: "M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z" },
    { name: "database", d: "M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,62.92C85.07,54.65,105.81,50,128,50s42.93,4.65,58.39,13.08C200.12,70.57,208,80.38,208,90s-7.88,19.43-21.61,26.92C170.93,125.35,150.19,130,128,130s-42.93-4.65-58.39-13.08C55.88,109.43,48,99.62,48,90S55.88,70.57,69.61,62.92ZM186.39,204.08C170.93,212.35,150.19,217,128,217s-42.93-4.65-58.39-13.08C55.88,196.43,48,186.62,48,177V160.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V177C208,186.62,200.12,196.43,186.39,204.08Z" },
    { name: "code", d: "M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.29Zm176,27.7-48-40a8,8,0,1,0-10.24,12.29L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z" },
  ],
  "Arrows": [
    { name: "arrow-right", d: "M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" },
    { name: "arrow-left", d: "M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" },
    { name: "caret-right", d: "M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" },
    { name: "arrow-up", d: "M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" },
    { name: "arrow-down", d: "M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z" },
  ],
  "Brand": [
    { name: "rocket", d: "M152,224a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,224Zm-24-80a12,12,0,1,0-12-12A12,12,0,0,0,128,144Zm95.62-30.23-16.37-92.48A16,16,0,0,0,193.68,8.87,224.06,224.06,0,0,0,128,0h0A224.06,224.06,0,0,0,62.32,8.87a16,16,0,0,0-13.57,12.42L32.38,113.77A16,16,0,0,0,37.1,128l43.33,37.16A36.05,36.05,0,0,0,76,184v40a16,16,0,0,0,16,16h72a16,16,0,0,0,16-16V184a36.05,36.05,0,0,0-4.43-18.84L219,128A16,16,0,0,0,223.62,113.77ZM128,16a207.06,207.06,0,0,1,57.38,8.07L175.42,71.85A32,32,0,0,0,128,56h0a32,32,0,0,0-47.42,15.85L70.62,24.07A207.06,207.06,0,0,1,128,16Zm36,168v40H92V184a20,20,0,0,1,20-20h32A20,20,0,0,1,164,184Z" },
    { name: "lightning", d: "M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5.1-9.27L58.81,131.35l88.82-95.27L137.16,88.46a8,8,0,0,0,5.1,9.27l55.93,20.95Z" },
    { name: "star", d: "M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.38,16.38,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.38,16.38,0,0,0,239.18,97.26Zm-15.34,12.15-45,38.83a16,16,0,0,0-5.12,15.86L187.5,222.17,137,191.09a16,16,0,0,0-17.92,0L68.5,222.17l13.76-58.07a16,16,0,0,0-5.12-15.86l-45-38.83L91.09,105a16,16,0,0,0,13.38-10.14L128,38.26l23.53,56.64A16,16,0,0,0,164.91,105Z" },
    { name: "heart", d: "M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z" },
    { name: "globe", d: "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-26.37,144h52.74C149.48,186.34,140,200.28,128,208.67,116,200.28,106.52,186.34,101.63,168ZM98,152a145.72,145.72,0,0,1,0-48h60a145.72,145.72,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.79a161.79,161.79,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128Zm114.37-40H101.63C106.52,69.66,116,55.72,128,47.33,140,55.72,149.48,69.66,154.37,88Zm19.84,0h38.46a88.15,88.15,0,0,1,0,80H174.21a161.79,161.79,0,0,0,0-48h0Z" },
    { name: "chat-circle", d: "M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z" },
    { name: "sparkle", d: "M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112.9,220.38,93.54,168.22a8,8,0,0,0-4.74-4.74L36.64,144,88.8,124.58a8,8,0,0,0,4.74-4.74L112.9,67.62l19.36,52.16a8,8,0,0,0,4.74,4.74L189.16,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z" },
    { name: "robot", d: "M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-36-60a12,12,0,1,1-12-12A12,12,0,0,1,180,132ZM88,132a12,12,0,1,1-12-12A12,12,0,0,1,88,132Zm16,36a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16H96A8,8,0,0,1,104,168Zm72,0a8,8,0,0,1-8,8H152a8,8,0,0,1,0-16h16A8,8,0,0,1,176,168Zm-40,0a8,8,0,0,1-8,8H120a8,8,0,0,1,0-16h8A8,8,0,0,1,136,168Z" },
    { name: "chart-bar", d: "M224,200h-8V40a8,8,0,0,0-16,0V200H168V96a8,8,0,0,0-16,0V200H112V136a8,8,0,0,0-16,0v64H56V168a8,8,0,0,0-16,0v32H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16Z" },
  ],
};
const PHOSPHOR_ICONS_FLAT = Object.values(PHOSPHOR_CATEGORIES).flat();

// Helper: render a Phosphor icon as inline SVG
function PhosphorSvg({ d, size = 20, color = "currentColor" }: { d: string; size?: number; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill={color} style={{ display: "block" }}>
      <path d={d} />
    </svg>
  );
}

// Lookup Phosphor icon path by name (for runtime)
function getPhosphorPath(name: string): string | null {
  for (const icons of Object.values(PHOSPHOR_CATEGORIES)) {
    const found = icons.find(i => i.name === name);
    if (found) return found.d;
  }
  return null;
}

// Compact Phosphor icon selector — button + popover with search
function PhosphorIconSelect({ value, onChange, allowEmpty = false, placeholder = "Ícone" }: {
  value: string; // "ph:house" or ""
  onChange: (val: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Position popover relative to trigger, rendered via portal
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popW = 300, popH = 360;
    let top = rect.bottom + 4;
    let left = rect.left;
    // Flip up if not enough space below
    if (top + popH > window.innerHeight) top = rect.top - popH - 4;
    // Clamp left
    if (left + popW > window.innerWidth) left = window.innerWidth - popW - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onMouse); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const phName = value?.startsWith("ph:") ? value.slice(3) : value || "";
  const phPath = phName ? getPhosphorPath(phName) : null;

  const allIcons = PHOSPHOR_ICONS_FLAT;
  const filtered = search
    ? allIcons.filter(i => i.name.includes(search.toLowerCase().replace(/\s+/g, "-")))
    : allIcons;

  const groupedFiltered = search
    ? [["Resultados", filtered] as const]
    : (Object.entries(PHOSPHOR_CATEGORIES) as [string, typeof allIcons][]);

  const popover = open ? ReactDOM.createPortal(
    <div ref={popoverRef} style={{
      position: "fixed", top: pos.top, left: pos.left, zIndex: 99999,
      width: 300, maxHeight: 360, overflowY: "auto",
      background: COLORS.surface1, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
      padding: 8,
    }}>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        style={{ ...s.input, width: "100%", fontSize: 11, marginBottom: 6, padding: "6px 8px", boxSizing: "border-box" }}
      />
      {allowEmpty && (
        <button
          onClick={() => { onChange(""); setOpen(false); }}
          style={{
            ...s.btnSmall, width: "100%", textAlign: "left", padding: "5px 8px",
            marginBottom: 4, fontSize: 11, color: COLORS.textDim,
            background: !value ? COLORS.accent + "15" : "transparent",
            border: "none", borderRadius: 4, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ width: 18, textAlign: "center" }}>—</span>
          <span>Nenhum ícone</span>
        </button>
      )}
      {groupedFiltered.map(([cat, icons]) => (
        (icons as typeof allIcons).length > 0 && (
          <div key={cat as string} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: COLORS.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 4px 2px", marginTop: 2 }}>
              {cat as string}
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {(icons as typeof allIcons).map(ic => {
                const isSelected = phName === ic.name;
                return (
                  <button
                    key={ic.name}
                    onClick={() => { onChange(`ph:${ic.name}`); setOpen(false); }}
                    title={ic.name}
                    style={{
                      ...s.btnSmall, padding: 5, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSelected ? COLORS.accent + "25" : COLORS.surface3,
                      border: isSelected ? `1.5px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                      borderRadius: 5, cursor: "pointer", width: 30, height: 30,
                      color: isSelected ? COLORS.accent : COLORS.textMuted,
                    }}
                  >
                    <PhosphorSvg d={ic.d} size={16} color={isSelected ? COLORS.accent : COLORS.textMuted} />
                  </button>
                );
              })}
            </div>
          </div>
        )
      ))}
      {filtered.length === 0 && (
        <div style={{ fontSize: 11, color: COLORS.textDim, padding: 12, textAlign: "center" }}>Nenhum ícone encontrado</div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => { setOpen(!open); setSearch(""); }}
        style={{
          ...s.btnSmall,
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", minWidth: 80, justifyContent: "space-between",
          background: COLORS.surface3, border: `1px solid ${open ? COLORS.accent : COLORS.border}`,
          borderRadius: 6, cursor: "pointer", fontSize: 11, color: COLORS.text,
        }}
        title={value || placeholder}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {phPath ? <PhosphorSvg d={phPath} size={14} color={COLORS.text} /> : null}
          <span style={{ color: phName ? COLORS.text : COLORS.textDim, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {phName || placeholder}
          </span>
        </span>
        <span style={{ fontSize: 8, color: COLORS.textDim }}>{open ? "▲" : "▼"}</span>
      </button>
      {popover}
    </>
  );
}

function IconPicker({ value, onSelect }: { value: string; onSelect: (icon: string) => void }) {
  const [tab, setTab] = useState<"emoji" | "phosphor">(value?.startsWith("ph:") ? "phosphor" : "emoji");
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const emojiCategories = Object.entries(ICON_CATEGORIES);
  const phCategories = Object.entries(PHOSPHOR_CATEGORIES);

  const quickIcons = [...emojiCategories[0][1], ...emojiCategories[1][1]];

  const filteredPhCategories = search
    ? phCategories.map(([cat, icons]) => [cat, icons.filter(i => i.name.includes(search.toLowerCase()))] as const).filter(([, icons]) => icons.length > 0)
    : phCategories;

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
        {(["emoji", "phosphor"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...s.btnSmall, padding: "4px 12px", fontSize: 11, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? COLORS.accent : COLORS.surface3,
            color: tab === t ? "#fff" : COLORS.textMuted,
            borderRadius: 4,
          }}>
            {t === "emoji" ? "Emoji" : "Phosphor"}
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(expanded ? [] : quickIcons).map(ic => (
              <button key={ic} onClick={() => onSelect(ic)} style={{
                ...s.btnSmall, fontSize: 16, padding: "4px 8px",
                background: value === ic ? COLORS.accent + "30" : COLORS.surface3,
                border: value === ic ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
              }}>{ic}</button>
            ))}
          </div>
          {expanded && emojiCategories.map(([cat, icons]) => (
            <div key={cat} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {icons.map(ic => (
                  <button key={ic} onClick={() => onSelect(ic)} style={{
                    ...s.btnSmall, fontSize: 16, padding: "4px 8px",
                    background: value === ic ? COLORS.accent + "30" : COLORS.surface3,
                    border: value === ic ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                  }}>{ic}</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setExpanded(!expanded)} style={{ ...s.btnSmall, marginTop: 8, fontSize: 11, color: COLORS.accent, background: "transparent", border: "none", padding: "4px 0", cursor: "pointer" }}>
            {expanded ? "▲ Menos ícones" : "▼ Mais ícones (100+)"}
          </button>
        </>
      )}

      {tab === "phosphor" && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ícone..."
            style={{ ...s.input, fontSize: 11, marginBottom: 8, width: "100%" }}
          />
          {filteredPhCategories.map(([cat, icons]) => (
            <div key={cat} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {icons.map(ic => {
                  const phKey = `ph:${ic.name}`;
                  const isSelected = value === phKey;
                  return (
                    <button key={ic.name} onClick={() => onSelect(phKey)} title={ic.name} style={{
                      ...s.btnSmall, padding: "6px",
                      background: isSelected ? COLORS.accent + "30" : COLORS.surface3,
                      border: isSelected ? `1px solid ${COLORS.accent}` : `1px solid ${COLORS.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isSelected ? COLORS.accent : COLORS.textMuted,
                    }}>
                      <PhosphorSvg d={ic.d} size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredPhCategories.length === 0 && (
            <div style={{ fontSize: 12, color: COLORS.textDim, padding: 16, textAlign: "center" }}>Nenhum ícone encontrado</div>
          )}
        </>
      )}
    </div>
  );
}

function LogoConfigEditor({ logo, onChange }) {
  const cfg = logo || {
    type: "text", text: "App", icon: "⬡", iconUrl: "", imageUrl: "",
    position: "sidebar", headerSlot: "left", sidebarAlign: "left", alignWithHeader: true,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    iconGap: 8,
    typography: { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 },
  };
  const update = (field, val) => onChange({ ...cfg, [field]: val });
  const updateTypo = (field, val) => onChange({ ...cfg, typography: { ...cfg.typography, [field]: val } });
  const updatePadding = (side, val) => onChange({ ...cfg, padding: { ...cfg.padding, [side]: Number(val) || 0 } });

  const [dragOver, setDragOver] = useState(false);
  const [iconDragOver, setIconDragOver] = useState(false);

  const handleImageFile = (file, field) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => update(field, reader.result);
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleImageFile(e.dataTransfer?.files?.[0], "imageUrl");
    if (e.dataTransfer?.files?.[0]) update("type", "image");
  };

  const handleIconDrop = (e) => {
    e.preventDefault(); setIconDragOver(false);
    handleImageFile(e.dataTransfer?.files?.[0], "iconUrl");
  };

  const pad = cfg.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const typo = cfg.typography || { fontFamily: "", fontSize: 16, fontWeight: 700, color: "", letterSpacing: 0 };

  // Preview
  const renderPreview = () => {
    const align = cfg.position === "sidebar" ? cfg.sidebarAlign : cfg.headerSlot;
    const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
    return (
      <div style={{
        background: COLORS.surface2, borderRadius: 8, marginBottom: 16,
        padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
        display: "flex", justifyContent: justifyMap[align] || "flex-start", alignItems: "center",
        border: `1px solid ${COLORS.border}`, minHeight: 48,
      }}>
        {cfg.type === "image" && cfg.imageUrl ? (
          <img src={cfg.imageUrl} alt="Logo" style={{ height: 32, maxWidth: 160, objectFit: "contain" }} />
        ) : cfg.type === "icon-text" ? (
          <div style={{ display: "flex", alignItems: "center", gap: cfg.iconGap || 8 }}>
            {cfg.iconUrl ? (
              <img src={cfg.iconUrl} alt="" style={{ height: typo.fontSize || 20, objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: typo.fontSize || 20 }}>{cfg.icon || "⬡"}</span>
            )}
            <span style={{
              fontSize: typo.fontSize || 15, fontWeight: typo.fontWeight || 700, color: typo.color || COLORS.text,
              fontFamily: typo.fontFamily || "inherit", letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
            }}>{cfg.text || "App"}</span>
          </div>
        ) : (
          <span style={{
            fontSize: typo.fontSize || 15, fontWeight: typo.fontWeight || 700, color: typo.color || COLORS.text,
            fontFamily: typo.fontFamily || "inherit", letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
          }}>{cfg.text || "App"}</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Logo Configuration</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configure a identidade visual do aplicativo</p>
      </div>

      {renderPreview()}

      <Field label="Tipo de Logo">
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "text", label: "Texto" },
            { id: "icon-text", label: "Ícone + Texto" },
            { id: "image", label: "Imagem" },
          ].map(opt => (
            <button key={opt.id} onClick={() => update("type", opt.id)} style={{
              ...s.btnSmall,
              background: cfg.type === opt.id ? COLORS.accent : COLORS.surface3,
              color: cfg.type === opt.id ? "#fff" : COLORS.textMuted,
              fontWeight: cfg.type === opt.id ? 600 : 400,
              padding: "6px 14px",
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>

      {(cfg.type === "text" || cfg.type === "icon-text") && (
        <Field label="Texto">
          <input value={cfg.text || ""} onChange={(e) => update("text", e.target.value)} style={s.input} placeholder="Nome do app" />
        </Field>
      )}

      {cfg.type === "icon-text" && (
        <>
          <Field label="Ícone (emoji ou upload)">
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <input value={cfg.icon || ""} onChange={(e) => update("icon", e.target.value)} style={{ ...s.input, width: 60, textAlign: "center", fontSize: 18 }} />
              <IconPicker value={(!cfg.iconUrl && cfg.icon) || ""} onSelect={(ic) => onChange({ ...cfg, icon: ic, iconUrl: "" })} />
            </div>
          </Field>
          <Field label="Ou upload de ícone (imagem)">
            <div
              onDragOver={(e) => { e.preventDefault(); setIconDragOver(true); }}
              onDragLeave={() => setIconDragOver(false)}
              onDrop={handleIconDrop}
              onClick={() => document.getElementById("orqui-icon-upload")?.click()}
              style={{
                border: `2px dashed ${iconDragOver ? COLORS.accent : COLORS.border}`,
                borderRadius: 8, padding: 12, textAlign: "center",
                background: iconDragOver ? COLORS.accent + "08" : COLORS.surface2,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {cfg.iconUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <img src={cfg.iconUrl} alt="Icon" style={{ height: 24, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</span>
                  <button onClick={(e) => { e.stopPropagation(); update("iconUrl", ""); }} style={{ ...s.btnSmall, fontSize: 10, padding: "2px 6px" }}>✕</button>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>Arraste imagem do ícone aqui</span>
              )}
              <input id="orqui-icon-upload" type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0], "iconUrl")} style={{ display: "none" }} />
            </div>
          </Field>
          <Field label="Tamanho do ícone">
            <Row gap={8}>
              <input type="range" min={12} max={48} value={cfg.iconSize || 20} onChange={(e) => update("iconSize", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 40, textAlign: "right" }}>{cfg.iconSize || 20}px</span>
            </Row>
          </Field>
          <Field label="Espaço entre ícone e texto (gap)">
            <Row gap={8}>
              <input type="range" min={0} max={24} value={cfg.iconGap || 8} onChange={(e) => update("iconGap", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 40, textAlign: "right" }}>{cfg.iconGap || 8}px</span>
            </Row>
          </Field>
        </>
      )}

      {cfg.type === "image" && (
        <Field label="Imagem">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImageDrop}
            style={{
              border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
              borderRadius: 8, padding: 20, textAlign: "center",
              background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onClick={() => document.getElementById("orqui-logo-upload")?.click()}
          >
            {cfg.imageUrl ? (
              <div>
                <img src={cfg.imageUrl} alt="Logo" style={{ height: 40, maxWidth: 200, objectFit: "contain", marginBottom: 8 }} />
                <div style={{ fontSize: 11, color: COLORS.textDim }}>Clique ou arraste para trocar</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                Arraste uma imagem aqui ou clique para upload
              </div>
            )}
            <input id="orqui-logo-upload" type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0], "imageUrl")} style={{ display: "none" }} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Field label="Ou cole URL">
              <input value={cfg.imageUrl || ""} onChange={(e) => update("imageUrl", e.target.value)} style={{ ...s.input, fontSize: 11 }} placeholder="https://..." />
            </Field>
          </div>
        </Field>
      )}

      {/* Typography */}
      {(cfg.type === "text" || cfg.type === "icon-text") && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Tipografia do Logo</div>
          <Row gap={8}>
            <Field label="Fonte" style={{ flex: 1 }}>
              <select value={typo.fontFamily || ""} onChange={(e) => updateTypo("fontFamily", e.target.value)} style={s.select}>
                <option value="">Sistema (inherit)</option>
                {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Tamanho" style={{ width: 80 }}>
              <input type="number" value={typo.fontSize || 16} onChange={(e) => updateTypo("fontSize", Number(e.target.value))} style={s.input} min={8} max={48} />
            </Field>
          </Row>
          <Row gap={8}>
            <Field label="Peso" style={{ flex: 1 }}>
              <select value={typo.fontWeight || 700} onChange={(e) => updateTypo("fontWeight", Number(e.target.value))} style={s.select}>
                {[300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}{w === 400 ? " (normal)" : w === 700 ? " (bold)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Cor" style={{ width: 120 }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="color" value={typo.color || "#e4e4e7"} onChange={(e) => updateTypo("color", e.target.value)} style={{ width: 32, height: 28, border: "none", padding: 0, cursor: "pointer" }} />
                <input value={typo.color || ""} onChange={(e) => updateTypo("color", e.target.value)} style={{ ...s.input, flex: 1, fontSize: 11 }} placeholder="var(--foreground)" />
              </div>
            </Field>
          </Row>
          <Field label="Letter Spacing">
            <Row gap={8}>
              <input type="range" min={-2} max={8} step={0.1} value={typo.letterSpacing || 0} onChange={(e) => updateTypo("letterSpacing", Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted, width: 50, textAlign: "right" }}>{typo.letterSpacing || 0}px</span>
            </Row>
          </Field>
        </div>
      )}

      {/* Padding */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Padding do Container</div>
        <Row gap={8}>
          {(["top", "right", "bottom", "left"] as const).map(side => (
            <Field key={side} label={side} style={{ flex: 1 }}>
              <input type="number" value={pad[side] || 0} onChange={(e) => updatePadding(side, e.target.value)} style={s.input} min={0} max={64} />
            </Field>
          ))}
        </Row>
      </div>

      {/* Position */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <Field label="Posição do Logo">
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { id: "sidebar", label: "Sidebar" },
              { id: "header", label: "Header" },
            ].map(opt => (
              <button key={opt.id} onClick={() => update("position", opt.id)} style={{
                ...s.btnSmall,
                background: cfg.position === opt.id ? COLORS.accent : COLORS.surface3,
                color: cfg.position === opt.id ? "#fff" : COLORS.textMuted,
                padding: "6px 14px",
              }}>{opt.label}</button>
            ))}
          </div>
        </Field>

        {cfg.position === "header" && (
          <Field label="Slot no Header">
            <div style={{ display: "flex", gap: 4 }}>
              {["left", "center", "right"].map(pos => (
                <button key={pos} onClick={() => update("headerSlot", pos)} style={{
                  ...s.btnSmall,
                  background: cfg.headerSlot === pos ? COLORS.accent : COLORS.surface3,
                  color: cfg.headerSlot === pos ? "#fff" : COLORS.textMuted,
                  padding: "6px 14px", textTransform: "capitalize",
                }}>{pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}</button>
              ))}
            </div>
          </Field>
        )}

        {cfg.position === "sidebar" && (
          <>
            <Field label="Alinhamento na Sidebar">
              <div style={{ display: "flex", gap: 4 }}>
                {["left", "center", "right"].map(pos => (
                  <button key={pos} onClick={() => update("sidebarAlign", pos)} style={{
                    ...s.btnSmall,
                    background: cfg.sidebarAlign === pos ? COLORS.accent : COLORS.surface3,
                    color: cfg.sidebarAlign === pos ? "#fff" : COLORS.textMuted,
                    padding: "6px 14px", textTransform: "capitalize",
                  }}>{pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}</button>
                ))}
              </div>
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginTop: 8 }}>
              <input type="checkbox" checked={cfg.alignWithHeader ?? true} onChange={(e) => update("alignWithHeader", e.target.checked)} />
              Alinhamento do container da logo e do header variável?
            </label>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Header Elements Editor
// ============================================================================
const HEADER_ICON_OPTIONS = ["bell", "settings", "user", "mail", "help", "moon", "sun", "menu", "search", "grid", "download", "share", "server"];
const HEADER_ICON_PHOSPHOR: Record<string, string> = {
  bell: "bell", settings: "gear", user: "user", mail: "envelope", help: "question", moon: "moon",
  sun: "sun", menu: "list", search: "magnifying-glass", grid: "squares-four", download: "arrow-square-down", share: "share-network", server: "hard-drives",
};
const HEADER_ICON_MAP = {
  bell: "🔔", settings: "⚙️", user: "👤", mail: "✉️", help: "❓", moon: "🌙",
  sun: "☀️", menu: "☰", search: "🔍", grid: "⊞", download: "⬇", share: "↗", server: "🖥",
};

// Mini Phosphor icon for editor preview
function MiniPhosphorIcon({ name, size = 16, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const PATHS: Record<string, string> = {
    "bell": "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z",
    "gear": "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM199.87,123.66Z",
    "user": "M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z",
    "envelope": "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z",
    "question": "M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
    "moon": "M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23Z",
    "sun": "M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128Z",
    "list": "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z",
    "magnifying-glass": "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z",
    "squares-four": "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48Z",
    "arrow-square-down": "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Z",
    "share-network": "M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Z",
    "plus": "M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z",
    "hard-drives": "M208,136H48a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,56H48V152H208v40Zm0-160H48A16,16,0,0,0,32,48V88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,56H48V48H208V88ZM188,172a12,12,0,1,1-12-12A12,12,0,0,1,188,172Zm-40,0a12,12,0,1,1-12-12A12,12,0,0,1,148,172ZM188,68a12,12,0,1,1-12-12A12,12,0,0,1,188,68Zm-40,0a12,12,0,1,1-12-12A12,12,0,0,1,148,68Z",
  };
  const d = PATHS[name];
  if (!d) return <span style={{ fontSize: size }}>?</span>;
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill={color}><path d={d} /></svg>);
}

function HeaderElementsEditor({ elements, onChange }) {
  const cfg = elements || {
    search: { enabled: false, placeholder: "Buscar...", showIcon: true, icon: "ph:magnifying-glass" },
    cta: { enabled: false, label: "Novo", variant: "default" },
    ctas: [],
    icons: { enabled: true, items: [{ id: "bell", route: "/notifications" }, { id: "settings", route: "/settings" }] },
    order: ["search", "icons", "ctas"],
  };
  const update = (key, field, val) => onChange({ ...cfg, [key]: { ...cfg[key], [field]: val } });
  const updateRoot = (field, val) => onChange({ ...cfg, [field]: val });

  // Normalize icons
  const normalizeIcons = (items) => {
    if (!items) return [];
    return items.map(it => typeof it === "string" ? { id: it, route: "" } : it);
  };
  const iconItems = normalizeIcons(cfg.icons?.items);
  const updateIconItems = (newItems) => update("icons", "items", newItems);

  // Multi-CTA helpers
  const ctas = cfg.ctas || [];
  const addCta = () => {
    const newCta = { id: `cta-${Date.now()}`, label: "Ação", variant: "default", route: "" };
    const newCtas = [...ctas, newCta];
    // Add individual CTA entry to order
    const curOrder = cfg.order || ["search", "icons"];
    const newOrder = [...curOrder, `cta:${newCta.id}`];
    onChange({ ...cfg, ctas: newCtas, order: newOrder });
  };
  const removeCta = (id) => {
    const newCtas = ctas.filter(c => c.id !== id);
    // Remove from order
    const curOrder = cfg.order || ["search", "icons"];
    const newOrder = curOrder.filter(k => k !== `cta:${id}`);
    onChange({ ...cfg, ctas: newCtas, order: newOrder });
  };
  const updateCta = (id, field, val) => updateRoot("ctas", ctas.map(c => c.id === id ? { ...c, [field]: val } : c));

  // Order — expand legacy "ctas" group into individual cta: entries
  const expandOrder = (rawOrder: string[]): string[] => {
    const result: string[] = [];
    for (const key of rawOrder) {
      if (key === "ctas") {
        // Legacy grouped → expand to individual
        for (const c of ctas) result.push(`cta:${c.id}`);
      } else {
        result.push(key);
      }
    }
    // Ensure any CTA not in order gets appended
    for (const c of ctas) {
      if (!result.includes(`cta:${c.id}`)) result.push(`cta:${c.id}`);
    }
    return result;
  };
  const order = expandOrder(cfg.order || ["search", "icons", "ctas"]);
  const moveOrder = (idx, dir) => {
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    updateRoot("order", newOrder);
  };

  const getOrderLabel = (key: string) => {
    if (key === "search") return "🔍 Pesquisa";
    if (key === "icons") return "🔔 Ícones";
    if (key.startsWith("cta:")) {
      const ctaId = key.slice(4);
      const cta = ctas.find(c => c.id === ctaId);
      return `🎯 CTA: ${cta?.label || ctaId}`;
    }
    return key;
  };

  // CTA variant style map for preview
  const CTA_VARIANT_STYLES = {
    default: { bg: COLORS.accent, color: "#fff", border: "none" },
    destructive: { bg: "#ef4444", color: "#fff", border: "none" },
    outline: { bg: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` },
    secondary: { bg: COLORS.surface3, color: COLORS.text, border: "none" },
    ghost: { bg: "transparent", color: COLORS.textMuted, border: "none" },
  };

  // Preview
  const renderPreviewElement = (key) => {
    if (key === "search" && cfg.search?.enabled) {
      const searchPhosphor = HEADER_ICON_PHOSPHOR[cfg.search?.icon?.replace("ph:", "")] || cfg.search?.icon?.replace("ph:", "") || "magnifying-glass";
      return (
        <div key="search" style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface3, borderRadius: 6, padding: "4px 10px", border: `1px solid ${COLORS.border}` }}>
          {(cfg.search.showIcon !== false) && <MiniPhosphorIcon name={searchPhosphor} size={12} color={COLORS.textDim} />}
          <span style={{ fontSize: 12, color: COLORS.textDim }}>{cfg.search.placeholder || "Buscar..."}</span>
        </div>
      );
    }
    if (key === "icons" && cfg.icons?.enabled) {
      return iconItems.map(ic => (
        <span key={ic.id} style={{ display: "inline-flex", opacity: 0.7 }} title={ic.route || ic.id}>
          <MiniPhosphorIcon name={HEADER_ICON_PHOSPHOR[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
        </span>
      ));
    }
    if (key.startsWith("cta:")) {
      const ctaId = key.slice(4);
      const cta = ctas.find(c => c.id === ctaId);
      if (!cta) return null;
      const vs = CTA_VARIANT_STYLES[cta.variant || "default"] || CTA_VARIANT_STYLES.default;
      const phIcon = cta.icon?.startsWith("ph:") ? cta.icon.slice(3) : undefined;
      return (
        <button key={cta.id} style={{
          fontSize: 11, padding: "5px 14px", borderRadius: 6, cursor: "default", fontWeight: 500,
          background: vs.bg, color: vs.color, border: vs.border || "none",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {phIcon && <MiniPhosphorIcon name={phIcon} size={12} />}
          {cta.label}
        </button>
      );
    }
    return null;
  };

  const renderPreview = () => (
    <div style={{
      background: COLORS.surface2, borderRadius: 8, padding: "10px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 12, border: `1px solid ${COLORS.border}`,
      minHeight: 44,
    }}>
      <span style={{ fontSize: 12, color: COLORS.textDim, flex: "0 0 auto" }}>Header →</span>
      <div style={{ flex: 1 }} />
      {order.map(key => <React.Fragment key={key}>{renderPreviewElement(key)}</React.Fragment>)}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Header Elements</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configure quais elementos aparecem no header e sua ordem</p>
      </div>

      {renderPreview()}

      {/* Order */}
      <Section title="📐 Ordem dos Elementos" defaultOpen={true} id="header-order">
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Reordene os elementos do header individualmente:</div>
        {order.map((key, idx) => {
          const isCta = key.startsWith("cta:");
          const ctaObj = isCta ? ctas.find(c => c.id === key.slice(4)) : null;
          return (
            <div key={key} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
              background: isCta ? `${COLORS.accent}11` : COLORS.surface3, borderRadius: 6, marginBottom: 4,
              border: `1px solid ${isCta ? COLORS.accent + "33" : COLORS.border}`,
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveOrder(idx, -1)} disabled={idx === 0} style={{ ...s.btnSmall, padding: "1px 4px", fontSize: 10, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moveOrder(idx, 1)} disabled={idx === order.length - 1} style={{ ...s.btnSmall, padding: "1px 4px", fontSize: 10, opacity: idx === order.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>
              <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, flex: 1 }}>{getOrderLabel(key)}</span>
              {ctaObj && (
                <span style={{ fontSize: 10, color: COLORS.textDim, background: COLORS.surface3, padding: "1px 6px", borderRadius: 3 }}>{ctaObj.variant || "default"}</span>
              )}
              <span style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "monospace" }}>{key}</span>
            </div>
          );
        })}
        {ctas.length === 0 && (
          <div style={{ fontSize: 11, color: COLORS.textDim, padding: 8, textAlign: "center" }}>
            Adicione CTAs na seção abaixo — cada um aparecerá aqui individualmente.
          </div>
        )}
      </Section>

      {/* Search */}
      <Section title="🔍 Pesquisa" defaultOpen={cfg.search?.enabled} id="header-search">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
          <input type="checkbox" checked={cfg.search?.enabled ?? false} onChange={(e) => update("search", "enabled", e.target.checked)} />
          Habilitar campo de pesquisa
        </label>
        {cfg.search?.enabled && (
          <>
            <Field label="Placeholder">
              <input value={cfg.search?.placeholder || ""} onChange={(e) => update("search", "placeholder", e.target.value)} style={s.input} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={cfg.search?.showIcon !== false} onChange={(e) => update("search", "showIcon", e.target.checked)} />
              Mostrar ícone na caixa de pesquisa
            </label>
            {(cfg.search?.showIcon !== false) && (
              <Field label="Ícone da pesquisa">
                <PhosphorIconSelect
                  value={cfg.search?.icon || "ph:magnifying-glass"}
                  onChange={(val) => update("search", "icon", val || "ph:magnifying-glass")}
                  placeholder="magnifying-glass"
                />
              </Field>
            )}
          </>
        )}
      </Section>

      {/* Icons */}
      <Section title="🔔 Ícones de Ação" defaultOpen={cfg.icons?.enabled} id="header-icons">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", marginBottom: 10 }}>
          <input type="checkbox" checked={cfg.icons?.enabled ?? false} onChange={(e) => update("icons", "enabled", e.target.checked)} />
          Habilitar ícones no header
        </label>
        {cfg.icons?.enabled && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Clique para adicionar/remover ícones (Phosphor):</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
              {HEADER_ICON_OPTIONS.map(icId => {
                const active = iconItems.some(i => i.id === icId);
                const phName = HEADER_ICON_PHOSPHOR[icId] || icId;
                return (
                  <button key={icId} onClick={() => {
                    if (active) updateIconItems(iconItems.filter(i => i.id !== icId));
                    else updateIconItems([...iconItems, { id: icId, route: `/${icId}` }]);
                  }} style={{
                    ...s.btnSmall, padding: "6px 8px", display: "inline-flex", alignItems: "center", gap: 4,
                    background: active ? COLORS.accent + "20" : COLORS.surface3,
                    border: active ? `1px solid ${COLORS.accent}50` : `1px solid ${COLORS.border}`,
                    opacity: active ? 1 : 0.5,
                  }} title={icId}>
                    <MiniPhosphorIcon name={phName} size={14} color={active ? COLORS.accent : COLORS.textMuted} />
                    <span style={{ fontSize: 10, color: COLORS.textDim }}>{icId}</span>
                  </button>
                );
              })}
            </div>
            {/* Routes for each icon */}
            {iconItems.length > 0 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Rotas dos ícones</div>
            )}
            {iconItems.map((ic, idx) => (
              <Row key={ic.id} gap={8} style={{ marginBottom: 4 }}>
                <span style={{ display: "inline-flex", width: 24, justifyContent: "center" }}>
                  <MiniPhosphorIcon name={HEADER_ICON_PHOSPHOR[ic.id] || ic.id} size={16} color={COLORS.textMuted} />
                </span>
                <span style={{ fontSize: 12, color: COLORS.textMuted, width: 70 }}>{ic.id}</span>
                <input
                  value={ic.route || ""}
                  onChange={(e) => {
                    const updated = [...iconItems];
                    updated[idx] = { ...ic, route: e.target.value };
                    updateIconItems(updated);
                  }}
                  style={{ ...s.input, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  placeholder={`/${ic.id}`}
                />
              </Row>
            ))}
          </div>
        )}
      </Section>

      {/* CTAs (Multi) */}
      <Section title="🎯 CTAs (Call to Action)" defaultOpen={cfg.cta?.enabled || ctas.length > 0} id="header-cta">
        {/* Legacy single CTA migration hint */}
        {cfg.cta?.enabled && ctas.length === 0 && (
          <div style={{ padding: 8, background: COLORS.surface3, borderRadius: 6, marginBottom: 10, fontSize: 11, color: COLORS.textDim }}>
            CTA legado detectado. <button onClick={() => {
              const legacy = { id: `cta-${Date.now()}`, label: cfg.cta?.label || "Novo", variant: cfg.cta?.variant || "default", route: cfg.cta?.route || "" };
              onChange({ ...cfg, ctas: [legacy], cta: { ...cfg.cta, enabled: false } });
            }} style={{ ...s.btnSmall, fontSize: 11, color: COLORS.accent }}>Migrar para multi-CTA →</button>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <button onClick={addCta} style={{ ...s.btnSmall, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <MiniPhosphorIcon name="plus" size={12} /> Adicionar CTA
          </button>
        </div>

        {ctas.map((cta, idx) => {
          const vs = CTA_VARIANT_STYLES[cta.variant || "default"] || CTA_VARIANT_STYLES.default;
          return (
            <div key={cta.id} style={{ padding: 10, background: COLORS.surface2, borderRadius: 6, marginBottom: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>CTA #{idx + 1}</span>
                <button onClick={() => removeCta(cta.id)} style={{ ...s.btnSmall, fontSize: 10, color: COLORS.danger }}>✕ Remover</button>
              </div>
              <Row gap={8}>
                <Field label="Label" style={{ flex: 1 }}>
                  <input value={cta.label || ""} onChange={(e) => updateCta(cta.id, "label", e.target.value)} style={s.input} />
                </Field>
                <Field label="Variant" style={{ width: 120 }}>
                  <select value={cta.variant || "default"} onChange={(e) => updateCta(cta.id, "variant", e.target.value)} style={s.select}>
                    {["default", "destructive", "outline", "secondary", "ghost"].map(v => <option key={v}>{v}</option>)}
                  </select>
                </Field>
              </Row>
              <Row gap={8}>
                <Field label="Rota (link)" style={{ flex: 1 }}>
                  <input value={cta.route || ""} onChange={(e) => updateCta(cta.id, "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} placeholder="/nova-acao" />
                </Field>
                <Field label="Ícone" style={{ width: 150 }}>
                  <PhosphorIconSelect
                    value={cta.icon || ""}
                    allowEmpty
                    placeholder="Nenhum"
                    onChange={(val) => updateCta(cta.id, "icon", val)}
                  />
                </Field>
              </Row>
              {/* Preview */}
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.textDim }}>Preview:</span>
                <button style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 6, cursor: "default", fontWeight: 500,
                  background: vs.bg, color: vs.color, border: vs.border || "none",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {cta.icon?.startsWith("ph:") && <MiniPhosphorIcon name={cta.icon.slice(3)} size={12} />}
                  {cta.label || "CTA"}
                </button>
              </div>
            </div>
          );
        })}

        {/* Legacy single CTA (backward compat) */}
        {cfg.cta?.enabled && ctas.length === 0 && (
          <>
            <Row gap={8}>
              <Field label="Label" style={{ flex: 1 }}>
                <input value={cfg.cta?.label || ""} onChange={(e) => update("cta", "label", e.target.value)} style={s.input} />
              </Field>
              <Field label="Variant" style={{ width: 140 }}>
                <select value={cfg.cta?.variant || "default"} onChange={(e) => update("cta", "variant", e.target.value)} style={s.select}>
                  {["default", "destructive", "outline", "secondary", "ghost"].map(v => <option key={v}>{v}</option>)}
                </select>
              </Field>
            </Row>
            <Field label="Rota (link)">
              <input value={cfg.cta?.route || ""} onChange={(e) => update("cta", "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} placeholder="/nova-validacao" />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}

// ============================================================================
// Table Separator Editor
// ============================================================================
function TableSeparatorEditor({ config, tokens, onChange }) {
  const cfg = config || { color: "$tokens.colors.border", width: "1px", style: "solid", headerColor: "", headerWidth: "2px", headerStyle: "solid" };
  const update = (field, val) => onChange({ ...cfg, [field]: val });

  const colorKeys = Object.keys(tokens?.colors || {});

  // Preview table
  const resolveColor = (ref) => {
    if (!ref) return COLORS.border;
    const m = ref.match(/^\$tokens\.colors\.(.+)$/);
    if (m && tokens?.colors?.[m[1]]) return tokens.colors[m[1]].value;
    return ref;
  };

  const sepColor = resolveColor(cfg.color);
  const hdrColor = resolveColor(cfg.headerColor) || sepColor;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Table Separator</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Configuração das linhas separadoras em tabelas</p>
      </div>

      {/* Preview */}
      <div style={{ background: COLORS.surface2, borderRadius: 8, padding: 12, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `${cfg.headerWidth || cfg.width || "1px"} ${cfg.headerStyle || cfg.style || "solid"} ${hdrColor}` }}>
              <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>ID</th>
              <th style={{ textAlign: "left", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: COLORS.textMuted, fontWeight: 600 }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {[["RUN-001", "Passed", "Gate 3"], ["RUN-002", "Failed", "Gate 1"], ["RUN-003", "Passed", "Gate 3"]].map(([id, st, gate], i) => (
              <tr key={i} style={{ borderBottom: `${cfg.width || "1px"} ${cfg.style || "solid"} ${sepColor}` }}>
                <td style={{ padding: "6px 8px", color: COLORS.text, fontFamily: "monospace", fontSize: 10 }}>{id}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, background: st === "Passed" ? "#22c55e20" : "#ef444420", color: st === "Passed" ? "#22c55e" : "#ef4444" }}>{st}</span>
                </td>
                <td style={{ padding: "6px 8px", color: COLORS.text, textAlign: "right", fontSize: 10 }}>{gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Row Separator" defaultOpen={true} id="table-row-sep">
        <Field label="Cor">
          <Row gap={6}>
            <select value={cfg.color?.startsWith("$tokens.colors.") ? cfg.color : "__custom"} onChange={(e) => update("color", e.target.value === "__custom" ? (sepColor || COLORS.border) : e.target.value)} style={{ ...s.select, flex: 1 }}>
              <option value="__custom">Custom</option>
              {colorKeys.map(k => <option key={k} value={`$tokens.colors.${k}`}>{k}</option>)}
            </select>
            {!cfg.color?.startsWith("$tokens.colors.") && (
              <input type="color" value={cfg.color || COLORS.border} onChange={(e) => update("color", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer" }} />
            )}
          </Row>
        </Field>
        <Row gap={8}>
          <Field label="Espessura" style={{ flex: 1 }}>
            <select value={cfg.width || "1px"} onChange={(e) => update("width", e.target.value)} style={s.select}>
              {["0px", "1px", "2px", "3px"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Estilo" style={{ flex: 1 }}>
            <select value={cfg.style || "solid"} onChange={(e) => update("style", e.target.value)} style={s.select}>
              {["solid", "dashed", "dotted", "none"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </Row>
      </Section>

      <Section title="Header Separator" defaultOpen={false} id="table-header-sep">
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>Separador entre header e body (se vazio, usa o mesmo das rows)</div>
        <Field label="Cor do Header">
          <Row gap={6}>
            <select value={cfg.headerColor?.startsWith("$tokens.colors.") ? cfg.headerColor : (cfg.headerColor ? "__custom" : "")} onChange={(e) => update("headerColor", e.target.value === "__custom" ? (hdrColor || COLORS.border) : e.target.value)} style={{ ...s.select, flex: 1 }}>
              <option value="">Mesma das rows</option>
              <option value="__custom">Custom</option>
              {colorKeys.map(k => <option key={k} value={`$tokens.colors.${k}`}>{k}</option>)}
            </select>
            {cfg.headerColor && !cfg.headerColor.startsWith("$tokens.colors.") && (
              <input type="color" value={cfg.headerColor || COLORS.border} onChange={(e) => update("headerColor", e.target.value)} style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer" }} />
            )}
          </Row>
        </Field>
        <Row gap={8}>
          <Field label="Espessura" style={{ flex: 1 }}>
            <select value={cfg.headerWidth || "2px"} onChange={(e) => update("headerWidth", e.target.value)} style={s.select}>
              {["1px", "2px", "3px", "4px"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Estilo" style={{ flex: 1 }}>
            <select value={cfg.headerStyle || "solid"} onChange={(e) => update("headerStyle", e.target.value)} style={s.select}>
              {["solid", "dashed", "dotted", "double"].map(v => <option key={v}>{v}</option>)}
            </select>
          </Field>
        </Row>
      </Section>
    </div>
  );
}

// ============================================================================
// Pages Editor (Multi-page layout support)
// ============================================================================
function PagesEditor({ layout, onChange }) {
  const pages = layout.structure?.pages || {};
  const pageKeys = Object.keys(pages);
  const [selected, setSelected] = usePersistentTab("pages-selected", pageKeys[0] || "");
  const [newPageKey, setNewPageKey] = useState("");

  const addPage = () => {
    if (!newPageKey.trim()) return;
    const key = newPageKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (pages[key]) return;
    const updated = {
      ...pages,
      [key]: {
        label: newPageKey.trim(),
        route: `/${key}`,
        description: "",
        overrides: {},
      },
    };
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
    setSelected(key);
    setNewPageKey("");
  };

  const removePage = (key) => {
    const updated = { ...pages };
    delete updated[key];
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
    if (selected === key) setSelected(Object.keys(updated)[0] || "");
  };

  const updatePage = (key, field, val) => {
    const updated = { ...pages, [key]: { ...pages[key], [field]: val } };
    onChange({ ...layout, structure: { ...layout.structure, pages: updated } });
  };

  const updateOverride = (pageKey, regionName, field, val) => {
    const page = pages[pageKey];
    const overrides = { ...page.overrides };
    if (!overrides[regionName]) overrides[regionName] = {};
    overrides[regionName] = { ...overrides[regionName], [field]: val };
    updatePage(pageKey, "overrides", overrides);
  };

  const removeOverride = (pageKey, regionName, field) => {
    const page = pages[pageKey];
    const overrides = { ...page.overrides };
    if (overrides[regionName]) {
      const region = { ...overrides[regionName] };
      delete region[field];
      if (Object.keys(region).length === 0) delete overrides[regionName];
      else overrides[regionName] = region;
    }
    updatePage(pageKey, "overrides", overrides);
  };

  const selectedPage = selected ? pages[selected] : null;
  const regionNames = ["sidebar", "header", "main", "footer"];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, marginBottom: 4 }}>Pages</h3>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>
          Cada página herda o layout base e pode sobrescrever regiões, header elements, etc.
          Use <span style={{ fontFamily: "monospace", color: COLORS.accent }}>&lt;AppShell page="dashboard"&gt;</span> no runtime.
        </p>
      </div>

      {/* Page list + add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={newPageKey} onChange={(e) => setNewPageKey(e.target.value)} placeholder="nome-da-pagina" style={{ ...s.input, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && addPage()} />
        <button onClick={addPage} style={s.btn}>+ Página</button>
      </div>

      {pageKeys.length === 0 ? (
        <EmptyState message="Nenhuma página configurada. Todas as rotas usarão o layout base." action={
          <div style={{ fontSize: 11, color: COLORS.textDim }}>Adicione páginas para customizar o layout por rota</div>
        } />
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Page tabs */}
          <div style={{ width: 160, flexShrink: 0 }}>
            {pageKeys.map(key => (
              <div key={key} onClick={() => setSelected(key)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", marginBottom: 2, borderRadius: 6, cursor: "pointer",
                background: selected === key ? COLORS.surface3 : "transparent",
                border: selected === key ? `1px solid ${COLORS.border2}` : "1px solid transparent",
              }}>
                <div>
                  <div style={{ fontSize: 13, color: selected === key ? COLORS.text : COLORS.textMuted, fontWeight: selected === key ? 600 : 400 }}>{pages[key].label || key}</div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: "monospace" }}>{pages[key].route}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removePage(key); }} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Page editor */}
          {selectedPage && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...s.card, marginBottom: 12 }}>
                <Row gap={8}>
                  <Field label="Label" style={{ flex: 1 }}>
                    <input value={selectedPage.label || ""} onChange={(e) => updatePage(selected, "label", e.target.value)} style={s.input} />
                  </Field>
                  <Field label="Route" style={{ flex: 1 }}>
                    <input value={selectedPage.route || ""} onChange={(e) => updatePage(selected, "route", e.target.value)} style={{ ...s.input, fontFamily: "monospace" }} />
                  </Field>
                </Row>
                <Field label="Descrição">
                  <input value={selectedPage.description || ""} onChange={(e) => updatePage(selected, "description", e.target.value)} style={s.input} placeholder="Breve descrição da página" />
                </Field>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Region Overrides</div>
              <p style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, marginTop: 0 }}>
                Apenas campos marcados serão sobrescritos. Campos não marcados usam o layout base.
              </p>

              {regionNames.map(rName => {
                const baseRegion = layout.structure.regions[rName];
                const override = selectedPage.overrides?.[rName] || {};
                const hasOverride = Object.keys(override).length > 0;

                return (
                  <div key={rName} style={{ ...s.card, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasOverride ? 10 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, textTransform: "capitalize" }}>
                        {rName} <span style={{ ...s.tag, marginLeft: 6 }}>{baseRegion?.enabled ? "base: ativo" : "base: inativo"}</span>
                        {hasOverride && <span style={{ ...s.tag, marginLeft: 4, background: COLORS.accent + "20", color: COLORS.accent, border: `1px solid ${COLORS.accent}40` }}>override</span>}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {/* Enable/disable override */}
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={override.enabled !== undefined}
                          onChange={(e) => {
                            if (e.target.checked) updateOverride(selected, rName, "enabled", !baseRegion?.enabled);
                            else removeOverride(selected, rName, "enabled");
                          }}
                        />
                        Override enabled ({override.enabled !== undefined ? (override.enabled ? "ativo" : "inativo") : "herdar"})
                      </label>

                      {override.enabled !== undefined && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.accent, cursor: "pointer" }}>
                          <input type="checkbox" checked={override.enabled} onChange={(e) => updateOverride(selected, rName, "enabled", e.target.checked)} />
                          Ativo nesta página
                        </label>
                      )}
                    </div>

                    {/* Behavior overrides */}
                    {baseRegion?.behavior && (
                      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {["fixed", "collapsible", "scrollable"].map(b => (
                          <label key={b} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textDim, cursor: "pointer" }}>
                            <input type="checkbox"
                              checked={override.behavior?.[b] !== undefined}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const beh = { ...(override.behavior || {}), [b]: !baseRegion.behavior?.[b] };
                                  updateOverride(selected, rName, "behavior", beh);
                                } else {
                                  const beh = { ...(override.behavior || {}) };
                                  delete beh[b];
                                  if (Object.keys(beh).length === 0) removeOverride(selected, rName, "behavior");
                                  else updateOverride(selected, rName, "behavior", beh);
                                }
                              }}
                            />
                            override {b}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Header elements override */}
              <div style={{ ...s.card, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>Header Elements Override</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["search", "cta", "icons"].map(el => {
                    const baseEnabled = layout.structure.headerElements?.[el]?.enabled ?? false;
                    const overrideVal = selectedPage.overrides?.headerElements?.[el];
                    return (
                      <label key={el} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={overrideVal !== undefined}
                          onChange={(e) => {
                            const he = { ...(selectedPage.overrides?.headerElements || {}) };
                            if (e.target.checked) he[el] = { enabled: !baseEnabled };
                            else delete he[el];
                            if (Object.keys(he).length === 0) {
                              const ov = { ...selectedPage.overrides };
                              delete ov.headerElements;
                              updatePage(selected, "overrides", ov);
                            } else {
                              updatePage(selected, "overrides", { ...selectedPage.overrides, headerElements: he });
                            }
                          }}
                        />
                        {el} {overrideVal !== undefined
                          ? <span style={{ fontSize: 10, color: COLORS.accent }}>(override: {overrideVal.enabled ? "on" : "off"})</span>
                          : <span style={{ fontSize: 10, color: COLORS.textDim }}>(base: {baseEnabled ? "on" : "off"})</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Layout Sections (Wireframe B — scrollable left panel)
// ============================================================================
function LayoutSections({ layout, registry, setLayout, setRegistry }: { layout: any; registry: any; setLayout: (l: any) => void; setRegistry: (r: any) => void }) {
  const onChange = setLayout;
  const [activeTextStyle, setActiveTextStyle] = usePersistentTab("layout-textstyle", "");

  const updateRegion = (name: string, region: any) => {
    onChange({ ...layout, structure: { ...layout.structure, regions: { ...layout.structure.regions, [name]: region } } });
  };
  const updateTokenCat = (cat: string, val: any) => {
    onChange({ ...layout, tokens: { ...layout.tokens, [cat]: val } });
  };

  const textStyleKeys = Object.keys(layout.textStyles || {});
  const safeActiveTS = textStyleKeys.includes(activeTextStyle) ? activeTextStyle : (textStyleKeys[0] || "");

  const DOT = { brand: "#f59e0b", layout: "#3b82f6", header: "#22c55e", tokens: "#a855f7", typo: "#a1a1aa", pages: "#ef4444", io: "#6d9cff" };

  return (
    <div>
      {/* ================================================================ */}
      {/* §1 — MARCA (Logo + Favicon)                                     */}
      {/* ================================================================ */}
      <WBSection title="Marca" dotColor={DOT.brand} tag="logo + favicon" id="sec-brand" defaultOpen={true}>
        <LogoConfigEditor
          logo={layout.structure?.logo}
          onChange={(logo) => onChange({ ...layout, structure: { ...layout.structure, logo } })}
        />
        <WBSub title="Favicon">
          <FaviconEditor
            favicon={layout.structure?.favicon}
            onChange={(fav) => onChange({ ...layout, structure: { ...layout.structure, favicon: fav } })}
          />
        </WBSub>
      </WBSection>

      {/* ================================================================ */}
      {/* §2 — LAYOUT & REGIÕES                                           */}
      {/* ================================================================ */}
      <WBSection title="Layout & Regiões" dotColor={DOT.layout} tag="sidebar · header · main · footer" id="sec-layout" defaultOpen={true}>
        {(["sidebar", "header", "main", "footer"] as const).map(name => (
          <Section
            key={name}
            title={<span>{name.charAt(0).toUpperCase() + name.slice(1)} <span style={{ color: layout.structure.regions[name]?.enabled ? COLORS.success : COLORS.textDim }}>{layout.structure.regions[name]?.enabled ? "●" : "○"}</span></span>}
            defaultOpen={name === "sidebar"}
            id={`wb-region-${name}`}
          >
            <RegionEditor
              name={name}
              region={layout.structure.regions[name]}
              tokens={layout.tokens}
              onChange={(r) => updateRegion(name, r)}
            />
          </Section>
        ))}
        <Section
          title={<span>Breadcrumbs <span style={{ color: layout.structure.breadcrumbs?.enabled ? COLORS.success : COLORS.textDim }}>{layout.structure.breadcrumbs?.enabled ? "●" : "○"}</span></span>}
          defaultOpen={layout.structure.breadcrumbs?.enabled}
          id="wb-breadcrumbs"
        >
          <BreadcrumbEditor
            breadcrumbs={layout.structure.breadcrumbs}
            tokens={layout.tokens}
            onChange={(bc) => onChange({ ...layout, structure: { ...layout.structure, breadcrumbs: bc } })}
          />
        </Section>
      </WBSection>

      {/* ================================================================ */}
      {/* §3 — HEADER ELEMENTS                                            */}
      {/* ================================================================ */}
      <WBSection title="Header Elements" dotColor={DOT.header} tag="busca · cta · ícones · ordem" id="sec-header" defaultOpen={false}>
        <HeaderElementsEditor
          elements={layout.structure?.headerElements}
          onChange={(he) => onChange({ ...layout, structure: { ...layout.structure, headerElements: he } })}
        />
      </WBSection>

      {/* ================================================================ */}
      {/* §3b — TABLE SEPARATOR                                           */}
      {/* ================================================================ */}
      <WBSection title="Table Separator" dotColor={DOT.header} tag="linhas · cor · espessura" id="sec-table-sep" defaultOpen={false}>
        <TableSeparatorEditor
          config={layout.structure?.tableSeparator}
          tokens={layout.tokens}
          onChange={(ts) => onChange({ ...layout, structure: { ...layout.structure, tableSeparator: ts } })}
        />
      </WBSection>

      {/* ================================================================ */}
      {/* §4 — DESIGN TOKENS                                              */}
      {/* ================================================================ */}
      <WBSection title="Design Tokens" dotColor={DOT.tokens} tag="cores · spacing · sizing" id="sec-tokens" defaultOpen={false}>
        <Section title={`Cores (${Object.keys(layout.tokens.colors || {}).length})`} defaultOpen={true} id="wb-colors">
          <ColorTokenEditor colors={layout.tokens.colors || {}} onChange={(v) => updateTokenCat("colors", v)} />
        </Section>
        <Section title="Spacing / Sizing / Border" defaultOpen={false} id="wb-spacing-sizing">
          <TokenEditor tokens={layout.tokens} onChange={(t) => onChange({ ...layout, tokens: t })} />
        </Section>
      </WBSection>

      {/* ================================================================ */}
      {/* §5 — TIPOGRAFIA & TEXT STYLES                                    */}
      {/* ================================================================ */}
      <WBSection title="Tipografia & Text Styles" dotColor={DOT.typo} id="sec-typo" defaultOpen={false}>
        <Section title={`Font Families (${Object.keys(layout.tokens.fontFamilies || {}).length})`} defaultOpen={false} id="wb-font-families">
          <FontFamilyEditor families={layout.tokens.fontFamilies || {}} onChange={(v) => updateTokenCat("fontFamilies", v)} />
        </Section>
        <Section title={`Font Sizes (${Object.keys(layout.tokens.fontSizes || {}).length})`} defaultOpen={false} id="wb-font-sizes">
          <FontSizeEditor sizes={layout.tokens.fontSizes || {}} onChange={(v) => updateTokenCat("fontSizes", v)} />
        </Section>
        <Section title={`Font Weights (${Object.keys(layout.tokens.fontWeights || {}).length})`} defaultOpen={false} id="wb-font-weights">
          <FontWeightEditor weights={layout.tokens.fontWeights || {}} onChange={(v) => updateTokenCat("fontWeights", v)} />
        </Section>
        <Section title={`Line Heights (${Object.keys(layout.tokens.lineHeights || {}).length})`} defaultOpen={false} id="wb-line-heights">
          <LineHeightEditor lineHeights={layout.tokens.lineHeights || {}} onChange={(v) => updateTokenCat("lineHeights", v)} />
        </Section>
        <Section title={`Letter Spacings (${Object.keys(layout.tokens.letterSpacings || {}).length})`} defaultOpen={false} id="wb-letter-spacings">
          <LetterSpacingEditor spacings={layout.tokens.letterSpacings || {}} onChange={(v) => updateTokenCat("letterSpacings", v)} />
        </Section>

        {/* Text Styles */}
        <WBSub title="Text Styles">
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
            const update = (field: string, val: any) => {
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
        </WBSub>
      </WBSection>

      {/* ================================================================ */}
      {/* §6 — PÁGINAS                                                     */}
      {/* ================================================================ */}
      <WBSection title="Páginas" dotColor={DOT.pages} tag={`${Object.keys(layout.structure?.pages || {}).length} pages`} id="sec-pages" defaultOpen={false}>
        <PagesEditor layout={layout} onChange={onChange} />
      </WBSection>

      {/* ================================================================ */}
      {/* §7 — IMPORT / EXPORT                                             */}
      {/* ================================================================ */}
      <WBSection title="Import / Export" dotColor={DOT.io} tag="JSON" id="sec-io" defaultOpen={false}>
        <ImportPanel onImportLayout={setLayout} onImportRegistry={setRegistry} />
        <WBSub title="Export">
          <ExportPanel layout={layout} registry={registry} />
        </WBSub>
      </WBSection>
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

      {/* Component-specific Style Editor */}
      {comp.name === "ScrollArea" && (
        <ScrollAreaStyleEditor styles={comp.styles || {}} onChange={(st) => update("styles", st)} />
      )}
    </div>
  );
}

// ============================================================================
// ScrollArea Style Editor
// ============================================================================
function ScrollAreaStyleEditor({ styles, onChange }) {
  const st = styles || {};
  const upd = (field, val) => onChange({ ...st, [field]: val });

  const PRESETS = [
    { value: "minimal", label: "Minimal — fino, sem setas, discreto" },
    { value: "default", label: "Default — scrollbar padrão do OS" },
    { value: "overlay", label: "Overlay — aparece só no hover" },
    { value: "hidden", label: "Hidden — sem scrollbar visível" },
    { value: "custom", label: "Custom — configuração manual" },
  ];

  const applyPreset = (preset) => {
    switch (preset) {
      case "minimal":
        onChange({ preset: "minimal", thumbWidth: 4, thumbColor: "rgba(255,255,255,0.15)", trackColor: "transparent", thumbRadius: 99, showArrows: false, hoverThumbWidth: 6, hoverThumbColor: "rgba(255,255,255,0.3)" });
        break;
      case "overlay":
        onChange({ preset: "overlay", thumbWidth: 6, thumbColor: "rgba(255,255,255,0.2)", trackColor: "transparent", thumbRadius: 99, showArrows: false, autoHide: true, hoverThumbWidth: 8, hoverThumbColor: "rgba(255,255,255,0.4)" });
        break;
      case "hidden":
        onChange({ preset: "hidden", thumbWidth: 0, thumbColor: "transparent", trackColor: "transparent", showArrows: false });
        break;
      case "default":
        onChange({ preset: "default" });
        break;
      default:
        onChange({ ...st, preset: "custom" });
    }
  };

  const isCustom = st.preset === "custom" || (!st.preset && (st.thumbWidth || st.thumbColor));
  const showCustom = st.preset === "custom" || st.preset === "minimal" || st.preset === "overlay" || isCustom;

  // Live preview
  const previewThumbW = st.thumbWidth ?? 6;
  const previewThumbC = st.thumbColor ?? "rgba(255,255,255,0.2)";
  const previewTrackC = st.trackColor ?? "transparent";
  const previewRadius = st.thumbRadius ?? 99;

  return (
    <Section title="Styles — Scrollbar" defaultOpen={true}>
      <div style={{ ...s.card, marginBottom: 12 }}>
        {/* Live preview */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 180, height: 120, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            overflow: "hidden", position: "relative", background: COLORS.surface2,
          }}>
            <div style={{ padding: 10, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.8 }}>
              {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ padding: "2px 0", borderBottom: `1px solid ${COLORS.border}30` }}>Item {i + 1}</div>)}
            </div>
            {/* Fake scrollbar thumb */}
            {st.preset !== "hidden" && (
              <div style={{
                position: "absolute", right: 1, top: 8,
                width: previewThumbW, height: 40,
                borderRadius: previewRadius,
                background: previewThumbC,
                transition: "all 0.15s",
              }} />
            )}
            {/* Track */}
            {previewTrackC !== "transparent" && st.preset !== "hidden" && (
              <div style={{
                position: "absolute", right: 0, top: 0, bottom: 0,
                width: Math.max(previewThumbW + 2, 8),
                background: previewTrackC,
              }} />
            )}
          </div>
          <div style={{ flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
            {st.preset === "minimal" && "Scrollbar ultra-discreto: 4px, sem setas, quase invisível até o hover."}
            {st.preset === "overlay" && "Scrollbar aparece com opacity ao passar o mouse na área de scroll."}
            {st.preset === "hidden" && "Scrollbar completamente oculto. O conteúdo ainda é scrollável."}
            {st.preset === "default" && "Scrollbar nativo do navegador/OS."}
            {st.preset === "custom" && "Configuração manual de cada propriedade do scrollbar."}
            {!st.preset && "Selecione um preset ou customize manualmente."}
          </div>
        </div>

        {/* Preset selector */}
        <Field label="Preset">
          <select value={st.preset || ""} onChange={(e) => applyPreset(e.target.value)} style={s.select}>
            <option value="">— selecionar —</option>
            {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        {/* Custom controls */}
        {showCustom && (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Thumb</div>
            <Row gap={12}>
              <Field label="Largura (px)" style={{ flex: 1 }}>
                <input type="number" min={0} max={20} value={st.thumbWidth ?? 6} onChange={(e) => upd("thumbWidth", Number(e.target.value))} style={s.input} />
              </Field>
              <Field label="Cor" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.thumbColor?.startsWith("rgba") ? "#ffffff" : (st.thumbColor || "#666666")} onChange={(e) => upd("thumbColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.thumbColor || ""} onChange={(e) => upd("thumbColor", e.target.value)} placeholder="rgba(255,255,255,0.15)" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
              <Field label="Radius" style={{ flex: 0, minWidth: 60 }}>
                <input type="number" min={0} max={99} value={st.thumbRadius ?? 99} onChange={(e) => upd("thumbRadius", Number(e.target.value))} style={s.input} />
              </Field>
            </Row>

            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hover</div>
            <Row gap={12}>
              <Field label="Largura hover (px)" style={{ flex: 1 }}>
                <input type="number" min={0} max={20} value={st.hoverThumbWidth ?? st.thumbWidth ?? 6} onChange={(e) => upd("hoverThumbWidth", Number(e.target.value))} style={s.input} />
              </Field>
              <Field label="Cor hover" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.hoverThumbColor?.startsWith("rgba") ? "#ffffff" : (st.hoverThumbColor || "#999999")} onChange={(e) => upd("hoverThumbColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.hoverThumbColor || ""} onChange={(e) => upd("hoverThumbColor", e.target.value)} placeholder="rgba(255,255,255,0.3)" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
            </Row>

            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Track</div>
            <Row gap={12}>
              <Field label="Cor do track" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.trackColor?.startsWith("rgba") || st.trackColor === "transparent" ? "#111111" : (st.trackColor || "#111111")} onChange={(e) => upd("trackColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.trackColor || ""} onChange={(e) => upd("trackColor", e.target.value)} placeholder="transparent" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
              <Field label="Setas" style={{ flex: 0, minWidth: 80 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                  <input type="checkbox" checked={st.showArrows ?? false} onChange={(e) => upd("showArrows", e.target.checked)} />
                  Exibir
                </label>
              </Field>
            </Row>

            {st.preset === "overlay" && (
              <>
                <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Comportamento</div>
                <Field label="Auto-hide">
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={st.autoHide ?? true} onChange={(e) => upd("autoHide", e.target.checked)} />
                    Ocultar quando parado
                  </label>
                </Field>
              </>
            )}
          </div>
        )}
      </div>
    </Section>
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

      {/* AppShell preview — matches real layout: sidebar full height, header+main on right */}
      <div style={{
        border: `1px solid ${COLORS.border2}`,
        borderRadius: 10,
        overflow: "hidden",
        background: COLORS.bg,
        height: PREVIEW_H,
        display: "flex",
        position: "relative",
      }}>
        {/* Sidebar — full height */}
        {regions.sidebar?.enabled && (
          <div style={{
            width: Math.max(sidebarW * SCALE, 120),
            background: regionColors.sidebar.bg,
            borderRight: `1px solid ${regionColors.sidebar.border}`,
            padding: 8,
            position: "relative",
            overflow: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            order: regions.sidebar.position === "right" ? 2 : 0,
            ...(regions.sidebar.position === "right" ? { borderRight: "none", borderLeft: `1px solid ${regionColors.sidebar.border}` } : {}),
          }}>
            {renderPadding(regions.sidebar, "sidebar")}
            {/* Logo in sidebar */}
            {layout.structure?.logo?.position === "sidebar" && (
              <div style={{
                marginBottom: 8, paddingBottom: 6,
                borderBottom: `1px solid ${regionColors.sidebar.border}`,
                textAlign: layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "right" : "left",
                minHeight: layout.structure.logo.alignWithHeader && regions.header?.enabled ? Math.max((headerH * SCALE || 40) - 16, 24) : undefined,
                display: "flex", alignItems: "center",
                justifyContent: layout.structure.logo.sidebarAlign === "center" ? "center" : layout.structure.logo.sidebarAlign === "right" ? "flex-end" : "flex-start",
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: regionColors.sidebar.text, fontFamily: "'JetBrains Mono', monospace" }}>
                  {layout.structure.logo.type === "icon-text"
                    ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                    : layout.structure.logo.text || "App"}
                </span>
              </div>
            )}
            {renderRegionLabel("sidebar", regions.sidebar)}
            <div style={{ flex: 1, overflow: "auto" }}>
              {(regions.sidebar.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.sidebar.text))}
            </div>
          </div>
        )}

        {/* Right column: header + main + footer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, order: 1 }}>
          {/* Header */}
          {regions.header?.enabled && (
            <div style={{
              height: headerH * SCALE || 40,
              minHeight: 36,
              background: regionColors.header.bg,
              borderBottom: `1px solid ${regionColors.header.border}`,
              padding: 8,
              position: "relative",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}>
              {renderPadding(regions.header, "header")}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                {/* Logo in header */}
                {layout.structure?.logo?.position === "header" && (
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: regionColors.header.text,
                    fontFamily: "'JetBrains Mono', monospace",
                    order: layout.structure.logo.headerSlot === "right" ? 3 : layout.structure.logo.headerSlot === "center" ? 1 : 0,
                    flex: layout.structure.logo.headerSlot === "center" ? 1 : "0 0 auto",
                    textAlign: layout.structure.logo.headerSlot === "center" ? "center" : undefined,
                  }}>
                    {layout.structure.logo.type === "icon-text"
                      ? `${layout.structure.logo.icon || "⬡"} ${layout.structure.logo.text || "App"}`
                      : layout.structure.logo.text || "App"}
                  </div>
                )}
                {/* Breadcrumbs in header */}
                {layout.structure?.breadcrumbs?.enabled && layout.structure.breadcrumbs.position === "header" && (
                  <div style={{ fontSize: 9, color: regionColors.header.text, opacity: 0.7, fontFamily: "'JetBrains Mono', monospace" }}>
                    {layout.structure.breadcrumbs.showHome !== false ? (layout.structure.breadcrumbs.homeLabel || "Home") : ""}
                    {layout.structure.breadcrumbs.showHome !== false ? ` ${layout.structure.breadcrumbs.separator || "/"} ` : ""}
                    Page
                  </div>
                )}
                <div style={{ flex: 1 }} />
                {/* Header elements preview */}
                {layout.structure?.headerElements?.search?.enabled && (
                  <div style={{ fontSize: 8, padding: "2px 4px", borderRadius: 3, background: `${regionColors.header.text}15`, color: regionColors.header.text, border: `1px solid ${regionColors.header.text}25`, display: "inline-flex" }}><MiniPhosphorIcon name="magnifying-glass" size={8} /></div>
                )}
                {layout.structure?.headerElements?.icons?.enabled && (layout.structure.headerElements.icons.items || []).slice(0, 3).map((raw, i) => {
                  const ic = typeof raw === "string" ? raw : raw.id;
                  const phName = HEADER_ICON_PHOSPHOR[ic] || ic;
                  return <div key={i} style={{ display: "inline-flex", padding: "2px 3px", borderRadius: 3, background: `${regionColors.header.text}10`, color: regionColors.header.text }}><MiniPhosphorIcon name={phName} size={8} /></div>;
                })}
                {((layout.structure?.headerElements?.ctas?.length > 0) || layout.structure?.headerElements?.cta?.enabled) && (
                  <div style={{ fontSize: 8, padding: "2px 8px", borderRadius: 3, background: COLORS.accent, color: "#fff" }}>{layout.structure.headerElements.ctas?.[0]?.label || layout.structure.headerElements.cta?.label || "CTA"}</div>
                )}
              </div>
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
            }}>
              {renderPadding(regions.main, "main")}
              {renderRegionLabel("main", regions.main)}
              {(regions.main.containers || [])
                .sort((a, b) => a.order - b.order)
                .map(c => renderContainer(c, regionColors.main.text))}
            </div>
          )}

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
        </div>

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
  const [dragOver, setDragOver] = useState(false);

  const processImport = (text: string) => {
    setError(null);
    setSuccess(null);
    try {
      const data = JSON.parse(text);
      if (data.$orqui?.schema === "layout-contract") {
        const { $orqui, ...rest } = data;
        onImportLayout(rest);
        setSuccess("Layout Contract importado!");
        setJson(text);
      } else if (data.$orqui?.schema === "ui-registry-contract") {
        const { $orqui, ...rest } = data;
        onImportRegistry(rest);
        setSuccess("UI Registry Contract importado!");
        setJson(text);
      } else {
        setError("JSON não é um contrato Orqui válido (campo $orqui.schema não encontrado)");
      }
    } catch (e) {
      setError("JSON inválido: " + e.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    // Try files first
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setJson(text);
        processImport(text);
      };
      reader.readAsText(file);
      return;
    }

    // Then try text data
    const text = e.dataTransfer?.getData("text/plain");
    if (text) {
      setJson(text);
      processImport(text);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setJson(text);
      processImport(text);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <Section title="Import Contract" defaultOpen={true}>
        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={handleDrop}
          onClick={() => document.getElementById("orqui-import-file")?.click()}
          style={{
            border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
            borderRadius: 10,
            padding: 32,
            textAlign: "center",
            background: dragOver ? COLORS.accent + "08" : COLORS.surface2,
            cursor: "pointer",
            transition: "all 0.2s ease",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>{dragOver ? "⬇" : "📄"}</div>
          <div style={{ fontSize: 13, color: dragOver ? COLORS.accent : COLORS.text, fontWeight: 500, marginBottom: 4 }}>
            {dragOver ? "Solte o arquivo aqui" : "Arraste um contrato JSON aqui"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>
            ou clique para selecionar arquivo
          </div>
          <input id="orqui-import-file" type="file" accept=".json,application/json" onChange={handleFileInput} style={{ display: "none" }} />
        </div>

        <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 0, marginBottom: 8 }}>Ou cole o JSON diretamente:</p>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} placeholder="Cole o JSON do contrato aqui..." style={{ ...s.input, height: 120, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }} />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => processImport(json)} style={s.btn} disabled={!json.trim()}>Import</button>
          {json && <button onClick={() => { setJson(""); setError(null); setSuccess(null); }} style={s.btnGhost}>Limpar</button>}
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
// Command Palette (Ctrl+K / Cmd+K)
// ============================================================================
interface CmdItem {
  id: string;
  label: string;
  category: string;
  hint?: string;
  icon?: string;
  action: () => void;
}

function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: CmdItem[] }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollOnNav = useRef(false); // only scroll into view on keyboard nav

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 30);
    const q = query.toLowerCase().trim();
    const terms = q.split(/\s+/);
    return items
      .map((item) => {
        const haystack = `${item.label} ${item.category} ${item.hint || ""}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (!haystack.includes(t)) return null;
          // Boost exact prefix match on label
          if (item.label.toLowerCase().startsWith(t)) score += 10;
          else if (item.label.toLowerCase().includes(t)) score += 5;
          else score += 1;
        }
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 20)
      .map((r) => r!.item);
  }, [items, query]);

  // Clamp active index
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length]);

  // Scroll active into view — only on keyboard nav
  useEffect(() => {
    if (!scrollOnNav.current) return;
    scrollOnNav.current = false;
    const items = listRef.current?.querySelectorAll("[data-cmd-item]");
    const el = items?.[activeIdx] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const execute = (item: CmdItem) => {
    onClose();
    // Small delay so the palette closes before action (e.g. scroll)
    setTimeout(() => item.action(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      scrollOnNav.current = true;
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      scrollOnNav.current = true;
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIdx]) {
      e.preventDefault();
      execute(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  // Group by category
  const groups: { cat: string; items: CmdItem[] }[] = [];
  const seen = new Set<string>();
  for (const item of filtered) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      groups.push({ cat: item.category, items: [] });
    }
    groups.find((g) => g.cat === item.category)!.items.push(item);
  }

  const CAT_COLORS: Record<string, string> = {
    "Seção": "#6d9cff",
    "Token": "#f0a040",
    "Cor": "#e06090",
    "Componente": "#50d080",
    "Ação": "#c080ff",
    "Tipografia": "#60c0e0",
    "Página": "#e0c040",
  };

  let globalIdx = 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxHeight: "60vh",
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <span style={{ fontSize: 16, color: COLORS.textDim, flexShrink: 0 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar seções, tokens, cores, componentes, ações…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: COLORS.text, fontSize: 15, fontFamily: "'Inter', sans-serif",
            }}
          />
          <kbd style={{
            fontSize: 10, color: COLORS.textDim, background: COLORS.surface2,
            padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.border}`,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "24px 18px", textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
              Nenhum resultado para "{query}"
            </div>
          )}
          {groups.map((group) => (
            <div key={group.cat}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: COLORS.textDim,
                textTransform: "uppercase", letterSpacing: "0.8px",
                padding: "8px 18px 4px",
              }}>{group.cat}</div>
              {group.items.map((item) => {
                const idx = globalIdx++;
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={item.id}
                    data-cmd-item=""
                    onClick={() => execute(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 18px", cursor: "pointer",
                      background: isActive ? COLORS.surface3 : "transparent",
                      transition: "background 0.08s",
                    }}
                  >
                    {/* Color swatch for color tokens */}
                    {item.icon === "swatch" && item.hint ? (
                      <div style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        background: item.hint, border: `1px solid ${COLORS.border}`,
                      }} />
                    ) : (
                      <span style={{ fontSize: 13, width: 18, textAlign: "center", flexShrink: 0, color: COLORS.textDim }}>
                        {item.icon || "→"}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13, color: isActive ? COLORS.text : COLORS.textMuted }}>
                      {item.label}
                    </span>
                    {item.hint && item.icon !== "swatch" && (
                      <span style={{
                        fontSize: 11, color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace",
                        maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{item.hint}</span>
                    )}
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 3,
                      background: (CAT_COLORS[item.category] || COLORS.textDim) + "18",
                      color: CAT_COLORS[item.category] || COLORS.textDim,
                      fontWeight: 600, flexShrink: 0,
                    }}>{item.category}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: "8px 18px", borderTop: `1px solid ${COLORS.border}`,
          display: "flex", gap: 16, fontSize: 10, color: COLORS.textDim,
        }}>
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}

function useCommandPaletteItems(
  layout: any,
  registry: any,
  setActiveTab: (t: string) => void,
  scrollToSection: (id: string) => void,
  openAccordion: (id: string) => void,
): CmdItem[] {
  return useMemo(() => {
    const items: CmdItem[] = [];

    // ---- Seções ----
    const sections = [
      { id: "sec-brand", label: "Marca (Logo + Favicon)", icon: "🏷" },
      { id: "sec-layout", label: "Layout & Regiões", icon: "📐" },
      { id: "wb-breadcrumbs", label: "Breadcrumbs", icon: "🔗" },
      { id: "sec-header", label: "Header Elements", icon: "📌" },
      { id: "sec-table-sep", label: "Table Separator", icon: "📊" },
      { id: "sec-tokens", label: "Design Tokens", icon: "🎨" },
      { id: "wb-colors", label: "Cores (tokens)", icon: "🎨" },
      { id: "wb-spacing-sizing", label: "Spacing / Sizing / Border", icon: "📏" },
      { id: "sec-typo", label: "Tipografia & Text Styles", icon: "✏️" },
      { id: "wb-font-families", label: "Font Families", icon: "🔤" },
      { id: "wb-font-sizes", label: "Font Sizes", icon: "🔠" },
      { id: "wb-font-weights", label: "Font Weights", icon: "🅱" },
      { id: "wb-line-heights", label: "Line Heights", icon: "↕" },
      { id: "wb-letter-spacings", label: "Letter Spacings", icon: "↔" },
      { id: "sec-pages", label: "Páginas", icon: "📄" },
      { id: "sec-io", label: "Import / Export", icon: "📦" },
    ];
    for (const sec of sections) {
      items.push({
        id: `nav:${sec.id}`, label: sec.label, category: "Seção", icon: sec.icon,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => {
            openAccordion(sec.id);
            scrollToSection(sec.id);
          }, 60);
        },
      });
    }

    // ---- Cores ----
    const colors = layout.tokens?.colors || {};
    for (const [key, tok] of Object.entries(colors)) {
      const val = (tok as any).value;
      items.push({
        id: `color:${key}`, label: key, category: "Cor", icon: "swatch", hint: val,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("wb-colors"); scrollToSection("wb-colors"); }, 60);
        },
      });
    }

    // ---- Tokens (spacing, sizing, radii, fontSizes, fontWeights) ----
    const tokenCats = [
      { cat: "spacing", label: "Spacing" },
      { cat: "sizing", label: "Sizing" },
      { cat: "borderRadius", label: "Border Radius" },
      { cat: "fontSizes", label: "Font Size" },
      { cat: "fontWeights", label: "Font Weight" },
      { cat: "lineHeights", label: "Line Height" },
      { cat: "letterSpacings", label: "Letter Spacing" },
    ];
    for (const tc of tokenCats) {
      const toks = layout.tokens?.[tc.cat] || {};
      for (const [key, tok] of Object.entries(toks)) {
        const v = tok as any;
        const display = v.value != null ? (v.unit ? `${v.value}${v.unit}` : `${v.value}`) : (v.family || "");
        items.push({
          id: `token:${tc.cat}.${key}`, label: `${tc.label}: ${key}`, category: "Token", icon: "◆", hint: display,
          action: () => {
            setActiveTab("layout");
            const sectionId = tc.cat === "spacing" || tc.cat === "sizing" || tc.cat === "borderRadius" || tc.cat === "borderWidth" ? "wb-spacing-sizing"
              : tc.cat === "fontSizes" ? "wb-font-sizes"
              : tc.cat === "fontWeights" ? "wb-font-weights"
              : tc.cat === "lineHeights" ? "wb-line-heights"
              : tc.cat === "letterSpacings" ? "wb-letter-spacings"
              : "sec-tokens";
            setTimeout(() => { openAccordion(sectionId); scrollToSection(sectionId); }, 60);
          },
        });
      }
    }

    // ---- Font Families ----
    const fontFamilies = layout.tokens?.fontFamilies || {};
    for (const [key, tok] of Object.entries(fontFamilies)) {
      const fam = (tok as any).family || key;
      items.push({
        id: `font:${key}`, label: `Font: ${fam}`, category: "Tipografia", icon: "🔤", hint: key,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("wb-font-families"); scrollToSection("wb-font-families"); }, 60);
        },
      });
    }

    // ---- Text Styles ----
    const textStyles = layout.textStyles || {};
    for (const key of Object.keys(textStyles)) {
      items.push({
        id: `ts:${key}`, label: `Text Style: ${key}`, category: "Tipografia", icon: "✏️",
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("sec-typo"); scrollToSection("sec-typo"); }, 60);
        },
      });
    }

    // ---- Componentes ----
    const comps = registry.components || {};
    for (const [name, comp] of Object.entries(comps)) {
      const c = comp as any;
      items.push({
        id: `comp:${name}`, label: name, category: "Componente", icon: "◻",
        hint: c.category || "",
        action: () => {
          setActiveTab("components");
        },
      });
    }

    // ---- Páginas ----
    const pages = layout.structure?.pages || {};
    for (const [key, pg] of Object.entries(pages)) {
      const p = pg as any;
      items.push({
        id: `page:${key}`, label: `Página: ${p.label || key}`, category: "Página", icon: "📄",
        hint: key,
        action: () => {
          setActiveTab("layout");
          setTimeout(() => { openAccordion("sec-pages"); scrollToSection("sec-pages"); }, 60);
        },
      });
    }

    // ---- Ações ----
    items.push({
      id: "act:save", label: "Salvar no projeto", category: "Ação", icon: "💾",
      action: () => {
        document.querySelector<HTMLButtonElement>('button[class*="save"], button')?.click();
      },
    });
    items.push({
      id: "act:export-layout", label: "Export Layout JSON", category: "Ação", icon: "📦",
      action: () => {
        setActiveTab("layout");
        setTimeout(() => { openAccordion("sec-io"); scrollToSection("sec-io"); }, 60);
      },
    });
    items.push({
      id: "act:tab-layout", label: "Ir para Layout", category: "Ação", icon: "📐",
      action: () => setActiveTab("layout"),
    });
    items.push({
      id: "act:tab-components", label: "Ir para Componentes", category: "Ação", icon: "◻",
      action: () => setActiveTab("components"),
    });

    return items;
  }, [layout, registry, setActiveTab, scrollToSection, openAccordion]);
}

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
  const [previewTab, setPreviewTab] = useState("layout");

  // Snapshot for undo: stores state at last save
  const [savedSnapshot, setSavedSnapshot] = useState<{ layout: any; registry: any } | null>(null);
  const hasUnsavedChanges = savedSnapshot && (
    JSON.stringify(layout) !== JSON.stringify(savedSnapshot.layout) ||
    JSON.stringify(registry) !== JSON.stringify(savedSnapshot.registry)
  );

  const undoChanges = useCallback(() => {
    if (!savedSnapshot) return;
    setLayout(savedSnapshot.layout);
    setRegistry(savedSnapshot.registry);
  }, [savedSnapshot]);

  // Load: try API first (filesystem), then IndexedDB (draft), then defaults
  useEffect(() => {
    (async () => {
      const apiContracts = await apiLoadContracts();
      if (apiContracts) {
        setHasApi(true);
        let loadedLayout = null, loadedRegistry = null;
        if (apiContracts["layout-contract"]) {
          const { $orqui, ...data } = apiContracts["layout-contract"];
          setLayout(data);
          loadedLayout = data;
        }
        if (apiContracts["ui-registry-contract"]) {
          const { $orqui, ...data } = apiContracts["ui-registry-contract"];
          setRegistry(data);
          loadedRegistry = data;
        }
        setSavedSnapshot({ layout: loadedLayout || layout, registry: loadedRegistry || registry });
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
    if (r1.ok && r2.ok) {
      setSavedSnapshot({ layout: { ...layout }, registry: { ...registry } });
    }
    setSaveStatus(r1.ok && r2.ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [layout, registry, hasApi]);

  // Scroll spy for section indicator dots
  const configRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("sec-brand");
  const sectionDots = [
    { id: "sec-brand", color: "#f59e0b", label: "Marca" },
    { id: "sec-layout", color: "#3b82f6", label: "Layout" },
    { id: "sec-header", color: "#22c55e", label: "Header" },
    { id: "sec-tokens", color: "#a855f7", label: "Tokens" },
    { id: "sec-typo", color: "#a1a1aa", label: "Tipografia" },
    { id: "sec-pages", color: "#ef4444", label: "Páginas" },
    { id: "sec-io", color: "#6d9cff", label: "I/O" },
  ];

  useEffect(() => {
    const el = configRef.current;
    if (!el) return;
    const handleScroll = () => {
      const ids = sectionDots.map(d => d.id);
      let active = ids[0];
      ids.forEach(id => {
        const sec = document.getElementById(id);
        if (sec && sec.offsetTop - el.offsetTop - 120 <= el.scrollTop) active = id;
      });
      setActiveSection(active);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  const scrollToSection = (id: string) => {
    const sec = document.getElementById(id);
    const el = configRef.current;
    if (sec && el) {
      el.scrollTo({ top: sec.offsetTop - el.offsetTop, behavior: "smooth" });
    }
  };

  // Command Palette
  const [cmdOpen, setCmdOpen] = useState(false);

  // Orqui favicon
  useEffect(() => {
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${COLORS.accent}"><path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z"/></svg>`;
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    link.type = "image/svg+xml";
    document.title = "orqui — contract editor";
  }, []);

  const openAccordion = useCallback((sectionId: string) => {
    // Dispatch custom event that usePersistentState hooks listen for
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: sectionId }));
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: `wb-${sectionId}` }));
  }, []);

  const cmdItems = useCommandPaletteItems(layout, registry, setActiveTab, scrollToSection, openAccordion);

  // Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const CONFIG_WIDTH = 460;

  return (
    <div style={{
      background: COLORS.bg, height: "100vh", color: COLORS.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ============================================================ */}
      {/* TOPBAR                                                        */}
      {/* ============================================================ */}
      <div style={{
        height: 52, flexShrink: 0, background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 256 256" fill={COLORS.accent}>
            <path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z" />
          </svg>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
            fontSize: 16, color: COLORS.accent, letterSpacing: "-0.5px",
          }}>orqui</span>
        </div>

        {/* Dot separator */}
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.border }} />

        {/* Tab pills */}
        <div style={{
          display: "flex", gap: 2, background: COLORS.surface2,
          padding: 3, borderRadius: 8,
        }}>
          {[
            { id: "layout", label: "Layout" },
            { id: "components", label: "Componentes" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: activeTab === tab.id ? COLORS.surface3 : "transparent",
              color: activeTab === tab.id ? COLORS.text : COLORS.textDim,
              boxShadow: activeTab === tab.id ? "0 1px 3px #0003" : "none",
              transition: "all 0.15s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Search trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 8, fontSize: 12,
            border: `1px solid ${COLORS.border}`, cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: COLORS.surface2, color: COLORS.textDim,
            transition: "all 0.15s", minWidth: 180,
          }}
        >
          <span style={{ fontSize: 13 }}>⌘</span>
          <span style={{ flex: 1, textAlign: "left" }}>Buscar…</span>
          <kbd style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 3,
            background: COLORS.surface3, border: `1px solid ${COLORS.border}`,
            color: COLORS.textDim,
          }}>⌘K</kbd>
        </button>

        <div style={{ flex: 1 }} />

        {/* Status badges */}
        <span style={{
          ...s.tag, fontSize: 10,
          background: `${COLORS.success}15`, color: COLORS.success,
          border: `1px solid ${COLORS.success}30`,
        }}>
          {Object.values(layout.structure.regions).filter((r: any) => r.enabled).length} regions
        </span>
        <span style={{
          ...s.tag, fontSize: 10,
          background: `${COLORS.accent}15`, color: COLORS.accent,
          border: `1px solid ${COLORS.accent}30`,
        }}>
          {Object.keys(registry.components).length} components
        </span>
        <span style={{ ...s.tag, fontSize: 10 }}>IndexedDB ✓</span>

        {/* Undo */}
        {hasApi && hasUnsavedChanges && (
          <button onClick={undoChanges} style={{
            padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: `1px solid ${COLORS.danger}30`, cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: "transparent", color: COLORS.danger,
          }}>
            ↩ Desfazer
          </button>
        )}

        {/* Save */}
        {hasApi && (
          <button onClick={saveToFilesystem} disabled={saveStatus === "saving"} style={{
            padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: "none", cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            background: saveStatus === "saved" ? COLORS.success : saveStatus === "error" ? COLORS.danger : COLORS.accent,
            color: "#fff",
            opacity: saveStatus === "saving" ? 0.6 : 1,
            transition: "all 0.15s",
          }}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "✕ Error" : "Save to Project"}
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* MAIN LAYOUT: config scroll (left) + preview (right)           */}
      {/* ============================================================ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — scrollable config panel */}
        <div
          ref={configRef}
          style={{
            width: CONFIG_WIDTH, flexShrink: 0,
            overflowY: "auto", overflowX: "hidden",
            borderRight: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            scrollBehavior: "smooth" as const,
          }}
        >
          {activeTab === "layout" && (
            <LayoutSections
              layout={layout}
              registry={registry}
              setLayout={setLayout}
              setRegistry={setRegistry}
            />
          )}
          {activeTab === "components" && (
            <div style={{ padding: 20 }}>
              <UIRegistryEditor registry={registry} onChange={setRegistry} />
            </div>
          )}
        </div>

        {/* RIGHT — preview pane */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: COLORS.bg, position: "relative",
        }}>
          {/* Preview tab bar */}
          <div style={{
            padding: "0 24px", display: "flex", gap: 0,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            flexShrink: 0,
          }}>
            {[
              { id: "layout", label: "Layout" },
              { id: "typography", label: "Tipografia" },
              { id: "components", label: "Componentes" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setPreviewTab(tab.id)} style={{
                padding: "12px 16px", fontSize: 11, fontWeight: 500,
                border: "none", cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                borderBottom: previewTab === tab.id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                background: "transparent",
                color: previewTab === tab.id ? COLORS.text : COLORS.textDim,
                transition: "color 0.15s",
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Preview content */}
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
            {previewTab === "layout" && <LayoutPreview layout={layout} />}
            {previewTab === "typography" && <TypographyPreview layout={layout} />}
            {previewTab === "components" && <ComponentPreview registry={registry} />}
          </div>

          {/* Scroll spy dots — only in layout tab */}
          {activeTab === "layout" && (
            <div style={{
              position: "absolute", right: 16, top: "50%",
              transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: 6,
              zIndex: 10,
            }}>
              {sectionDots.map(dot => (
                <div
                  key={dot.id}
                  onClick={() => scrollToSection(dot.id)}
                  title={dot.label}
                  style={{
                    width: activeSection === dot.id ? 10 : 7,
                    height: activeSection === dot.id ? 10 : 7,
                    borderRadius: "50%",
                    background: dot.color,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: activeSection === dot.id ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Command Palette overlay */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
    </div>
  );
}
