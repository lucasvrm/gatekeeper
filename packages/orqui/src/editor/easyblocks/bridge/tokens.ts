// ============================================================================
// Token Bridge — Orqui tokens → Easyblocks Config.tokens
//
// Orqui stores tokens as typed objects:
//   { "sm": { value: 8, unit: "px" } }
//   { "accent": { value: "#6d9cff" } }
//
// Easyblocks expects flat token arrays:
//   [{ id: "sm", label: "sm", value: "8px" }]
//
// This bridge converts bidirectionally.
// ============================================================================

import type { EasyblocksToken, EasyblocksTokens } from "../types";

// ============================================================================
// Orqui → Easyblocks
// ============================================================================

/** Resolve an Orqui token to its CSS string value */
function resolveTokenValue(token: { value: unknown; unit?: string }): string {
  if (typeof token.value === "string") return token.value;
  if (typeof token.value === "number") {
    return token.unit ? `${token.value}${token.unit}` : String(token.value);
  }
  return String(token.value ?? "");
}

/** Convert a single Orqui token group to Easyblocks token array */
function convertTokenGroup(
  group: Record<string, { value: unknown; unit?: string }> | undefined,
  defaultId?: string,
): EasyblocksToken[] {
  if (!group) return [];
  return Object.entries(group).map(([id, token]) => ({
    id,
    label: id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: resolveTokenValue(token),
    ...(id === defaultId ? { isDefault: true } : {}),
  }));
}

/** Convert Orqui font family tokens to Easyblocks font tokens */
function convertFontTokens(
  fontFamilies: Record<string, { family: string; fallbacks?: string[] }> | undefined,
): EasyblocksToken[] {
  if (!fontFamilies) return [];
  return Object.entries(fontFamilies).map(([id, token]) => {
    const fallbacks = token.fallbacks?.join(", ") || "sans-serif";
    const fullFamily = `'${token.family}', ${fallbacks}`;
    return {
      id,
      label: token.family,
      value: { fontFamily: fullFamily },
      ...(id === "primary" ? { isDefault: true } : {}),
    };
  });
}

/**
 * Convert the full Orqui `layout.tokens` object to Easyblocks `Config.tokens`.
 *
 * @param orquiTokens - The `layout.tokens` from the Orqui contract
 * @returns Easyblocks-compatible token configuration
 *
 * @example
 * ```ts
 * const ebTokens = orquiTokensToEasyblocks(layout.tokens);
 * // → { colors: [...], space: [...], fonts: [...], borderRadius: [...] }
 * ```
 */
/**
 * Easyblocks `parseSpacing` only accepts: plain numbers, px, and vw.
 * Orqui sizing tokens can include vh, %, rem, em — these CRASH the editor.
 */
// Only: "0", "Npx", "Nvw" — bare decimals like "1.12" are rejected
const EB_SPACING_RE = /^(0|(-?\d+(\.\d+)?(px|vw)))$/;

export function orquiTokensToEasyblocks(orquiTokens: Record<string, any>): EasyblocksTokens {
  const allSpace = [
    ...convertTokenGroup(orquiTokens.spacing, "md"),
    ...convertTokenGroup(orquiTokens.sizing),
  ].filter(t => {
    const v = typeof t.value === "string" ? t.value : String(t.value);
    return EB_SPACING_RE.test(v);
  });

  return {
    colors: convertTokenGroup(orquiTokens.colors, "accent"),
    space: allSpace,
    fonts: convertFontTokens(orquiTokens.fontFamilies),
    borderRadius: convertTokenGroup(orquiTokens.borderRadius, "md"),
  };
}

// ============================================================================
// Easyblocks → Orqui (reverse bridge for roundtrip)
// ============================================================================

/**
 * Convert Easyblocks token arrays back to Orqui token objects.
 * Used when syncing changes made in Easyblocks back to the contract.
 *
 * Note: this is lossy for font tokens (fallbacks are reconstructed heuristically).
 */
