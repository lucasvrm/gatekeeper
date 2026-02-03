// ============================================================================
// Easyblocks Config Builder — returns real @easyblocks/core Config
// ============================================================================

import type { Config } from "@easyblocks/core";
import { ALL_DEFINITIONS } from "./definitions";
import { orquiTokensToEasyblocks } from "./bridge/tokens";
import { getOrquiCustomTypes } from "./bridge/variables";
import { createOrquiBackend, type OrquiBackendOptions } from "./backend";
import type { PageDef } from "../page-editor/nodeDefaults";

// ============================================================================
// Config Builder
// ============================================================================

export interface BuildConfigOptions {
  tokens: Record<string, any>;
  pages: Record<string, PageDef>;
  onPageChange: (pageId: string, page: PageDef) => void;
  onPageDelete?: (pageId: string) => void;
}

/**
 * Build the complete Easyblocks Config from Orqui state.
 */
export function buildOrquiEasyblocksConfig(options: BuildConfigOptions): Config {
  const backend = createOrquiBackend({
    pages: options.pages,
    onPageChange: options.onPageChange,
    onPageDelete: options.onPageDelete,
  });

  const ebTokens = orquiTokensToEasyblocks(options.tokens);

  return {
    backend,
    components: ALL_DEFINITIONS,
    tokens: {
      colors: ebTokens.colors,
      space: ebTokens.space,
      fonts: ebTokens.fonts,
    },
    types: getOrquiCustomTypes(),
    locales: [{ code: "pt-BR", isDefault: true }],
    devices: {
      xs: { hidden: true },
      sm: { hidden: false },
      md: { hidden: true },
      lg: { hidden: false },
      xl: { hidden: true },
    },
    templates: [],
    hideCloseButton: true,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { orquiTokensToEasyblocks, generateTokenCSSVariables } from "./bridge/tokens";
export { buildWidgetVariableContext, getOrquiCustomTypes } from "./bridge/variables";
export { createOrquiBackend } from "./backend";
export {
  noCodeEntryToNodeDef, nodeDefToNoCodeEntry,
  pageDefToDocument, documentToPageDef, testRoundtrip,
} from "./adapter";
export { ALL_DEFINITIONS } from "./definitions";
