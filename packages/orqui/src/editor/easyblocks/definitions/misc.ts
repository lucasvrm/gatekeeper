// ============================================================================
// Navigation, Input & Special — Tabs, Search, Select, Slot
// ============================================================================

import type { NoCodeComponentDefinition } from "@easyblocks/core";

export const tabsDefinition: NoCodeComponentDefinition = {
  id: "OrquiTabs",
  label: "Tabs",
  type: "item",
  schema: [
    { prop: "tabsJson", type: "string", label: "Tabs (JSON)", defaultValue: JSON.stringify([{ id: "tab1", label: "Tab 1" }, { id: "tab2", label: "Tab 2" }]) },
    { prop: "defaultTab", type: "string", label: "Tab padrão", defaultValue: "tab1" },
  ],
  styles: () => ({
    styled: {
      Root: { display: "flex", flexDirection: "column", width: "100%" },
      TabBar: { display: "flex", gap: "0", borderBottom: "1px solid var(--orqui-border, #2a2a33)" },
      Tab: { padding: "8px 16px", fontSize: "13px", fontWeight: 500, color: "var(--orqui-text-muted, #8b8b96)", cursor: "pointer", borderBottom: "2px solid transparent", background: "none", border: "none" },
      TabActive: { color: "var(--orqui-accent, #6d9cff)", borderBottomColor: "var(--orqui-accent, #6d9cff)" },
      Content: { padding: "16px 0" },
    },
  }),
};

export const searchDefinition: NoCodeComponentDefinition = {
  id: "OrquiSearch",
  label: "Busca",
  type: "item",
  schema: [
    { prop: "placeholder", type: "string", label: "Placeholder", defaultValue: "Buscar..." },
  ],
  styles: () => ({
    styled: {
      Root: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--orqui-border, #2a2a33)", background: "var(--orqui-surface-2, #1c1c21)", fontSize: "13px", color: "var(--orqui-text, #e4e4e7)", width: "100%" },
      Icon: { width: "16px", height: "16px", color: "var(--orqui-text-dim, #5b5b66)", flexShrink: 0 },
      Input: { background: "none", border: "none", outline: "none", color: "inherit", fontSize: "inherit", width: "100%" },
    },
  }),
};

export const selectDefinition: NoCodeComponentDefinition = {
  id: "OrquiSelect",
  label: "Select",
  type: "item",
  schema: [
    { prop: "placeholder", type: "string", label: "Placeholder", defaultValue: "Selecionar..." },
    { prop: "optionsJson", type: "string", label: "Opções (JSON)", defaultValue: JSON.stringify([{ value: "opt1", label: "Opção 1" }, { value: "opt2", label: "Opção 2" }]) },
  ],
  styles: () => ({
    styled: {
      Root: { padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--orqui-border, #2a2a33)", background: "var(--orqui-surface-2, #1c1c21)", fontSize: "13px", color: "var(--orqui-text, #e4e4e7)", width: "100%" },
    },
  }),
};

export const slotDefinition: NoCodeComponentDefinition = {
  id: "OrquiSlot",
  label: "Slot",
  type: "item",
  schema: [
    { prop: "name", type: "string", label: "Nome do slot", defaultValue: "custom-slot" },
  ],
  styles: () => ({
    styled: {
      Root: { border: "2px dashed var(--orqui-border-2, #3a3a45)", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "64px", color: "var(--orqui-text-dim, #5b5b66)", fontSize: "12px", fontStyle: "italic" },
    },
  }),
};
