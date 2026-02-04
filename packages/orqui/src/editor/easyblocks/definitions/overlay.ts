// ============================================================================
// Overlay Component Definitions — Modal, Drawer, Tooltip
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

export const modalDefinition: NoCodeComponentDefinition = {
  id: "OrquiModal",
  label: "Modal",
  type: "item",
  paletteLabel: "Overlay",
  schema: [
    { prop: "title", type: "string", label: "Título", defaultValue: "Título do modal" },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      params: {
        options: [
          { value: "sm", label: "Pequeno (400px)" },
          { value: "md", label: "Médio (560px)" },
          { value: "lg", label: "Grande (720px)" },
          { value: "xl", label: "Extra grande (960px)" },
        ],
      },
      defaultValue: "md",
    },
    { prop: "showClose", type: "boolean", label: "Botão fechar", defaultValue: true },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 80, label: "Conteúdo do modal" },
    },
  ],
  styles: ({ values }) => {
    const widthMap: Record<string, string> = {
      sm: "400px", md: "560px", lg: "720px", xl: "960px",
    };
    return {
      styled: {
        Root: {
          background: "var(--orqui-surface-2, #1c1c21)",
          border: "1px solid var(--orqui-border, #2a2a33)",
          borderRadius: "12px",
          padding: "24px",
          width: widthMap[values.size] || "560px",
          maxWidth: "90vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        },
      },
    };
  },
};

export const drawerDefinition: NoCodeComponentDefinition = {
  id: "OrquiDrawer",
  label: "Drawer",
  type: "item",
  paletteLabel: "Overlay",
  schema: [
    { prop: "title", type: "string", label: "Título", defaultValue: "Painel lateral" },
    {
      prop: "position",
      type: "select",
      label: "Posição",
      params: {
        options: [
          { value: "right", label: "Direita" },
          { value: "left", label: "Esquerda" },
        ],
      },
      defaultValue: "right",
    },
    {
      prop: "width",
      type: "select",
      label: "Largura",
      params: {
        options: [
          { value: "280px", label: "Estreito (280px)" },
          { value: "360px", label: "Médio (360px)" },
          { value: "480px", label: "Largo (480px)" },
        ],
      },
      defaultValue: "360px",
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 80, label: "Conteúdo do drawer" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        background: "var(--orqui-surface-2, #1c1c21)",
        border: "1px solid var(--orqui-border, #2a2a33)",
        borderRadius: values.position === "right" ? "12px 0 0 12px" : "0 12px 12px 0",
        padding: "20px",
        width: values.width || "360px",
        height: "100%",
        display: "flex",
        flexDirection: "column" as const,
        gap: "16px",
      },
    },
  }),
};

export const tooltipDefinition: NoCodeComponentDefinition = {
  id: "OrquiTooltip",
  label: "Tooltip",
  type: "item",
  paletteLabel: "Overlay",
  schema: [
    { prop: "content", type: "string", label: "Conteúdo", defaultValue: "Texto do tooltip" },
    {
      prop: "position",
      type: "select",
      label: "Posição",
      params: {
        options: [
          { value: "top", label: "Acima" },
          { value: "bottom", label: "Abaixo" },
          { value: "left", label: "Esquerda" },
          { value: "right", label: "Direita" },
        ],
      },
      defaultValue: "top",
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 32, label: "Elemento com tooltip" },
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        position: "relative" as const,
        display: "inline-block",
      },
    },
  }),
};
