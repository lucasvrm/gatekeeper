// ============================================================================
// Contract Adapter — Bidirectional conversion NoCodeComponentEntry ↔ NodeDef
//
// Uses the real NoCodeComponentEntry type from @easyblocks/core:
//   { _component: string, _id: string, [key: string]: any }
// ============================================================================

import type { NoCodeComponentEntry } from "@easyblocks/core";
import type { NodeDef, PageDef } from "../../page-editor/nodeDefaults";
import { generateId } from "../../page-editor/nodeDefaults";
import { NODE_TYPE_TO_EB_ID, EB_ID_TO_NODE_TYPE } from "../types";

// ============================================================================
// Responsive value handling
// ============================================================================

interface TrulyResponsiveValue {
  $res: true;
  [key: string]: unknown;
}

function isResponsive(val: unknown): val is TrulyResponsiveValue {
  return typeof val === "object" && val !== null && (val as any).$res === true;
}

/** Extract the "current" value from a potentially responsive value (highest breakpoint wins) */
function unwrapResponsive(val: unknown): unknown {
  if (isResponsive(val)) {
    return val.xl ?? val.lg ?? val.md ?? val.sm ?? val.xs;
  }
  return val;
}

// ============================================================================
// Constants
// ============================================================================

/** Easyblocks metadata keys — stripped when converting to NodeDef */
const EB_META_KEYS = new Set(["_id", "_component", "_itemProps"]);

/** Slot key for children */
const CHILDREN_SLOT_KEY = "Children";

/**
 * Props stored as JSON strings in Easyblocks that need parsing.
 * Maps Easyblocks prop name → Orqui prop name.
 */
const JSON_PROP_MAP: Record<string, string> = {
  columnsJson: "columns",
  itemsJson: "items",
  tabsJson: "items",
  optionsJson: "options",
};

// ============================================================================
// NoCodeComponentEntry → NodeDef
// ============================================================================

/**
 * Convert an Easyblocks NoCodeComponentEntry to an Orqui NodeDef.
 */
export function noCodeEntryToNodeDef(entry: NoCodeComponentEntry): NodeDef {
  const orquiType = EB_ID_TO_NODE_TYPE[entry._component];
  if (!orquiType) {
    console.warn(`[adapter] Unknown Easyblocks component: ${entry._component}`);
    return { id: entry._id || generateId("unknown"), type: entry._component };
  }

  const node: NodeDef = {
    id: entry._id || generateId(orquiType),
    type: orquiType,
  };

  const props: Record<string, any> = {};
  const style: Record<string, string> = {};
  let hasProps = false;
  let hasStyle = false;

  for (const [key, rawValue] of Object.entries(entry)) {
    if (EB_META_KEYS.has(key)) continue;
    if (key === CHILDREN_SLOT_KEY) continue;

    const value = unwrapResponsive(rawValue);

    // JSON-encoded props
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

    // Style override props
    if (isStyleOverrideProp(key, orquiType)) {
      if (value != null && value !== "") {
        style[key] = String(value);
        hasStyle = true;
      }
      continue;
    }

    // Numeric props
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

  // Children
  const childrenRaw = entry[CHILDREN_SLOT_KEY];
  if (Array.isArray(childrenRaw) && childrenRaw.length > 0) {
    node.children = childrenRaw.map((child: NoCodeComponentEntry) => noCodeEntryToNodeDef(child));
  }

  return node;
}

// ============================================================================
// NodeDef → NoCodeComponentEntry
// ============================================================================

let _ebIdCounter = Date.now() % 100000;
function generateEbId(): string {
  return `eb-${++_ebIdCounter}`;
}

/**
 * Convert an Orqui NodeDef to an Easyblocks NoCodeComponentEntry.
 */
export function nodeDefToNoCodeEntry(node: NodeDef): NoCodeComponentEntry {
  const ebComponent = NODE_TYPE_TO_EB_ID[node.type];
  if (!ebComponent) {
    console.warn(`[adapter] Unknown Orqui node type: ${node.type}`);
    return { _id: node.id || generateEbId(), _component: node.type };
  }

  const entry: NoCodeComponentEntry = {
    _id: node.id || generateEbId(),
    _component: ebComponent,
  };

  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      const jsonKey = findJsonKey(key, node.type);
      if (jsonKey) {
        entry[jsonKey] = JSON.stringify(value);
        continue;
      }
      if (isNumericAsString(key, node.type)) {
        entry[key] = String(value);
        continue;
      }
      entry[key] = value;
    }
  }

  if (node.style) {
    for (const [key, value] of Object.entries(node.style)) {
      entry[key] = value;
    }
  }

  if (node.children && node.children.length > 0) {
    entry[CHILDREN_SLOT_KEY] = node.children.map(nodeDefToNoCodeEntry);
  }

  return entry;
}

