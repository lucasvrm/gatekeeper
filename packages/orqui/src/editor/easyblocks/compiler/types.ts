// ============================================================================
// Contract Compiler — Type Definitions
//
// These types define the ENRICHED contract format that apps consume.
// The enrichment process closes 3 gaps:
//   Gap 1: Responsive values preserved (not flattened to xl-only)
//   Gap 2: Token references preserved as $tokens.X.Y (not resolved)
//   Gap 3: Styles pre-computed per breakpoint (not editor-only)
// ============================================================================

import type { NodeDef, PageDef } from "../../page-editor/nodeDefaults";

// ============================================================================
// Enriched Node — output format for app consumption
// ============================================================================

/**
 * EnrichedNodeDef extends NodeDef with responsive and token-ref data.
 *
 * VERSUS NodeDef:
 *   - props may contain "$tokens.colors.accent" instead of "#6d9cff"
 *   - responsive map preserves per-breakpoint overrides
 *   - bindings declares template expressions for runtime resolution
 */
export interface EnrichedNodeDef {
  id: string;
  type: string;
  props?: Record<string, any>;

  /**
   * GAP 1: Responsive overrides per breakpoint.
   * Only present for props that actually vary by device.
   *
   * @example
   * {
   *   "gap": { "xl": "$tokens.spacing.lg", "md": "$tokens.spacing.md", "xs": "$tokens.spacing.sm" },
   *   "columns": { "xl": "4", "md": "2", "xs": "1" }
   * }
   */
  responsive?: Record<string, Record<string, any>>;

  /**
   * Template bindings: props that contain {{...}} expressions.
   * The runtime resolves these against real data.
   * Listed separately so the runtime knows which props to process.
   *
   * @example ["content", "label"]
   */
  bindings?: string[];

  children?: EnrichedNodeDef[];
  style?: Record<string, string>;
}

/**
 * Enriched page: the same as PageDef but content is EnrichedNodeDef.
 */
export interface EnrichedPageDef {
  id: string;
  label: string;
  route: string;
  browserTitle?: string;
  content: EnrichedNodeDef;
}

// ============================================================================
// Style Contract — pre-computed CSS per component per breakpoint
// ============================================================================

/**
 * GAP 3: CSS computed offline from the definitions' styles() functions.
 *
 * Keyed by node ID → slot name → breakpoint → CSS properties.
 * The runtime picks the right breakpoint at render time.
 *
 * @example
 * {
 *   "eb-002": {
 *     "Root": {
 *       "xl": { "fontSize": "22px", "fontWeight": 600, "color": "var(--orqui-text)" },
 *       "xs": { "fontSize": "16px" }
 *     }
 *   }
 * }
 */
export type ComponentStyleMap = Record<
  string,                             // node ID
  Record<
    string,                           // slot name (e.g. "Root")
    Record<string, Record<string, any>> // breakpoint → CSS properties
  >
>;

/**
 * Extra props computed by styles() — forwarded to the React component.
 * Example: Heading styles() returns { props: { as: "h2" } }
 */
export type ComponentPropsMap = Record<
  string,                             // node ID
  Record<string, Record<string, any>> // breakpoint → computed props
>;

/**
 * TextStyles from the contract, resolved to concrete CSS.
 * Token references like "$tokens.fontFamilies.primary" become
 * "var(--orqui-font-primary)" for CSS consumption.
 */
export type ResolvedTextStyles = Record<string, Record<string, string | number>>;

// ============================================================================
// CSS Variables — from tokens
// ============================================================================

/**
 * Flat map of CSS custom property → value.
 * The runtime injects these into :root.
 */
export type CSSVariableMap = Record<string, string>;

// ============================================================================
// Component Catalog — from definitions
// ============================================================================

export interface CatalogPropDef {
  type: string;
  label?: string;
  default?: any;
  responsive?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface CatalogSlotDef {
  accepts: string[];
  min?: number;
}

export interface CatalogEntry {
  type: string;
  label: string;
  category?: string;
  props: Record<string, CatalogPropDef>;
  slots: Record<string, CatalogSlotDef>;
}

export type ComponentCatalog = Record<string, CatalogEntry>;

// ============================================================================
// Compiler I/O
// ============================================================================

export interface CompilerInput {
  layout: {
    structure: any;
    tokens: Record<string, any>;
    textStyles?: Record<string, any>;
    pages: Record<string, PageDef>;
    variables?: any;
  };
  /**
   * EB entry cache — the raw Easyblocks NoCodeEntry per page.
   * These contain responsive wrappers and token refs that the
   * adapter normally strips.
   */
  ebEntryCache: Map<string, any>;
}

export interface CompilerOutput {
  /** Enriched layout contract with responsive + token ref preservation */
  layoutContract: LayoutContractV3;
  /** Pre-computed styles per component per breakpoint */
  styleContract: StyleContractV1;
  /** Component catalog derived from definitions */
  registryContract: RegistryContractV2;
}

// ============================================================================
// Contract schemas (versioned)
// ============================================================================

export interface ContractMeta {
  schema: string;
  version: string;
  generatedAt: string;
  hash?: string;
}

export interface LayoutContractV3 {
  $orqui: ContractMeta & { pageCount: number };
  structure: any;
  tokens: Record<string, any>;
  textStyles?: Record<string, any>;
  variables?: any;
  pages: Record<string, EnrichedPageDef>;
}

export interface StyleContractV1 {
  $orqui: ContractMeta;
  cssVariables: CSSVariableMap;
  componentStyles: ComponentStyleMap;
  componentProps: ComponentPropsMap;
  resolvedTextStyles: ResolvedTextStyles;
  breakpoints: BreakpointDef[];
}

export interface BreakpointDef {
  id: string;
  minWidth: number;
  label: string;
}

export interface RegistryContractV2 {
  $orqui: ContractMeta;
  catalog: ComponentCatalog;
}

// ============================================================================
// Device / Breakpoint constants
// ============================================================================

/** Standard Orqui breakpoints, descending (mobile-last in the map) */
export const BREAKPOINTS: BreakpointDef[] = [
  { id: "xl", minWidth: 1440, label: "Wide" },
  { id: "lg", minWidth: 1024, label: "Desktop" },
  { id: "md", minWidth: 768,  label: "Tablet" },
  { id: "sm", minWidth: 640,  label: "Mobile L" },
  { id: "xs", minWidth: 0,    label: "Mobile" },
];

export const BREAKPOINT_IDS = BREAKPOINTS.map(b => b.id);

export const DEVICE_WIDTHS: Record<string, number> = {
  xl: 1440, lg: 1024, md: 768, sm: 640, xs: 375,
};
