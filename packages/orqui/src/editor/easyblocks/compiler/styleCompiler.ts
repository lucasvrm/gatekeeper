// ============================================================================
// Style Compiler — Gap 3 (Styles Functions → Pre-computed CSS)
//
// The Easyblocks editor runs each definition's styles() function at
// design-time to generate CSS for the canvas. The APP never has access
// to these functions — it only gets the NodeDef/EnrichedNodeDef.
//
// This module runs styles() OFFLINE (outside the editor) for every node
// in the tree, at every breakpoint, producing a ComponentStyleMap that
// the runtime can apply directly as inline styles or CSS classes.
//
// It also tokenizes concrete color/spacing values back to CSS variables
// so that the styles respond to theme changes at runtime.
// ============================================================================

import { EB_ID_TO_NODE_TYPE, NODE_TYPE_TO_EB_ID } from "../types";
import { ALL_DEFINITIONS } from "../definitions";
import type { NoCodeComponentDefinition, StylesFunctionArgs } from "../types";
import type {
  EnrichedNodeDef,
  ComponentStyleMap,
  ComponentPropsMap,
  ResolvedTextStyles,
  CSSVariableMap,
} from "./types";
import { BREAKPOINT_IDS, DEVICE_WIDTHS } from "./types";
import type { TokenIndex } from "./enricher";

// ============================================================================
// Definition lookup
// ============================================================================

const DEFINITION_BY_EB_ID = new Map<string, NoCodeComponentDefinition>();
for (const def of ALL_DEFINITIONS) {
  DEFINITION_BY_EB_ID.set(def.id, def);
}

// ============================================================================
// Token value → CSS variable tokenization
// ============================================================================

/**
 * CSS variable naming convention:
 *   colors.accent      → var(--orqui-accent)
 *   spacing.md         → var(--orqui-spacing-md)
 *   sizing.sidebar-width → var(--orqui-sizing-sidebar-width)
 *   fontFamilies.primary → var(--orqui-font-primary)
 *   borderRadius.md    → var(--orqui-radius-md)
 */
function tokenValueToCSSVar(group: string, id: string): string {
  const prefixMap: Record<string, string> = {
    colors: `--orqui-${id}`,
    spacing: `--orqui-spacing-${id}`,
    sizing: `--orqui-sizing-${id}`,
    fontFamilies: `--orqui-font-${id}`,
    borderRadius: `--orqui-radius-${id}`,
    fontSizes: `--orqui-font-size-${id}`,
    fontWeights: `--orqui-font-weight-${id}`,
    lineHeights: `--orqui-line-height-${id}`,
    letterSpacings: `--orqui-letter-spacing-${id}`,
    borderWidth: `--orqui-border-width-${id}`,
  };
  return prefixMap[group] || `--orqui-${group}-${id}`;
}

/**
 * Build a reverse index: concrete token value → CSS variable reference.
 * Used to tokenize concrete values in styles() output back to var(--...).
 *
 * For example, if spacing.md = { value: 16, unit: "px" }, then
 *   reverseIndex["16px"] = "var(--orqui-spacing-md)"
 *
 * Multiple tokens can resolve to the same value — we keep the most
 * specific (shortest group name + id) to avoid ambiguity.
 */
export interface ReverseTokenIndex {
  /** concrete CSS value → var(--...) reference */
  valueToVar: Map<string, string>;
  /** concrete CSS value → $tokens.group.id */
  valueToRef: Map<string, string>;
}

export function buildReverseTokenIndex(
  tokens: Record<string, any>,
  tokenIndex: TokenIndex,
): ReverseTokenIndex {
  const valueToVar = new Map<string, string>();
  const valueToRef = new Map<string, string>();

  for (const [key, cssValue] of tokenIndex.resolvedValues) {
    const [group, id] = key.split(".", 2);
    const varName = tokenValueToCSSVar(group, id);
    const varRef = `var(${varName})`;

    // Don't overwrite more specific matches
    if (!valueToVar.has(cssValue)) {
      valueToVar.set(cssValue, varRef);
      valueToRef.set(cssValue, `$tokens.${group}.${id}`);
    }
  }

  return { valueToVar, valueToRef };
}

