// ============================================================================
// Extra Layout Component Definitions — Accordion, Sidebar
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

export const accordionDefinition: NoCodeComponentDefinition = {
  id: "OrquiAccordion",
  label: "Accordion",
  type: "item",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "itemsJson",
      type: "string",
      label: "Itens (JSON)",
      defaultValue: JSON.stringify([
        { title: "Seção 1", content: "Conteúdo da seção 1" },
        { title: "Seção 2", content: "Conteúdo da seção 2" },
        { title: "Seção 3", content: "Conteúdo da seção 3" },
      ]),
    },
    { prop: "allowMultiple", type: "boolean", label: "Abrir múltiplos", defaultValue: false },
    {
      prop: "variant",
      type: "select",
      label: "Estilo",
      params: {
        options: [
          { value: "default", label: "Padrão" },
          { value: "bordered", label: "Com borda" },
          { value: "separated", label: "Separado" },
        ],
      },
      defaultValue: "default",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column" as const,
        width: "100%",
      },
    },
  }),
};

export const sidebarDefinition: NoCodeComponentDefinition = {
  id: "OrquiSidebar",
  label: "Sidebar",
  type: "item",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "width",
      type: "select",
      label: "Largura",
      responsive: true,
      params: {
        options: [
          { value: "200px", label: "Estreita (200px)" },
          { value: "256px", label: "Média (256px)" },
          { value: "320px", label: "Larga (320px)" },
        ],
      },
      defaultValue: "256px",
    },
    {
      prop: "position",
      type: "select",
      label: "Posição",
      params: {
        options: [
          { value: "left", label: "Esquerda" },
          { value: "right", label: "Direita" },
        ],
      },
      defaultValue: "left",
    },
    { prop: "background", type: "color", label: "Background" },
    { prop: "collapsible", type: "boolean", label: "Recolhível", defaultValue: false },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 48, label: "Conteúdo da sidebar" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: values.width || "256px",
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        background: values.background || "var(--orqui-surface-2, #1c1c21)",
        borderRight: values.position === "left" ? "1px solid var(--orqui-border, #2a2a33)" : "none",
        borderLeft: values.position === "right" ? "1px solid var(--orqui-border, #2a2a33)" : "none",
        padding: "16px",
        gap: "8px",
        flexShrink: 0,
      },
    },
  }),
};
