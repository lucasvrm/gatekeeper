// ============================================================================
// OrquiBackend — Custom Easyblocks Backend
//
// ARCHITECTURE:
// Easyblocks internally normalizes entries into a complex format with
// responsive wrappers ($res), token refs ({tokenId, value}), _itemProps, etc.
// We CANNOT reliably produce this format from Orqui NodeDef.
//
// Solution: Cache-first approach.
// - create(): Easyblocks sends its own normalized entry → cache it
// - update(): Easyblocks sends updated entry → cache it + notify parent
// - get(): Return cached entry (Easyblocks-native format, guaranteed valid)
//
// Pages that have NEVER been opened in Easyblocks have no cached entry.
// The editor must use ?rootComponent mode for those (not ?document mode).
// Use hasEbCachedEntry() to check before choosing mode.
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
// Module-level entry cache — persists across backend recreations
//
// This cache stores raw Easyblocks entries keyed by page ID.
// Entries come from create() and update() calls — they are in
// Easyblocks' own internal format and are safe to return from get().
// ============================================================================

const _ebEntryCache = new Map<string, any>();

/**
 * Tracks which cache entries were seeded from the adapter (NodeDef → NoCodeEntry)
 * rather than produced by Easyblocks itself. If one of these causes a crash,
 * clearAdapterSeededEntry() removes it so the editor can fall back to
 * rootComponent mode (empty stack) on retry.
 */
const _adapterSeededEntries = new Set<string>();

/** Check if a page has a cached Easyblocks entry (safe for document mode) */
export function hasEbCachedEntry(pageId: string): boolean {
  return _ebEntryCache.has(pageId);
}

/** Remove a cached entry (e.g., when page is deleted) */
export function removeEbCachedEntry(pageId: string): void {
  _ebEntryCache.delete(pageId);
  _adapterSeededEntries.delete(pageId);
}

/** Clear an adapter-seeded entry that caused a crash, allowing
 *  the editor to fall back to rootComponent mode (empty stack).
 *  Returns true if the entry was adapter-seeded and was removed. */
export function clearAdapterSeededEntry(pageId: string): boolean {
  if (_adapterSeededEntries.has(pageId)) {
    _ebEntryCache.delete(pageId);
    _adapterSeededEntries.delete(pageId);
    console.warn(`[backend] Cleared adapter-seeded entry for "${pageId}" — falling back to rootComponent mode`);
    return true;
  }
  return false;
}

// ============================================================================
// Types
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
  entry: any;
}

// ============================================================================
// Debounce helper
// ============================================================================

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }, ms);
  }) as T & { flush: () => void; cancel: () => void };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}

// ============================================================================
// Backend Implementation
// ============================================================================

const PAGE_CHANGE_DEBOUNCE_MS = 300;

