import React, { useState, useCallback, useEffect, useRef } from "react";
import { COLORS, s, DEFAULT_LAYOUT, DEFAULT_UI_REGISTRY } from "./lib/constants";
import { computeHash } from "./lib/utils";
import { idbGet, idbSet } from "./lib/indexeddb";
import { apiLoadContracts, apiSaveContract } from "./lib/api";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { CommandPalette } from "./components/CommandPalette";
import { PageEditor } from "./page-editor/PageEditor";
import { StackedWorkbench } from "./workbench/StackedWorkbench";
import { EasyblocksPageEditor, invalidateAllEntries } from "./easyblocks";
import { stripEbEntries, hydrateEbEntries } from "./easyblocks/backend";

// ============================================================================
// OrquiEditor — top-level mode switcher + topbar
//
// PHASE 6 CHANGES:
//   P5: display:none coexistence (instant mode switch)
//       Shell ↔ Pages token sync via snapshot comparison
//   P7: ⌘? keyboard shortcut help overlay
//       Animated save toast
//       Page duplicate (⌘D)
//       Better mode transition UX
// ============================================================================
export function OrquiEditor() {
  // Top-level mode: "pages" (DnD builder) or "shell" (Stacked Workbench)
  const [editorMode, _setEditorMode] = useState<"pages" | "shell">("pages");

  // ── P5: Shell entry snapshot for smart invalidation ──────────────────────
  // When entering Shell, snapshot tokens + variables.
  // When returning to Pages, compare to detect changes that require EB rebuild.
  const shellSnapshotRef = useRef({ tokens: "", variables: "" });

  // We need layout to be accessible inside setEditorMode's callback.
  // Since setEditorMode is memoized, we use a ref to always have the latest layout.
  const layoutRef = useRef(DEFAULT_LAYOUT);

  const [layout, _setLayout] = useState(DEFAULT_LAYOUT);
  const setLayout = useCallback((updater: any) => {
    _setLayout(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      layoutRef.current = next;
      return next;
    });
  }, []);

  // Patch setEditorMode to read from layoutRef
  const setEditorModeSafe = useCallback((mode: "pages" | "shell") => {
    // Read latest layout from ref (avoids stale closure)
    const currentLayout = layoutRef.current;

    _setEditorMode(prev => {
      if (prev === mode) return prev;

      if (prev === "pages" && mode === "shell") {
        shellSnapshotRef.current = {
          tokens: JSON.stringify(currentLayout.tokens),
          variables: JSON.stringify(currentLayout.variables),
        };
      }

      if (prev === "shell" && mode === "pages") {
        const tokensChanged = JSON.stringify(currentLayout.tokens) !== shellSnapshotRef.current.tokens;
        const varsChanged = JSON.stringify(currentLayout.variables) !== shellSnapshotRef.current.variables;

        if (tokensChanged || varsChanged) {
          console.debug("[OrquiEditor] Tokens/vars changed in Shell → dispatching external-change");
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent("orqui:external-change"));
          });
        }

        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }

      return mode;
    });
  }, []);

  // Normalize registry: ensure every component has name field matching its key
  const normalizeRegistry = useCallback((reg: any) => {
    if (!reg?.components) return reg;
    const normalized = { ...reg, components: { ...reg.components } };
    Object.keys(normalized.components).forEach(key => {
      if (!normalized.components[key].name || normalized.components[key].name !== key) {
        normalized.components[key] = { ...normalized.components[key], name: key };
      }
    });
    return normalized;
  }, []);

  const [registry, setRegistryRaw] = useState(() => normalizeRegistry(DEFAULT_UI_REGISTRY));
  const setRegistry = useCallback((r: any) => setRegistryRaw(normalizeRegistry(r)), [normalizeRegistry]);
  const [hasApi, setHasApi] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Ref to track whether a save is in progress (prevents double saves)
  const savingRef = useRef(false);

  // Snapshot for undo: stores state at last save
  const [savedSnapshot, setSavedSnapshot] = useState<{ layout: any; registry: any } | null>(null);
  const hasUnsavedChanges = savedSnapshot && (
    JSON.stringify(layout) !== JSON.stringify(savedSnapshot.layout) ||
    JSON.stringify(registry) !== JSON.stringify(savedSnapshot.registry)
  );

  const undoChanges = useCallback(() => {
    if (!savedSnapshot) return;
    invalidateAllEntries();
    setLayout(savedSnapshot.layout);
    setRegistry(savedSnapshot.registry);
  }, [savedSnapshot]);

  // ── P7: Keyboard shortcut help overlay ──────────────────────────────────
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ── P7: Save toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Data Loading ───────────────────────────────────────────────────────────
  // Try API first (filesystem via Vite plugin), then IndexedDB (draft), then defaults
  useEffect(() => {
    (async () => {
      const apiContracts = await apiLoadContracts();
      if (apiContracts) {
        setHasApi(true);
        let loadedLayout = null, loadedRegistry = null;
        if (apiContracts["layout-contract"]) {
          const { $orqui, ...data } = apiContracts["layout-contract"];
          setLayout(data);
          loadedLayout = data;
        }
        if (apiContracts["ui-registry-contract"]) {
          const { $orqui, ...data } = apiContracts["ui-registry-contract"];
          setRegistry(data);
          loadedRegistry = data;
        }
        setSavedSnapshot({ layout: loadedLayout || layout, registry: loadedRegistry || registry });
        return;
      }
      // Fallback to IndexedDB
      const l = await idbGet("orqui-layout");
      if (l) setLayout(l);
      const r = await idbGet("orqui-registry");
      if (r) setRegistry(r);
    })();
  }, []);

  // Auto-save to IndexedDB on every change (draft persistence)
  // IndexedDB KEEPS _ebEntry for hydration across browser refreshes
  useEffect(() => {
    const hydrated = {
      ...layout,
      pages: layout.pages ? hydrateEbEntries(layout.pages) : {},
    };
    idbSet("orqui-layout", hydrated);
  }, [layout]);
  useEffect(() => { idbSet("orqui-registry", registry); }, [registry]);

  // ── Beforeunload — warn on exit with unsaved changes ────────────────────
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Há alterações não salvas. Tem certeza que deseja sair?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ══════════════════════════════════════════════════════════════════════════
  // UNIFIED SAVE PIPELINE
  // ══════════════════════════════════════════════════════════════════════════

  const doFilesystemWrite = useCallback(async (currentLayout: any, currentRegistry: any) => {
    try {
      const cleanLayout = {
        ...currentLayout,
        pages: currentLayout.pages ? stripEbEntries(currentLayout.pages) : {},
      };

      const layoutHash = await computeHash(cleanLayout);
      const layoutContract = {
        $orqui: {
          schema: "layout-contract",
          version: "2.0.0",
          hash: layoutHash,
          generatedAt: new Date().toISOString(),
          pageCount: Object.keys(cleanLayout.pages || {}).length,
        },
        ...cleanLayout,
      };

      const registryHash = await computeHash(currentRegistry);
      const registryContract = {
        $orqui: {
          schema: "ui-registry-contract",
          version: "1.0.0",
          hash: registryHash,
          generatedAt: new Date().toISOString(),
        },
        ...currentRegistry,
      };

      const errors = validateLayoutContract(cleanLayout);
      if (errors.length > 0) {
        console.warn("[OrquiEditor] Contract validation warnings:", errors);
      }

      const r1 = await apiSaveContract(layoutContract);
      const r2 = await apiSaveContract(registryContract);

      if (r1.ok && r2.ok) {
        setSavedSnapshot({ layout: { ...currentLayout }, registry: { ...currentRegistry } });
        setSaveStatus("saved");
        showToast("Contratos salvos com sucesso", "success");
      } else {
        console.error("[OrquiEditor] Save failed:", { r1, r2 });
        setSaveStatus("error");
        showToast("Erro ao salvar contratos", "error");
      }
    } catch (err) {
      console.error("[OrquiEditor] Save error:", err);
      setSaveStatus("error");
      showToast("Erro ao salvar contratos", "error");
    }

    setTimeout(() => setSaveStatus(null), 2000);
  }, [showToast]);

  const handleSave = useCallback(async () => {
    if (!hasApi || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");

    try {
      // Phase A: Flush EB backend
      window.dispatchEvent(new CustomEvent("orqui:force-save"));
      await new Promise<void>(r => setTimeout(r, 100));
    } catch {
      // flush failed — continue with current state
    }

    // Phase B: Save — read latest from ref
    await doFilesystemWrite(layoutRef.current, registry);
    savingRef.current = false;
  }, [hasApi, registry, doFilesystemWrite]);

  // ── P7: Duplicate page ──────────────────────────────────────────────────
  const duplicateCurrentPage = useCallback(() => {
    const pages = layoutRef.current.pages;
    if (!pages) return;

    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) return;

    // Find the "current" page — for now, duplicate the last one
    // (EasyblocksPageEditor tracks selection internally; we duplicate
    //  based on what's focused or the first page as fallback)
    const sourceId = pageIds[pageIds.length - 1];
    const source = pages[sourceId];
    if (!source) return;

    const newId = `page-${Date.now()}`;
    const newPage = {
      ...source,
      id: newId,
      label: `${source.label} (cópia)`,
      route: `${source.route}-copy`,
      // Don't copy _ebEntry — the duplicate starts fresh in rootComponent mode
      _ebEntry: undefined,
    };

    setLayout((prev: any) => ({
      ...prev,
      pages: { ...prev.pages, [newId]: newPage },
    }));

    showToast(`Página "${source.label}" duplicada`, "success");
  }, [setLayout, showToast]);

  // ── Command Palette ────────────────────────────────────────────────────────
  const [cmdOpen, setCmdOpen] = useState(false);

  const setActiveTab = useCallback((_t: string) => {}, []);
  const scrollToSection = useCallback((_id: string) => {}, []);
  const openAccordion = useCallback((sectionId: string) => {
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: sectionId }));
    window.dispatchEvent(new CustomEvent("orqui:open-accordion", { detail: `wb-${sectionId}` }));
  }, []);

  const cmdItems = useCommandPaletteItems(layout, registry, setActiveTab, scrollToSection, openAccordion);

  // ── Global keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+K — Command palette
      if (ctrl && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }

      // Ctrl+S — Save to filesystem
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Ctrl+Shift+M — Toggle mode (Pages ↔ Shell)
      if (ctrl && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setEditorModeSafe(editorMode === "pages" ? "shell" : "pages");
      }

      // Ctrl+Shift+D — Duplicate current page
      if (ctrl && e.shiftKey && e.key === "D") {
        e.preventDefault();
        duplicateCurrentPage();
      }

      // Ctrl+? (Ctrl+/ on most keyboards) — Keyboard shortcuts help
      if (ctrl && (e.key === "?" || e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, editorMode, setEditorModeSafe, duplicateCurrentPage]);

  // ── Orqui Favicon ──────────────────────────────────────────────────────────
  useEffect(() => {
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${COLORS.accent}"><path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z"/></svg>`;
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    link.type = "image/svg+xml";
    document.title = "orqui — contract editor";
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — Both modes simultaneously, toggled with display:none
  //
  // P5: Both Shell and Pages stay mounted. Switching is instant because
  //     we only toggle CSS visibility. The EB iframe stays alive (preserving
  //     scroll, selection, undo history). Token changes in Shell trigger a
  //     rebuild only when returning to Pages.
  //
  //     Pages wrapper uses display:contents when active so EasyblocksEditor
  //     remains the sole viewport occupant (per EB docs requirement).
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* Google Fonts (shared) */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SHELL & TOKENS MODE                                             */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="orqui-editor-root" style={{
        background: COLORS.bg, height: "100vh", color: COLORS.text,
        fontFamily: "'Inter', -apple-system, sans-serif",
        display: editorMode === "shell" ? "flex" : "none",
        flexDirection: "column", overflow: "hidden",
      }}>
        {/* Scrollbar styles */}
        <style>{`
          .orqui-editor-root { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
          .orqui-editor-root *::-webkit-scrollbar { width: 3px; height: 3px; }
          .orqui-editor-root *::-webkit-scrollbar-track { background: transparent; }
          .orqui-editor-root *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 99px; }
          .orqui-editor-root *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
          .orqui-editor-root *::-webkit-scrollbar-button { display: none; }
          .orqui-editor-root * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
        `}</style>

        {/* ── TOPBAR ──────────────────────────────────────────────── */}
        <div style={{
          height: 52, flexShrink: 0, background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex", alignItems: "center", padding: "0 20px", gap: 12,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 256 256" fill={COLORS.accent}>
              <path d="M245.66,74.34l-32-32a8,8,0,0,0-11.32,11.32L220.69,72H208c-49.33,0-61.05,28.12-71.38,52.92-9.38,22.51-16.92,40.59-49.48,42.84a40,40,0,1,0,.1,16c43.26-2.65,54.34-29.15,64.14-52.69C161.41,107,169.33,88,208,88h12.69l-18.35,18.34a8,8,0,0,0,11.32,11.32l32-32A8,8,0,0,0,245.66,74.34ZM48,200a24,24,0,1,1,24-24A24,24,0,0,1,48,200Z" />
            </svg>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              fontSize: 16, color: COLORS.accent, letterSpacing: "-0.5px",
            }}>orqui</span>
          </div>

          <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.border }} />

          {/* Mode switcher */}
          <div style={{
            display: "flex", gap: 2, background: COLORS.surface2,
            padding: 3, borderRadius: 8,
          }}>
            {[
              { id: "pages" as const, label: "📐 Páginas" },
              { id: "shell" as const, label: "⚙ Shell & Tokens" },
            ].map(mode => (
              <button key={mode.id} onClick={() => setEditorModeSafe(mode.id)} title={`⌘⇧M — Alternar modo`} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                background: editorMode === mode.id ? COLORS.accent + "20" : "transparent",
                color: editorMode === mode.id ? COLORS.accent : COLORS.textDim,
                transition: "all 0.15s",
                position: "relative",
              }}>
                {mode.label}
                {hasUnsavedChanges && editorMode === mode.id && (
                  <span style={{
                    position: "absolute", top: 3, right: 3,
                    width: 6, height: 6, borderRadius: "50%",
                    background: COLORS.warning,
                  }} />
                )}
              </button>
            ))}
          </div>

          <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.border }} />

          {/* Search trigger — ⌘K */}
          <button
            onClick={() => setCmdOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 8, fontSize: 12,
              border: `1px solid ${COLORS.border}`, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: COLORS.surface2, color: COLORS.textDim,
              transition: "all 0.15s", minWidth: 180,
            }}
          >
            <span style={{ fontSize: 13 }}>⌘</span>
            <span style={{ flex: 1, textAlign: "left" }}>Buscar…</span>
            <kbd style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: COLORS.surface3, border: `1px solid ${COLORS.border}`,
              color: COLORS.textDim,
            }}>⌘K</kbd>
          </button>

          <div style={{ flex: 1 }} />

          {/* Status badges */}
          <span style={{
            ...s.tag, fontSize: 10,
            background: `${COLORS.success}15`, color: COLORS.success,
            border: `1px solid ${COLORS.success}30`,
          }}>
            {Object.values(layout.structure.regions).filter((r: any) => r.enabled).length} regions
          </span>
          <span style={{
            ...s.tag, fontSize: 10,
            background: `${COLORS.accent}15`, color: COLORS.accent,
            border: `1px solid ${COLORS.accent}30`,
          }}>
            {Object.keys(registry.components).length} components
          </span>
          {layout.pages && Object.keys(layout.pages).length > 0 && (
            <span style={{
              ...s.tag, fontSize: 10,
              background: `${COLORS.orange}15`, color: COLORS.orange,
              border: `1px solid ${COLORS.orange}30`,
            }}>
              {Object.keys(layout.pages).length} {Object.keys(layout.pages).length === 1 ? "página" : "páginas"}
            </span>
          )}
          <span style={{ ...s.tag, fontSize: 10 }}>IndexedDB ✓</span>

          {/* Keyboard shortcut help */}
          <button onClick={() => setShortcutsOpen(true)} title="⌘/ — Atalhos" style={{
            padding: "5px 8px", borderRadius: 6, fontSize: 11,
            border: `1px solid ${COLORS.border}`, cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            background: "transparent", color: COLORS.textDim,
            transition: "all 0.15s",
          }}>?</button>

          {/* Undo */}
          {hasApi && hasUnsavedChanges && (
            <button onClick={undoChanges} style={{
              padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: `1px solid ${COLORS.danger}30`, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: "transparent", color: COLORS.danger,
            }}>
              ↩ Desfazer
            </button>
          )}

          {/* Save */}
          {hasApi && (
            <button onClick={handleSave} disabled={saveStatus === "saving"} title="⌘S — Salvar no projeto" style={{
              padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: saveStatus === "saved" ? COLORS.success : saveStatus === "error" ? COLORS.danger : COLORS.accent,
              color: "#fff",
              opacity: saveStatus === "saving" ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "✕ Error" : "Save to Project"}
            </button>
          )}
        </div>

        {/* ── MAIN CONTENT — Shell & Tokens ──────────────────────── */}
        <StackedWorkbench
          layout={layout}
          setLayout={setLayout}
          registry={registry}
          setRegistry={setRegistry}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGES MODE — Easyblocks full viewport                           */}
      {/*                                                                  */}
      {/* display:contents when active → wrapper is transparent to layout  */}
      {/* display:none when hidden → EB iframe stays alive but invisible   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div style={{ display: editorMode === "pages" ? "contents" : "none" }}>
        <EasyblocksPageEditor
          pages={layout.pages || {}}
          onPagesChange={(pages) => setLayout((prev: any) => ({ ...prev, pages }))}
          tokens={layout.tokens}
          variables={layout.variables}
          onVariablesChange={(variables) => setLayout((prev: any) => ({ ...prev, variables }))}
          onSwitchToShell={() => setEditorModeSafe("shell")}
          onSave={hasApi ? handleSave : undefined}
          saveStatus={saveStatus}
          hasUnsavedChanges={!!hasUnsavedChanges}
          visible={editorMode === "pages"}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* SHARED OVERLAYS                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />

      {/* P7: Keyboard shortcuts help */}
      {shortcutsOpen && (
        <KeyboardShortcutsHelp
          onClose={() => setShortcutsOpen(false)}
          editorMode={editorMode}
        />
      )}

      {/* P7: Save toast */}
      {toast && <SaveToast message={toast.message} type={toast.type} />}
    </>
  );
}

// ============================================================================
// P7: Keyboard Shortcuts Help Overlay
// ============================================================================

function KeyboardShortcutsHelp({ onClose, editorMode }: { onClose: () => void; editorMode: string }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on click outside
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const globalShortcuts = [
    { keys: "⌘ S", desc: "Salvar contratos no projeto" },
    { keys: "⌘ K", desc: "Abrir command palette" },
    { keys: "⌘ ⇧ M", desc: "Alternar Páginas ↔ Shell & Tokens" },
    { keys: "⌘ ⇧ D", desc: "Duplicar página atual" },
    { keys: "⌘ /", desc: "Mostrar/ocultar atalhos" },
  ];

  const pagesShortcuts = [
    { keys: "⌘ ⇧ P", desc: "Nova página" },
    { keys: "⌘ W", desc: "Excluir página atual" },
    { keys: "⌘ PgUp", desc: "Página anterior" },
    { keys: "⌘ PgDn", desc: "Página seguinte" },
    { keys: "⌘ Z", desc: "Desfazer (EB nativo)" },
    { keys: "⌘ ⇧ Z", desc: "Refazer (EB nativo)" },
    { keys: "Duplo-clique", desc: "Renomear aba da página" },
    { keys: "Botão direito", desc: "Configurações da página" },
  ];

  const shellShortcuts = [
    { keys: "⌘ Z", desc: "Desfazer alterações (restaurar último save)" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300000,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      animation: "orqui-fade-in 0.15s ease-out",
    }}>
      <style>{`
        @keyframes orqui-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes orqui-slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div ref={ref} style={{
        background: "#141417", borderRadius: 12, padding: 24,
        border: "1px solid #2a2a33", boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
        maxWidth: 480, width: "90%", maxHeight: "80vh", overflow: "auto",
        animation: "orqui-slide-up 0.2s ease-out",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e4e4e7" }}>
            ⌨️ Atalhos do teclado
          </h2>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", color: "#5b5b66",
            fontSize: 18, cursor: "pointer", padding: "4px 8px",
          }}>✕</button>
        </div>

        <ShortcutGroup title="Global" shortcuts={globalShortcuts} />
        {editorMode === "pages" && <ShortcutGroup title="Modo Páginas" shortcuts={pagesShortcuts} />}
        {editorMode === "shell" && <ShortcutGroup title="Modo Shell" shortcuts={shellShortcuts} />}

        <div style={{ marginTop: 16, fontSize: 11, color: "#5b5b66", textAlign: "center" }}>
          Pressione <kbd style={kbdMiniStyle}>Esc</kbd> para fechar
        </div>
      </div>
    </div>
  );
}

