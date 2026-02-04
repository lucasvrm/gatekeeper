import React, { useState, useCallback, useEffect } from "react";
import { COLORS, s, DEFAULT_LAYOUT, DEFAULT_UI_REGISTRY } from "./lib/constants";
import { computeHash } from "./lib/utils";
import { idbGet, idbSet } from "./lib/indexeddb";
import { apiLoadContracts, apiSaveContract } from "./lib/api";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { CommandPalette } from "./components/CommandPalette";
import { PageEditor } from "./page-editor/PageEditor";
import { StackedWorkbench } from "./workbench/StackedWorkbench";
import { EasyblocksPageEditor, invalidateAllEntries } from "./easyblocks";

// ============================================================================
// OrquiEditor — top-level mode switcher + topbar
// Pages mode: DnD builder (intocável)
// Shell & Tokens mode: Stacked Workbench (IDE-like layout)
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
  useEffect(() => { idbSet("orqui-layout", layout); }, [layout]);
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

  // ── Save to Filesystem ─────────────────────────────────────────────────────
  const saveToFilesystem = useCallback(async () => {
    if (!hasApi) return;
    setSaveStatus("saving");
    const layoutHash = await computeHash(layout);
    const layoutContract = {
      $orqui: { schema: "layout-contract", version: "1.0.0", hash: layoutHash, generatedAt: new Date().toISOString() },
      ...layout,
    };
    const registryHash = await computeHash(registry);
    const registryContract = {
      $orqui: { schema: "ui-registry-contract", version: "1.0.0", hash: registryHash, generatedAt: new Date().toISOString() },
      ...registry,
    };
    const r1 = await apiSaveContract(layoutContract);
    const r2 = await apiSaveContract(registryContract);
    if (r1.ok && r2.ok) {
      setSavedSnapshot({ layout: { ...layout }, registry: { ...registry } });
    }
    setSaveStatus(r1.ok && r2.ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [layout, registry, hasApi]);

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
        // Emit force-save for pages editor (flushes backend debounce)
        window.dispatchEvent(new CustomEvent("orqui:force-save"));
        // Also trigger filesystem save
        saveToFilesystem();
      }

      // Ctrl+Shift+M — Toggle mode (Pages ↔ Shell)
      if (ctrl && e.shiftKey && e.key === "M") {
        e.preventDefault();
        setEditorMode(editorMode === "pages" ? "shell" : "pages");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveToFilesystem, editorMode, setEditorMode]);

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* EasyblocksPageEditor — sole occupant of the viewport */}
        <EasyblocksPageEditor
          pages={layout.pages || {}}
          onPagesChange={(pages) => setLayout((prev: any) => ({ ...prev, pages }))}
          tokens={layout.tokens}
          variables={layout.variables}
          onVariablesChange={(variables) => setLayout((prev: any) => ({ ...prev, variables }))}
          onSwitchToShell={() => setEditorMode("shell")}
          onSave={hasApi ? saveToFilesystem : undefined}
          saveStatus={saveStatus}
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
          <button onClick={saveToFilesystem} disabled={saveStatus === "saving"} title="⌘S — Salvar no projeto" style={{
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
