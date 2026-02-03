// ============================================================================
// OrquiBackend — Custom Easyblocks Backend
//
// Implements the real @easyblocks/core Backend interface:
//   documents: { get, create, update }
//   templates:  { get, getAll, create, update, delete }
//
// Stores documents in-memory, synced with Orqui's layout.pages.
// ============================================================================

import type {
  Backend,
  Document,
  NoCodeComponentEntry,
  UserDefinedTemplate,
} from "@easyblocks/core";
import type { PageDef } from "../page-editor/nodeDefaults";
import { noCodeEntryToNodeDef, nodeDefToNoCodeEntry } from "./adapter";

// ============================================================================
// Options
// ============================================================================

export interface OrquiBackendOptions {
  /** Current pages from layout.pages */
  pages: Record<string, PageDef>;
  /** Callback when a page is created/updated */
  onPageChange: (pageId: string, page: PageDef) => void;
  /** Callback when a page is deleted */
  onPageDelete?: (pageId: string) => void;
}

// ============================================================================
// In-memory state
// ============================================================================

interface DocRecord {
  id: string;
  version: number;
  entry: NoCodeComponentEntry;
  meta: { label: string; route: string; browserTitle?: string };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a Backend compatible with the real @easyblocks/core Backend interface.
 *
 * Documents map 1:1 to Orqui pages. When the Easyblocks editor saves,
 * we convert back to NodeDef and notify the parent via onPageChange.
 */
export function createOrquiBackend(options: OrquiBackendOptions): Backend {
  // ---- In-memory document store ----
  const docs = new Map<string, DocRecord>();
  let nextVersion = 1;

  // Seed from current pages
  for (const [id, page] of Object.entries(options.pages)) {
    docs.set(id, {
      id,
      version: nextVersion++,
      entry: nodeDefToNoCodeEntry(page.content),
      meta: { label: page.label, route: page.route, browserTitle: page.browserTitle },
    });
  }

  // ---- In-memory template store ----
  const templates = new Map<string, UserDefinedTemplate>();

  // ================================================================
  // Backend implementation
  // ================================================================
  return {
    documents: {
      async get({ id }): Promise<Document> {
        const doc = docs.get(id);
        if (!doc) {
          throw new Error(`[OrquiBackend] Document "${id}" not found`);
        }
        return { id: doc.id, version: doc.version, entry: doc.entry };
      },

      async create({ entry }): Promise<Document> {
        const id = `page-${Date.now()}`;
        const version = nextVersion++;
        const noCodeEntry = entry as NoCodeComponentEntry;

        const meta = {
          label: `Página ${docs.size + 1}`,
          route: `/${id}`,
        };

        docs.set(id, { id, version, entry: noCodeEntry, meta });

        // Convert to NodeDef and notify parent
        const node = noCodeEntryToNodeDef(noCodeEntry);
        options.onPageChange(id, {
          id,
          label: meta.label,
          route: meta.route,
          content: node,
        });

        return { id, version, entry: noCodeEntry };
      },

      async update({ id, version, entry }): Promise<Document> {
        const existing = docs.get(id);
        if (!existing) {
          throw new Error(`[OrquiBackend] Document "${id}" not found for update`);
        }

        const newVersion = nextVersion++;
        const noCodeEntry = entry as NoCodeComponentEntry;

        docs.set(id, { ...existing, version: newVersion, entry: noCodeEntry });

        // Convert to NodeDef and notify parent
        const node = noCodeEntryToNodeDef(noCodeEntry);
        options.onPageChange(id, {
          id,
          label: existing.meta.label,
          route: existing.meta.route,
          browserTitle: existing.meta.browserTitle,
          content: node,
        });

        return { id, version: newVersion, entry: noCodeEntry };
      },
    },

    templates: {
      async get({ id }): Promise<UserDefinedTemplate> {
        const tpl = templates.get(id);
        if (!tpl) throw new Error(`[OrquiBackend] Template "${id}" not found`);
        return tpl;
      },

      async getAll(): Promise<UserDefinedTemplate[]> {
        return Array.from(templates.values());
      },

      async create({ label, entry, width, widthAuto }): Promise<UserDefinedTemplate> {
        const id = `tpl-${Date.now()}`;
        const tpl: UserDefinedTemplate = {
          id,
          label,
          entry: entry as NoCodeComponentEntry,
          isUserDefined: true,
          width,
          widthAuto,
        };
        templates.set(id, tpl);
        return tpl;
      },

      async update({ id, label }): Promise<Omit<UserDefinedTemplate, "entry">> {
        const existing = templates.get(id);
        if (!existing) throw new Error(`[OrquiBackend] Template "${id}" not found`);
        const updated = { ...existing, label };
        templates.set(id, updated);
        return { id, label, isUserDefined: true, width: updated.width, widthAuto: updated.widthAuto };
      },

      async delete({ id }): Promise<void> {
        templates.delete(id);
      },
    },
  };
}