function ShortcutGroup({ title, shortcuts }: { title: string; shortcuts: { keys: string; desc: string }[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#5b5b66",
        textTransform: "uppercase", letterSpacing: "0.5px",
        marginBottom: 8, paddingBottom: 4,
        borderBottom: "1px solid #1c1c21",
      }}>
        {title}
      </div>
      {shortcuts.map(s => (
        <div key={s.keys} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "5px 0", fontSize: 12,
        }}>
          <span style={{ color: "#8b8b96" }}>{s.desc}</span>
          <kbd style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            padding: "2px 8px", borderRadius: 4,
            background: "#1c1c21", border: "1px solid #2a2a33",
            color: "#e4e4e7", fontWeight: 500,
            whiteSpace: "nowrap",
          }}>{s.keys}</kbd>
        </div>
      ))}
    </div>
  );
}

const kbdMiniStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
  padding: "1px 5px", borderRadius: 3,
  background: "#1c1c21", border: "1px solid #2a2a33",
  color: "#e4e4e7",
};

// ============================================================================
// P7: Save Toast
// ============================================================================

function SaveToast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      zIndex: 300001,
      padding: "10px 20px", borderRadius: 8,
      background: type === "success" ? "#141417" : "#1c1417",
      border: `1px solid ${type === "success" ? "#22c55e30" : "#ef444430"}`,
      color: type === "success" ? "#4ade80" : "#f87171",
      fontSize: 13, fontWeight: 500,
      fontFamily: "'Inter', sans-serif",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "orqui-toast-in 0.3s ease-out",
      pointerEvents: "none",
    }}>
      <style>{`
        @keyframes orqui-toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span>{message}</span>
    </div>
  );
}

// ============================================================================
// Contract Validation
// ============================================================================

function validateLayoutContract(layout: any): string[] {
  const warnings: string[] = [];
  if (!layout.structure?.regions) warnings.push("Missing structure.regions");
  if (!layout.tokens) warnings.push("Missing tokens");

  if (layout.pages) {
    for (const [id, page] of Object.entries(layout.pages) as [string, any][]) {
      if (!page.content) warnings.push(`Page "${id}" has no content tree`);
      if (!page.label) warnings.push(`Page "${id}" has no label`);
      if (!page.route) warnings.push(`Page "${id}" has no route`);
      if (page._ebEntry) warnings.push(`Page "${id}" still has _ebEntry (should be stripped)`);
    }
  }

  return warnings;
}