export function createOrquiBackend(options: OrquiBackendOptions) {
  const versions = new Map<string, number>();

  // Hydrate entry cache from persisted _ebEntry on pages.
  // This restores document-mode capability after browser refresh.
  for (const [id, page] of Object.entries(options.pages)) {
    versions.set(id, 1);

    if (_ebEntryCache.has(id)) {
      // Already in cache (from a previous backend creation in this session)
      continue;
    }

    if (page._ebEntry) {
      // Persisted EB-native entry — use it directly (Passo 1)
      _ebEntryCache.set(id, structuredClone(page._ebEntry));
    } else if (page.content) {
      // No EB entry — best-effort hydration from adapter (Passo 2).
      // Converts existing NodeDef → NoCodeEntry so the page opens in
      // document mode with its content visible instead of an empty stack.
      // If Easyblocks can't normalize this, the error boundary catches it
      // and clearAdapterSeededEntry() allows graceful fallback.
      try {
        const seeded = nodeDefToNoCodeEntry(page.content);
        _ebEntryCache.set(id, seeded);
        _adapterSeededEntries.add(id);
      } catch (err) {
        console.warn(`[backend] Could not hydrate page "${id}" from adapter:`, err);
      }
    }
  }

  const debouncedPageChange = debounce(
    (pageId: string, page: PageDef) => options.onPageChange(pageId, page),
    PAGE_CHANGE_DEBOUNCE_MS,
  );

  return {
    documents: {
      /**
       * Get a document by ID.
       *
       * ONLY returns cached Easyblocks-native entries. If no cache exists,
       * the caller should have used ?rootComponent mode instead.
       */
      async get(payload: { id: string; locale?: string }): Promise<Document> {
        const version = versions.get(payload.id) || 1;
        const cached = _ebEntryCache.get(payload.id);

        if (cached) {
          return { id: payload.id, version, entry: structuredClone(cached) };
        }

        // No cache — this means the editor should NOT be using ?document mode
        // for this page. Throw to surface the bug early.
        throw new Error(
          `[backend] No cached entry for "${payload.id}". ` +
          `Use ?rootComponent mode for pages not yet opened in Easyblocks.`
        );
      },

      /**
       * Create a new document.
       *
       * Easyblocks calls this in ?rootComponent mode after creating and
       * normalizing the initial entry. The entry is in Easyblocks-native
       * format — we cache it for future get() calls.
       */
      async create(payload: { entry: any }): Promise<Document> {
        const id = `page-${Date.now()}`;
        const noCodeEntry = payload.entry;

        // Cache the Easyblocks-native entry
        _ebEntryCache.set(id, structuredClone(noCodeEntry));
        versions.set(id, 1);

        // Convert to NodeDef for the shell
        let node;
        try {
          node = noCodeEntryToNodeDef(noCodeEntry as NoCodeEntry);
        } catch (err) {
          console.error("[backend] Adapter error on create, using fallback:", err);
          node = { id, type: "stack", children: [] };
        }

        options.onPageChange(id, {
          id,
          label: `Página ${Object.keys(options.pages).length + 1}`,
          route: `/${id}`,
          content: node,
          _ebEntry: structuredClone(noCodeEntry),
        });

        return { id, version: 1, entry: noCodeEntry };
      },

      /**
       * Update an existing document.
       *
       * Called on every keystroke. Caches the raw entry and debounces
       * the NodeDef notification to the shell.
       */
      async update(payload: { id: string; version: number; entry: any }): Promise<Document> {
        const noCodeEntry = payload.entry;

        // Cache the Easyblocks-native entry for future get() calls
        _ebEntryCache.set(payload.id, structuredClone(noCodeEntry));
        // Entry is now EB-native (produced by Easyblocks), no longer adapter-seeded
        _adapterSeededEntries.delete(payload.id);

        // Convert to NodeDef for the shell
        let node;
        try {
          node = noCodeEntryToNodeDef(noCodeEntry as NoCodeEntry);
        } catch (err) {
          console.error("[backend] Adapter error on update, skipping notification:", err);
          const newVersion = (versions.get(payload.id) || 0) + 1;
          versions.set(payload.id, newVersion);
          return { id: payload.id, version: newVersion, entry: noCodeEntry };
        }

        const newVersion = (versions.get(payload.id) || 0) + 1;
        versions.set(payload.id, newVersion);

        const existing = options.pages[payload.id];
        const label = existing?.label || "Página";
        const route = existing?.route || `/${payload.id}`;

        debouncedPageChange(payload.id, {
          id: payload.id,
          label,
          route,
          browserTitle: existing?.browserTitle,
          content: node,
          _ebEntry: structuredClone(noCodeEntry),
        });

        // Shell sync event
        try {
          window.dispatchEvent(new CustomEvent("orqui:page-updated", {
            detail: { pageId: payload.id, entry: noCodeEntry },
          }));
        } catch {
          // SSR or test environment
        }

        return { id: payload.id, version: newVersion, entry: noCodeEntry };
      },
    },

    templates: {
      async get(payload: { id: string }) {
        return { id: payload.id, label: "", entry: {}, isUserDefined: true as const };
      },
      async getAll() {
        return [];
      },
      async create(payload: { label: string; entry: any }) {
        return { id: `tpl-${Date.now()}`, label: payload.label, entry: payload.entry, isUserDefined: true as const };
      },
      async update(payload: { id: string; label: string }) {
        return { id: payload.id, label: payload.label };
      },
      async delete(_payload: { id: string }) {},
    },

    flush() { debouncedPageChange.flush(); },
    cancel() { debouncedPageChange.cancel(); },
  };
}
