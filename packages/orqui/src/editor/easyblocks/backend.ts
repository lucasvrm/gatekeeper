// ============================================================================
// OrquiBackend — Custom Easyblocks Backend
//
// Instead of using the Easyblocks cloud service, this backend stores
// documents directly in the Orqui contract structure (layout.pages).
//
// Document lifecycle:
//   1. Load: pageDefToDocument(page) → feed to EasyblocksEditor
//   2. Save: onSave(entry) → documentToPageDef() → update layout.pages
//   3. Persist: OrquiEditor's existing save pipeline (IndexedDB + API)
//
// This backend is stateful: it holds a reference to the current pages
// and notifies the parent when a document changes.
// ============================================================================

import type { EasyblocksBackend } from "./types";
import type { PageDef } from "../page-editor/nodeDefaults";
import {
  noCodeEntryToNodeDef,
  nodeDefToNoCodeEntry,
  type NoCodeEntry,
} from "./adapter";

// ============================================================================
// Types
// ============================================================================

export interface OrquiBackendOptions {
  /** Current pages from layout.pages */
  pages: Record<string, PageDef>;
  /** Callback when a page is created/updated */
  onPageChange: (pageId: string, page: PageDef) => void;
  /** Callback when a page is deleted */
  onPageDelete?: (pageId: string) => void;
}

interface DocumentRecord {
  id: string;
  entry: NoCodeEntry;
  meta: { label: string; route: string; browserTitle?: string };
  updatedAt: string;
}

// ============================================================================
// Backend Implementation
// ============================================================================

/**
 * Creates an Easyblocks-compatible backend that bridges to Orqui's
 * contract-based persistence.
 *
 * @example
 * ```tsx
 * const backend = createOrquiBackend({
 *   pages: layout.pages,
 *   onPageChange: (id, page) => {
 *     setLayout(prev => ({
 *       ...prev,
 *       pages: { ...prev.pages, [id]: page },
 *     }));
 *   },
 * });
 *
 * const config: Config = {
 *   backend,
 *   components: ALL_DEFINITIONS,
 *   tokens: orquiTokensToEasyblocks(layout.tokens),
 * };
 * ```
 */
export function createOrquiBackend(options: OrquiBackendOptions): EasyblocksBackend {
  // In-memory document store (synced from options.pages)
  const documents = new Map<string, DocumentRecord>();

  // Initialize from current pages
  for (const [id, page] of Object.entries(options.pages)) {
    documents.set(id, {
      id,
      entry: nodeDefToNoCodeEntry(page.content),
      meta: {
        label: page.label,
        route: page.route,
        browserTitle: page.browserTitle,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    documents: {
      async get({ id }) {
        const doc = documents.get(id);
        if (!doc) return null;
        return {
          document: {
            _id: doc.id,
            entry: doc.entry,
            meta: doc.meta,
          },
        };
      },

      async create({ entry, id: requestedId }) {
        const id = requestedId || `page-${Date.now()}`;
        const noCodeEntry = entry as NoCodeEntry;
        const node = noCodeEntryToNodeDef(noCodeEntry);

        const meta = {
          label: `Página ${Object.keys(options.pages).length + 1}`,
          route: `/${id}`,
        };

        documents.set(id, {
          id,
          entry: noCodeEntry,
          meta,
          updatedAt: new Date().toISOString(),
        });

        // Notify parent
        options.onPageChange(id, {
          id,
          label: meta.label,
          route: meta.route,
          content: node,
        });

        return { id };
      },

      async update({ id, entry }) {
        const existing = documents.get(id);
        if (!existing) {
          throw new Error(`Document ${id} not found`);
        }

        const noCodeEntry = entry as NoCodeEntry;
        const node = noCodeEntryToNodeDef(noCodeEntry);

        documents.set(id, {
          ...existing,
          entry: noCodeEntry,
          updatedAt: new Date().toISOString(),
        });

        // Notify parent
        options.onPageChange(id, {
          id,
          label: existing.meta.label,
          route: existing.meta.route,
          browserTitle: existing.meta.browserTitle,
          content: node,
        });
      },
    },

    templates: {
      async get() {
        // In Phase 2, this will return saved page presets as templates
        return [];
      },
    },
  };
}

// ============================================================================
// Utility: sync backend when pages change externally
// ============================================================================

/**
 * Update the backend's in-memory store when pages change from outside
 * (e.g., Shell & Tokens mode edits page metadata, or undo reverts).
 *
 * This is a mutable operation on the backend instance.
 */
export function syncBackendPages(
  backend: EasyblocksBackend,
  pages: Record<string, PageDef>,
): void {
  // The backend holds a closure over the documents Map.
  // To sync, we re-create documents for each page.
  // This requires the backend to expose an internal sync method.
  //
  // TODO: In Phase 4, refactor to use a shared reactive store
  // (e.g., Zustand or a custom observable) so both the Easyblocks
  // editor and OrquiEditor share the same state.
  console.warn("[OrquiBackend] syncBackendPages is a no-op until Phase 4 reactive store");
}
