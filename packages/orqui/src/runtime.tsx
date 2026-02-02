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
interface SeparatorConfig {
  enabled: boolean;
  color?: string;
  width?: string;
  style?: string;
  extend?: string;
}
interface NavTypography {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  fontFamily?: string;
  letterSpacing?: string;
  lineHeight?: string;
  cardEnabled?: boolean;
  cardBorderRadius?: string;
  cardPadding?: string;
  cardBackground?: string;
  cardBorderColor?: string;
  cardBorderWidth?: string;
  activeColor?: string;
  activeFontWeight?: string;
  activeBackground?: string;
  activeCardBorder?: string;
  hoverColor?: string;
  hoverFontWeight?: string;
  hoverBackground?: string;
  hoverCardBorder?: string;
}
interface NavigationConfig {
  icons?: { enabled: boolean; size?: string; gap?: string };
  typography?: NavTypography;
  items?: Array<{ icon?: string; label: string; route?: string }>;
}
interface CollapseButtonConfig {
  icon?: string;
  position?: string;
}
interface RegionConfig {
  enabled: boolean;
  position?: string;
  dimensions?: Record<string, string>;
  padding?: Record<string, string>;
  containers?: Container[];
  behavior?: { fixed: boolean; collapsible: boolean; scrollable: boolean; collapsedDisplay?: string };
  navigation?: NavigationConfig;
  collapseButton?: CollapseButtonConfig;
  separators?: Record<string, SeparatorConfig>;
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
  color?: string;
}
interface HeaderElementsConfig {
  search?: { enabled: boolean; placeholder?: string; icon?: string; showIcon?: boolean };
  cta?: { enabled: boolean; label?: string; variant?: string; route?: string; icon?: string };
  ctas?: Array<{ id: string; label: string; variant?: string; route?: string; icon?: string }>;
  icons?: { enabled: boolean; items?: Array<string | { id: string; route?: string; icon?: string }> };
  order?: string[]; // e.g. ["search", "icons", "ctas"]
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
  typography?: {
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    color?: string;
    activeColor?: string;
    activeFontWeight?: string;
    separatorColor?: string;
  };
  padding?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}
