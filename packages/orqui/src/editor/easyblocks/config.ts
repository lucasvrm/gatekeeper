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

  return {
    backend,
    components: ALL_DEFINITIONS,
    tokens,

    // NOTE: Disabling custom types for now — orqui-template props
    // have been changed to "string" type as fallback.
    // Re-enable in Phase 5 when the TemplatePickerWidget is validated.
    // types: getOrquiCustomTypes(),

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
