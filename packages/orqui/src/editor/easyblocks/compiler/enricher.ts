// ============================================================================
// Entry Enricher — Gap 1 (Responsive) + Gap 2 (Token Refs)
//
// Walks an Easyblocks NoCodeEntry and produces an EnrichedNodeDef where:
//   - Token values like { tokenId: "accent", value: "#6d9cff" }
//     become "$tokens.colors.accent" (preserving the reference)
//   - Responsive wrappers like { $res: true, xl: "4", xs: "1" }
//     are preserved in the `responsive` map (not flattened)
//   - Template expressions {{ ... }} are catalogued in `bindings`
//
// The output is deterministic and suitable for JSON serialization.
// ============================================================================

import { EB_ID_TO_NODE_TYPE } from "../types";
import { ALL_DEFINITIONS } from "../definitions";
import type { NoCodeComponentDefinition } from "../types";
import type { EnrichedNodeDef } from "./types";
import { BREAKPOINT_IDS } from "./types";

// ============================================================================
// Token detection — built from definitions at load time
// ============================================================================

const TOKEN_SCHEMA_TYPES = new Set(["space", "color", "font", "orqui-border-radius"]);

/** Map: EB component ID → Set of prop names that are token-typed */
const TOKEN_PROP_MAP = new Map<string, Set<string>>();
for (const def of ALL_DEFINITIONS) {
  const tokenProps = new Set<string>();
  for (const sp of def.schema) {
    if (TOKEN_SCHEMA_TYPES.has(sp.type)) {
      tokenProps.add(sp.prop);
    }
  }
  if (tokenProps.size > 0) {
    TOKEN_PROP_MAP.set(def.id, tokenProps);
  }
}

/** Definition lookup by EB component ID */
const DEFINITION_MAP = new Map<string, NoCodeComponentDefinition>();
for (const def of ALL_DEFINITIONS) {
  DEFINITION_MAP.set(def.id, def);
}

// ============================================================================
// EB meta keys — always skip
// ============================================================================

const SKIP_KEYS = new Set([
  "_id", "_component", "_itemProps", "_master", "__editing",
  "Children",                // handled as children
]);

/** Props that are stored as JSON strings in EB */
const JSON_PROP_MAP: Record<string, string> = {
  columnsJson: "columns",
  itemsJson: "items",
  tabsJson: "items",
  optionsJson: "options",
};

// ============================================================================
// Responsive detection
// ============================================================================

function isResponsive(val: unknown): val is { $res: true; [bp: string]: unknown } {
  return typeof val === "object" && val !== null && (val as any).$res === true;
}

// ============================================================================
// Token group index — maps tokenId → group name
// ============================================================================

export interface TokenIndex {
  /** tokenId → group name (e.g. "accent" → "colors") */
  idToGroup: Map<string, string>;
  /** group.id → resolved CSS value */
  resolvedValues: Map<string, string>;
}

/**
 * Build a token index from the Orqui tokens object.
 * Scans all token groups and indexes every tokenId.
 */
export function buildTokenIndex(tokens: Record<string, any>): TokenIndex {
  const idToGroup = new Map<string, string>();
  const resolvedValues = new Map<string, string>();

  for (const [group, entries] of Object.entries(tokens)) {
    if (typeof entries !== "object" || entries === null) continue;

    for (const [id, token] of Object.entries(entries)) {
      if (typeof token !== "object" || token === null) continue;

      // Primary key: direct id → group
      idToGroup.set(id, group);

      // Resolve value for CSS variable fallback
      const t = token as { value?: unknown; unit?: string; family?: string; fallbacks?: string[] };
      if (t.family) {
        // Font family
        const fallbacks = t.fallbacks?.join(", ") || "sans-serif";
        resolvedValues.set(`${group}.${id}`, `'${t.family}', ${fallbacks}`);
      } else if (t.value !== undefined) {
        const unit = t.unit || "";
        const val = typeof t.value === "number" ? `${t.value}${unit}` : String(t.value);
        resolvedValues.set(`${group}.${id}`, val);
      }
    }
  }

  return { idToGroup, resolvedValues };
}

