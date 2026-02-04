// ============================================================================
// Contract Compiler — Main Orchestrator
//
// Combines the enricher (Gap 1+2) and style compiler (Gap 3) to produce
// three enriched contracts from the editor state:
//
//   1. layout-contract.json v3 — enriched NodeDef with token refs + responsive
//   2. style-contract.json v1  — pre-computed CSS per component per breakpoint
//   3. ui-registry-contract.json v2 — component catalog from definitions
//
// Usage:
//   import { compileContracts } from "./compiler";
//   const output = compileContracts({ layout, ebEntryCache });
//   await save(output.layoutContract);
//   await save(output.styleContract);
//   await save(output.registryContract);
//
// ============================================================================

import { ALL_DEFINITIONS } from "../definitions";
import type { NoCodeComponentDefinition } from "../types";
import { EB_ID_TO_NODE_TYPE } from "../types";

import type {
  CompilerInput,
  CompilerOutput,
  LayoutContractV3,
  StyleContractV1,
  RegistryContractV2,
  EnrichedPageDef,
  ComponentCatalog,
  CatalogEntry,
  CatalogPropDef,
  CatalogSlotDef,
} from "./types";
import { BREAKPOINTS } from "./types";

import { enrichEntry, enrichNodeDef, buildTokenIndex } from "./enricher";
import {
  compileStyles,
  generateCSSVariableMap,
  resolveTextStyles,
  buildReverseTokenIndex,
} from "./styleCompiler";

// ============================================================================
// Main compiler
// ============================================================================

/**
 * Compile enriched contracts from the editor state.
 *
 * This is the single entry point that closes all 3 gaps:
 *   Gap 1: Responsive values preserved in EnrichedNodeDef.responsive
 *   Gap 2: Token refs preserved as "$tokens.X.Y" in EnrichedNodeDef.props
 *   Gap 3: Styles pre-computed per breakpoint in styleContract.componentStyles
 *
 * @param input - Editor layout state + EB entry cache
 * @returns Three enriched contract objects
 */
export function compileContracts(input: CompilerInput): CompilerOutput {
  const { layout, ebEntryCache } = input;
  const startTime = Date.now();

  // ── Build indexes ──────────────────────────────────────────
  const tokenIndex = buildTokenIndex(layout.tokens);
  const reverseIndex = buildReverseTokenIndex(layout.tokens, tokenIndex);

  // ── Process pages ──────────────────────────────────────────
  const enrichedPages: Record<string, EnrichedPageDef> = {};
  const allComponentStyles: Record<string, any> = {};
  const allComponentProps: Record<string, any> = {};
  const allTemplateBindings = new Map<string, Map<string, string[]>>();

  for (const [pageId, page] of Object.entries(layout.pages)) {
    const ebEntry = ebEntryCache.get(pageId);

    if (ebEntry) {
      // ── Full enrichment from EB entry (preferred path) ─────
      const enrichResult = enrichEntry(ebEntry, tokenIndex);
      const styleResult = compileStyles(enrichResult.tree, tokenIndex, reverseIndex);

      enrichedPages[pageId] = {
        id: pageId,
        label: page.label,
        route: page.route,
        browserTitle: page.browserTitle,
        content: enrichResult.tree,
      };

      Object.assign(allComponentStyles, styleResult.componentStyles);
      Object.assign(allComponentProps, styleResult.componentProps);

      if (enrichResult.templateBindings.size > 0) {
        allTemplateBindings.set(pageId, enrichResult.templateBindings);
      }
    } else {
      // ── Fallback: enrich from existing NodeDef ─────────────
      // Token refs and responsive data can't be recovered,
      // but template bindings are still detected.
      const enrichedTree = page.content
        ? enrichNodeDef(page.content)
        : { id: pageId, type: "stack" };

      // Still try to compile styles from the enriched tree
      const styleResult = compileStyles(enrichedTree, tokenIndex, reverseIndex);

      enrichedPages[pageId] = {
        id: pageId,
        label: page.label,
        route: page.route,
        browserTitle: page.browserTitle,
        content: enrichedTree,
      };

      Object.assign(allComponentStyles, styleResult.componentStyles);
      Object.assign(allComponentProps, styleResult.componentProps);
    }
  }

  // ── Generate CSS variables ─────────────────────────────────
  const cssVariables = generateCSSVariableMap(layout.tokens);

  // ── Resolve text styles ────────────────────────────────────
  const resolvedTextStyles = resolveTextStyles(
    layout.textStyles,
    layout.tokens,
    tokenIndex,
  );

  // ── Build component catalog ────────────────────────────────
  const catalog = buildCatalog();

  // ── Compute hash ───────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const compileTimeMs = Date.now() - startTime;

  // ── Assemble contracts ─────────────────────────────────────
  const layoutContract: LayoutContractV3 = {
    $orqui: {
      schema: "layout-contract",
      version: "3.0.0",
      generatedAt,
      pageCount: Object.keys(enrichedPages).length,
    },
    structure: layout.structure,
    tokens: layout.tokens,
    textStyles: layout.textStyles,
    variables: layout.variables,
    pages: enrichedPages,
  };

  const styleContract: StyleContractV1 = {
    $orqui: {
      schema: "style-contract",
      version: "1.0.0",
      generatedAt,
    },
    cssVariables,
    componentStyles: allComponentStyles,
    componentProps: allComponentProps,
    resolvedTextStyles,
    breakpoints: BREAKPOINTS,
  };

  const registryContract: RegistryContractV2 = {
    $orqui: {
      schema: "ui-registry-contract",
      version: "2.0.0",
      generatedAt,
    },
    catalog,
  };

  if (typeof console !== "undefined") {
    const nodeCount = Object.keys(allComponentStyles).length;
    const pageCount = Object.keys(enrichedPages).length;
    console.log(
      `[compiler] Compiled ${pageCount} pages, ${nodeCount} styled nodes in ${compileTimeMs}ms`
    );
  }

  return { layoutContract, styleContract, registryContract };
}

