// ============================================================================
// Orqui Runtime — CSS StyleSheet Builder
// ============================================================================
import type { Tokens, LayoutContract } from "./types.js";
import { resolveTokenRef, tokenToCSS } from "./tokens.js";

export function buildStyleSheet(tokens: Tokens, layout?: LayoutContract): string {
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

  // Semantic status colors (consumed by Tailwind utilities + page-level components)
  if (c("success"))      lines.push(`  --success: ${c("success")}${imp};`);
  if (c("success-dim"))  lines.push(`  --success-foreground: ${c("success-dim")}${imp};`);
  if (c("warning"))      lines.push(`  --warning: ${c("warning")}${imp};`);
  if (c("warning-dim"))  lines.push(`  --warning-foreground: ${c("warning-dim")}${imp};`);
  if (c("danger"))       lines.push(`  --danger: ${c("danger")}${imp};`);
  if (c("danger-dim"))   lines.push(`  --danger-foreground: ${c("danger-dim")}${imp};`);

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

  // --- Scrollbar styling (always generated with defaults) ---
  const sb = layout?.structure?.scrollbar || {};
  const sbW = sb.width || "6px";
  const sbThumb = sb.thumbColor || "rgba(255,255,255,0.08)";
  const sbThumbHover = sb.thumbHoverColor || "rgba(255,255,255,0.15)";
  const sbTrack = sb.trackColor || "transparent";
  const sbRadius = sb.borderRadius || "3px";
  lines.push("");
  lines.push("/* Orqui Contract → Scrollbar styling */");
  lines.push(`::-webkit-scrollbar { width: ${sbW}${imp}; height: ${sbW}${imp}; }`);
  lines.push(`::-webkit-scrollbar-track { background: ${sbTrack}${imp}; }`);
  lines.push(`::-webkit-scrollbar-thumb { background: ${sbThumb}${imp}; border-radius: ${sbRadius}${imp}; }`);
  lines.push(`::-webkit-scrollbar-thumb:hover { background: ${sbThumbHover}${imp}; }`);
  lines.push(`::-webkit-scrollbar-button { display: none${imp}; }`);
  lines.push(`* { scrollbar-width: thin; scrollbar-color: ${sbThumb} ${sbTrack}; }`);

  // --- Skeleton animation (always generated with defaults) ---
  const sk = layout?.structure?.skeleton || {};
  const skBase = sk.baseColor || "rgba(255,255,255,0.05)";
  const skHighlight = sk.highlightColor || "rgba(255,255,255,0.10)";
  const skRadius = sk.borderRadius || "6px";
  const skDuration = sk.duration || "1.5s";
  const skAnim = sk.animation || "pulse";
  lines.push("");
  lines.push("/* Orqui Contract → Skeleton styling */");
  lines.push(`:root { --orqui-skeleton-base: ${skBase}; --orqui-skeleton-highlight: ${skHighlight}; --orqui-skeleton-radius: ${skRadius}; --orqui-skeleton-duration: ${skDuration}; }`);
  lines.push(`[data-orqui-skeleton] { background: var(--orqui-skeleton-base); border-radius: var(--orqui-skeleton-radius); }`);
  if (skAnim === "pulse") {
    lines.push(`@keyframes orqui-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`);
    lines.push(`[data-orqui-skeleton] { animation: orqui-pulse var(--orqui-skeleton-duration) ease-in-out infinite; }`);
  } else if (skAnim === "shimmer") {
    lines.push(`@keyframes orqui-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`);
    lines.push(`[data-orqui-skeleton] { background: linear-gradient(90deg, var(--orqui-skeleton-base) 25%, var(--orqui-skeleton-highlight) 50%, var(--orqui-skeleton-base) 75%); background-size: 200% 100%; animation: orqui-shimmer var(--orqui-skeleton-duration) ease-in-out infinite; }`);
  }

  // --- Toast positioning CSS variables (always generated with defaults) ---
  const tc = layout?.structure?.toast || {};
  const pos = tc.position || "bottom-right";
  const posMap: Record<string, { top?: string; bottom?: string; left?: string; right?: string; transform?: string; align?: string }> = {
    "top-right":     { top: "16px", right: "16px", align: "flex-end" },
    "top-left":      { top: "16px", left: "16px", align: "flex-start" },
    "bottom-right":  { bottom: "16px", right: "16px", align: "flex-end" },
    "bottom-left":   { bottom: "16px", left: "16px", align: "flex-start" },
    "top-center":    { top: "16px", left: "50%", transform: "translateX(-50%)", align: "center" },
    "bottom-center": { bottom: "16px", left: "50%", transform: "translateX(-50%)", align: "center" },
  };
  const p = posMap[pos] || posMap["bottom-right"];
  lines.push("");
  lines.push("/* Orqui Contract → Toast positioning */");
  lines.push(`:root { --orqui-toast-top: ${p.top || "auto"}; --orqui-toast-bottom: ${p.bottom || "auto"}; --orqui-toast-left: ${p.left || "auto"}; --orqui-toast-right: ${p.right || "auto"}; --orqui-toast-transform: ${p.transform || "none"}; --orqui-toast-align: ${p.align || "flex-end"}; --orqui-toast-max-visible: ${tc.maxVisible || 3}; --orqui-toast-duration: ${tc.duration || 4000}ms; }`);
  // Override sonner/radix toast container if present
  lines.push(`[data-sonner-toaster], [data-radix-toast-viewport] { position: fixed${imp}; top: var(--orqui-toast-top)${imp}; bottom: var(--orqui-toast-bottom)${imp}; left: var(--orqui-toast-left)${imp}; right: var(--orqui-toast-right)${imp}; transform: var(--orqui-toast-transform)${imp}; align-items: var(--orqui-toast-align)${imp}; z-index: 9999${imp}; }`);

  // --- Empty state CSS variables (always generated with defaults) ---
  const es = layout?.structure?.emptyState || {};
  lines.push("");
  lines.push("/* Orqui Contract → Empty state defaults */");
  lines.push(`:root { --orqui-empty-icon: "${(es.icon || "ph:magnifying-glass").replace(/"/g, '\\"')}"; --orqui-empty-title: "${(es.title || "Nenhum item encontrado").replace(/"/g, '\\"')}"; --orqui-empty-description: "${(es.description || "").replace(/"/g, '\\"')}"; --orqui-empty-show-action: ${es.showAction !== false ? 1 : 0}; --orqui-empty-action-label: "${(es.actionLabel || "Criar Novo").replace(/"/g, '\\"')}"; }`);

  // --- Collapsed sidebar tooltip CSS ---
  lines.push("");
  lines.push("/* Orqui Contract → Collapsed sidebar tooltips */");
  lines.push(`.orqui-nav-item:hover + .orqui-nav-tooltip, .orqui-nav-tooltip:hover { opacity: 1${imp}; }`);
  // Tooltip arrow
  lines.push(`.orqui-nav-tooltip::before { content: ''; position: absolute; left: -6px; top: 50%; transform: translateY(-50%); border: 3px solid transparent; border-right-color: var(--border, #2e3135); }`);

  return lines.join("\n");
}
