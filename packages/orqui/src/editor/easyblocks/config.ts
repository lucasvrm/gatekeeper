// ============================================================================
// Easyblocks Config Builder
//
// Constructs the complete Easyblocks Config object from Orqui state.
// ============================================================================

import { ALL_DEFINITIONS } from "./definitions";
import { orquiTokensToEasyblocks } from "./bridge/tokens";
import { getOrquiCustomTypes } from "./bridge/variables";
import { createOrquiBackend, type OrquiBackendOptions } from "./backend";
import type { PageDef } from "../page-editor/nodeDefaults";

export interface BuildConfigOptions {
  tokens: Record<string, any>;
  pages: Record<string, PageDef>;
  onPageChange: (pageId: string, page: PageDef) => void;
  onPageDelete?: (pageId: string) => void;
}

export function buildOrquiEasyblocksConfig(options: BuildConfigOptions) {
  const backend = createOrquiBackend({
    pages: options.pages,
    onPageChange: options.onPageChange,
    onPageDelete: options.onPageDelete,
  });

  const tokens = orquiTokensToEasyblocks(options.tokens);

  // Ensure at least one space token exists (Easyblocks breaks with empty space tokens)
  if (!tokens.space || tokens.space.length === 0) {
    tokens.space = [{ id: "0", label: "0", value: "0px", isDefault: true }];
  }

  // Ensure at least one color token
  if (!tokens.colors || tokens.colors.length === 0) {
    tokens.colors = [{ id: "transparent", label: "Transparent", value: "transparent", isDefault: true }];
  }

  // Ensure at least one font token
  if (!tokens.fonts || tokens.fonts.length === 0) {
    tokens.fonts = [{
      id: "default",
      label: "Default",
      value: { fontFamily: "'Inter', -apple-system, sans-serif" },
      isDefault: true,
    }];
  }

  // Ensure borderRadius tokens (custom token type)
  if (!tokens.borderRadius || tokens.borderRadius.length === 0) {
    tokens.borderRadius = [
      { id: "none", label: "Nenhum", value: "0px", isDefault: false },
      { id: "sm", label: "sm", value: "4px", isDefault: false },
      { id: "md", label: "md", value: "6px", isDefault: true },
      { id: "lg", label: "lg", value: "8px", isDefault: false },
      { id: "xl", label: "xl", value: "12px", isDefault: false },
      { id: "2xl", label: "2xl", value: "16px", isDefault: false },
      { id: "full", label: "Full", value: "9999px", isDefault: false },
    ];
  }

  return {
    backend,
    components: ALL_DEFINITIONS,
    tokens,

    // Custom types: borderRadius token type + orqui-template (Phase 5)
    types: getOrquiCustomTypes(),

    locales: [
      { code: "pt-BR", isDefault: true },
    ],

    devices: {
      xs: { hidden: true },
      sm: { hidden: false },
      md: { hidden: true },
      lg: { hidden: false },
      xl: { hidden: true },
    },
  };
}

// Re-exports
export { orquiTokensToEasyblocks, generateTokenCSSVariables } from "./bridge/tokens";
export { buildWidgetVariableContext, getOrquiCustomTypes } from "./bridge/variables";
export { createOrquiBackend } from "./backend";
export {
  noCodeEntryToNodeDef,
  nodeDefToNoCodeEntry,
  pageDefToDocument,
  documentToPageDef,
  testRoundtrip,
} from "./adapter";
export { ALL_DEFINITIONS } from "./definitions";
