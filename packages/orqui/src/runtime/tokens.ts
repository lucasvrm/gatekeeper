// ============================================================================
// Orqui Runtime — Token Resolution
// ============================================================================
import type { CSSProperties } from "react";
import type { Tokens, TextStyleDef, FontFamilyToken } from "./types.js";

export function resolveTokenRef(ref: string, tokens: Tokens): string | number | null {
  if (!ref) return null;

  // Direct token reference: $tokens.sizing.sidebar-pad → "16px"
  if (ref.startsWith("$tokens.")) {
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

  // calc() with embedded token refs: "calc($tokens.sizing.sidebar-pad - 6px)"
  if (ref.startsWith("calc(") && ref.includes("$tokens.")) {
    const resolved = ref.replace(/\$tokens\.[a-zA-Z0-9._-]+/g, (match) => {
      const val = resolveTokenRef(match, tokens);
      return val != null ? String(val) : match;
    });
    return resolved;
  }

  // Plain CSS value passthrough: "16px", "0", "1rem", etc.
  // Only return if it looks like a valid CSS value (number, px, rem, em, %, vh, vw, etc.)
  if (/^-?[\d.]+(px|rem|em|%|vh|vw|ch|ex|vmin|vmax)?$/.test(ref) || ref === "0") {
    return ref;
  }

  return null;
}

export function tokenToCSS(token: any): string {
  if (typeof token === "string") return token;
  if ("family" in token) return [token.family, ...(token as FontFamilyToken).fallbacks].join(", ");
  if ("unit" in token) return `${token.value}${token.unit}`;
  return String(token.value);
}

export function resolveTextStyleCSS(style: TextStyleDef, tokens: Tokens): CSSProperties {
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

export function cssVar(category: string, key: string): string {
  return `var(--orqui-${category}-${key})`;
}
