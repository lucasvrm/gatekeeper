import React, { useState, useCallback, useEffect, useRef } from "react";
import { COLORS, s, DEFAULT_LAYOUT, DEFAULT_UI_REGISTRY } from "./lib/constants";
import { computeHash } from "./lib/utils";
import { idbGet, idbSet } from "./lib/indexeddb";
import { apiLoadContracts, apiSaveContract, getSandboxInfo, apiResetSandbox } from "./lib/api";
import { useCommandPaletteItems } from "./hooks/useCommandPaletteItems";
import { CommandPalette } from "./components/CommandPalette";
import { StackedWorkbench } from "./workbench/StackedWorkbench";

// ============================================================================
// OrquiEditor — Shell & Tokens Contract Editor
//
// Simplified version without Easyblocks. Directly opens the StackedWorkbench
// for editing layout structure, tokens, and UI registry.
// ============================================================================

export function OrquiEditor() {
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

  // Visual indicator para mudanças não salvas
  const [showUnsavedIndicator, setShowUnsavedIndicator] = useState(false);
  useEffect(() => {
    setShowUnsavedIndicator(!!hasUnsavedChanges);
  }, [hasUnsavedChanges]);

  const undoChanges = useCallback(() => {
    if (!savedSnapshot) return;
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
  useEffect(() => {
    idbSet("orqui-layout", layout);
  }, [layout]);
  useEffect(() => {
    idbSet("orqui-registry", registry);
  }, [registry]);

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
  // SAVE PIPELINE
  // ══════════════════════════════════════════════════════════════════════════

  const handleSave = useCallback(async () => {
    if (!hasApi || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("saving");

    try {
      // ── Build layout contract ──────────────────────────────────────
      const layoutHash = await computeHash(layout);
      const layoutContract = {
        $orqui: {
          schema: "layout-contract",
          version: "2.0.0",
          hash: layoutHash,
          generatedAt: new Date().toISOString(),
          pageCount: Object.keys(layout.pages || {}).length,
        },
        ...layout,
      };

      // ── Build registry contract ────────────────────────────────────
      const registryHash = await computeHash(registry);
      const registryContract = {
        $orqui: {
          schema: "ui-registry-contract",
          version: "1.0.0",
          hash: registryHash,
          generatedAt: new Date().toISOString(),
        },
        ...registry,
      };

      // ── Validate contract structure ────────────────────────────────
      const errors = validateLayoutContract(layout);
      if (errors.length > 0) {
        console.warn("[OrquiEditor] Contract validation warnings:", errors);
      }

      // ── Save to API ────────────────────────────────────────────────
      const r1 = await apiSaveContract(layoutContract);
      const r2 = await apiSaveContract(registryContract);

      if (r1.ok && r2.ok) {
        setSavedSnapshot({ layout: { ...layout }, registry: { ...registry } });
        setSaveStatus("saved");
      } else {
        console.error("[OrquiEditor] Save failed:", { r1, r2 });
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("[OrquiEditor] Save error:", err);
      setSaveStatus("error");
    }

    savingRef.current = false;
    setTimeout(() => setSaveStatus(null), 2000);
  }, [hasApi, layout, registry]);

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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

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
      <SandboxBanner />

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

        {/* Title */}
        <span style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: 500 }}>
          Shell & Tokens
        </span>

        {/* Unsaved changes indicator */}
        {showUnsavedIndicator && (
          <span style={{
            padding: '2px 8px',
            background: '#f59e0b',
            color: '#000',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
          }}>
            Não salvo ⚠️
          </span>
        )}

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
          {Object.values(layout.structure?.regions || {}).filter((r: any) => r.enabled).length} regions
        </span>
        <span style={{
          ...s.tag, fontSize: 10,
          background: `${COLORS.accent}15`, color: COLORS.accent,
          border: `1px solid ${COLORS.accent}30`,
        }}>
          {Object.keys(registry.components || {}).length} components
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
      {/* MAIN CONTENT — StackedWorkbench                               */}
      {/* ============================================================ */}
      <StackedWorkbench
        layout={layout}
        setLayout={setLayout}
        registry={registry}
        setRegistry={setRegistry}
      />

      {/* Grid Canvas Editor Integration (Fase 2A)
          When implementing grid mode in editor context:

          {mode === 'grid' && (
            <GridCanvas
              layout={state.gridLayout}
              selectedItemId={state.selectedGridItemId}
              onSelectItem={(id) => dispatch({type: 'SELECT_GRID_ITEM', payload: {itemId: id}})}
              onUpdateItem={(id, updates) => {
                if ('colStart' in updates) {
                  dispatch({
                    type: 'UPDATE_GRID_ITEM_POSITION',
                    payload: {itemId: id, colStart: updates.colStart, rowStart: updates.rowStart}
                  });
                } else if ('colSpan' in updates) {
                  dispatch({
                    type: 'UPDATE_GRID_ITEM_SIZE',
                    payload: {itemId: id, colSpan: updates.colSpan, rowSpan: updates.rowSpan}
                  });
                }
              }}
            />
          )}
      */}

      {/* Command Palette overlay */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
    </div>
  );
}

// ============================================================================
// Contract Validation
// ============================================================================

function validateLayoutContract(layout: any): string[] {
  const warnings: string[] = [];

  if (!layout.structure?.regions) {
    warnings.push("Missing structure.regions");
  }

  if (!layout.tokens) {
    warnings.push("Missing tokens");
  }

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
    }
  }

  return warnings;
}

// ============================================================================
// SandboxBanner — visual indicator when running in sandbox mode
// ============================================================================

function SandboxBanner() {
  const sandbox = getSandboxInfo();
  if (!sandbox) return null;

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
