// ============================================================================
// Token Bridge — Orqui tokens → Easyblocks Config.tokens
//
// Easyblocks Config.tokens uses ConfigTokenValue<T>:
//   { id: string, label?: string, value: T, isDefault?: boolean }
//
// Where T is:
//   colors  → ThemeColor (ResponsiveValue<string>)
//   space   → ThemeSpace (ResponsiveValue<string|number>)
//   fonts   → ThemeFont  (ResponsiveValue<{fontFamily: string, ...}>)
// ============================================================================

import type { ConfigTokenValue } from "@easyblocks/core";

// ============================================================================
// Token output shape matching Config.tokens
// ============================================================================

export interface OrquiEasyblocksTokens {
  colors: ConfigTokenValue<string>[];
  space: ConfigTokenValue<string | number>[];
  fonts: ConfigTokenValue<Record<string, any>>[];
  /** Custom token group — not in core ConfigTokens but Config.tokens allows extra keys */
  [key: string]: ConfigTokenValue<any>[];
}

// ============================================================================
// Orqui → Easyblocks
// ============================================================================

function resolveTokenValue(token: { value: unknown; unit?: string }): string {
  if (typeof token.value === "string") return token.value;
  if (typeof token.value === "number") {
    return token.unit ? `${token.value}${token.unit}` : String(token.value);
  }
  return String(token.value ?? "");
}

function convertColorTokens(
  group: Record<string, { value: string }> | undefined,
): ConfigTokenValue<string>[] {
  if (!group) return [];
  return Object.entries(group).map(([id, token]) => ({
    id,
    label: id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: token.value,
    ...(id === "accent" ? { isDefault: true } : {}),
  }));
}

/**
 * Easyblocks parseSpacing only accepts `px` and `vw` units.
 * Values like `vh`, `%`, `rem`, `em` etc. will crash the editor.
 */
const VALID_SPACE_UNITS = /^-?\d+(\.\d+)?(px|vw)$/;

function isValidSpaceValue(css: string): boolean {
  return VALID_SPACE_UNITS.test(css);
}

/** Attempt to normalize a token to a valid space value (px/vw). Returns null if not possible. */
function normalizeSpaceValue(token: { value: unknown; unit?: string }): string | null {
  const raw = resolveTokenValue(token);
  if (isValidSpaceValue(raw)) return raw;

  // Pure number → assume px
  const num = parseFloat(raw);
  if (!isNaN(num) && String(num) === raw.trim()) return `${num}px`;

  // Has px/vw suffix but maybe extra whitespace
  const cleaned = raw.replace(/\s/g, "");
  if (isValidSpaceValue(cleaned)) return cleaned;

  // Cannot safely convert (vh, %, rem, em, etc.) — skip
  return null;
}

function convertSpaceTokens(
  spacing: Record<string, { value: unknown; unit?: string }> | undefined,
  sizing: Record<string, { value: unknown; unit?: string }> | undefined,
): ConfigTokenValue<string | number>[] {
  const tokens: ConfigTokenValue<string | number>[] = [];
  if (spacing) {
    for (const [id, token] of Object.entries(spacing)) {
      const val = normalizeSpaceValue(token);
      if (val === null) continue; // skip incompatible values
      tokens.push({
        id,
        label: id.replace(/-/g, " "),
        value: val,
        ...(id === "md" ? { isDefault: true } : {}),
      });
    }
  }
  if (sizing) {
    for (const [id, token] of Object.entries(sizing)) {
      const val = normalizeSpaceValue(token);
      if (val === null) continue; // skip incompatible values
      tokens.push({
        id: `sizing-${id}`,
        label: id.replace(/-/g, " "),
        value: val,
      });
    }
  }
  return tokens;
}