// ============================================================================
// Page-level conversion
// ============================================================================

export function pageDefToDocument(page: PageDef): {
  id: string;
  entry: NoCodeComponentEntry;
  meta: { label: string; route: string; browserTitle?: string };
} {
  return {
    id: page.id,
    entry: nodeDefToNoCodeEntry(page.content),
    meta: { label: page.label, route: page.route, browserTitle: page.browserTitle },
  };
}

export function documentToPageDef(
  id: string,
  entry: NoCodeComponentEntry,
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
// Bulk conversion
// ============================================================================

export function allPagesToDocuments(pages: Record<string, PageDef>) {
  const docs = new Map<string, ReturnType<typeof pageDefToDocument>>();
  for (const [id, page] of Object.entries(pages)) {
    docs.set(id, pageDefToDocument(page));
  }
  return docs;
}

export function allDocumentsToPages(
  docs: Map<string, { entry: NoCodeComponentEntry; meta: { label: string; route: string; browserTitle?: string } }>,
): Record<string, PageDef> {
  const pages: Record<string, PageDef> = {};
  for (const [id, doc] of docs) {
    pages[id] = documentToPageDef(id, doc.entry, doc.meta);
  }
  return pages;
}

// ============================================================================
// Roundtrip test utility
// ============================================================================

export function testRoundtrip(original: NodeDef): {
  passed: boolean;
  original: NodeDef;
  roundtripped: NodeDef;
  diff: string[];
} {
  const entry = nodeDefToNoCodeEntry(original);
  const result = noCodeEntryToNodeDef(entry);
  const diff = compareNodeDefs(original, result);
  return { passed: diff.length === 0, original, roundtripped: result, diff };
}

function compareNodeDefs(a: NodeDef, b: NodeDef, path = ""): string[] {
  const diffs: string[] = [];
  if (a.type !== b.type) diffs.push(`${path}.type: ${a.type} → ${b.type}`);
  const aProps = a.props || {};
  const bProps = b.props || {};
  for (const key of new Set([...Object.keys(aProps), ...Object.keys(bProps)])) {
    if (JSON.stringify(aProps[key]) !== JSON.stringify(bProps[key]))
      diffs.push(`${path}.props.${key}: ${JSON.stringify(aProps[key])} → ${JSON.stringify(bProps[key])}`);
  }
  const aC = a.children || [], bC = b.children || [];
  if (aC.length !== bC.length) diffs.push(`${path}.children.length: ${aC.length} → ${bC.length}`);
  for (let i = 0; i < Math.min(aC.length, bC.length); i++) {
    diffs.push(...compareNodeDefs(aC[i], bC[i], `${path}.children[${i}]`));
  }
  return diffs;
}

// ============================================================================
// Helpers
// ============================================================================

function isStyleOverrideProp(key: string, nodeType: string): boolean {
  if (nodeType === "container") return key === "background" || key === "borderRadius" || key === "maxWidth";
  return false;
}

function isNumericProp(key: string, nodeType: string): boolean {
  if (key === "level" && nodeType === "heading") return true;
  if (key === "size" && (nodeType === "icon" || nodeType === "image")) return true;
  if (key === "columns" && nodeType === "grid") return true;
  if (key === "maxItems" && nodeType === "list") return true;
  return false;
}

function isNumericAsString(key: string, nodeType: string): boolean {
  return isNumericProp(key, nodeType);
}

function findJsonKey(orquiPropName: string, nodeType: string): string | null {
  const reverseMap: Record<string, Record<string, string>> = {
    table: { columns: "columnsJson" },
    "key-value": { items: "itemsJson" },
    tabs: { items: "tabsJson" },
    select: { options: "optionsJson" },
  };
  return reverseMap[nodeType]?.[orquiPropName] || null;
}
