// ============================================================================
// OrquiBackend — Custom Easyblocks Backend
//
// FIX: Backend interface must match the real Easyblocks API:
//   documents.get()    → Promise<Document>           (not { document: ... })
//   documents.create() → Promise<Document>           (not { id })
//   documents.update() → Promise<Document>           (not void)
//
// Where Document = { id: string; version: number; entry: NoCodeComponentEntry }
//
// Ref: https://docs.easyblocks.io/essentials/backend
// ============================================================================

import type { PageDef } from "../page-editor/nodeDefaults";
import {
  noCodeEntryToNodeDef,
  nodeDefToNoCodeEntry,
  type NoCodeEntry,
} from "./adapter";

// ============================================================================
// Types matching the real Easyblocks Backend interface
// ============================================================================

export interface OrquiBackendOptions {
  pages: Record<string, PageDef>;
  onPageChange: (pageId: string, page: PageDef) => void;
  onPageDelete?: (pageId: string) => void;
}

/** Easyblocks Document shape */
interface Document {
  id: string;
  version: number;
  entry: any; // NoCodeComponentEntry
}

// ============================================================================
// Backend Implementation
// ============================================================================

export function createOrquiBackend(options: OrquiBackendOptions) {
  // In-memory version tracking
  const versions = new Map<string, number>();

  // Initialize versions from existing pages
  for (const id of Object.keys(options.pages)) {
    versions.set(id, 1);
  }

  return {
    documents: {
      async get(payload: { id: string; locale?: string }): Promise<Document> {
        const page = options.pages[payload.id];
        if (!page) {
          // Easyblocks expects a Document even for missing docs
          // Return a minimal entry — the editor handles this gracefully
          throw new Error(`Document ${payload.id} not found`);
        }

        const entry = nodeDefToNoCodeEntry(page.content);
        const version = versions.get(payload.id) || 1;

        return {
          id: payload.id,
          version,
          entry,
        };
      },

      async create(payload: { entry: any }): Promise<Document> {
        const id = `page-${Date.now()}`;
        const noCodeEntry = payload.entry;
        const node = noCodeEntryToNodeDef(noCodeEntry as NoCodeEntry);

        versions.set(id, 1);

        // Notify parent
        options.onPageChange(id, {
          id,
          label: `Página ${Object.keys(options.pages).length + 1}`,
          route: `/${id}`,
          content: node,
        });

        return {
          id,
          version: 1,
          entry: noCodeEntry,
        };
      },

      async update(payload: { id: string; version: number; entry: any }): Promise<Document> {
        const noCodeEntry = payload.entry;
        const node = noCodeEntryToNodeDef(noCodeEntry as NoCodeEntry);

        const newVersion = (versions.get(payload.id) || 0) + 1;
        versions.set(payload.id, newVersion);

        // Get existing metadata
        const existing = options.pages[payload.id];
        const label = existing?.label || `Página`;
        const route = existing?.route || `/${payload.id}`;

        // Notify parent
        options.onPageChange(payload.id, {
          id: payload.id,
          label,
          route,
          browserTitle: existing?.browserTitle,
          content: node,
        });

        return {
          id: payload.id,
          version: newVersion,
          entry: noCodeEntry,
        };
      },
    },

    templates: {
      async get(payload: { id: string }) {
        return {
          id: payload.id,
          label: "",
          entry: {},
          isUserDefined: true as const,
        };
      },

      async getAll() {
        // In Phase 2, return saved page presets as templates
        return [];
      },

      async create(payload: { label: string; entry: any }) {
        return {
          id: `tpl-${Date.now()}`,
          label: payload.label,
          entry: payload.entry,
          isUserDefined: true as const,
        };
      },

      async update(payload: { id: string; label: string }) {
        return { id: payload.id, label: payload.label };
      },

      async delete(_payload: { id: string }) {
        // no-op for now
      },
    },
  };
}
