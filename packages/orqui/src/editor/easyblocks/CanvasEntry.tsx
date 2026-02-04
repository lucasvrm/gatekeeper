// ============================================================================
// EasyblocksCanvasEntry — Minimal entry for the Easyblocks canvas iframe
//
// When Easyblocks creates its internal iframe, the iframe loads /__orqui.
// This component renders ONLY the <EasyblocksEditor> which auto-detects
// that it's in child mode and renders <EasyblocksCanvas> instead of the
// full editor UI.
//
// No OrquiEditor shell. No topbar. No data loading. Just the canvas.
//
// The canvas gets everything it needs from window.parent.editorWindowAPI
// (set by the parent EasyblocksEditor instance). The config, components
// map, and widgets are the only things we need to provide.
// ============================================================================

import React from "react";
import { EasyblocksEditor } from "@easyblocks/editor";
import { ORQUI_COMPONENTS } from "./components";
import { ORQUI_WIDGETS } from "./widgets/TemplatePickerWidget";

/**
 * Minimal canvas entry for the Easyblocks iframe.
 *
 * EasyblocksEditor detects it's in child mode (window.parent.isShopstoryEditor)
 * and renders EasyblocksCanvas, which reads everything from the parent window.
 * The config prop is required by TypeScript but ignored in child mode.
 */
export function EasyblocksCanvasEntry() {
  return (
    <div style={{ width: "100vw", minHeight: "100vh", overflow: "auto", background: "#fff" }}>
      <EasyblocksEditor
        config={{
          // Minimal config — child mode gets everything from parent via editorWindowAPI
          backend: {
            documents: {
              get: async () => ({ id: "", version: 0, entry: {} }),
              create: async () => ({ id: "", version: 0, entry: {} }),
              update: async () => ({ id: "", version: 0, entry: {} }),
            },
            templates: {
              get: async () => ({ id: "", label: "", entry: {}, isUserDefined: true as const }),
              getAll: async () => [],
              create: async () => ({ id: "", label: "", entry: {}, isUserDefined: true as const }),
              update: async () => ({ id: "", label: "" }),
              delete: async () => {},
            },
          },
          components: [],
          locales: [{ code: "pt-BR", isDefault: true }],
        } as any}
        components={ORQUI_COMPONENTS}
        widgets={ORQUI_WIDGETS}
      />
    </div>
  );
}
