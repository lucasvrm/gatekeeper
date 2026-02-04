// ============================================================================
// Contract Adapter — Bidirectional conversion NoCodeEntry ↔ NodeDef
//
// This is the HEART of the Orqui × Easyblocks integration.
// It ensures that:
//   1. Existing Orqui contracts can be loaded into Easyblocks editor
//   2. Easyblocks documents can be saved back as Orqui contracts
//   3. Roundtrip: nodeDefToEntry(entryToNodeDef(x)) ≈ x (within normalization)
//
// The Easyblocks NoCodeEntry is a JSON tree where each node has:
//   _id: string
//   _component: string (maps to definition.id)
//   [prop]: value | { $res: true, [device]: value } (responsive)
//   [slot]: NoCodeEntry[] (children)
//
// The Orqui NodeDef is:
//   id: string
//   type: string
//   props?: Record<string, any>
//   children?: NodeDef[]
//   style?: Record<string, string>
//   visibility?: { ... }
// ============================================================================

import type { NodeDef, PageDef } from "../../page-editor/nodeDefaults";
import { generateId } from "../../page-editor/nodeDefaults";
import { NODE_TYPE_TO_EB_ID, EB_ID_TO_NODE_TYPE } from "../types";
import { ALL_DEFINITIONS } from "../definitions";

// ============================================================================
// Token prop detection — built dynamically from definitions
//
// Easyblocks expects token-typed props (space, color, font, border-radius)
// to be objects like { tokenId?: string, value: any }, NOT raw strings.
// Passing a raw string (e.g. "24px") causes:
//   TypeError: Cannot use 'in' operator to search for 'tokenId' in 24px
//
// We build a map of which props need wrapping per component so the adapter
// can convert bidirectionally without crashing Easyblocks' normalizer.
// ============================================================================

const TOKEN_SCHEMA_TYPES = new Set(["space", "color", "font", "orqui-border-radius"]);

/**
 * Map: Easyblocks component ID → Set of prop names that are token-typed.
 * Built once at module load from ALL_DEFINITIONS.
 */
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

/**
 * Regex to detect Orqui token references: $tokens.{group}.{id}
 * e.g. "$tokens.spacing.lg" → tokenId "lg"
 */
const TOKEN_REF_REGEX = /^\$tokens\.([\w-]+)\.([\w-]+)$/;

/**
 * Wrap a raw scalar into Easyblocks token value format.
 * Already-wrapped objects (from EB-native entries) pass through unchanged.
 *
 * Handles three cases:
 *   1. Already an object → pass through (e.g. { tokenId: "lg", value: "24px" })
 *   2. "$tokens.spacing.lg" → { tokenId: "lg" } (EB resolves value from config)
 *   3. "24px" → { value: "24px" } (custom value, no token)
 */
function wrapTokenValue(value: unknown): unknown {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value === "string") {
    const match = value.match(TOKEN_REF_REGEX);
    if (match) {
      // match[1] = group (spacing, colors, etc.), match[2] = id (lg, accent, etc.)
      return { tokenId: match[2] };
    }
  }
  return { value };
}

/**
 * Unwrap an Easyblocks token value to its raw scalar.
 *   { tokenId: "md", value: "16px" } → "16px"
 *   { value: "24px" }               → "24px"
 *   "24px"                           → "24px"  (already raw)
 */
function unwrapTokenValue(val: unknown): unknown {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if ("tokenId" in obj || "value" in obj) {
      return obj.value ?? obj.tokenId ?? val;
    }
  }
  return val;
}

// ============================================================================
// Types — Easyblocks NoCodeEntry shape
// ============================================================================

/**
 * Easyblocks NoCodeEntry — the JSON representation of a document node.
 * This is a simplified version; the real one has more meta-fields.
 */
export interface NoCodeEntry {
  _id: string;
  _component: string;
  /** Regular props — string, number, boolean, or responsive objects */
  [key: string]: unknown;
}

