import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================
interface TokenValue { value: number; unit: string }
interface FontFamilyToken { family: string; fallbacks: string[] }
interface FontWeightToken { value: number }
interface UnitlessToken { value: number }
interface ColorToken { value: string }
interface Container { name: string; description: string; order: number }
interface RegionConfig {
  enabled: boolean;
  position?: string;
  dimensions?: Record<string, string>;
  padding?: Record<string, string>;
  containers?: Container[];
  behavior?: { fixed: boolean; collapsible: boolean; scrollable: boolean };
}
interface TextStyleDef {
  description?: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}
interface LogoConfig {
  type: "text" | "image" | "icon-text";
  text?: string;
  icon?: string;
  iconUrl?: string;
  iconSize?: number;
  imageUrl?: string;
  position: "sidebar" | "header";
  headerSlot?: "left" | "center" | "right";
  sidebarAlign?: "left" | "center" | "right";
  alignWithHeader?: boolean;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  iconGap?: number;
  typography?: { fontFamily?: string; fontSize?: number; fontWeight?: number; color?: string; letterSpacing?: number };
}
interface FaviconConfig {
  type: "none" | "emoji" | "image";
  url?: string;
  emoji?: string;
}
interface HeaderElementsConfig {
  search?: { enabled: boolean; placeholder?: string };
  cta?: { enabled: boolean; label?: string; variant?: string; route?: string };
  icons?: { enabled: boolean; items?: Array<string | { id: string; route?: string }> };
}
interface PageConfig {
  label: string;
  route: string;
  description?: string;
  overrides: {
    [regionName: string]: any;
    headerElements?: Partial<HeaderElementsConfig>;
  };
}
interface Tokens {
  spacing: Record<string, TokenValue>;
  sizing: Record<string, TokenValue>;
  colors: Record<string, ColorToken>;
  fontFamilies: Record<string, FontFamilyToken>;
  fontSizes: Record<string, TokenValue>;
  fontWeights: Record<string, FontWeightToken>;
  lineHeights: Record<string, UnitlessToken>;
  letterSpacings: Record<string, TokenValue>;
  borderRadius: Record<string, TokenValue>;
  borderWidth: Record<string, TokenValue>;
  [key: string]: any;
}
interface BreadcrumbsConfig {
  enabled: boolean;
  position: "header" | "sidebar-top" | "sidebar-bottom";
  alignment?: "left" | "center" | "right";
  separator: string;
  clickable: boolean;
  showHome?: boolean;
  homeLabel?: string;
  homeRoute?: string;
}
interface LayoutContract {
  $orqui?: any;
  structure: {
    regions: Record<string, RegionConfig>;
    breadcrumbs?: BreadcrumbsConfig;
    logo?: LogoConfig;
    favicon?: FaviconConfig;
    headerElements?: HeaderElementsConfig;
    pages?: Record<string, PageConfig>;
  };
  tokens: Tokens;
  textStyles: Record<string, TextStyleDef>;
}
interface UIRegistryContract {
  $orqui?: any;
  components: Record<string, any>;
}
interface ContractContextValue {
  layout: LayoutContract;
  registry: UIRegistryContract;
  resolveToken: (ref: string) => string | number | null;
  getTextStyle: (name: string) => CSSProperties;
  getTokenValue: (category: string, key: string) => string;
  color: (name: string) => string;
  tokens: Tokens;
}

// ============================================================================
// Token Resolution
// ============================================================================
function resolveTokenRef(ref: string, tokens: Tokens): string | number | null {
  if (!ref || !ref.startsWith("$tokens.")) return null;
  const path = ref.replace("$tokens.", "").split(".");
  let current: any = tokens;
  for (const segment of path) {
    if (current == null) return null;
    current = current[segment];
  }
  if (current == null) return null;
  if (current.family) return [current.family, ...(current.fallbacks || [])].join(", ");
  if (current.value !== undefined && current.unit !== undefined) return `${current.value}${current.unit}`;
  if (current.value !== undefined) return current.value;
  return null;
}

function tokenToCSS(token: any): string {
  if (typeof token === "string") return token;
  if ("family" in token) return [token.family, ...(token as FontFamilyToken).fallbacks].join(", ");
  if ("unit" in token) return `${token.value}${token.unit}`;
  return String(token.value);
}

function resolveTextStyleCSS(style: TextStyleDef, tokens: Tokens): CSSProperties {
  const css: CSSProperties = {};
  const ff = resolveTokenRef(style.fontFamily, tokens);
  if (ff) css.fontFamily = String(ff);
  const fs = resolveTokenRef(style.fontSize, tokens);
  if (fs) css.fontSize = String(fs);
  const fw = resolveTokenRef(style.fontWeight, tokens);
  if (fw != null) css.fontWeight = Number(fw);
  const lh = resolveTokenRef(style.lineHeight, tokens);
  if (lh != null) css.lineHeight = Number(lh);
  if (style.letterSpacing) {
    const ls = resolveTokenRef(style.letterSpacing, tokens);
    if (ls) css.letterSpacing = String(ls);
  }
  return css;
}

