// ============================================================================
// Navigation, Input & Special Component Definitions
// Tabs, Search, Select, Slot
//
// Phase 3: color tokens on Search/Select backgrounds, space tokens for gaps,
// borderRadius on Slot/Search/Select.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { THUMB_TABS, THUMB_SEARCH, THUMB_SELECT, THUMB_SLOT } from "./thumbnails";

// ============================================================================
// OrquiTabs — tabbed content
// ============================================================================

export const tabsDefinition: NoCodeComponentDefinition = {
  id: "OrquiTabs",
  thumbnail: THUMB_TABS,
  label: "Tabs",
  type: "item",
  paletteLabel: "Navegação",
  schema: [
    {
      prop: "tabsJson",
      type: "string",
      label: "Tabs (JSON)",
      defaultValue: JSON.stringify([
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ]),
    },
    {
      prop: "defaultTab",
      type: "string",
      label: "Tab padrão",
      defaultValue: "tab1",
    },
    {
      prop: "activeColor",
      type: "color",
      label: "Cor ativa",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
      },
      TabBar: {
        display: "flex",
        gap: "0",
        borderBottom: "1px solid var(--orqui-border, #2a2a33)",
      },
      Tab: {
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 500,
        color: "var(--orqui-text-muted, #8b8b96)",
        cursor: "pointer",
        borderBottom: "2px solid transparent",
        transition: "all 0.15s",
        background: "none",
        border: "none",
      },
      TabActive: {
        color: values.activeColor || "var(--orqui-accent, #6d9cff)",
        borderBottomColor: values.activeColor || "var(--orqui-accent, #6d9cff)",
      },
      Content: {
        padding: "16px 0",
      },
    },
  }),
};

// ============================================================================
// OrquiSearch — search input
// ============================================================================

export const searchDefinition: NoCodeComponentDefinition = {
  id: "OrquiSearch",
  thumbnail: THUMB_SEARCH,
  label: "Busca",
  type: "item",
  paletteLabel: "Inputs",
  schema: [
    {
      prop: "placeholder",
      type: "string",
      label: "Placeholder",
      defaultValue: "Buscar...",
    },
    {
      prop: "background",
      type: "color",
      label: "Background",
      group: "Estilo",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: values.borderRadius || "6px",
        border: "1px solid var(--orqui-input-border, #2a2a33)",
        background: values.background || "var(--orqui-input-bg, #1c1c21)",
        fontSize: "13px",
        color: "var(--orqui-text, #e4e4e7)",
        width: "100%",
      },
      Icon: {
        width: "16px",
        height: "16px",
        color: "var(--orqui-text-dim, #5b5b66)",
        flexShrink: 0,
      },
      Input: {
        background: "none",
        border: "none",
        outline: "none",
        color: "inherit",
        fontSize: "inherit",
        width: "100%",
      },
    },
  }),
};

// ============================================================================
// OrquiSelect — dropdown select
// ============================================================================

export const selectDefinition: NoCodeComponentDefinition = {
  id: "OrquiSelect",
  thumbnail: THUMB_SELECT,
  label: "Select",
  type: "item",
  paletteLabel: "Inputs",
  schema: [
    {
      prop: "placeholder",
      type: "string",
      label: "Placeholder",
      defaultValue: "Selecionar...",
    },
    {
      prop: "optionsJson",
      type: "string",
      label: "Opções (JSON)",
      defaultValue: JSON.stringify([
        { value: "opt1", label: "Opção 1" },
        { value: "opt2", label: "Opção 2" },
      ]),
    },
    {
      prop: "background",
      type: "color",
      label: "Background",
      group: "Estilo",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        padding: "8px 12px",
        borderRadius: values.borderRadius || "6px",
        border: "1px solid var(--orqui-input-border, #2a2a33)",
        background: values.background || "var(--orqui-input-bg, #1c1c21)",
        fontSize: "13px",
        color: "var(--orqui-text, #e4e4e7)",
        width: "100%",
        cursor: "pointer",
        appearance: "none" as const,
      },
    },
  }),
};

// ============================================================================
// OrquiSlot — named slot for custom component injection
// ============================================================================

export const slotDefinition: NoCodeComponentDefinition = {
  id: "OrquiSlot",
  thumbnail: THUMB_SLOT,
  label: "Slot",
  type: "item",
  paletteLabel: "Especial",
  schema: [
    {
      prop: "name",
      type: "string",
      label: "Nome do slot",
      defaultValue: "custom-slot",
    },
    {
      prop: "padding",
      type: "space",
      label: "Padding",
      group: "Estilo",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        border: "2px dashed var(--orqui-border-2, #3a3a45)",
        borderRadius: values.borderRadius || "8px",
        padding: values.padding || "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "64px",
        color: "var(--orqui-text-dim, #5b5b66)",
        fontSize: "12px",
        fontStyle: "italic",
      },
    },
  }),
};