// ============================================================================
// Component Catalog Builder
// ============================================================================

/**
 * Build a component catalog from the 43 Orqui definitions.
 * This tells the runtime (and developer tools) what components exist,
 * what props they accept, and what slots they expose.
 */
function buildCatalog(): ComponentCatalog {
  const catalog: ComponentCatalog = {};

  for (const def of ALL_DEFINITIONS) {
    const orquiType = EB_ID_TO_NODE_TYPE[def.id] || def.id;

    const props: Record<string, CatalogPropDef> = {};
    const slots: Record<string, CatalogSlotDef> = {};

    for (const sp of def.schema) {
      if (sp.type === "component-collection" || sp.type === "component") {
        // Slot
        slots[sp.prop] = {
          accepts: sp.accepts || ["*"],
          min: sp.required ? 1 : 0,
        };
      } else {
        // Prop
        const propDef: CatalogPropDef = {
          type: sp.type,
        };
        if (sp.label) propDef.label = sp.label;
        if (sp.defaultValue !== undefined) propDef.default = sp.defaultValue;
        if (sp.responsive) propDef.responsive = true;
        if (sp.params?.options) {
          propDef.options = sp.params.options.map(opt =>
            typeof opt === "string" ? { value: opt, label: opt } : opt
          );
        }
        props[sp.prop] = propDef;
      }
    }

    const entry: CatalogEntry = {
      type: orquiType,
      label: def.label,
      props,
      slots,
    };

    if (def.paletteLabel) {
      entry.category = def.paletteLabel.toLowerCase();
    }

    catalog[def.id] = entry;
  }

  return catalog;
}

// ============================================================================
// Incremental compilation (single page)
// ============================================================================

/**
 * Compile a single page — useful for incremental updates during editing.
 * Returns only the enriched page + its styles.
 */
export function compilePage(
  pageId: string,
  page: { label: string; route: string; browserTitle?: string; content?: any },
  ebEntry: any | undefined,
  tokens: Record<string, any>,
): {
  enrichedPage: EnrichedPageDef;
  styles: Record<string, any>;
  props: Record<string, any>;
} {
  const tokenIndex = buildTokenIndex(tokens);
  const reverseIndex = buildReverseTokenIndex(tokens, tokenIndex);

  let enrichedTree;
  if (ebEntry) {
    const result = enrichEntry(ebEntry, tokenIndex);
    enrichedTree = result.tree;
  } else if (page.content) {
    enrichedTree = enrichNodeDef(page.content);
  } else {
    enrichedTree = { id: pageId, type: "stack" };
  }

  const { componentStyles, componentProps } = compileStyles(
    enrichedTree,
    tokenIndex,
    reverseIndex,
  );

  return {
    enrichedPage: {
      id: pageId,
      label: page.label,
      route: page.route,
      browserTitle: page.browserTitle,
      content: enrichedTree,
    },
    styles: componentStyles,
    props: componentProps,
  };
}

// ============================================================================
// Contract validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a compiled layout contract for common issues.
 */
export function validateLayoutContract(contract: LayoutContractV3): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check schema version
  if (contract.$orqui.version !== "3.0.0") {
    warnings.push(`Unexpected schema version: ${contract.$orqui.version}`);
  }

  // Check pages exist
  if (!contract.pages || Object.keys(contract.pages).length === 0) {
    warnings.push("No pages defined in the contract");
  }

  // Check each page
  for (const [pageId, page] of Object.entries(contract.pages || {})) {
    if (!page.content) {
      errors.push(`Page "${pageId}" has no content tree`);
      continue;
    }

    // Walk tree for common issues
    walkValidate(page.content, pageId, errors, warnings);
  }

  // Check tokens
  if (!contract.tokens) {
    errors.push("No tokens defined");
  } else {
    if (!contract.tokens.colors) warnings.push("No color tokens defined");
    if (!contract.tokens.spacing) warnings.push("No spacing tokens defined");
  }

  // Check structure
  if (!contract.structure) {
    errors.push("No structure defined");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function walkValidate(
  node: any,
  pageId: string,
  errors: string[],
  warnings: string[],
  depth = 0,
): void {
  if (depth > 50) {
    errors.push(`Page "${pageId}": tree exceeds 50 levels deep (possible cycle)`);
    return;
  }

  if (!node.id) {
    warnings.push(`Page "${pageId}": node at depth ${depth} has no id`);
  }

  if (!node.type) {
    errors.push(`Page "${pageId}": node "${node.id}" has no type`);
  }

  // Check for unresolved token refs (shouldn't happen after enrichment)
  if (node.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (typeof value === "object" && value !== null && "tokenId" in (value as any)) {
        warnings.push(
          `Page "${pageId}": node "${node.id}" prop "${key}" has unresolved tokenId "${(value as any).tokenId}"`
        );
      }
    }
  }

  // Check template bindings have matching props
  if (node.bindings) {
    for (const binding of node.bindings) {
      if (!node.props || !(binding in node.props)) {
        warnings.push(
          `Page "${pageId}": node "${node.id}" declares binding "${binding}" but prop doesn't exist`
        );
      }
    }
  }

  // Recurse
  if (node.children) {
    for (const child of node.children) {
      walkValidate(child, pageId, errors, warnings, depth + 1);
    }
  }
}