// ============================================================================
// CSS Variable Override Generation
//
// Maps Orqui contract colors → shadcn + Spark CSS variables with !important
// so the contract ALWAYS wins over existing stylesheets.
// ============================================================================

function buildStyleSheet(tokens: Tokens): string {
  const colors = tokens.colors ?? {};
  const c = (name: string) => colors[name]?.value ?? "";
  const lines: string[] = [];
  const imp = " !important"; // every override wins

  // --- Orqui's own token variables (no !important, these are new) ---
  lines.push(":root {");
  for (const [category, entries] of Object.entries(tokens)) {
    for (const [key, token] of Object.entries(entries as Record<string, any>)) {
      if (token && typeof token === "object") {
        lines.push(`  --orqui-${category}-${key}: ${tokenToCSS(token)};`);
      }
    }
  }
  lines.push("}");

  // --- shadcn variable overrides (with !important) ---
  lines.push("");
  lines.push("/* Orqui Contract → shadcn overrides */");
  lines.push(":root, .dark {");

  if (c("bg"))           lines.push(`  --background: ${c("bg")}${imp};`);
  if (c("text"))         lines.push(`  --foreground: ${c("text")}${imp};`);

  // Card
  const cardBg = c("card-bg") || c("surface");
  if (cardBg)            lines.push(`  --card: ${cardBg}${imp};`);
  if (c("text"))         lines.push(`  --card-foreground: ${c("text")}${imp};`);

  // Popover
  if (cardBg)            lines.push(`  --popover: ${cardBg}${imp};`);
  if (c("text"))         lines.push(`  --popover-foreground: ${c("text")}${imp};`);

  // Primary = Orqui accent
  if (c("accent"))       lines.push(`  --primary: ${c("accent")}${imp};`);
  if (c("accent-fg"))    lines.push(`  --primary-foreground: ${c("accent-fg")}${imp};`);

  // Secondary
  if (c("surface-2"))    lines.push(`  --secondary: ${c("surface-2")}${imp};`);
  if (c("text"))         lines.push(`  --secondary-foreground: ${c("text")}${imp};`);

  // Muted
  if (c("surface-2"))    lines.push(`  --muted: ${c("surface-2")}${imp};`);
  if (c("text-muted"))   lines.push(`  --muted-foreground: ${c("text-muted")}${imp};`);

  // Accent (shadcn accent = hover/active states)
  if (c("surface-3"))    lines.push(`  --accent: ${c("surface-3")}${imp};`);
  if (c("text"))         lines.push(`  --accent-foreground: ${c("text")}${imp};`);

  // Destructive
  if (c("danger"))       lines.push(`  --destructive: ${c("danger")}${imp};`);

  // Border & Input
  if (c("border"))       lines.push(`  --border: ${c("border")}${imp};`);
  if (c("input-border")) lines.push(`  --input: ${c("input-border")}${imp};`);
  else if (c("border"))  lines.push(`  --input: ${c("border")}${imp};`);

  // Ring
  if (c("ring"))         lines.push(`  --ring: ${c("ring")}${imp};`);

  // Charts
  if (c("accent"))       lines.push(`  --chart-1: ${c("accent")}${imp};`);
  if (c("success"))      lines.push(`  --chart-2: ${c("success")}${imp};`);
  if (c("warning"))      lines.push(`  --chart-3: ${c("warning")}${imp};`);
  if (c("danger"))       lines.push(`  --chart-4: ${c("danger")}${imp};`);

  // Sidebar
  if (c("sidebar-bg"))   lines.push(`  --sidebar: ${c("sidebar-bg")}${imp};`);
  if (c("text"))         lines.push(`  --sidebar-foreground: ${c("text")}${imp};`);
  if (c("accent"))       lines.push(`  --sidebar-primary: ${c("accent")}${imp};`);
  if (c("accent-fg"))    lines.push(`  --sidebar-primary-foreground: ${c("accent-fg")}${imp};`);
  if (c("surface-3"))    lines.push(`  --sidebar-accent: ${c("surface-3")}${imp};`);
  if (c("text"))         lines.push(`  --sidebar-accent-foreground: ${c("text")}${imp};`);
  if (c("border"))       lines.push(`  --sidebar-border: ${c("border")}${imp};`);
  if (c("ring"))         lines.push(`  --sidebar-ring: ${c("ring")}${imp};`);

  lines.push("}");

  // --- Spark variable overrides ---
  const sparkLines: string[] = [];
  if (c("bg"))           sparkLines.push(`  --color-bg: ${c("bg")}${imp};`);
  if (c("surface"))      sparkLines.push(`  --color-bg-inset: ${c("surface")}${imp};`);
  if (c("surface-2"))    sparkLines.push(`  --color-bg-overlay: ${c("surface-2")}${imp};`);
  if (c("text"))         sparkLines.push(`  --color-fg: ${c("text")}${imp};`);
  if (c("text-muted"))   sparkLines.push(`  --color-fg-secondary: ${c("text-muted")}${imp};`);
  if (c("bg"))           sparkLines.push(`  --color-neutral-1: ${c("bg")}${imp};`);
  if (c("surface"))      sparkLines.push(`  --color-neutral-2: ${c("surface")}${imp};`);
  if (c("surface-2"))    sparkLines.push(`  --color-neutral-3: ${c("surface-2")}${imp};`);
  if (c("surface-3"))    sparkLines.push(`  --color-neutral-4: ${c("surface-3")}${imp};`);
  if (c("border"))       sparkLines.push(`  --color-neutral-6: ${c("border")}${imp};`);
  if (c("border-2"))     sparkLines.push(`  --color-neutral-7: ${c("border-2")}${imp};`);
  if (c("text-dim"))     sparkLines.push(`  --color-neutral-9: ${c("text-dim")}${imp};`);
  if (c("text-muted"))   sparkLines.push(`  --color-neutral-11: ${c("text-muted")}${imp};`);
  if (c("text"))         sparkLines.push(`  --color-neutral-12: ${c("text")}${imp};`);
  if (c("accent"))       sparkLines.push(`  --color-focus-ring: ${c("accent")}${imp};`);

  if (sparkLines.length > 0) {
    lines.push("");
    lines.push("/* Orqui Contract → Spark overrides */");
    lines.push(":root, :root #spark-app, :root #spark-app.dark-theme {");
    lines.push(...sparkLines);
    lines.push("}");
  }

  // --- Typography overrides ---
  const fonts = tokens.fontFamilies ?? {};
  const fontSizes = tokens.fontSizes ?? {};
  const borderRadius = tokens.borderRadius ?? {};
  const borderWidth = tokens.borderWidth ?? {};

  lines.push("");
  lines.push("/* Orqui Contract → Typography + Layout overrides */");
  lines.push(":root, .dark {");

  // Font families → shadcn variables
  if (fonts.primary) {
    const ff = [fonts.primary.family, ...(fonts.primary.fallbacks || [])].join(", ");
    lines.push(`  --font-sans: ${ff}${imp};`);
  }
  if (fonts.mono) {
    const ff = [fonts.mono.family, ...(fonts.mono.fallbacks || [])].join(", ");
    lines.push(`  --font-mono: ${ff}${imp};`);
  }

  // Border radius → shadcn --radius (base value, components derive from it)
  if (borderRadius.lg) lines.push(`  --radius: ${borderRadius.lg.value}${borderRadius.lg.unit}${imp};`);

  lines.push("}");

  // --- Global body/html styles ---
  lines.push("");
  lines.push("/* Orqui Contract → Global base styles */");

  const primaryFont = fonts.primary
    ? [fonts.primary.family, ...(fonts.primary.fallbacks || [])].join(", ")
    : null;
  const baseFontSize = fontSizes.md ? `${fontSizes.md.value}${fontSizes.md.unit}` : null;

  lines.push("html, body {");
  if (primaryFont) lines.push(`  font-family: ${primaryFont}${imp};`);
  if (baseFontSize) lines.push(`  font-size: ${baseFontSize}${imp};`);
  lines.push(`  -webkit-font-smoothing: antialiased${imp};`);
  lines.push(`  -moz-osx-font-smoothing: grayscale${imp};`);
  lines.push("}");

  // --- Card and component refinements ---
  // Override shadcn's rounded-xl on cards to use contract border-radius
  const cardRadius = borderRadius.lg ? `${borderRadius.lg.value}${borderRadius.lg.unit}` : null;
  const thinBorder = borderWidth.thin ? `${borderWidth.thin.value}${borderWidth.thin.unit}` : null;

  if (cardRadius || thinBorder || c("card-border")) {
    lines.push("");
    lines.push("/* Orqui Contract → Component style normalization */");
    lines.push("[data-slot='card'] {");
    if (cardRadius) lines.push(`  border-radius: ${cardRadius}${imp};`);
    if (thinBorder) lines.push(`  border-width: ${thinBorder}${imp};`);
    if (c("card-border")) lines.push(`  border-color: ${c("card-border")}${imp};`);
    lines.push("}");
  }

  // --- Collapsed sidebar display modes ---
  lines.push("");
  lines.push("/* Orqui Contract → Collapsed sidebar nav styles */");
  // When collapsed with letter-only mode, truncate text to first letter
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] a,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] button {`);
  lines.push(`  overflow: hidden; text-overflow: clip; white-space: nowrap;`);
  lines.push(`  width: 36px; height: 36px; padding: 0${imp}; justify-content: center;`);
  lines.push(`  display: flex; align-items: center; border-radius: 6px; font-size: 13px; font-weight: 600;`);
  lines.push(`}`);
  // Hide all text content, show only first letter via ::first-letter won't work,
  // so we use a font-size trick: make text invisible and use a pseudo-element approach
  // Actually the simplest: make text size 0 and use text-indent
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] a span,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] button span {`);
  lines.push(`  display: none;`);
  lines.push(`}`);
  // Icon-only: hide labels
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] a,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] button {`);
  lines.push(`  overflow: hidden; white-space: nowrap; width: 36px; height: 36px; padding: 0${imp};`);
  lines.push(`  display: flex; align-items: center; justify-content: center; border-radius: 6px;`);
  lines.push(`}`);

  // --- Sidebar structural integrity ---
  // Ensure sidebar sections ALWAYS span full sidebar width regardless of host app CSS
  lines.push("");
  lines.push("/* Orqui Contract → Sidebar structural integrity */");
  lines.push(`[data-orqui-sidebar] {`);
  lines.push(`  padding: 0${imp};`);
  lines.push(`  box-sizing: border-box${imp};`);
  lines.push(`  overflow: hidden${imp};`);
  lines.push(`}`);
  lines.push(`[data-orqui-sidebar] > * {`);
  lines.push(`  width: 100%${imp};`);
  lines.push(`  max-width: 100%${imp};`);
  lines.push(`  box-sizing: border-box${imp};`);
  lines.push(`  margin-left: 0${imp};`);
  lines.push(`  margin-right: 0${imp};`);
  lines.push(`}`);
  lines.push(`[data-orqui-sidebar-header] {`);
  lines.push(`  flex-shrink: 0${imp};`);
  lines.push(`}`);

  return lines.join("\n");
}

// ============================================================================
// Context
// ============================================================================
const ContractContext = createContext<ContractContextValue | null>(null);

export function useContract(): ContractContextValue {
  const ctx = useContext(ContractContext);
  if (!ctx) throw new Error("useContract must be used within <ContractProvider>");
  return ctx;
}

// ============================================================================
// ContractProvider
// ============================================================================
interface ContractProviderProps {
  layout: LayoutContract;
  registry: UIRegistryContract;
  children: ReactNode;
  injectCSS?: boolean;
}

export function ContractProvider({ layout, registry, children, injectCSS = true }: ContractProviderProps) {
  const value = useMemo<ContractContextValue>(() => ({
    layout, registry, tokens: layout.tokens,
    resolveToken: (ref: string) => resolveTokenRef(ref, layout.tokens),
    getTextStyle: (name: string) => {
      const style = layout.textStyles[name];
      return style ? resolveTextStyleCSS(style, layout.tokens) : {};
    },
    getTokenValue: (category: string, key: string) => {
      const token = layout.tokens[category]?.[key];
      return token ? tokenToCSS(token) : "";
    },
    color: (name: string) => layout.tokens.colors?.[name]?.value ?? "",
  }), [layout, registry]);

  const styleSheet = useMemo(
    () => injectCSS ? buildStyleSheet(layout.tokens) : "",
    [layout.tokens, injectCSS]
  );

  // Dynamically load Google Fonts for all referenced font families
  useEffect(() => {
    const families = layout.tokens.fontFamilies ?? {};
    const toLoad = Object.values(families)
      .map((f: any) => f.family)
      .filter(Boolean);
    if (toLoad.length === 0) return;
    const existing = new Set(
      Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((l: HTMLLinkElement) => l.href)
    );
    toLoad.forEach((family: string) => {
      const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
      if (!existing.has(url)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
      }
    });
  }, [layout.tokens.fontFamilies]);

  return (
    <ContractContext.Provider value={value}>
      {injectCSS && <style dangerouslySetInnerHTML={{ __html: styleSheet }} />}
      {children}
    </ContractContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================
export function useToken(category: string, key: string): string {
  const { getTokenValue } = useContract();
  return getTokenValue(category, key);
}

export function useTextStyle(name: string): CSSProperties {
  const { getTextStyle } = useContract();
  return useMemo(() => getTextStyle(name), [getTextStyle, name]);
}

export function useTokens(): Tokens { return useContract().tokens; }
export function useColor(name: string): string { return useContract().color(name); }

export function useComponentDef(name: string) {
  const { registry } = useContract();
  return registry.components[name] ?? null;
}

export function cssVar(category: string, key: string): string {
  return `var(--orqui-${category}-${key})`;
}

/** Resolve layout for a specific page (merge base + overrides) */
export { resolvePageLayout };

// ============================================================================
// Deep Merge for page overrides
// ============================================================================
function deepMerge(base: any, override: any): any {
  if (override === undefined) return base;
  if (override === null || typeof override !== "object" || typeof base !== "object") return override;
  if (Array.isArray(override)) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }
  return result;
}

function resolvePageLayout(layout: LayoutContract, page?: string): LayoutContract {
  if (!page || !layout.structure.pages?.[page]) return layout;
  const pageConfig = layout.structure.pages[page];
  const overrides = pageConfig.overrides || {};
  const mergedRegions: Record<string, RegionConfig> = {};
  for (const [name, region] of Object.entries(layout.structure.regions)) {
    mergedRegions[name] = overrides[name] ? deepMerge(region, overrides[name]) : region;
  }
  const mergedHeaderElements = overrides.headerElements
    ? deepMerge(layout.structure.headerElements || {}, overrides.headerElements)
    : layout.structure.headerElements;
  return {
    ...layout,
    structure: {
      ...layout.structure,
      regions: mergedRegions,
      headerElements: mergedHeaderElements,
    },
  };
}

// ============================================================================
// Logo Component
// ============================================================================
function LogoRenderer({ config, collapsed }: { config?: LogoConfig; collapsed?: boolean }) {
  if (!config) return null;
  const typo = config.typography || {};
  const pad = config.padding || {};
  const textStyle: any = {
    fontSize: typo.fontSize || 16,
    fontWeight: typo.fontWeight || 700,
    color: typo.color || "var(--foreground)",
    fontFamily: typo.fontFamily || "inherit",
    letterSpacing: typo.letterSpacing ? `${typo.letterSpacing}px` : undefined,
    whiteSpace: "nowrap",
  };
  const containerStyle: any = {
    padding: `${pad.top || 0}px ${pad.right || 0}px ${pad.bottom || 0}px ${pad.left || 0}px`,
  };

  const iconSz = config.iconSize || typo.fontSize || 20;

  if (collapsed) {
    return (
      <div style={{ ...containerStyle, display: "flex", justifyContent: "center", alignItems: "center" }}>
        {config.type === "icon-text" && config.iconUrl ? (
          <img src={config.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain" }} />
        ) : config.type === "icon-text" && config.icon ? (
          <span style={{ fontSize: iconSz }}>{config.icon}</span>
        ) : config.type === "image" && config.imageUrl ? (
          <img src={config.imageUrl} alt="" style={{ height: 24, objectFit: "contain" }} />
        ) : (
          <span style={{ ...textStyle, fontSize: Math.max((typo.fontSize || 16), 16) }}>
            {(config.text || "A").charAt(0)}
          </span>
        )}
      </div>
    );
  }

  if (config.type === "image" && config.imageUrl) {
    return (
      <div style={containerStyle}>
        <img src={config.imageUrl} alt={config.text || "Logo"} style={{ height: 28, maxWidth: 160, objectFit: "contain" }} />
      </div>
    );
  }
  if (config.type === "icon-text") {
    return (
      <div style={{ ...containerStyle, display: "flex", alignItems: "center", gap: config.iconGap || 8 }}>
        {config.iconUrl ? (
          <img src={config.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain" }} />
        ) : config.icon ? (
          <span style={{ fontSize: iconSz }}>{config.icon}</span>
        ) : null}
        <span style={textStyle}>{config.text || "App"}</span>
      </div>
    );
  }
  return <div style={containerStyle}><span style={textStyle}>{config.text || "App"}</span></div>;
}

// ============================================================================
// Header Elements Renderer
// ============================================================================
const RUNTIME_ICON_MAP: Record<string, string> = {
  bell: "🔔", settings: "⚙️", user: "👤", mail: "✉️", help: "❓",
  moon: "🌙", sun: "☀️", search: "🔍", grid: "⊞", download: "⬇", share: "↗",
};

const CTA_VARIANT_CSS: Record<string, any> = {
  default:     { background: "var(--primary, #6d9cff)", color: "var(--primary-foreground, #fff)", border: "none" },
  destructive: { background: "var(--destructive, #ef4444)", color: "var(--destructive-foreground, #fff)", border: "none" },
  outline:     { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
  secondary:   { background: "var(--secondary, #27272a)", color: "var(--secondary-foreground, #fafafa)", border: "none" },
  ghost:       { background: "transparent", color: "var(--foreground)", border: "none" },
};

function HeaderElementsRenderer({ config, onSearch, onCTA, onIconClick, navigate }: {
  config?: HeaderElementsConfig;
  onSearch?: (query: string) => void;
  onCTA?: () => void;
  onIconClick?: (iconId: string, route?: string) => void;
  navigate?: (route: string) => void;
}) {
  if (!config) return null;

  const handleNavigation = (route?: string, callback?: () => void) => {
    if (route && navigate) navigate(route);
    else if (callback) callback();
  };

  const normalizeIcon = (item: string | { id: string; route?: string }) =>
    typeof item === "string" ? { id: item, route: "" } : item;

  const ctaVariantStyle = CTA_VARIANT_CSS[config.cta?.variant || "default"] || CTA_VARIANT_CSS.default;

  return (
    <>
      {config.search?.enabled && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--muted, #1c1c21)", borderRadius: 6,
          padding: "4px 10px", border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 14, opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder={config.search.placeholder || "Buscar..."}
            onChange={(e) => onSearch?.(e.target.value)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "var(--foreground)", fontSize: 13, width: 160,
            }}
          />
        </div>
      )}
      {config.icons?.enabled && (config.icons.items || []).map(raw => {
        const ic = normalizeIcon(raw);
        return (
          <button key={ic.id} onClick={() => {
            if (onIconClick) onIconClick(ic.id, ic.route);
            else handleNavigation(ic.route);
          }} style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 18, padding: 4, opacity: 0.7, color: "var(--foreground)",
          }} title={ic.route || ic.id}>
            {RUNTIME_ICON_MAP[ic.id] || ic.id}
          </button>
        );
      })}
      {config.cta?.enabled && (
        <button onClick={() => handleNavigation(config.cta?.route, onCTA)} style={{
          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
          fontSize: 13, fontWeight: 500,
          ...ctaVariantStyle,
        }}>
          {config.cta.label || "Action"}
        </button>
      )}
    </>
  );
}

// ============================================================================
// Breadcrumb Renderer
// ============================================================================
function BreadcrumbRenderer({ config, pages, currentPage, navigate }: {
  config?: BreadcrumbsConfig;
  pages?: Record<string, PageConfig>;
  currentPage?: string;
  navigate?: (route: string) => void;
}) {
  if (!config?.enabled || !pages || !currentPage) return null;
  const page = pages[currentPage];
  if (!page) return null;

  const items: { label: string; route?: string }[] = [];

  // Home
  if (config.showHome !== false) {
    items.push({ label: config.homeLabel || "Home", route: config.homeRoute || "/" });
  }

  // Current page
  items.push({ label: page.label || currentPage });

  const alignment = config.alignment || "left";
  const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: justifyMap[alignment] || "flex-start",
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          <span
            onClick={() => {
              if (i < items.length - 1 && config.clickable && item.route && navigate) {
                navigate(item.route);
              }
            }}
            style={{
              fontSize: 13,
              color: i < items.length - 1
                ? (config.clickable ? "var(--primary, #6d9cff)" : "var(--muted-foreground)")
                : "var(--foreground)",
              cursor: i < items.length - 1 && config.clickable ? "pointer" : "default",
              fontWeight: i === items.length - 1 ? 500 : 400,
            }}
          >
            {item.label}
          </span>
          {i < items.length - 1 && (
            <span style={{ color: "var(--muted-foreground)", margin: "0 6px", fontSize: 12, opacity: 0.6 }}>
              {config.separator || "/"}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// AppShell — renders layout from contract, uses same CSS vars as components
// ============================================================================
interface AppShellProps {
  sidebarHeader?: ReactNode;
  sidebarNav?: ReactNode;
  sidebarFooter?: ReactNode;
  headerLeft?: ReactNode;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  /** Page key — merges page overrides from layout contract */
  page?: string;
  /** Called when header search input changes */
  onSearch?: (query: string) => void;
  /** Called when header CTA is clicked */
  onCTA?: () => void;
  /** Called when a header icon is clicked */
  onIconClick?: (iconId: string, route?: string) => void;
  /** Navigation function (e.g. react-router's navigate) for icon/CTA routes */
  navigate?: (route: string) => void;
}

const COLLAPSE_ICONS: Record<string, [string, string]> = {
  chevron: ["◂", "▸"],
  arrow:   ["←", "→"],
  hamburger: ["✕", "☰"],
  dots:    ["⋮", "⋯"],
};

export function AppShell({
  sidebarHeader,
  sidebarNav,
  sidebarFooter,
  headerLeft,
  headerCenter,
  headerRight,
  children,
  page,
  onSearch,
  onCTA,
  onIconClick,
  navigate,
}: AppShellProps) {
  const { layout: baseLayout, tokens } = useContract();
  const layout = resolvePageLayout(baseLayout, page);
  const { regions } = layout.structure;
  const logoConfig = layout.structure.logo;
  const headerElements = layout.structure.headerElements;
  const faviconConfig = layout.structure.favicon;
  const breadcrumbsConfig = layout.structure.breadcrumbs;
  const pages = layout.structure.pages;

  const sidebar = regions.sidebar;
  const header = regions.header;
  const isCollapsible = sidebar?.behavior?.collapsible ?? false;
  const [collapsed, setCollapsed] = useState(false);

  const resolve = (ref?: string) => ref ? resolveTokenRef(ref, tokens) : null;

  const sidebarWidth = collapsed
    ? (resolve(sidebar?.dimensions?.minWidth) ?? "64px")
    : (resolve(sidebar?.dimensions?.width) ?? "260px");
  const headerHeightRaw = resolve(header?.dimensions?.height) ?? "56px";
  const headerHeightNum = parseInt(String(headerHeightRaw), 10) || 56;

  const sidebarPadTop = sidebar?.padding?.top ? parseInt(String(resolve(sidebar.padding.top) ?? "0"), 10) || 0 : 0;
  const sidebarPadL = sidebar?.padding?.left ? parseInt(String(resolve(sidebar.padding.left) ?? "0"), 10) || 0 : 0;
  const sidebarPadR = sidebar?.padding?.right ? parseInt(String(resolve(sidebar.padding.right) ?? "0"), 10) || 0 : 0;
  const sidebarPadBot = sidebar?.padding?.bottom ? parseInt(String(resolve(sidebar.padding.bottom) ?? "0"), 10) || 0 : 0;
  const shouldAlignLogo = logoConfig?.position === "sidebar" && logoConfig?.alignWithHeader && header?.enabled;

  // When aligned, the sidebar header container height = headerHeight - sidebar's own top padding
  // This makes the bottom border line up exactly with the main header's bottom border
  const alignedSidebarHeaderH = Math.max(headerHeightNum - sidebarPadTop, 32);

  const resolvePadding = (p?: Record<string, string>) => {
    if (!p) return "0";
    return [p.top, p.right, p.bottom, p.left].map(v => String(resolve(v) ?? "0")).join(" ");
  };

  // Separator helper
  const resolveSeparator = (sep?: any): string | undefined => {
    if (!sep) return undefined; // no config → use fallback
    if (!sep.enabled) return "none"; // explicitly disabled → no border
    const width = resolve(sep.width) ?? "1px";
    const style = sep.style ?? "solid";
    const color = resolve(sep.color) ?? "var(--sidebar-border)";
    return `${width} ${style} ${color}`;
  };

  // Separator extend helper — computes negative margins to cancel parent padding
  const separatorExtendStyle = (sep?: any, parentPadding?: Record<string, string>): React.CSSProperties => {
    if (!sep?.enabled || !parentPadding) return {};
    const ext = sep.extend || "full";
    if (ext === "full") {
      const pl = parseInt(String(resolve(parentPadding.left) ?? "0"), 10) || 0;
      const pr = parseInt(String(resolve(parentPadding.right) ?? "0"), 10) || 0;
      return { marginLeft: -pl, marginRight: -pr, paddingLeft: pl, paddingRight: pr };
    }
    if (ext === "none") return { marginLeft: 8, marginRight: 8 };
    return {}; // "inset" — respect parent padding
  };

  // Collapse button config
  const cbConfig = sidebar?.collapseButton ?? {};
  const cbIcons = COLLAPSE_ICONS[cbConfig.icon ?? "chevron"] ?? COLLAPSE_ICONS.chevron;
  const cbPosition = cbConfig.position ?? "header-end";

  // Collapsed display mode
  const collapsedDisplay = sidebar?.behavior?.collapsedDisplay ?? "icon-only";

  const collapseButtonEl = isCollapsible ? (
    <button
      onClick={() => setCollapsed(!collapsed)}
      style={{
        background: "var(--sidebar, #111114)",
        border: "1px solid var(--sidebar-border, #2a2a33)",
        color: "var(--muted-foreground)",
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 4,
        fontSize: 16,
        lineHeight: 1,
        flexShrink: 0,
        zIndex: 50,
      }}
      title={collapsed ? "Expand" : "Collapse"}
    >
      {collapsed ? cbIcons[1] : cbIcons[0]}
    </button>
  ) : null;

  // Inject favicon
  useEffect(() => {
    if (!faviconConfig || faviconConfig.type === "none") return;
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (faviconConfig.type === "image" && faviconConfig.url) {
      link.href = faviconConfig.url;
      link.type = faviconConfig.url.startsWith("data:image/svg") ? "image/svg+xml" : "image/x-icon";
    } else if (faviconConfig.type === "emoji" && faviconConfig.emoji) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${faviconConfig.emoji}</text></svg>`;
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      link.type = "image/svg+xml";
    }
  }, [faviconConfig]);

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "var(--background)",
      color: "var(--foreground)",
      fontFamily: "var(--font-sans, Inter, sans-serif)",
      position: "relative",
    }}>
      {/* Sidebar */}
      {sidebar?.enabled && (
        <aside data-orqui-sidebar="" style={{
          width: String(sidebarWidth),
          minWidth: String(sidebarWidth),
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--sidebar)",
          borderRight: "1px solid var(--sidebar-border)",
          transition: "width 0.2s ease, min-width 0.2s ease",
          overflow: "hidden",
          boxSizing: "border-box",
        }}>
          {/* Sidebar header — full-width, own padding */}
          <div data-orqui-sidebar-header="" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : (logoConfig?.sidebarAlign === "center" ? "center" : logoConfig?.sidebarAlign === "right" ? "flex-end" : "space-between"),
            borderBottom: resolveSeparator(sidebar.separators?.header) ?? "1px solid var(--sidebar-border)",
            paddingLeft: sidebarPadL,
            paddingRight: sidebarPadR,
            paddingTop: sidebarPadTop,
            ...(shouldAlignLogo ? {
              height: `${headerHeightNum}px`,
              minHeight: `${headerHeightNum}px`,
              maxHeight: `${headerHeightNum}px`,
              boxSizing: "border-box" as const,
            } : {
              paddingBottom: String(resolve("$tokens.spacing.md") ?? "16px"),
            }),
            flexShrink: 0,
          }}>
            {/* Logo in sidebar */}
            {logoConfig?.position === "sidebar" ? (
              <LogoRenderer config={logoConfig} collapsed={collapsed} />
            ) : (
              !collapsed && sidebarHeader
            )}
            {cbPosition === "header-end" && collapseButtonEl}
          </div>

          {/* Nav area — own padding from sidebar config */}
          <nav data-orqui-sidebar-nav="" style={{
            flex: 1,
            overflow: sidebar.behavior?.scrollable ? "auto" : "hidden",
            display: "flex",
            flexDirection: "column",
            gap: String(resolve("$tokens.spacing.2xs") ?? "2px"),
            padding: `${String(resolve("$tokens.spacing.sm") ?? "8px")} ${sidebarPadR}px ${String(resolve("$tokens.spacing.sm") ?? "8px")} ${sidebarPadL}px`,
            ...(collapsed ? { alignItems: "center" } : {}),
          }}>
            {collapsed ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", width: "100%" }}
                data-orqui-collapsed="true"
                data-orqui-collapsed-display={collapsedDisplay}
              >
                {sidebarNav}
              </div>
            ) : sidebarNav}
          </nav>

          {/* Collapse button at center position (inside sidebar) */}
          {cbPosition === "center" && collapseButtonEl && (
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
              {collapseButtonEl}
            </div>
          )}

          {/* Sidebar footer */}
          {(sidebarFooter || cbPosition === "bottom") && (
            <div style={{
              paddingTop: String(resolve("$tokens.spacing.sm") ?? "8px"),
              borderTop: resolveSeparator(sidebar.separators?.footer) ?? "1px solid var(--sidebar-border)",
              paddingLeft: sidebarPadL,
              paddingRight: sidebarPadR,
              paddingBottom: sidebarPadBot,
              display: "flex",
              alignItems: collapsed ? "center" : "stretch",
              flexDirection: "column",
              gap: 4,
            }}>
              {!collapsed && sidebarFooter}
              {cbPosition === "bottom" && collapseButtonEl}
            </div>
          )}
        </aside>
      )}

      {/* Edge-center collapse button: fixed position, centered in viewport below header */}
      {sidebar?.enabled && cbPosition === "edge-center" && collapseButtonEl && (
        <div style={{
          position: "fixed",
          left: `calc(${sidebarWidth} - 12px)`,
          top: `calc(${headerHeightNum}px + (100vh - ${headerHeightNum}px) / 2)`,
          transform: "translateY(-50%)",
          zIndex: 100,
          transition: "left 0.2s ease",
        }}>
          {collapseButtonEl}
        </div>
      )}

      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "clip" }}>
        {header?.enabled && (
          <header style={{
            height: `${headerHeightNum}px`,
            minHeight: `${headerHeightNum}px`,
            display: "flex",
            alignItems: "center",
            padding: resolvePadding(header.padding),
            background: "var(--background)",
            borderBottom: resolveSeparator((header as any).separators?.bottom) ?? "1px solid var(--border)",
            ...separatorExtendStyle((header as any).separators?.bottom, header.padding),
            position: header.behavior?.fixed ? "sticky" : undefined,
            top: header.behavior?.fixed ? 0 : undefined,
            zIndex: header.behavior?.fixed ? 10 : undefined,
            gap: "16px",
            boxSizing: "border-box",
          }}>
            {/* Left zone: breadcrumbs + logo (if header position) + headerLeft */}
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
              {logoConfig?.position === "header" && logoConfig?.headerSlot === "left" && (
                <LogoRenderer config={logoConfig} />
              )}
              {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && breadcrumbsConfig?.alignment !== "center" && breadcrumbsConfig?.alignment !== "right" && (
                <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} />
              )}
              {headerLeft}
            </div>
            {/* Center zone: logo (if center) + breadcrumbs (if center) + headerCenter */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", justifyContent: (logoConfig?.position === "header" && logoConfig?.headerSlot === "center") || breadcrumbsConfig?.alignment === "center" ? "center" : undefined }}>
              {logoConfig?.position === "header" && logoConfig?.headerSlot === "center" && (
                <LogoRenderer config={logoConfig} />
              )}
              {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && breadcrumbsConfig?.alignment === "center" && (
                <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} />
              )}
              {headerCenter}
            </div>
            {/* Right zone: header elements + logo (if right) + headerRight */}
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <HeaderElementsRenderer config={headerElements} onSearch={onSearch} onCTA={onCTA} onIconClick={onIconClick} navigate={navigate} />
              {logoConfig?.position === "header" && logoConfig?.headerSlot === "right" && (
                <LogoRenderer config={logoConfig} />
              )}
              {headerRight}
            </div>
          </header>
        )}

        <main style={{
          flex: 1,
          padding: resolvePadding(regions.main?.padding),
          overflow: "auto",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Text
// ============================================================================
interface TextProps {
  style_name: string;
  as?: keyof JSX.IntrinsicElements;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Text({ style_name: styleName, as: Tag = "span", children, className, style }: TextProps) {
  const css = useTextStyle(styleName);
  return <Tag className={className} style={{ ...css, ...style }} data-orqui-text={styleName}>{children}</Tag>;
}