interface LayoutContract {
  $orqui?: any;
  structure: {
    regions: Record<string, RegionConfig>;
    breadcrumbs?: BreadcrumbsConfig;
    logo?: LogoConfig;
    favicon?: FaviconConfig;
    headerElements?: HeaderElementsConfig;
    tableSeparator?: {
      color?: string;
      width?: string;
      style?: string;
      headerColor?: string;
      headerWidth?: string;
      headerStyle?: string;
    };
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

function buildStyleSheet(tokens: Tokens, layout?: LayoutContract): string {
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
  // Must override Tailwind classes (px-4, py-2.5, gap-3, space-y-1) on real app components
  lines.push("");
  lines.push("/* Orqui Contract → Collapsed sidebar nav styles */");

  // Reset list containers: kill padding, margin, gaps from Tailwind (space-y-*, p-*, etc)
  lines.push(`[data-orqui-collapsed="true"] ul,`);
  lines.push(`[data-orqui-collapsed="true"] ol {`);
  lines.push(`  padding: 0${imp}; margin: 0${imp}; list-style: none${imp};`);
  lines.push(`  display: flex${imp}; flex-direction: column${imp}; align-items: center${imp};`);
  lines.push(`  width: 100%${imp}; gap: 2px${imp};`);
  lines.push(`}`);
  // Reset Tailwind space-y-* (uses > :not(:first-child) margin-top)
  lines.push(`[data-orqui-collapsed="true"] ul > *,`);
  lines.push(`[data-orqui-collapsed="true"] ol > * {`);
  lines.push(`  margin-top: 0${imp}; margin-bottom: 0${imp};`);
  lines.push(`}`);

  // Reset list items
  lines.push(`[data-orqui-collapsed="true"] li {`);
  lines.push(`  width: auto${imp}; display: flex${imp}; justify-content: center${imp};`);
  lines.push(`}`);

  // Force all link/button items to centered square boxes
  // Override Tailwind: px-4 → padding:0, gap-3 → gap:0, py-2.5 → height:36px
  lines.push(`[data-orqui-collapsed="true"] a,`);
  lines.push(`[data-orqui-collapsed="true"] button:not([data-orqui-cb]) {`);
  lines.push(`  width: 36px${imp}; height: 36px${imp};`);
  lines.push(`  padding: 0${imp}; gap: 0${imp};`);
  lines.push(`  display: flex${imp}; align-items: center${imp}; justify-content: center${imp};`);
  lines.push(`  overflow: hidden${imp}; border-radius: 6px${imp};`);
  lines.push(`  margin: 0 auto${imp}; min-width: 0${imp};`);
  lines.push(`}`);

  // Icon-only: hide everything except SVG (Phosphor React renders <svg>)
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] a > *:not(svg),`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] button:not([data-orqui-cb]) > *:not(svg) {`);
  lines.push(`  display: none${imp};`);
  lines.push(`}`);
  // Ensure SVG icons stay visible and centered
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] a > svg,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="icon-only"] button:not([data-orqui-cb]) > svg {`);
  lines.push(`  display: block${imp}; flex-shrink: 0${imp}; width: 20px${imp}; height: 20px${imp};`);
  lines.push(`}`);

  // Letter-only: hide SVG icons, show first letter of text span
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] a > svg,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] button:not([data-orqui-cb]) > svg {`);
  lines.push(`  display: none${imp};`);
  lines.push(`}`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] a > span,`);
  lines.push(`[data-orqui-collapsed="true"][data-orqui-collapsed-display="letter-only"] button:not([data-orqui-cb]) > span {`);
  lines.push(`  display: block${imp}; width: 1ch${imp}; overflow: hidden${imp};`);
  lines.push(`  text-overflow: clip${imp}; white-space: nowrap${imp};`);
  lines.push(`  font-size: 13px${imp}; font-weight: 600${imp}; line-height: 1${imp};`);
  lines.push(`  text-align: center${imp};`);
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

  // --- Sidebar navigation typography ---
  const sidebarRegion = layout?.structure?.regions?.sidebar;
  const navTypo = sidebarRegion?.navigation?.typography;
  if (navTypo) {
    lines.push("");
    lines.push("/* Orqui Contract → Sidebar navigation typography */");
    lines.push(`[data-orqui-sidebar-nav] a, [data-orqui-sidebar-nav] button {`);
    if (navTypo.fontSize) {
      const fs = resolveTokenRef(navTypo.fontSize, tokens);
      if (fs) lines.push(`  font-size: ${fs}${imp};`);
    }
    if (navTypo.fontWeight) {
      const fw = resolveTokenRef(navTypo.fontWeight, tokens);
      if (fw) lines.push(`  font-weight: ${fw}${imp};`);
    }
    if (navTypo.fontFamily) {
      const ff = resolveTokenRef(navTypo.fontFamily, tokens);
      if (ff) lines.push(`  font-family: ${ff}${imp};`);
    }
    if (navTypo.color) {
      const cl = resolveTokenRef(navTypo.color, tokens);
      if (cl) lines.push(`  color: ${cl}${imp};`);
    }
    if (navTypo.letterSpacing) {
      const ls = resolveTokenRef(navTypo.letterSpacing, tokens);
      if (ls) lines.push(`  letter-spacing: ${ls}${imp};`);
    }
    if (navTypo.lineHeight) {
      const lh = resolveTokenRef(navTypo.lineHeight, tokens);
      if (lh) lines.push(`  line-height: ${lh}${imp};`);
    }
    lines.push(`}`);

    // Nav item card styling
    if (navTypo.cardEnabled) {
      const sel = `[data-orqui-sidebar-nav] a, [data-orqui-sidebar-nav] button`;
      lines.push(`${sel} {`);
      if (navTypo.cardBorderRadius) {
        const br = resolveTokenRef(navTypo.cardBorderRadius, tokens);
        if (br) lines.push(`  border-radius: ${br}${imp};`);
      }
      if (navTypo.cardPadding) {
        const cp = resolveTokenRef(navTypo.cardPadding, tokens);
        if (cp) lines.push(`  padding: ${cp}${imp};`);
      }
      if (navTypo.cardBackground) {
        const cb = resolveTokenRef(navTypo.cardBackground, tokens);
        if (cb) lines.push(`  background: ${cb}${imp};`);
      }
      if (navTypo.cardBorderColor) {
        const bw = navTypo.cardBorderWidth || "1";
        const bc = resolveTokenRef(navTypo.cardBorderColor, tokens);
        if (bc) lines.push(`  border: ${bw}px solid ${bc}${imp};`);
      }
      lines.push(`  transition: background 0.15s, border-color 0.15s, color 0.15s;`);
      lines.push(`}`);
    }

    // Active item styling
    if (navTypo.activeColor || navTypo.activeFontWeight || navTypo.activeBackground || navTypo.activeCardBorder) {
      lines.push(`[data-orqui-sidebar-nav] a[data-active="true"], [data-orqui-sidebar-nav] button[data-active="true"],`);
      lines.push(`[data-orqui-sidebar-nav] a.active, [data-orqui-sidebar-nav] button.active {`);
      if (navTypo.activeColor) {
        const ac = resolveTokenRef(navTypo.activeColor, tokens);
        if (ac) lines.push(`  color: ${ac}${imp};`);
      }
      if (navTypo.activeFontWeight) {
        const aw = resolveTokenRef(navTypo.activeFontWeight, tokens);
        if (aw) lines.push(`  font-weight: ${aw}${imp};`);
      }
      if (navTypo.activeBackground) {
        const ab = resolveTokenRef(navTypo.activeBackground, tokens);
        if (ab) lines.push(`  background: ${ab}${imp};`);
      }
      if (navTypo.activeCardBorder) {
        const acb = resolveTokenRef(navTypo.activeCardBorder, tokens);
        const bw = navTypo.cardBorderWidth || "1";
        if (acb) lines.push(`  border-color: ${acb}${imp};`);
      }
      lines.push(`}`);
    }

    // Hover item styling
    if (navTypo.hoverColor || navTypo.hoverBackground || navTypo.hoverFontWeight || navTypo.hoverCardBorder) {
      lines.push(`[data-orqui-sidebar-nav] a:hover, [data-orqui-sidebar-nav] button:hover {`);
      if (navTypo.hoverColor) {
        const hc = resolveTokenRef(navTypo.hoverColor, tokens);
        if (hc) lines.push(`  color: ${hc}${imp};`);
      }
      if (navTypo.hoverBackground) {
        const hb = resolveTokenRef(navTypo.hoverBackground, tokens);
        if (hb) lines.push(`  background: ${hb}${imp};`);
      }
      if (navTypo.hoverFontWeight) {
        const hw = resolveTokenRef(navTypo.hoverFontWeight, tokens);
        if (hw) lines.push(`  font-weight: ${hw}${imp};`);
      }
      if (navTypo.hoverCardBorder) {
        const hcb = resolveTokenRef(navTypo.hoverCardBorder, tokens);
        if (hcb) lines.push(`  border-color: ${hcb}${imp};`);
      }
      lines.push(`}`);
    }
  }

  // --- Table separator CSS ---
  const ts = layout?.structure?.tableSeparator;
  if (ts) {
    const tsColor = ts.color ? (resolveTokenRef(ts.color, tokens) || ts.color) : undefined;
    const tsWidth = ts.width || "1px";
    const tsStyle = ts.style || "solid";
    const tsHeaderColor = ts.headerColor ? (resolveTokenRef(ts.headerColor, tokens) || ts.headerColor) : undefined;
    const tsHeaderWidth = ts.headerWidth || tsWidth;
    const tsHeaderStyle = ts.headerStyle || tsStyle;

    if (tsColor) {
      lines.push(`/* Table separator */`);
      lines.push(`table tbody tr { border-bottom: ${tsWidth} ${tsStyle} ${tsColor}${imp}; }`);
      lines.push(`table tbody td { border-bottom: ${tsWidth} ${tsStyle} ${tsColor}${imp}; }`);
    }
    if (tsHeaderColor) {
      lines.push(`table thead tr { border-bottom: ${tsHeaderWidth} ${tsHeaderStyle} ${tsHeaderColor}${imp}; }`);
      lines.push(`table thead th { border-bottom: ${tsHeaderWidth} ${tsHeaderStyle} ${tsHeaderColor}${imp}; }`);
    } else if (tsColor) {
      lines.push(`table thead tr { border-bottom: ${tsWidth} ${tsStyle} ${tsColor}${imp}; }`);
      lines.push(`table thead th { border-bottom: ${tsWidth} ${tsStyle} ${tsColor}${imp}; }`);
    }
  }

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
    () => injectCSS ? buildStyleSheet(layout.tokens, layout) : "",
    [layout.tokens, injectCSS]
  );

  // Build component-specific CSS from registry styles
  const componentCSS = useMemo(() => {
    if (!injectCSS || !registry?.components) return "";
    const lines: string[] = [];
    const scrollArea = registry.components.ScrollArea ?? registry.components.scrollArea;
    if (scrollArea?.styles) {
      const st = scrollArea.styles;
      if (st.preset === "hidden") {
        lines.push(`/* ScrollArea: hidden */`);
        lines.push(`::-webkit-scrollbar { width: 0 !important; height: 0 !important; }`);
        lines.push(`* { scrollbar-width: none !important; }`);
      } else if (st.preset !== "default" && (st.thumbWidth != null || st.thumbColor)) {
        const tw = st.thumbWidth ?? 6;
        const tc = st.thumbColor ?? "rgba(255,255,255,0.2)";
        const trc = st.trackColor ?? "transparent";
        const tr = st.thumbRadius ?? 99;
        const htw = st.hoverThumbWidth ?? tw;
        const htc = st.hoverThumbColor ?? tc;
        lines.push(`/* ScrollArea: custom scrollbar */`);
        lines.push(`* { scrollbar-width: thin; scrollbar-color: ${tc} ${trc}; }`);
        lines.push(`::-webkit-scrollbar { width: ${tw}px; height: ${tw}px; }`);
        lines.push(`::-webkit-scrollbar-track { background: ${trc}; }`);
        lines.push(`::-webkit-scrollbar-thumb { background: ${tc}; border-radius: ${tr}px; }`);
        lines.push(`::-webkit-scrollbar-thumb:hover { background: ${htc}; }`);
        if (htw !== tw) {
          lines.push(`:hover::-webkit-scrollbar { width: ${htw}px; }`);
        }
        if (!st.showArrows) {
          lines.push(`::-webkit-scrollbar-button { display: none; }`);
        }
        if (st.autoHide) {
          lines.push(`::-webkit-scrollbar-thumb { transition: background 0.3s; }`);
        }
      }
    }
    return lines.join("\n");
  }, [registry, injectCSS]);

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
      {injectCSS && <style dangerouslySetInnerHTML={{ __html: styleSheet + "\n" + componentCSS }} />}
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
// Phosphor Icon SVG paths (for ph: prefix support in logos/favicons)
// ============================================================================
const PHOSPHOR_SVG_PATHS: Record<string, string> = {
  "house": "M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8H96a8,8,0,0,0,8-8V160h48v56a8,8,0,0,0,8,8h56a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H168V152a8,8,0,0,0-8-8H96a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z",
  "gear": "M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.68l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.67a73.68,73.68,0,0,1-8.68,0,8,8,0,0,0-5.68,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64l-22.58-2.51a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.66,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.68L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69l2.51-22.58a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.66,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.68-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z",
  "magnifying-glass": "M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z",
  "bell": "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z",
  "user": "M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z",
  "shield-check": "M208,40H48A16,16,0,0,0,32,56v58.77c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.52-80-30.69-80-109.18V56H208ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z",
  "shield": "M208,40H48A16,16,0,0,0,32,56v58.77c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.52-80-30.69-80-109.18V56H208Z",
  "lock": "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208Zm-80-36V140a12,12,0,1,1,0-24h0a12,12,0,0,1,12,12v24a12,12,0,0,1-24,0Z",
  "key": "M216.57,39.43A80,80,0,0,0,83.91,120.78L28.69,176A15.86,15.86,0,0,0,24,187.31V216a16,16,0,0,0,16,16H72a8,8,0,0,0,8-8V208H96a8,8,0,0,0,8-8V184h16a8,8,0,0,0,5.66-2.34l9.56-9.57A80,80,0,0,0,216.57,39.43ZM224,100a63.08,63.08,0,0,1-17.39,43.52L126.34,168H104a8,8,0,0,0-8,8v16H80a8,8,0,0,0-8,8v16H40V187.31l58.83-58.82a8,8,0,0,0,2.11-7.34A63.93,63.93,0,0,1,160.05,36,64.08,64.08,0,0,1,224,100Zm-44-20a12,12,0,1,1-12-12A12,12,0,0,1,180,80Z",
  "eye": "M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.29A169.47,169.47,0,0,1,24.7,128,169.47,169.47,0,0,1,48.07,97.29C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.29A169.47,169.47,0,0,1,231.3,128C223.94,141.44,192.22,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z",
  "warning": "M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z",
  "folder": "M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Zm0,128H40V56H92.69l29.65,29.66A8,8,0,0,0,128,88h88Z",
  "file": "M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z",
  "code": "M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.29Zm176,27.7-48-40a8,8,0,1,0-10.24,12.29L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z",
  "rocket": "M152,224a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,224Zm-24-80a12,12,0,1,0-12-12A12,12,0,0,0,128,144Z",
  "lightning": "M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5.1-9.27L58.81,131.35l88.82-95.27L137.16,88.46a8,8,0,0,0,5.1,9.27l55.93,20.95Z",
  "star": "M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.38,16.38,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.38,16.38,0,0,0,239.18,97.26Z",
  "heart": "M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32Z",
  "globe": "M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Z",
  "sparkle": "M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112.9,220.38,93.54,168.22a8,8,0,0,0-4.74-4.74L36.64,144,88.8,124.58a8,8,0,0,0,4.74-4.74L112.9,67.62l19.36,52.16a8,8,0,0,0,4.74,4.74L189.16,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z",
  "robot": "M200,48H136V16a8,8,0,0,0-16,0V48H56A32,32,0,0,0,24,80V192a32,32,0,0,0,32,32H200a32,32,0,0,0,32-32V80A32,32,0,0,0,200,48Zm16,144a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Zm-36-60a12,12,0,1,1-12-12A12,12,0,0,1,180,132ZM88,132a12,12,0,1,1-12-12A12,12,0,0,1,88,132Z",
  "chart-bar": "M224,200h-8V40a8,8,0,0,0-16,0V200H168V96a8,8,0,0,0-16,0V200H112V136a8,8,0,0,0-16,0v64H56V168a8,8,0,0,0-16,0v32H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16Z",
  "flow-arrow": "M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z",
  "chat-circle": "M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z",
  "list": "M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z",
  "squares-four": "M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48Z",
  "clipboard": "M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Z",
  "database": "M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Z",
  "plus": "M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z",
  "check": "M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z",
  "x": "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z",
  "barricade": "M224,64H32A16,16,0,0,0,16,80v72a16,16,0,0,0,16,16H56v32a8,8,0,0,0,16,0V168H184v32a8,8,0,0,0,16,0V168h24a16,16,0,0,0,16-16V80A16,16,0,0,0,224,64Zm0,64.69L175.31,80H224ZM80.69,80l72,72H103.31L32,80.69V80ZM32,103.31,80.69,152H32ZM224,152H175.31l-72-72h49.38L224,151.32V152Z",
  "door": "M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16ZM64,40H192V216H64Zm104,92a12,12,0,1,1-12-12A12,12,0,0,1,168,132Z",
  "door-open": "M232,216H208V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V216H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16Zm-40,0H176V40h16ZM64,40h96V216H64Zm80,92a12,12,0,1,1-12-12A12,12,0,0,1,144,132Z",
  "envelope": "M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z",
  "question": "M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z",
  "moon": "M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z",
  "sun": "M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z",
  "arrow-square-down": "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Zm-42.34-77.66a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32L120,148.69V88a8,8,0,0,1,16,0v60.69l18.34-18.35A8,8,0,0,1,165.66,130.34Z",
  "share-network": "M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Zm0-128a24,24,0,1,1-24,24A24,24,0,0,1,176,32ZM64,152a24,24,0,1,1,24-24A24,24,0,0,1,64,152Zm112,72a24,24,0,1,1,24-24A24,24,0,0,1,176,224Z",
};

/** Render inline SVG for a Phosphor icon name */
function PhosphorIcon({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const d = PHOSPHOR_SVG_PATHS[name];
  if (!d) return <span style={{ fontSize: size }}>?</span>;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill={color}>
      <path d={d} />
    </svg>
  );
}

/** Render an icon value — supports emoji strings or "ph:icon-name" Phosphor refs */
function IconValue({ icon, size = 20, color }: { icon?: string; size?: number; color?: string }) {
  if (!icon) return null;
  if (icon.startsWith("ph:")) {
    return <PhosphorIcon name={icon.slice(3)} size={size} color={color} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
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
    lineHeight: 1,
  };
  const containerStyle: any = {
    padding: `${pad.top || 0}px ${pad.right || 0}px ${pad.bottom || 0}px ${pad.left || 0}px`,
  };

  const iconSz = config.iconSize || typo.fontSize || 20;
  const iconColor = typo.color || "var(--foreground)";

  if (collapsed) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
        {config.type === "icon-text" && config.iconUrl ? (
          <img src={config.iconUrl} alt="" style={{ height: iconSz, objectFit: "contain", display: "block" }} />
        ) : config.type === "icon-text" && config.icon ? (
          <IconValue icon={config.icon} size={iconSz} color={iconColor} />
        ) : config.type === "image" && config.imageUrl ? (
          <img src={config.imageUrl} alt="" style={{ height: 24, objectFit: "contain", display: "block" }} />
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
          <IconValue icon={config.icon} size={iconSz} color={iconColor} />
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
// Map legacy icon IDs to Phosphor names
const HEADER_ICON_TO_PHOSPHOR: Record<string, string> = {
  bell: "bell", settings: "gear", user: "user", mail: "envelope", help: "question",
  moon: "moon", sun: "sun", menu: "list", search: "magnifying-glass", grid: "squares-four",
  download: "arrow-square-down", share: "share-network",
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
    if (route) {
      if (navigate) navigate(route);
      else window.location.href = route;
    } else if (callback) callback();
  };

  const normalizeIcon = (item: string | { id: string; route?: string; icon?: string }) =>
    typeof item === "string" ? { id: item, route: "", icon: undefined } : item;

  // Resolve the Phosphor icon name for a header action icon
  const resolvePhosphorIcon = (iconId: string, customIcon?: string): string => {
    if (customIcon?.startsWith("ph:")) return customIcon.slice(3);
    return HEADER_ICON_TO_PHOSPHOR[iconId] || iconId;
  };

  const renderSearch = () => {
    if (!config.search?.enabled) return null;
    const searchIcon = config.search.icon?.startsWith("ph:") ? config.search.icon.slice(3) : "magnifying-glass";
    return (
      <div key="search" style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--muted, #1c1c21)", borderRadius: 6,
        padding: "4px 10px", border: "1px solid var(--border)",
      }}>
        {(config.search.showIcon !== false) && (
          <PhosphorIcon name={searchIcon} size={14} color="var(--muted-foreground, #888)" />
        )}
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
    );
  };

  const renderIcons = () => {
    if (!config.icons?.enabled) return null;
    return (config.icons.items || []).map(raw => {
      const ic = normalizeIcon(raw);
      const phName = resolvePhosphorIcon(ic.id, ic.icon);
      return (
        <button key={`icon-${ic.id}`} onClick={() => {
          if (onIconClick) onIconClick(ic.id, ic.route);
          else handleNavigation(ic.route);
        }} style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: 4, opacity: 0.7, color: "var(--foreground)", display: "flex", alignItems: "center",
        }} title={ic.route || ic.id}>
          <PhosphorIcon name={phName} size={18} />
        </button>
      );
    });
  };

  const renderCtas = () => {
    const items: Array<{ id: string; label: string; variant?: string; route?: string; icon?: string }> = [];
    // Support both legacy single CTA and new multi-CTA array
    if (config.ctas?.length) {
      items.push(...config.ctas);
    } else if (config.cta?.enabled) {
      items.push({ id: "cta-0", label: config.cta.label || "Action", variant: config.cta.variant, route: config.cta.route, icon: config.cta.icon });
    }
    if (!items.length) return null;
    return items.map((cta) => {
      const style = CTA_VARIANT_CSS[cta.variant || "default"] || CTA_VARIANT_CSS.default;
      const phIcon = cta.icon?.startsWith("ph:") ? cta.icon.slice(3) : undefined;
      return (
        <button key={cta.id} onClick={() => handleNavigation(cta.route, onCTA)} style={{
          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
          fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6,
          ...style,
        }}>
          {phIcon && <PhosphorIcon name={phIcon} size={14} />}
          {cta.label}
        </button>
      );
    });
  };

  // Render in configured order
  const order = config.order || ["search", "icons", "ctas"];
  const renderers: Record<string, () => React.ReactNode> = {
    search: renderSearch,
    icons: renderIcons,
    ctas: renderCtas,
  };

  return (
    <>
      {order.map(key => {
        const fn = renderers[key];
        return fn ? <React.Fragment key={key}>{fn()}</React.Fragment> : null;
      })}
    </>
  );
}

// ============================================================================
// Breadcrumb Renderer
// ============================================================================
function BreadcrumbRenderer({ config, pages, currentPage, navigate, resolveToken }: {
  config?: BreadcrumbsConfig;
  pages?: Record<string, PageConfig>;
  currentPage?: string;
  navigate?: (route: string) => void;
  resolveToken?: (ref: string) => string | number | null;
}) {
  if (!config?.enabled) return null;

  const resolve = (ref?: string) => ref ? (resolveToken?.(ref) ?? ref) : undefined;

  // Derive current page from prop OR from URL pathname
  const derivedPage = currentPage
    || (typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "");
  if (!derivedPage) return null;

  // Build breadcrumb items from URL segments
  const items: { label: string; route?: string }[] = [];

  // Home
  if (config.showHome !== false) {
    items.push({ label: config.homeLabel || "Home", route: config.homeRoute || "/" });
  }

  // Parse all URL segments for deep paths (e.g. /runs/abc123 → Runs > abc123)
  const pathSegments = typeof window !== "undefined"
    ? window.location.pathname.split("/").filter(Boolean)
    : [derivedPage];

  pathSegments.forEach((seg, i) => {
    const pageConfig = pages?.[seg];
    const label = pageConfig?.label || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/[-_]/g, " ");
    const isLast = i === pathSegments.length - 1;
    const route = isLast ? undefined : "/" + pathSegments.slice(0, i + 1).join("/");
    items.push({ label, route });
  });

  const alignment = config.alignment || "left";
  const justifyMap: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

  // Resolve separator display
  const sepChar = config.separator === ">" || config.separator === "chevron" ? "›"
    : config.separator === "/" ? "/"
    : config.separator === "→" || config.separator === "arrow" ? "→"
    : config.separator || "/";

  // Typography config
  const typo = config.typography;
  const baseFontSize = resolve(typo?.fontSize) ?? 13;
  const baseFontWeight = resolve(typo?.fontWeight) ?? 400;
  const baseFontFamily = resolve(typo?.fontFamily) as string | undefined;
  const baseColor = resolve(typo?.color) ?? "var(--muted-foreground)";
  const activeColor = resolve(typo?.activeColor) ?? "var(--foreground)";
  const activeWeight = resolve(typo?.activeFontWeight) ?? 600;
  const sepColor = resolve(typo?.separatorColor) ?? "var(--muted-foreground)";

  // Padding config
  const pad = config.padding;
  const padStyle = pad ? {
    paddingTop: resolve(pad.top) ?? undefined,
    paddingRight: resolve(pad.right) ?? undefined,
    paddingBottom: resolve(pad.bottom) ?? undefined,
    paddingLeft: resolve(pad.left) ?? undefined,
  } : {};

  return (
    <div data-orqui-breadcrumbs="" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: justifyMap[alignment] || "flex-start",
      fontFamily: baseFontFamily as string | undefined,
      ...padStyle,
    }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isClickable = !isLast && config.clickable && !!item.route;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span
              onClick={() => {
                if (isClickable) {
                  if (navigate) navigate(item.route!);
                  else window.location.href = item.route!;
                }
              }}
              style={{
                fontSize: baseFontSize as number,
                fontWeight: (isLast ? activeWeight : baseFontWeight) as number,
                color: isLast
                  ? (activeColor as string)
                  : (baseColor as string),
                cursor: isClickable ? "pointer" : "default",
              }}
            >
              {item.label}
            </span>
            {!isLast && (
              <span style={{ color: sepColor as string, margin: "0 6px", fontSize: (baseFontSize as number) * 0.9, opacity: 0.6 }}>
                {sepChar}
              </span>
            )}
          </span>
        );
      })}
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

  // Debug breadcrumbs — remove after confirming it works
  if (typeof window !== "undefined" && (window as any).__ORQUI_DEBUG !== false) {
    console.info("[Orqui] breadcrumbs config:", breadcrumbsConfig, "| page prop:", page);
  }

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
      data-orqui-cb=""
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
      let svg: string;
      const fillColor = faviconConfig.color || "white";
      if (faviconConfig.emoji.startsWith("ph:")) {
        const phPath = PHOSPHOR_SVG_PATHS[faviconConfig.emoji.slice(3)];
        if (phPath) {
          svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${fillColor}"><path d="${phPath}"/></svg>`;
        } else {
          svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">?</text></svg>`;
        }
      } else {
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${faviconConfig.emoji}</text></svg>`;
      }
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      link.type = "image/svg+xml";
    }
  }, [faviconConfig]);

  // Fallback nav items from contract when no sidebarNav prop provided
  const contractNavItems = sidebar?.navigation?.items;
  const effectiveNav = sidebarNav || (contractNavItems?.length ? (
    contractNavItems.map((item: any, i: number) => (
      <a
        key={i}
        href={item.route || "#"}
        onClick={(e) => {
          if (item.route) {
            if (navigate) { e.preventDefault(); navigate(item.route); }
          }
        }}
        data-active={page === item.route ? "true" : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 6,
          textDecoration: "none",
          color: "var(--sidebar-foreground, var(--foreground))",
          fontSize: 14,
        }}
      >
        {item.icon && <IconValue icon={item.icon} size={18} color="currentColor" />}
        <span>{item.label}</span>
      </a>
    ))
  ) : null);

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
            paddingLeft: collapsed ? 0 : sidebarPadL,
            paddingRight: collapsed ? 0 : sidebarPadR,
            paddingTop: collapsed ? 0 : sidebarPadTop,
            position: "relative",
            ...(shouldAlignLogo ? {
              height: `${headerHeightNum}px`,
              minHeight: `${headerHeightNum}px`,
              maxHeight: `${headerHeightNum}px`,
              boxSizing: "border-box" as const,
            } : {
              paddingBottom: collapsed ? 0 : String(resolve("$tokens.spacing.md") ?? "16px"),
            }),
            flexShrink: 0,
          }}>
            {/* Logo in sidebar */}
            {logoConfig?.position === "sidebar" ? (
              <LogoRenderer config={logoConfig} collapsed={collapsed} />
            ) : (
              !collapsed && sidebarHeader
            )}
            {cbPosition === "header-end" && collapseButtonEl && (
              collapsed ? (
                /* When collapsed, position button absolutely so it doesn't push logo off-center */
                <div style={{ position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)" }}>
                  {collapseButtonEl}
                </div>
              ) : collapseButtonEl
            )}
          </div>

          {/* Nav area — own padding from sidebar config */}
          <nav data-orqui-sidebar-nav="" style={{
            flex: 1,
            overflow: sidebar.behavior?.scrollable ? "auto" : "hidden",
            display: "flex",
            flexDirection: "column",
            gap: String(resolve("$tokens.spacing.2xs") ?? "2px"),
            padding: collapsed
              ? `${String(resolve("$tokens.spacing.sm") ?? "8px")} 4px`
              : `${String(resolve("$tokens.spacing.sm") ?? "8px")} ${sidebarPadR}px ${String(resolve("$tokens.spacing.sm") ?? "8px")} ${sidebarPadL}px`,
            ...(collapsed ? { alignItems: "center" } : {}),
          }}>
            {collapsed ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", width: "100%" }}
                data-orqui-collapsed="true"
                data-orqui-collapsed-display={collapsedDisplay}
              >
                {effectiveNav}
              </div>
            ) : effectiveNav}
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
              paddingLeft: collapsed ? 4 : sidebarPadL,
              paddingRight: collapsed ? 4 : sidebarPadR,
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
            borderBottom: resolveSeparator(header?.separators?.bottom) ?? "1px solid var(--border)",
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
                <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} resolveToken={(ref) => resolveTokenRef(ref, tokens)} />
              )}
              {headerLeft}
            </div>
            {/* Center zone: logo (if center) + breadcrumbs (if center) + headerCenter */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", justifyContent: (logoConfig?.position === "header" && logoConfig?.headerSlot === "center") || breadcrumbsConfig?.alignment === "center" ? "center" : undefined }}>
              {logoConfig?.position === "header" && logoConfig?.headerSlot === "center" && (
                <LogoRenderer config={logoConfig} />
              )}
              {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && breadcrumbsConfig?.alignment === "center" && (
                <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} resolveToken={(ref) => resolveTokenRef(ref, tokens)} />
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