// ============================================================================
// CSS value tokenization
// ============================================================================

/**
 * Post-process a CSS properties object: replace concrete token values
 * with var(--orqui-...) references.
 *
 * This allows runtime theme switching: changing --orqui-accent updates
 * all components that reference it.
 */
function tokenizeCSS(
  css: Record<string, any>,
  reverseIndex: ReverseTokenIndex,
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [prop, value] of Object.entries(css)) {
    if (value === undefined || value === null) continue;

    const strVal = String(value);

    // Already a var() reference — pass through
    if (strVal.startsWith("var(")) {
      result[prop] = value;
      continue;
    }

    // Already a $tokens ref — convert to var()
    if (strVal.startsWith("$tokens.")) {
      const parts = strVal.replace("$tokens.", "").split(".");
      if (parts.length === 2) {
        const varName = tokenValueToCSSVar(parts[0], parts[1]);
        result[prop] = `var(${varName})`;
        continue;
      }
    }

    // Try reverse lookup: concrete value → var(--...)
    const varRef = reverseIndex.valueToVar.get(strVal);
    if (varRef) {
      result[prop] = varRef;
      continue;
    }

    // No match — keep original
    result[prop] = value;
  }

  return result;
}

// ============================================================================
// Resolve prop values for styles() invocation
// ============================================================================

/**
 * Resolve a prop value so it can be passed to styles().
 * styles() expects concrete values, not token refs.
 *
 * "$tokens.spacing.md" → "16px"
 * "$tokens.colors.accent" → "#6d9cff"
 * "$tokens.fontFamilies.primary" → { fontFamily: "'Inter', ..." }
 */
function resolveForStyles(
  value: unknown,
  tokenIndex: TokenIndex,
): unknown {
  if (typeof value !== "string") return value;

  // $tokens reference
  const match = (value as string).match(/^\$tokens\.(.+)$/);
  if (match) {
    const resolved = tokenIndex.resolvedValues.get(match[1]);
    if (resolved !== undefined) return resolved;
  }

  return value;
}

// ============================================================================
// Diff-based responsive style compression
// ============================================================================

/**
 * Given full styles per breakpoint, produce a compressed map where
 * each breakpoint only contains the DIFF from the previous (larger) one.
 *
 * This matches CSS @media semantics: xl is the base, smaller breakpoints
 * override only what changes.
 */
function compressResponsiveStyles(
  fullMap: Record<string, Record<string, any>>,
): Record<string, Record<string, any>> {
  const compressed: Record<string, Record<string, any>> = {};
  const bps = BREAKPOINT_IDS.filter(bp => fullMap[bp]);

  if (bps.length === 0) return compressed;

  // xl (or first available) is always the full base
  compressed[bps[0]] = fullMap[bps[0]];

  for (let i = 1; i < bps.length; i++) {
    const prev = fullMap[bps[i - 1]];
    const curr = fullMap[bps[i]];
    const diff: Record<string, any> = {};

    for (const [prop, value] of Object.entries(curr)) {
      if (JSON.stringify(value) !== JSON.stringify(prev[prop])) {
        diff[prop] = value;
      }
    }

    if (Object.keys(diff).length > 0) {
      compressed[bps[i]] = diff;
    }
  }

  return compressed;
}

// ============================================================================
// Main style compiler
// ============================================================================

export interface StyleCompilerResult {
  componentStyles: ComponentStyleMap;
  componentProps: ComponentPropsMap;
}

/**
 * Compile styles for an entire EnrichedNodeDef tree.
 *
 * Walks the tree, runs each definition's styles() function at every
 * breakpoint, and produces the ComponentStyleMap.
 *
 * @param tree - The enriched node tree (from enricher)
 * @param tokenIndex - Token index for resolving $tokens refs
 * @param reverseIndex - Reverse index for tokenizing CSS values
 */