/** Responsive value wrapper in Easyblocks */
interface ResponsiveValue<T = unknown> {
  $res: true;
  xl?: T;
  lg?: T;
  md?: T;
  sm?: T;
  xs?: T;
}

function isResponsive(val: unknown): val is ResponsiveValue {
  return typeof val === "object" && val !== null && (val as any).$res === true;
}

/** Extract the "current" value from a potentially responsive value */
function unwrapResponsive(val: unknown): unknown {
  if (isResponsive(val)) {
    // Return the highest-fidelity value (xl → lg → md → sm → xs)
    return val.xl ?? val.lg ?? val.md ?? val.sm ?? val.xs;
  }
  return val;
}

// ============================================================================
// NoCodeEntry → NodeDef (Easyblocks → Orqui)
// ============================================================================

/**
 * Prop keys that are Easyblocks metadata (not Orqui props).
 * These are stripped when converting to NodeDef.
 *
 * Phase 5: Easyblocks normalization on documents.get() may add additional
 * meta-fields (_master, __editing, _itemProps, etc). We skip any key
 * that starts with _ or $ to be future-proof.
 */
const EB_META_KEYS = new Set(["_id", "_component", "_itemProps", "_master", "__editing"]);

/**
 * Props that hold children (component-collection slots).
 * The key in Easyblocks entry → children array in Orqui NodeDef.
 */
const CHILDREN_SLOT_KEY = "Children";

/**
 * Props stored as JSON strings in Easyblocks that need parsing.
 * Maps Easyblocks prop name → Orqui prop name.
 */
const JSON_PROP_MAP: Record<string, string> = {
  columnsJson: "columns",    // Table columns
  itemsJson: "items",        // KeyValue items
  tabsJson: "items",         // Tabs items
  optionsJson: "options",    // Select options
};

/**
 * Convert an Easyblocks NoCodeEntry to an Orqui NodeDef.
 *
 * @param entry - The Easyblocks document node
 * @returns Equivalent Orqui NodeDef
 */
export function noCodeEntryToNodeDef(entry: NoCodeEntry): NodeDef {
  const orquiType = EB_ID_TO_NODE_TYPE[entry._component];
  if (!orquiType) {
    console.warn(`[adapter] Unknown Easyblocks component: ${entry._component}`);
    return {
      id: entry._id || generateId("unknown"),
      type: entry._component,
    };
  }

  const node: NodeDef = {
    id: entry._id || generateId(orquiType),
    type: orquiType,
  };

  // Extract props
  const props: Record<string, any> = {};
  const style: Record<string, string> = {};
  let hasProps = false;
  let hasStyle = false;

  for (const [key, rawValue] of Object.entries(entry)) {
    if (EB_META_KEYS.has(key)) continue;

    // Skip any unknown meta/internal keys (Easyblocks normalization extras)
    if (key.startsWith("_") || key.startsWith("__")) continue;

    // Children slot → will be handled separately
    if (key === CHILDREN_SLOT_KEY) continue;

    const value = unwrapTokenValue(unwrapResponsive(rawValue));

    // JSON-encoded props (table columns, kv items, etc.)
    if (key in JSON_PROP_MAP) {
      const orquiPropName = JSON_PROP_MAP[key];
      try {
        props[orquiPropName] = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        props[orquiPropName] = value;
      }
      hasProps = true;
      continue;
    }

    // Style override props (background, borderRadius, maxWidth from container)
    if (isStyleOverrideProp(key, orquiType)) {
      if (value != null && value !== "") {
        style[key] = String(value);
        hasStyle = true;
      }
      continue;
    }

    // Numeric props that Easyblocks stores as strings
    if (isNumericProp(key, orquiType)) {
      props[key] = typeof value === "string" ? Number(value) : value;
      hasProps = true;
      continue;
    }

    // Regular prop
    if (value != null && value !== "") {
      props[key] = value;
      hasProps = true;
    }
  }

  if (hasProps) node.props = props;
  if (hasStyle) node.style = style;

  // Convert children
  const childrenRaw = entry[CHILDREN_SLOT_KEY];
  if (Array.isArray(childrenRaw) && childrenRaw.length > 0) {
    node.children = childrenRaw.map((child: NoCodeEntry) => noCodeEntryToNodeDef(child));
  }

  return node;
}

