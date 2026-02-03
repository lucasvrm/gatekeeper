// ============================================================================
// Easyblocks Config Builder
//
// Constructs the complete Easyblocks Config object from Orqui state.
// This is the single entry point that wires together:
//   - All 21 component definitions
//   - Token bridge (Orqui tokens → Easyblocks tokens)
//   - Custom types (orqui-template, orqui-entity-ref)
//   - Backend (OrquiBackend)
// ============================================================================

import type { EasyblocksConfig } from "./types";
import { ALL_DEFINITIONS } from "./definitions";
import { orquiTokensToEasyblocks } from "./bridge/tokens";
import { getOrquiCustomTypes } from "./bridge/variables";
import { createOrquiBackend, type OrquiBackendOptions } from "./backend";
import type { PageDef } from "../page-editor/nodeDefaults";

// ============================================================================
// Config Builder
// ============================================================================

export interface BuildConfigOptions {
  /** Orqui tokens from layout.tokens */
  tokens: Record<string, any>;
  /** Current pages */
  pages: Record<string, PageDef>;
  /** Callback when a page changes */
  onPageChange: (pageId: string, page: PageDef) => void;
  /** Callback when a page is deleted */
  onPageDelete?: (pageId: string) => void;
  /** Device configuration overrides */
  devices?: Record<string, { hidden?: boolean }>;
}

/**
 * Build the complete Easyblocks Config from Orqui state.
 *
 * @example
 * ```tsx
 * const config = buildOrquiEasyblocksConfig({
 *   tokens: layout.tokens,
 *   pages: layout.pages,
 *   onPageChange: (id, page) => {
 *     setLayout(prev => ({ ...prev, pages: { ...prev.pages, [id]: page } }));
 *   },
 * });
 * ```
 */
export function buildOrquiEasyblocksConfig(options: BuildConfigOptions): EasyblocksConfig {
  const backend = createOrquiBackend({
    pages: options.pages,
    onPageChange: options.onPageChange,
    onPageDelete: options.onPageDelete,
  });

  return {
    backend,

    // All 21 Orqui component definitions
    components: ALL_DEFINITIONS,

    // Tokens bridged from Orqui format
    tokens: orquiTokensToEasyblocks(options.tokens),

    // Custom types for template engine integration
    types: getOrquiCustomTypes(),

    // Single locale (Orqui is not multi-locale yet)
    locales: [
      { code: "pt-BR", isDefault: true },
    ],

    // Device configuration — show only desktop and mobile
    devices: options.devices || {
      xs: { hidden: true },
      sm: { hidden: false },  // Mobile
      md: { hidden: true },   // Tablet (hidden by default)
      lg: { hidden: false },  // Desktop
      xl: { hidden: true },
    },

    // Templates will be populated from PagePresets in Phase 2
    templates: [],
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

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