function convertFontTokens(
  fontFamilies: Record<string, { family: string; fallbacks?: string[] }> | undefined,
): ConfigTokenValue<Record<string, any>>[] {
  if (!fontFamilies) return [];
  return Object.entries(fontFamilies).map(([id, token]) => {
    const fallbacks = token.fallbacks?.join(", ") || "sans-serif";
    return {
      id,
      label: token.family,
      value: { fontFamily: `'${token.family}', ${fallbacks}` },
      ...(id === "primary" ? { isDefault: true } : {}),
    };
  });
}

/**
 * Convert the full Orqui `layout.tokens` to Easyblocks `Config.tokens`.
 */
export function orquiTokensToEasyblocks(orquiTokens: Record<string, any>): OrquiEasyblocksTokens {
  return {
    colors: convertColorTokens(orquiTokens.colors),
    space: convertSpaceTokens(orquiTokens.spacing, orquiTokens.sizing),
    fonts: convertFontTokens(orquiTokens.fontFamilies),
  };
}

// ============================================================================
// Easyblocks → Orqui (reverse bridge)
// ============================================================================

export function easyblocksToOrquiTokens(ebTokens: OrquiEasyblocksTokens): Record<string, any> {
  const colors: Record<string, { value: string }> = {};
  for (const t of ebTokens.colors) {
    colors[t.id] = { value: typeof t.value === "string" ? t.value : String(t.value) };
  }

  const SIZING_PREFIXES = ["sizing-"];
  const spacing: Record<string, { value: number; unit: string }> = {};
  const sizing: Record<string, { value: number; unit: string }> = {};

  for (const t of ebTokens.space) {
    const parsed = parseSpaceValue(String(t.value));
    if (typeof t.id === "string" && t.id.startsWith("sizing-")) {
      sizing[t.id.replace("sizing-", "")] = parsed;
    } else {
      spacing[t.id] = parsed;
    }
  }

  const fontFamilies: Record<string, { family: string; fallbacks: string[] }> = {};
  for (const t of ebTokens.fonts) {
    const fontFamily = typeof t.value === "object" ? (t.value as any).fontFamily || "" : String(t.value);
    const { family, fallbacks } = parseFontFamily(fontFamily);
    fontFamilies[t.id] = { family, fallbacks };
  }

  return { colors, spacing, sizing, fontFamilies };
}

// ============================================================================
// CSS Variable injection
// ============================================================================

/**
 * Generate CSS custom properties from Orqui tokens for the Easyblocks canvas.
 */
export function generateTokenCSSVariables(orquiTokens: Record<string, any>): string {
  const lines: string[] = [":root {"];

  if (orquiTokens.colors) {
    for (const [id, token] of Object.entries(orquiTokens.colors)) {
      lines.push(`  --orqui-${id}: ${(token as any).value};`);
    }
  }
  if (orquiTokens.spacing) {
    for (const [id, token] of Object.entries(orquiTokens.spacing)) {
      const t = token as { value: number; unit?: string };
      lines.push(`  --orqui-spacing-${id}: ${t.value}${t.unit || "px"};`);
    }
  }
  if (orquiTokens.fontFamilies) {
    for (const [id, token] of Object.entries(orquiTokens.fontFamilies)) {
      const t = token as { family: string; fallbacks?: string[] };
      lines.push(`  --orqui-font-${id}: '${t.family}', ${t.fallbacks?.join(", ") || "sans-serif"};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}

// ============================================================================
// Helpers
// ============================================================================

function parseSpaceValue(css: string): { value: number; unit: string } {
  const match = css.match(/^(-?\d+\.?\d*)(px|em|rem|vh|vw|%)?$/);
  if (match) return { value: parseFloat(match[1]), unit: match[2] || "px" };
  return { value: 0, unit: "px" };
}

function parseFontFamily(css: string): { family: string; fallbacks: string[] } {
  const parts = css.split(",").map(s => s.trim().replace(/^['"]|['"]$/g, ""));
  return { family: parts[0] || "Inter", fallbacks: parts.slice(1) };
}