export function compileStyles(
  tree: EnrichedNodeDef,
  tokenIndex: TokenIndex,
  reverseIndex: ReverseTokenIndex,
): StyleCompilerResult {
  const componentStyles: ComponentStyleMap = {};
  const componentProps: ComponentPropsMap = {};

  function walk(node: EnrichedNodeDef): void {
    const ebId = NODE_TYPE_TO_EB_ID[node.type];
    const definition = ebId ? DEFINITION_BY_EB_ID.get(ebId) : undefined;

    if (definition?.styles) {
      const fullStyles: Record<string, Record<string, Record<string, any>>> = {};
      // slot → bp → css
      const fullProps: Record<string, Record<string, any>> = {};
      // bp → computed props

      for (const bp of BREAKPOINT_IDS) {
        // ── Build values for this breakpoint ──────────────────
        const values: Record<string, any> = {};

        // Start with base props
        if (node.props) {
          for (const [key, val] of Object.entries(node.props)) {
            values[key] = resolveForStyles(val, tokenIndex);
          }
        }

        // Apply responsive overrides for this breakpoint
        if (node.responsive) {
          for (const [key, resMap] of Object.entries(node.responsive)) {
            // Find the applicable value: use this bp or nearest larger
            const applicable = findApplicableBreakpoint(resMap, bp);
            if (applicable !== undefined) {
              values[key] = resolveForStyles(applicable, tokenIndex);
            }
          }
        }

        // ── Run styles() ──────────────────────────────────────
        try {
          const args: StylesFunctionArgs = {
            values,
            params: {},
            isEditing: false,
            device: { id: bp, w: DEVICE_WIDTHS[bp] || 1440 },
          };

          const result = definition.styles(args);

          if (result?.styled) {
            for (const [slot, css] of Object.entries(result.styled)) {
              if (!fullStyles[slot]) fullStyles[slot] = {};
              // Tokenize concrete values → var(--orqui-...)
              fullStyles[slot][bp] = tokenizeCSS(css as Record<string, any>, reverseIndex);
            }
          }

          if (result?.props) {
            fullProps[bp] = result.props;
          }
        } catch (err) {
          // styles() failure is non-fatal — skip this breakpoint
          console.warn(`[style-compiler] styles() failed for ${node.id} at ${bp}:`, err);
        }
      }

      // ── Compress responsive styles (only diffs from xl) ────
      if (Object.keys(fullStyles).length > 0) {
        const compressed: Record<string, Record<string, Record<string, any>>> = {};
        for (const [slot, bpMap] of Object.entries(fullStyles)) {
          const comp = compressResponsiveStyles(bpMap);
          if (Object.keys(comp).length > 0) {
            compressed[slot] = comp;
          }
        }
        if (Object.keys(compressed).length > 0) {
          componentStyles[node.id] = compressed;
        }
      }

      // ── Compress responsive props ──────────────────────────
      if (Object.keys(fullProps).length > 0) {
        const compressed = compressResponsiveStyles(fullProps);
        if (Object.keys(compressed).length > 0) {
          componentProps[node.id] = compressed;
        }
      }
    }

    // ── Recurse ──────────────────────────────────────────────
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(tree);

  return { componentStyles, componentProps };
}

// ============================================================================
// Breakpoint cascade resolution
// ============================================================================

/**
 * Find the applicable value for a breakpoint by cascading up.
 *
 * If the exact breakpoint is not in the map, use the nearest larger one.
 * This mirrors how CSS @media (min-width) cascading works.
 *
 * @example
 * resMap = { xl: "4", xs: "1" }
 * findApplicableBreakpoint(resMap, "md") → "4" (cascades from xl)
 * findApplicableBreakpoint(resMap, "xs") → "1" (exact match)
 */
function findApplicableBreakpoint(
  resMap: Record<string, any>,
  targetBp: string,
): any {
  const targetIdx = BREAKPOINT_IDS.indexOf(targetBp);
  if (targetIdx === -1) return undefined;

  // Walk from target upward to xl (index 0)
  for (let i = targetIdx; i >= 0; i--) {
    const bp = BREAKPOINT_IDS[i];
    if (resMap[bp] !== undefined) return resMap[bp];
  }

  // Fallback: try smaller breakpoints
  for (let i = targetIdx + 1; i < BREAKPOINT_IDS.length; i++) {
    const bp = BREAKPOINT_IDS[i];
    if (resMap[bp] !== undefined) return resMap[bp];
  }

  return undefined;
}

// ============================================================================
// CSS Variables generator
// ============================================================================

/**
 * Generate the full CSS variable map from Orqui tokens.
 * The runtime injects these into :root.
 */
export function generateCSSVariableMap(tokens: Record<string, any>): CSSVariableMap {
  const vars: CSSVariableMap = {};

  // Colors
  if (tokens.colors) {
    for (const [id, token] of Object.entries(tokens.colors)) {
      const t = token as { value: string };
      vars[`--orqui-${id}`] = t.value;
    }
  }

  // Spacing
  if (tokens.spacing) {
    for (const [id, token] of Object.entries(tokens.spacing)) {
      const t = token as { value: number; unit?: string };
      vars[`--orqui-spacing-${id}`] = `${t.value}${t.unit || "px"}`;
    }
  }

  // Sizing
  if (tokens.sizing) {
    for (const [id, token] of Object.entries(tokens.sizing)) {
      const t = token as { value: number; unit?: string };
      vars[`--orqui-sizing-${id}`] = `${t.value}${t.unit || "px"}`;
    }
  }

  // Font families
  if (tokens.fontFamilies) {
    for (const [id, token] of Object.entries(tokens.fontFamilies)) {
      const t = token as { family: string; fallbacks?: string[] };
      const fallbacks = t.fallbacks?.join(", ") || "sans-serif";
      vars[`--orqui-font-${id}`] = `'${t.family}', ${fallbacks}`;
    }
  }

  // Font sizes
  if (tokens.fontSizes) {
    for (const [id, token] of Object.entries(tokens.fontSizes)) {
      const t = token as { value: number; unit?: string };
      vars[`--orqui-font-size-${id}`] = `${t.value}${t.unit || "px"}`;
    }
  }

  // Font weights
  if (tokens.fontWeights) {
    for (const [id, token] of Object.entries(tokens.fontWeights)) {
      const t = token as { value: number };
      vars[`--orqui-font-weight-${id}`] = String(t.value);
    }
  }

  // Line heights
  if (tokens.lineHeights) {
    for (const [id, token] of Object.entries(tokens.lineHeights)) {
      const t = token as { value: number };
      vars[`--orqui-line-height-${id}`] = String(t.value);
    }
  }

  // Letter spacings
  if (tokens.letterSpacings) {
    for (const [id, token] of Object.entries(tokens.letterSpacings)) {
      const t = token as { value: string | number; unit?: string };
      vars[`--orqui-letter-spacing-${id}`] = typeof t.value === "number"
        ? `${t.value}${t.unit || "em"}`
        : t.value;
    }
  }

  // Border radius
  if (tokens.borderRadius) {
    for (const [id, token] of Object.entries(tokens.borderRadius)) {
      const t = token as { value: number; unit?: string };
      vars[`--orqui-radius-${id}`] = `${t.value}${t.unit || "px"}`;
    }
  }

  // Border width
  if (tokens.borderWidth) {
    for (const [id, token] of Object.entries(tokens.borderWidth)) {
      const t = token as { value: number; unit?: string };
      vars[`--orqui-border-width-${id}`] = `${t.value}${t.unit || "px"}`;
    }
  }

  return vars;
}

// ============================================================================
// TextStyles resolver
// ============================================================================

/**
 * Resolve textStyles from the contract: replace $tokens.X.Y references
 * with var(--orqui-...) CSS variables.
 *
 * Input:  { "heading-1": { fontFamily: "$tokens.fontFamilies.display", fontSize: "$tokens.fontSizes.3xl" } }
 * Output: { "heading-1": { fontFamily: "var(--orqui-font-display)", fontSize: "var(--orqui-font-size-3xl)" } }
 */
export function resolveTextStyles(
  textStyles: Record<string, any> | undefined,
  tokens: Record<string, any>,
  tokenIndex: TokenIndex,
): ResolvedTextStyles {
  if (!textStyles) return {};

  const result: ResolvedTextStyles = {};

  for (const [name, style] of Object.entries(textStyles)) {
    if (typeof style !== "object" || style === null) continue;

    const resolved: Record<string, string | number> = {};

    for (const [prop, value] of Object.entries(style)) {
      if (prop === "description") continue; // skip metadata

      if (typeof value === "string" && value.startsWith("$tokens.")) {
        // Parse: "$tokens.fontFamilies.primary" → group="fontFamilies", id="primary"
        const ref = value.replace("$tokens.", "");
        const dotIdx = ref.indexOf(".");
        if (dotIdx !== -1) {
          const group = ref.substring(0, dotIdx);
          const id = ref.substring(dotIdx + 1);
          const varName = tokenValueToCSSVar(group, id);
          resolved[prop] = `var(${varName})`;
        } else {
          resolved[prop] = value;
        }
      } else {
        resolved[prop] = value as string | number;
      }
    }

    if (Object.keys(resolved).length > 0) {
      result[name] = resolved;
    }
  }

  return result;
}

// ============================================================================
// CSS string generation helpers (for runtime convenience)
// ============================================================================

/**
 * Convert CSS variable map to a CSS string for :root injection.
 *
 * @example
 * cssVarsToString({ "--orqui-accent": "#6d9cff" })
 * // → ":root {\n  --orqui-accent: #6d9cff;\n}"
 */
export function cssVarsToString(vars: CSSVariableMap): string {
  const lines = [":root {"];
  for (const [name, value] of Object.entries(vars)) {
    lines.push(`  ${name}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * Generate @media queries from component styles.
 *
 * Produces a CSS string where xl is the base and smaller breakpoints
 * are wrapped in @media (max-width: ...) queries.
 */
export function componentStylesToCSS(
  styles: ComponentStyleMap,
  breakpoints: typeof import("./types").BREAKPOINTS,
): string {
  const lines: string[] = [];

  for (const [nodeId, slots] of Object.entries(styles)) {
    for (const [slot, bpMap] of Object.entries(slots)) {
      const selector = `[data-orqui-id="${nodeId}"]${slot !== "Root" ? ` [data-orqui-slot="${slot}"]` : ""}`;

      // xl = base (no media query)
      if (bpMap.xl) {
        lines.push(`${selector} {`);
        for (const [prop, value] of Object.entries(bpMap.xl)) {
          lines.push(`  ${camelToKebab(prop)}: ${value};`);
        }
        lines.push("}");
      }

      // Smaller breakpoints wrapped in @media
      for (const bp of breakpoints) {
        if (bp.id === "xl" || !bpMap[bp.id]) continue;
        const maxWidth = breakpoints.find(b => BREAKPOINT_IDS.indexOf(b.id) === BREAKPOINT_IDS.indexOf(bp.id) - 1)?.minWidth;
        if (maxWidth === undefined) continue;

        lines.push(`@media (max-width: ${maxWidth - 1}px) {`);
        lines.push(`  ${selector} {`);
        for (const [prop, value] of Object.entries(bpMap[bp.id])) {
          lines.push(`    ${camelToKebab(prop)}: ${value};`);
        }
        lines.push("  }");
        lines.push("}");
      }
    }
  }

  return lines.join("\n");
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}
