// ============================================================================
// Contract Compiler — Public API
//
// Usage:
//   import { compileContracts } from "./compiler";
//   const { layoutContract, styleContract, registryContract } = compileContracts({
//     layout: editorState.layout,
//     ebEntryCache: _ebEntryCache,
//   });
// ============================================================================

// Main compiler
export { compileContracts, compilePage, validateLayoutContract } from "./contractCompiler";
export type { ValidationResult } from "./contractCompiler";

// Enricher (Gap 1 + Gap 2)
export { enrichEntry, enrichNodeDef, buildTokenIndex } from "./enricher";
export type { TokenIndex, EnricherResult } from "./enricher";

// Style compiler (Gap 3)
export {
  compileStyles,
  generateCSSVariableMap,
  resolveTextStyles,
  buildReverseTokenIndex,
  cssVarsToString,
  componentStylesToCSS,
} from "./styleCompiler";
export type { ReverseTokenIndex, StyleCompilerResult } from "./styleCompiler";

// Types
export type {
  EnrichedNodeDef,
  EnrichedPageDef,
  ComponentStyleMap,
  ComponentPropsMap,
  ResolvedTextStyles,
  CSSVariableMap,
  ComponentCatalog,
  CatalogEntry,
  CatalogPropDef,
  CompilerInput,
  CompilerOutput,
  LayoutContractV3,
  StyleContractV1,
  RegistryContractV2,
  BreakpointDef,
} from "./types";

export { BREAKPOINTS, BREAKPOINT_IDS, DEVICE_WIDTHS } from "./types";
