// ============================================================================
// Orqui × Easyblocks Integration — Public API
// ============================================================================

// ---- Main entry point ----
export { EasyblocksPageEditor } from "./EasyblocksPageEditor";

// ---- Config builder ----
export { buildOrquiEasyblocksConfig, type BuildConfigOptions } from "./config";

// ---- Adapter ----
export {
  noCodeEntryToNodeDef, nodeDefToNoCodeEntry,
  pageDefToDocument, documentToPageDef,
  allPagesToDocuments, allDocumentsToPages,
  testRoundtrip,
} from "./adapter";

// ---- Bridge ----
export { orquiTokensToEasyblocks, easyblocksToOrquiTokens, generateTokenCSSVariables } from "./bridge/tokens";
export { getOrquiCustomTypes, buildWidgetVariableContext, type WidgetVariableContext } from "./bridge/variables";

// ---- Backend ----
export { createOrquiBackend, type OrquiBackendOptions } from "./backend";

// ---- Definitions ----
export { ALL_DEFINITIONS } from "./definitions";

// ---- Components ----
export { ORQUI_COMPONENTS } from "./components";

// ---- Orqui-specific types and mappings ----
export { NODE_TYPE_TO_EB_ID, EB_ID_TO_NODE_TYPE, ALL_COMPONENT_IDS, ORQUI_TYPE_GROUPS } from "./types";
