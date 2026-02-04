// ============================================================================
// Feedback Component Definitions — Alert, Progress, Spinner, Skeleton
//
// Phase 3: borderRadius tokens on Alert/Skeleton, color on Spinner/Progress,
// space tokens for padding.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";

export const alertDefinition: NoCodeComponentDefinition = {
  id: "OrquiAlert",
  label: "Alert",
  type: "item",
  paletteLabel: "Feedback",
  schema: [
    {
      prop: "variant",
      type: "select",
      label: "Variante",
      params: {
        options: [
          { value: "info", label: "Info" },
          { value: "success", label: "Sucesso" },
          { value: "warning", label: "Atenção" },
          { value: "error", label: "Erro" },
        ],
      },
      defaultValue: "info",
    },
    { prop: "title", type: "string", label: "Título", defaultValue: "Atenção" },
    { prop: "message", type: "string", label: "Mensagem", defaultValue: "Esta é uma mensagem de alerta." },
    { prop: "dismissible", type: "boolean", label: "Dispensável", defaultValue: false },
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
  styles: ({ values }) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      info:    { bg: "rgba(109,156,255,0.08)", border: "rgba(109,156,255,0.3)", text: "#6d9cff" },
      success: { bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.3)",  text: "#4ade80" },
      warning: { bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.3)",  text: "#facc15" },
      error:   { bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
    };
    const c = colorMap[values.variant] || colorMap.info;
    return {
      styled: {
        Root: {
          padding: values.padding || "12px 16px",
          borderRadius: values.borderRadius || "8px",
          border: `1px solid ${c.border}`,
          background: c.bg,
          color: c.text,
          width: "100%",
        },
      },
    };
  },
};

export const progressDefinition: NoCodeComponentDefinition = {
  id: "OrquiProgress",
  label: "Progress",
  type: "item",
  paletteLabel: "Feedback",
  schema: [
    {
      prop: "value",
      type: "select",
      label: "Valor (%)",
      params: {
        options: [
          { value: "0", label: "0%" },
          { value: "10", label: "10%" },
          { value: "25", label: "25%" },
          { value: "33", label: "33%" },
          { value: "50", label: "50%" },
          { value: "66", label: "66%" },
          { value: "75", label: "75%" },
          { value: "90", label: "90%" },
          { value: "100", label: "100%" },
        ],
      },
      defaultValue: "50",
    },
    {
      prop: "variant",
      type: "select",
      label: "Cor",
      params: {
        options: [
          { value: "default", label: "Padrão" },
          { value: "success", label: "Sucesso" },
          { value: "warning", label: "Atenção" },
          { value: "error", label: "Erro" },
        ],
      },
      defaultValue: "default",
    },
    {
      prop: "barColor",
      type: "color",
      label: "Cor da barra",
      group: "Customização",
    },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      params: {
        options: [
          { value: "sm", label: "Pequeno" },
          { value: "md", label: "Médio" },
          { value: "lg", label: "Grande" },
        ],
      },
      defaultValue: "md",
    },
    { prop: "showLabel", type: "boolean", label: "Mostrar percentual", defaultValue: true },
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
        flexDirection: "column",
        gap: "4px",
        width: "100%",
      },
    },
  }),
};

export const spinnerDefinition: NoCodeComponentDefinition = {
  id: "OrquiSpinner",
  label: "Spinner",
  type: "item",
  paletteLabel: "Feedback",
  schema: [
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      params: {
        options: [
          { value: "sm", label: "Pequeno (16px)" },
          { value: "md", label: "Médio (24px)" },
          { value: "lg", label: "Grande (40px)" },
          { value: "xl", label: "Extra grande (56px)" },
        ],
      },
      defaultValue: "md",
    },
    { prop: "color", type: "color", label: "Cor" },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      },
    },
  }),
};

export const skeletonDefinition: NoCodeComponentDefinition = {
  id: "OrquiSkeleton",
  label: "Skeleton",
  type: "item",
  paletteLabel: "Feedback",
  schema: [
    {
      prop: "variant",
      type: "select",
      label: "Variante",
      params: {
        options: [
          { value: "text", label: "Texto" },
          { value: "circular", label: "Circular" },
          { value: "rectangular", label: "Retangular" },
        ],
      },
      defaultValue: "text",
    },
    {
      prop: "width",
      type: "select",
      label: "Largura",
      params: {
        options: [
          { value: "50%", label: "50%" },
          { value: "75%", label: "75%" },
          { value: "100%", label: "100%" },
          { value: "200px", label: "200px" },
          { value: "300px", label: "300px" },
        ],
      },
      defaultValue: "100%",
    },
    {
      prop: "height",
      type: "select",
      label: "Altura",
      params: {
        options: [
          { value: "16px", label: "16px" },
          { value: "24px", label: "24px" },
          { value: "40px", label: "40px" },
          { value: "80px", label: "80px" },
          { value: "120px", label: "120px" },
          { value: "200px", label: "200px" },
        ],
      },
      defaultValue: "16px",
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
        display: "block",
        borderRadius: values.variant === "circular" ? "50%" : (values.borderRadius || "4px"),
      },
    },
  }),
};