// ============================================================================
// NodeDef → NoCodeEntry (Orqui → Easyblocks)
// ============================================================================

let _ebIdCounter = Date.now() % 100000;
function generateEbId(): string {
  return `eb-${++_ebIdCounter}`;
}

/**
 * Convert an Orqui NodeDef to an Easyblocks NoCodeEntry.
 *
 * @param node - The Orqui node definition
 * @returns Equivalent Easyblocks NoCodeEntry
 */
export function nodeDefToNoCodeEntry(node: NodeDef): NoCodeEntry {
  const ebComponent = NODE_TYPE_TO_EB_ID[node.type];
  if (!ebComponent) {
    console.warn(`[adapter] Unknown Orqui node type: ${node.type}`);
    return { _id: node.id || generateEbId(), _component: node.type };
  }

  const entry: NoCodeEntry = {
    _id: node.id || generateEbId(),
    _component: ebComponent,
  };

  // Convert props
  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      // JSON-encoded props (reverse lookup)
      const jsonKey = findJsonKey(key, node.type);
      if (jsonKey) {
        entry[jsonKey] = JSON.stringify(value);
        continue;
      }

      // Numeric props that Easyblocks wants as strings (columns, level, size, etc.)
      if (isNumericAsString(key, node.type)) {
        entry[key] = String(value);
        continue;
      }

      entry[key] = value;
    }
  }

  // Convert style overrides
  if (node.style) {
    for (const [key, value] of Object.entries(node.style)) {
      entry[key] = value;
    }
  }

  // Convert children → Easyblocks component-collection slot
  if (node.children && node.children.length > 0) {
    entry[CHILDREN_SLOT_KEY] = node.children.map(nodeDefToNoCodeEntry);
  }

  // Wrap token-typed props in Easyblocks token value format.
  // Raw scalars like "24px" or "#ff0000" must become { value: "24px" }
  // to avoid crashes in Easyblocks' normalizeTokenValue which does
  // `'tokenId' in value` (TypeError on strings).
  const tokenProps = TOKEN_PROP_MAP.get(ebComponent);
  if (tokenProps) {
    for (const prop of tokenProps) {
      if (prop in entry && entry[prop] != null) {
        entry[prop] = wrapTokenValue(entry[prop]);
      }
    }
  }

  return entry;
}

// ============================================================================
// Page-level conversion (full page with metadata)
// ============================================================================

/**
 * Convert an Orqui PageDef to an Easyblocks document.
 * Wraps the content tree in a root "OrquiPage" entry with metadata.
 */
export function pageDefToDocument(page: PageDef): {
  id: string;
  entry: NoCodeEntry;
  meta: { label: string; route: string; browserTitle?: string };
} {
  return {
    id: page.id,
    entry: nodeDefToNoCodeEntry(page.content),
    meta: {
      label: page.label,
      route: page.route,
      browserTitle: page.browserTitle,
    },
  };
}

/**
 * Convert an Easyblocks document back to an Orqui PageDef.
 */
export function documentToPageDef(
  id: string,
  entry: NoCodeEntry,
  meta: { label: string; route: string; browserTitle?: string },
): PageDef {
  return {
    id,
    label: meta.label,
    route: meta.route,
    browserTitle: meta.browserTitle,
    content: noCodeEntryToNodeDef(entry),
  };
}

// ============================================================================
// Bulk conversion — all pages at once
// ============================================================================

/** Convert all Orqui pages to Easyblocks documents */
export function allPagesToDocuments(pages: Record<string, PageDef>): Map<string, ReturnType<typeof pageDefToDocument>> {
  const docs = new Map<string, ReturnType<typeof pageDefToDocument>>();
  for (const [id, page] of Object.entries(pages)) {
    docs.set(id, pageDefToDocument(page));
  }
  return docs;
}