// ============================================================================
// Group detection for ambiguous tokenIds
// ============================================================================

/**
 * Given a prop name and its parent component, detect which token group
 * the tokenId belongs to. Uses schema type + token index fallback.
 *
 * Ambiguity resolution: "md" exists in spacing AND borderRadius.
 * Schema type is the authoritative source.
 */
function detectTokenGroup(
  tokenId: string,
  propName: string,
  componentId: string,
  tokenIndex: TokenIndex,
): string | null {
  // 1. Try schema-based detection (most reliable)
  const def = DEFINITION_MAP.get(componentId);
  if (def) {
    const schemaProp = def.schema.find(s => s.prop === propName);
    if (schemaProp) {
      // Schema type → candidate token groups
      if (schemaProp.type === "color") return "colors";
      if (schemaProp.type === "space") {
        // "space" tokens can come from spacing OR sizing.
        // Check sizing first (more specific), then spacing.
        if (tokenIndex.resolvedValues.has(`sizing.${tokenId}`)) return "sizing";
        if (tokenIndex.resolvedValues.has(`spacing.${tokenId}`)) return "spacing";
        return "spacing"; // default
      }
      if (schemaProp.type === "font") return "fontFamilies";
      if (schemaProp.type === "orqui-border-radius") return "borderRadius";
    }
  }

  // 2. Fallback: check token index
  return tokenIndex.idToGroup.get(tokenId) || null;
}

// ============================================================================
// Value enrichment — the core of Gap 2
// ============================================================================

/**
 * Enrich a single prop value.
 *
 * - Token wrapper { tokenId, value } → "$tokens.{group}.{id}"
 * - Font token { tokenId, value: { fontFamily } } → "$tokens.fontFamilies.{id}"
 * - Raw scalar → pass through
 * - JSON string props → parse
 */
