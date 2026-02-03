// ============================================================================
// Orqui Design Tokens → CSS Custom Properties
// Converts contract tokens into CSS variables for the runtime
// ============================================================================

import type { TokenValue, TextStyleDef } from "../context/ContractProvider.js";

/**
 * Generate CSS custom properties from the tokens object.
 * Produces variables like:
 *   --orqui-spacing-sm: 8px;
 *   --orqui-colors-accent: #6d9cff;
 */
export function generateTokenCSS(tokens: Record<string, Record<string, TokenValue>>): string {
  const lines: string[] = [":root {"];

  for (const [category, values] of Object.entries(tokens)) {
    for (const [name, token] of Object.entries(values)) {
      const cssVar = `--orqui-${category}-${name}`;
      const cssValue = token.unit ? `${token.value}${token.unit}` : String(token.value);
      lines.push(`  ${cssVar}: ${cssValue};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Generate CSS custom properties as a flat object (for inline styles / style tag).
 */
export function generateTokenVars(
  tokens: Record<string, Record<string, TokenValue>>
): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [category, values] of Object.entries(tokens)) {
    for (const [name, token] of Object.entries(values)) {
      const cssVar = `--orqui-${category}-${name}`;
      vars[cssVar] = token.unit ? `${token.value}${token.unit}` : String(token.value);
    }
  }

  return vars;
}

/**
 * Resolve a token reference to its CSS variable or direct value.
 *
 * "$tokens.colors.accent"  → "var(--orqui-colors-accent)"
 * "$tokens.spacing.lg"     → "var(--orqui-spacing-lg)"
 * "#ff0000"                → "#ff0000" (passthrough)
 * "16px"                   → "16px" (passthrough)
 */
export function resolveTokenToCSS(ref: string): string {
  if (!ref.startsWith("$tokens.")) return ref;
  const path = ref.slice("$tokens.".length).replace(/\./g, "-");
  return `var(--orqui-${path})`;
}

/**
 * Resolve a token reference to its actual value (for computations).
 */
export function resolveTokenToValue(
  ref: string,
  tokens: Record<string, Record<string, TokenValue>>
): string | number {
  if (!ref.startsWith("$tokens.")) return ref;
  const parts = ref.slice("$tokens.".length).split(".");
  const [category, name] = parts;
  const token = tokens[category]?.[name];
  if (!token) return ref;
  return token.unit ? `${token.value}${token.unit}` : token.value;
}

/**
 * Convert a style overrides object (from node.style) to React CSSProperties.
 * Resolves token references to CSS variables.
 *
 * Input:  { "background": "$tokens.colors.surface", "padding": "$tokens.spacing.lg", "borderRadius": "8px" }
 * Output: { background: "var(--orqui-colors-surface)", padding: "var(--orqui-spacing-lg)", borderRadius: "8px" }
 */
export function resolveStyleOverrides(
  style: Record<string, string> | undefined
): React.CSSProperties {
  if (!style) return {};

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    resolved[key] = resolveTokenToCSS(value);
  }
  return resolved as React.CSSProperties;
}

/**
 * Convert a TextStyleDef to React CSSProperties.
 */
export function textStyleToCSS(def: TextStyleDef | undefined): React.CSSProperties {
  if (!def) return {};

  return {
    fontFamily: def.fontFamily ? resolveTokenToCSS(def.fontFamily) : undefined,
    fontSize: def.fontSize ? resolveTokenToCSS(def.fontSize) : undefined,
    fontWeight: def.fontWeight
      ? typeof def.fontWeight === "string"
        ? resolveTokenToCSS(def.fontWeight)
        : def.fontWeight
      : undefined,
    lineHeight: def.lineHeight,
    letterSpacing: def.letterSpacing ? resolveTokenToCSS(def.letterSpacing) : undefined,
  } as React.CSSProperties;
}

/**
 * Generate a full CSS reset + token foundation stylesheet.
 */
export function generateBaseCSS(tokens: Record<string, Record<string, TokenValue>>): string {
  const tokenVars = generateTokenCSS(tokens);

  return `
${tokenVars}

/* Orqui Base Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  font-family: var(--orqui-fontFamilies-primary, Inter, -apple-system, sans-serif);
  font-size: var(--orqui-fontSizes-md, 14px);
  color: var(--orqui-colors-text, #e4e4e7);
  background: var(--orqui-colors-bg, #0a0a0b);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; border: none; background: none; }
input, select, textarea { font: inherit; }

/* Orqui scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--orqui-colors-border, #2a2a33);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--orqui-colors-border-2, #3a3a45);
}
`.trim();
}