/** Convert all Easyblocks documents back to Orqui pages */
export function allDocumentsToPages(
  docs: Map<string, { entry: NoCodeEntry; meta: { label: string; route: string; browserTitle?: string } }>,
): Record<string, PageDef> {
  const pages: Record<string, PageDef> = {};
  for (const [id, doc] of docs) {
    pages[id] = documentToPageDef(id, doc.entry, doc.meta);
  }
  return pages;
}

// ============================================================================
// Helpers — prop classification
// ============================================================================

/** Props that are style overrides (go into NodeDef.style, not NodeDef.props) */
function isStyleOverrideProp(key: string, nodeType: string): boolean {
  // Container-specific style props that Easyblocks handles in the definition
  // but Orqui stores separately in node.style
  if (nodeType === "container") {
    return key === "background" || key === "borderRadius" || key === "maxWidth";
  }
  return false;
}

/** Props that should be stored as numbers in Orqui */
function isNumericProp(key: string, nodeType: string): boolean {
  if (key === "level" && nodeType === "heading") return true;
  if (key === "size" && (nodeType === "icon" || nodeType === "image")) return true;
  if (key === "columns" && nodeType === "grid") return true;
  if (key === "maxItems" && nodeType === "list") return true;
  return false;
}

/** Props that Easyblocks stores as strings but Orqui stores as numbers */
function isNumericAsString(key: string, nodeType: string): boolean {
  return isNumericProp(key, nodeType);
}

/** Reverse lookup: Orqui prop name → Easyblocks JSON prop key */
function findJsonKey(orquiPropName: string, nodeType: string): string | null {
  // Reverse map: orqui prop name → easyblocks json key
  const reverseMap: Record<string, Record<string, string>> = {
    table: { columns: "columnsJson" },
    "key-value": { items: "itemsJson" },
    tabs: { items: "tabsJson" },
    select: { options: "optionsJson" },
  };
  return reverseMap[nodeType]?.[orquiPropName] || null;
}

// ============================================================================
// Roundtrip test utility
// ============================================================================

/**
 * Test roundtrip fidelity: NodeDef → NoCodeEntry → NodeDef
 * Returns true if the output matches the input (within normalization).
 */
export function testRoundtrip(original: NodeDef): {
  passed: boolean;
  original: NodeDef;
  roundtripped: NodeDef;
  diff: string[];
} {
  const entry = nodeDefToNoCodeEntry(original);
  const result = noCodeEntryToNodeDef(entry);
  const diff = compareNodeDefs(original, result);
  return {
    passed: diff.length === 0,
    original,
    roundtripped: result,
    diff,
  };
}

function compareNodeDefs(a: NodeDef, b: NodeDef, path = ""): string[] {
  const diffs: string[] = [];

  if (a.type !== b.type) diffs.push(`${path}.type: ${a.type} → ${b.type}`);

  // Compare props
  const aProps = a.props || {};
  const bProps = b.props || {};
  const allKeys = new Set([...Object.keys(aProps), ...Object.keys(bProps)]);
  for (const key of allKeys) {
    const av = JSON.stringify(aProps[key]);
    const bv = JSON.stringify(bProps[key]);
    if (av !== bv) diffs.push(`${path}.props.${key}: ${av} → ${bv}`);
  }

  // Compare children (recursive)
  const aChildren = a.children || [];
  const bChildren = b.children || [];
  if (aChildren.length !== bChildren.length) {
    diffs.push(`${path}.children.length: ${aChildren.length} → ${bChildren.length}`);
  }
  const minLen = Math.min(aChildren.length, bChildren.length);
  for (let i = 0; i < minLen; i++) {
    diffs.push(...compareNodeDefs(aChildren[i], bChildren[i], `${path}.children[${i}]`));
  }

  return diffs;
}