function enrichValue(
  value: unknown,
  propName: string,
  componentId: string,
  tokenIndex: TokenIndex,
): unknown {
  if (value === null || value === undefined) return value;

  // Token wrapper: { tokenId: "accent", value: "#6d9cff" }
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    if ("tokenId" in obj && obj.tokenId) {
      const tokenId = String(obj.tokenId);
      const group = detectTokenGroup(tokenId, propName, componentId, tokenIndex);
      if (group) {
        return `$tokens.${group}.${tokenId}`;
      }
      // Unknown group — return resolved value
      return obj.value ?? tokenId;
    }

    // Plain value wrapper (custom value, no tokenId): { value: "24px" }
    if ("value" in obj && !("tokenId" in obj) && Object.keys(obj).length <= 2) {
      return obj.value;
    }

    // Font value object: { fontFamily: "...", fontSize: 14 }
    // These come from font tokens when the widget returns the resolved object
    if ("fontFamily" in obj) {
      return value; // Keep as-is — runtime interprets font objects
    }
  }

  // JSON string prop
  if (propName in JSON_PROP_MAP && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

// ============================================================================
// Template binding detection
// ============================================================================

const TEMPLATE_RE = /\{\{.+?\}\}/;

function isTemplateString(value: unknown): boolean {
  return typeof value === "string" && TEMPLATE_RE.test(value);
}

// ============================================================================
// Main enricher
// ============================================================================

export interface EnricherResult {
  tree: EnrichedNodeDef;
  /** All template bindings found (nodeId → prop names) */
  templateBindings: Map<string, string[]>;
}

/**
 * Enrich an Easyblocks NoCodeEntry into an EnrichedNodeDef.
 *
 * This is the main function that closes Gap 1 and Gap 2:
 *   - Responsive wrappers → `responsive` map
 *   - Token refs → `$tokens.X.Y` strings
 *   - Templates → `bindings` array
 *
 * @param entry - Raw Easyblocks NoCodeEntry (from cache)
 * @param tokenIndex - Pre-built token index
 * @returns EnrichedNodeDef tree + template binding catalog
 */
export function enrichEntry(
  entry: any,
  tokenIndex: TokenIndex,
): EnricherResult {
  const templateBindings = new Map<string, string[]>();

  function walk(node: any): EnrichedNodeDef {
    const componentId = node._component as string;
    const nodeId = node._id as string;
    const orquiType = EB_ID_TO_NODE_TYPE[componentId] || componentId;

    const props: Record<string, any> = {};
    const responsive: Record<string, Record<string, any>> = {};
    const bindings: string[] = [];
    let hasProps = false;
    let hasResponsive = false;

    for (const [key, rawValue] of Object.entries(node)) {
      // Skip meta and children slot
      if (SKIP_KEYS.has(key)) continue;
      if (key.startsWith("_") || key.startsWith("__")) continue;

      // Determine the Orqui prop name (JSON props get renamed)
      const orquiPropName = JSON_PROP_MAP[key] || key;

      if (isResponsive(rawValue)) {
        // ── GAP 1: Preserve responsive map ──────────────────────
        const resMap: Record<string, any> = {};
        let hasVariation = false;
        let firstValue: any = undefined;

        for (const bp of BREAKPOINT_IDS) {
          const bpVal = (rawValue as any)[bp];
          if (bpVal === undefined) continue;

          const enriched = enrichValue(bpVal, key, componentId, tokenIndex);
          resMap[bp] = enriched;

          if (firstValue === undefined) {
            firstValue = enriched;
          } else if (JSON.stringify(enriched) !== JSON.stringify(firstValue)) {
            hasVariation = true;
          }

          // Track template bindings
          if (isTemplateString(enriched)) {
            if (!bindings.includes(orquiPropName)) bindings.push(orquiPropName);
          }
        }

        // Default value (highest breakpoint available)
        const defaultVal = resMap.xl ?? resMap.lg ?? resMap.md ?? resMap.sm ?? resMap.xs;
        if (defaultVal !== undefined && defaultVal !== null && defaultVal !== "") {
          props[orquiPropName] = defaultVal;
          hasProps = true;
        }

        // Only add to responsive if there's actual variation across breakpoints
        if (hasVariation) {
          responsive[orquiPropName] = resMap;
          hasResponsive = true;
        }
      } else {
        // ── Non-responsive prop ──────────────────────────────────
        const enriched = enrichValue(rawValue, key, componentId, tokenIndex);

        if (enriched !== undefined && enriched !== null && enriched !== "") {
          props[orquiPropName] = enriched;
          hasProps = true;
        }

        if (isTemplateString(enriched)) {
          if (!bindings.includes(orquiPropName)) bindings.push(orquiPropName);
        }
      }
    }

    // ── Recurse children ───────────────────────────────────────
    const childrenRaw = node.Children;
    const children = Array.isArray(childrenRaw) && childrenRaw.length > 0
      ? childrenRaw.map((child: any) => walk(child))
      : undefined;

    // Track template bindings
    if (bindings.length > 0) {
      templateBindings.set(nodeId, bindings);
    }

    // Build result
    const result: EnrichedNodeDef = {
      id: nodeId,
      type: orquiType,
    };

    if (hasProps) result.props = props;
    if (hasResponsive) result.responsive = responsive;
    if (bindings.length > 0) result.bindings = bindings;
    if (children) result.children = children;

    return result;
  }

  return {
    tree: walk(entry),
    templateBindings,
  };
}

// ============================================================================
// Fallback enricher — when no EB entry is available
// ============================================================================

/**
 * Enrich a plain NodeDef (no EB entry available).
 * Token refs and responsive data can't be recovered, so this is a
 * best-effort pass that at least detects template bindings.
 */
export function enrichNodeDef(node: any): EnrichedNodeDef {
  const result: EnrichedNodeDef = {
    id: node.id,
    type: node.type,
  };

  if (node.props) {
    result.props = { ...node.props };

    // Detect template bindings
    const bindings: string[] = [];
    for (const [key, value] of Object.entries(node.props)) {
      if (isTemplateString(value)) {
        bindings.push(key);
      }
    }
    if (bindings.length > 0) result.bindings = bindings;
  }

  if (node.style) result.style = { ...node.style };

  if (node.children && node.children.length > 0) {
    result.children = node.children.map((c: any) => enrichNodeDef(c));
  }

  return result;
}