export function easyblocksToOrquiTokens(ebTokens: EasyblocksTokens): Record<string, any> {
  const colors: Record<string, { value: string }> = {};
  for (const t of ebTokens.colors) {
    colors[t.id] = { value: typeof t.value === "string" ? t.value : String(t.value) };
  }

  // Separate spacing from sizing based on known sizing keys
  const SIZING_KEYS = new Set([
    "sidebar-width", "sidebar-collapsed", "sidebar-pad",
    "main-pad", "header-height", "full-height",
  ]);
  const spacing: Record<string, { value: number; unit: string }> = {};
  const sizing: Record<string, { value: number; unit: string }> = {};

  for (const t of ebTokens.space) {
    const parsed = parseSpaceValue(typeof t.value === "string" ? t.value : String(t.value));
    if (SIZING_KEYS.has(t.id)) {
      sizing[t.id] = parsed;
    } else {
      spacing[t.id] = parsed;
    }
  }

  const fontFamilies: Record<string, { family: string; fallbacks: string[] }> = {};
  for (const t of ebTokens.fonts) {
    const val = typeof t.value === "object" && t.value !== null
      ? (t.value as { fontFamily?: string }).fontFamily || ""
      : String(t.value);
    const { family, fallbacks } = parseFontFamily(val);
    fontFamilies[t.id] = { family, fallbacks };
  }

  const borderRadius: Record<string, { value: number; unit: string }> = {};
  for (const t of (ebTokens.borderRadius || [])) {
    borderRadius[t.id] = parseSpaceValue(typeof t.value === "string" ? t.value : String(t.value));
  }

  return { colors, spacing, sizing, fontFamilies, borderRadius };
}

// ============================================================================
// Helpers
// ============================================================================

function parseSpaceValue(css: string): { value: number; unit: string } {
  const match = css.match(/^(-?\d+\.?\d*)(px|em|rem|vh|vw|%)?$/);
  if (match) {
    return { value: parseFloat(match[1]), unit: match[2] || "px" };
  }
  return { value: 0, unit: "px" };
}

function parseFontFamily(css: string): { family: string; fallbacks: string[] } {
  const parts = css.split(",").map(s => s.trim().replace(/^['"]|['"]$/g, ""));
  return {
    family: parts[0] || "Inter",
    fallbacks: parts.slice(1),
  };
}

// ============================================================================
// CSS Variable injection — for Easyblocks canvas to use Orqui token values
// ============================================================================

/**
 * Generate CSS custom properties from Orqui tokens.
 * These are injected into the Easyblocks canvas so components can reference
 * `var(--orqui-accent)` etc. in their styles functions.
 *
 * @returns A CSS string to inject into a <style> tag
 */
export function generateTokenCSSVariables(orquiTokens: Record<string, any>): string {
  const lines: string[] = [":root {"];

  // Colors
  if (orquiTokens.colors) {
    for (const [id, token] of Object.entries(orquiTokens.colors)) {
      lines.push(`  --orqui-${id}: ${(token as any).value};`);
    }
  }

  // Spacing
  if (orquiTokens.spacing) {
    for (const [id, token] of Object.entries(orquiTokens.spacing)) {
      const t = token as { value: number; unit?: string };
      lines.push(`  --orqui-spacing-${id}: ${t.value}${t.unit || "px"};`);
    }
  }

  // Sizing
  if (orquiTokens.sizing) {
    for (const [id, token] of Object.entries(orquiTokens.sizing)) {
      const t = token as { value: number; unit?: string };
      lines.push(`  --orqui-sizing-${id}: ${t.value}${t.unit || "px"};`);
    }
  }

  // Font families
  if (orquiTokens.fontFamilies) {
    for (const [id, token] of Object.entries(orquiTokens.fontFamilies)) {
      const t = token as { family: string; fallbacks?: string[] };
      const fallbacks = t.fallbacks?.join(", ") || "sans-serif";
      lines.push(`  --orqui-font-${id}: '${t.family}', ${fallbacks};`);
    }
  }

  // Border radius
  if (orquiTokens.borderRadius) {
    for (const [id, token] of Object.entries(orquiTokens.borderRadius)) {
      const t = token as { value: number; unit?: string };
      lines.push(`  --orqui-radius-${id}: ${t.value}${t.unit || "px"};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}
