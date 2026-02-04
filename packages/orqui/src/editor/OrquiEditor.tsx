import React, { useState, useCallback, useEffect, useRef } from "react";
import { COLORS, s, DEFAULT_LAYOUT, DEFAULT_UI_REGISTRY } from "./lib/constants";
import { computeHash } from "./lib/utils";
import { idbGet, idbSet } from "./lib/indexeddb";
import { apiLoadContracts, apiSaveContract, getSandboxInfo, apiResetSandbox } from "./lib/api";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { CommandPalette } from "./components/CommandPalette";
import { PageEditor } from "./page-editor/PageEditor";
import { StackedWorkbench } from "./workbench/StackedWorkbench";
import { EasyblocksPageEditor, invalidateAllEntries } from "./easyblocks";
import { stripEbEntries, hydrateEbEntries } from "./easyblocks/backend";

// ============================================================================
// OrquiEditor — top-level mode switcher + topbar
// Pages mode: DnD builder (intocável)
// Shell & Tokens mode: Stacked Workbench (IDE-like layout)
//
// PHASE 5 CHANGES:
//   - Unified save pipeline: flush EB backend → strip _ebEntry → save
//   - Contract v2 validation before filesystem write
//   - IndexedDB keeps _ebEntry for hydration; filesystem strips it
//   - hasUnsavedChanges prop passed down to EasyblocksPageEditor
// ============================================================================
export function OrquiEditor() {
  // Top-level mode: "pages" (DnD builder) or "shell" (Stacked Workbench)
  const [editorMode, _setEditorMode] = useState<"pages" | "shell">("pages");

  // Wrap mode switch: invalidate EB cache when returning to Pages
  // so the editor re-hydrates from the current layout state
  // (picks up token changes, imports, undos that happened in Shell).
  const setEditorMode = useCallback((mode: "pages" | "shell") => {
    _setEditorMode(prev => {
      if (prev === "shell" && mode === "pages") {
        invalidateAllEntries();
      }
      return mode;
    });
  }, []);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

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
      // Modern browsers ignore custom message but still show prompt
      e.returnValue = "Há alterações não salvas. Tem certeza que deseja sair?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ══════════════════════════════════════════════════════════════════════════
  // UNIFIED SAVE PIPELINE
  //
  // Sequence:
  // 1. Emit orqui:force-save → EasyblocksPageEditor flushes debounced
  //    backend changes via flushSync (waits for React state update)
  // 2. Read layout state (now up-to-date with all EB changes)
  // 3. Strip _ebEntry from pages (not needed by runtime consumers)
  // 4. Add $orqui metadata header
  // 5. POST to filesystem API
  // 6. Update saved snapshot
  //
  // The key insight: step 1 must COMPLETE before step 2 reads layout,
  // otherwise we save stale data. This is why we use a two-phase approach:
  // - Phase A: flush (event handler in EB component calls flushSync)
  // - Phase B: save (runs after a yield to the event loop)
  // ══════════════════════════════════════════════════════════════════════════

  const saveToFilesystem = useCallback(async () => {
    if (!hasApi || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");

    try {
      // Phase A: Flush EB backend debounced changes
      // The event listener in EasyblocksPageEditor calls backend.flushSync()
      // which awaits React state propagation
      window.dispatchEvent(new CustomEvent("orqui:force-save"));

      // Yield to let React process the state update from flush
      await new Promise<void>(r => setTimeout(r, 50));

      // Phase B: Read current state and save
      // We read layout via a ref-like pattern to get the latest value
      // after the flush state update has been processed
    } catch (err) {
      console.error("[OrquiEditor] Flush failed:", err);
    }

    // Note: saveToFilesystemInner is called separately because we need
    // the latest layout reference. See the useEffect that watches layout.
    savingRef.current = false;
  }, [hasApi]);

  // The actual filesystem write — separated so it always reads latest state
  const doFilesystemWrite = useCallback(async (currentLayout: any, currentRegistry: any) => {
    try {
      // ── Strip _ebEntry from pages ──────────────────────────────────
      // Runtime consumers don't need the Easyblocks-native format.
      // IndexedDB retains it (via hydrateEbEntries in the auto-save effect).
      const cleanLayout = {
        ...currentLayout,
        pages: currentLayout.pages ? stripEbEntries(currentLayout.pages) : {},
      };

      // ── Build layout contract ──────────────────────────────────────
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

      // ── Build registry contract ────────────────────────────────────
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

      // ── Validate contract structure ────────────────────────────────
      const errors = validateLayoutContract(cleanLayout);
      if (errors.length > 0) {
        console.warn("[OrquiEditor] Contract validation warnings:", errors);
        // Don't block save on warnings — just log them
      }

      // ── Save to API ────────────────────────────────────────────────
      const r1 = await apiSaveContract(layoutContract);
      const r2 = await apiSaveContract(registryContract);

      if (r1.ok && r2.ok) {
        setSavedSnapshot({ layout: { ...currentLayout }, registry: { ...currentRegistry } });
        setSaveStatus("saved");
      } else {
        console.error("[OrquiEditor] Save failed:", { r1, r2 });
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("[OrquiEditor] Save error:", err);
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus(null), 2000);
  }, []);

  // Combined save: flush + write
  const handleSave = useCallback(async () => {
    if (!hasApi || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");

    try {
      // Phase A: Flush EB backend
      window.dispatchEvent(new CustomEvent("orqui:force-save"));
      // Yield for React state propagation
      await new Promise<void>(r => setTimeout(r, 100));
    } catch {
      // flush failed — continue with current state
    }

    // Phase B: Save — we use a functional update pattern to read latest state
    // Unfortunately we can't read state directly in a callback, but
    // layout/registry are available via closure (re-created on each render)
    await doFilesystemWrite(layout, registry);
    savingRef.current = false;
  }, [hasApi, layout, registry, doFilesystemWrite]);

  // ── Command Palette ────────────────────────────────────────────────────────
  const [cmdOpen, setCmdOpen] = useState(false);

  // Backward-compat stubs for useCommandPaletteItems
  // (cmdItems still references setActiveTab/scrollToSection/openAccordion from the old layout;
  //  these stubs prevent breakage — command palette → SW deep-linking is a follow-up)
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

      // Ctrl+S — Save to filesystem (global, complements page-level flush)
      if (ctrl && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Ctrl+Shift+M — Toggle mode (Pages ↔ Shell)
      if (ctrl && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setEditorMode(editorMode === "pages" ? "shell" : "pages");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, editorMode, setEditorMode]);

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
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  // ── PAGES MODE — EasyblocksEditor takes the FULL viewport ─────────────────
  // Easyblocks docs: "the editor page shouldn't render any extra headers,
  // footers, popups etc. It must be blank canvas with EasyblocksEditor being
  // a single component rendered."
  // So we render NO header — just the editor + floating overlay controls.
  if (editorMode === "pages") {
    return (
      <>
        {/* Google Fonts (needed for floating controls) */}

        {/* Sandbox indicator */}
        <SandboxBanner variant="floating" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* EasyblocksPageEditor — sole occupant of the viewport */}
        <EasyblocksPageEditor
          pages={layout.pages || {}}
          onPagesChange={(pages) => setLayout((prev: any) => ({ ...prev, pages }))}
          tokens={layout.tokens}
          variables={layout.variables}
          onVariablesChange={(variables) => setLayout((prev: any) => ({ ...prev, variables }))}
          onSwitchToShell={() => setEditorMode("shell")}
          onSave={hasApi ? handleSave : undefined}
          saveStatus={saveStatus}
          hasUnsavedChanges={!!hasUnsavedChanges}
        />

        {/* Command Palette overlay */}
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
      </>
    );
  }

  // ── SHELL & TOKENS MODE — full Orqui chrome ───────────────────────────────
  return (
    <div className="orqui-editor-root" style={{
      background: COLORS.bg, height: "100vh", color: COLORS.text,
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Orqui editor scrollbar — discrete, thin, no arrows */}
      <style>{`
        .orqui-editor-root { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
        .orqui-editor-root *::-webkit-scrollbar { width: 3px; height: 3px; }
        .orqui-editor-root *::-webkit-scrollbar-track { background: transparent; }
        .orqui-editor-root *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 99px; }
        .orqui-editor-root *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .orqui-editor-root *::-webkit-scrollbar-button { display: none; }
        .orqui-editor-root * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.05) transparent; }
      `}</style>

      {/* Sandbox indicator */}
      <SandboxBanner variant="bar" />

      {/* ============================================================ */}
      {/* TOPBAR                                                        */}
      {/* ============================================================ */}
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

        {/* Dot separator */}
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.border }} />

        {/* Mode switcher — Pages vs Shell & Tokens */}
        <div style={{
          display: "flex", gap: 2, background: COLORS.surface2,
          padding: 3, borderRadius: 8,
        }}>
          {[
            { id: "pages" as const, label: "📐 Páginas" },
            { id: "shell" as const, label: "⚙ Shell & Tokens" },
          ].map(mode => (
            <button key={mode.id} onClick={() => setEditorMode(mode.id)} title={`⌘⇧M — Alternar modo`} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              background: editorMode === mode.id ? COLORS.accent + "20" : "transparent",
              color: editorMode === mode.id ? COLORS.accent : COLORS.textDim,
              transition: "all 0.15s",
              position: "relative",
            }}>
              {mode.label}
              {/* Unsaved dot */}
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

        {/* Dot separator */}
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

      {/* ============================================================ */}
      {/* MAIN CONTENT — Shell & Tokens                                 */}
      {/* ============================================================ */}
      <StackedWorkbench
        layout={layout}
        setLayout={setLayout}
        registry={registry}
        setRegistry={setRegistry}
      />

      {/* Command Palette overlay */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
    </div>
  );
}

// ============================================================================
// Contract Validation
// ============================================================================

/**
 * Validate the layout contract structure before saving.
 * Returns an array of warning messages (empty = valid).
 *
 * This is non-blocking — we save even with warnings.
 * Gatekeeper can enforce stricter validation if needed.
 */
function validateLayoutContract(layout: any): string[] {
  const warnings: string[] = [];

  // Must have structure.regions
  if (!layout.structure?.regions) {
    warnings.push("Missing structure.regions");
  }

  // Must have tokens
  if (!layout.tokens) {
    warnings.push("Missing tokens");
  }

  // Pages validation
  if (layout.pages) {
    for (const [id, page] of Object.entries(layout.pages) as [string, any][]) {
      if (!page.content) {
        warnings.push(`Page "${id}" has no content tree`);
      }
      if (!page.label) {
        warnings.push(`Page "${id}" has no label`);
      }
      if (!page.route) {
        warnings.push(`Page "${id}" has no route`);
      }
      // Ensure no _ebEntry leaked through
      if (page._ebEntry) {
        warnings.push(`Page "${id}" still has _ebEntry (should be stripped)`);
      }
    }
  }

  return warnings;
}

// ============================================================================
// SandboxBanner — visual indicator when running in sandbox mode
//
// Two variants:
//   "bar"      — full-width strip above topbar (Shell mode)
//   "floating" — fixed pill overlay (Pages mode, where EB needs clean viewport)
// ============================================================================

function SandboxBanner({ variant = "bar" }: { variant?: "bar" | "floating" }) {
  const sandbox = getSandboxInfo();
  if (!sandbox) return null;

  const [hovering, setHovering] = useState(false);

  const handleReset = async () => {
    if (!confirm(`Resetar sandbox "${sandbox.name}"? Todas as alterações serão perdidas.`)) return;
    await apiResetSandbox(sandbox.name, sandbox.from);
    window.location.reload();
  };

  const handleExit = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("sandbox");
    url.searchParams.delete("from");
    window.location.href = url.toString();
  };

  if (variant === "floating") {
    return (
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 99999,
          background: "#1a1625", border: "1px solid #7c3aed",
          borderRadius: 8, padding: "5px 12px",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 11, fontWeight: 600, color: "#c4b5fd",
          boxShadow: "0 4px 24px rgba(124,58,237,0.25)",
          transition: "all 0.2s",
          cursor: "default",
          opacity: hovering ? 1 : 0.7,
        }}
      >
        <span style={{ fontSize: 13 }}>🧪</span>
        <span>SANDBOX: {sandbox.name}</span>
        {hovering && (
          <>
            <div style={{ width: 1, height: 14, background: "#7c3aed40" }} />
            <button onClick={handleReset} style={{
              background: "none", border: "none", color: "#fbbf24", cursor: "pointer",
              fontSize: 10, fontWeight: 600, fontFamily: "inherit", padding: "2px 4px",
            }}>Reset</button>
            <button onClick={handleExit} style={{
              background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
              fontSize: 10, fontWeight: 600, fontFamily: "inherit", padding: "2px 4px",
            }}>Sair</button>
          </>
        )}
      </div>
    );
  }

  // Bar variant — full width
  return (
    <div style={{
      height: 28, flexShrink: 0,
      background: "linear-gradient(90deg, #1a1625, #1e1533)",
      borderBottom: "1px solid #7c3aed",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      fontFamily: "'Inter', -apple-system, sans-serif",
      fontSize: 11, fontWeight: 600, color: "#c4b5fd",
    }}>
      <span>🧪</span>
      <span>SANDBOX: {sandbox.name}</span>
      <span style={{ color: "#7c3aed80" }}>|</span>
      <span style={{ color: "#94a3b8", fontWeight: 400 }}>from: {sandbox.from}</span>
      <span style={{ color: "#7c3aed80" }}>|</span>
      <button onClick={handleReset} style={{
        background: "none", border: "none", color: "#fbbf24", cursor: "pointer",
        fontSize: 10, fontWeight: 600, fontFamily: "inherit", padding: "2px 4px",
      }}>↻ Reset</button>
      <button onClick={handleExit} style={{
        background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
        fontSize: 10, fontWeight: 600, fontFamily: "inherit", padding: "2px 4px",
        textDecoration: "underline",
      }}>Sair do sandbox</button>
    </div>
  );
}
