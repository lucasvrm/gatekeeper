// ============================================================================
// Content Component Definitions
// Heading, Text, Button, Badge, Icon, Image, Divider, Spacer
// ============================================================================

import type { NoCodeComponentDefinition } from "@easyblocks/core";

// ============================================================================
// OrquiHeading
// ============================================================================

export const headingDefinition: NoCodeComponentDefinition = {
  id: "OrquiHeading",
  label: "Título",
  type: "item",
  schema: [
    {
      prop: "content",
      type: "orqui-template",
      label: "Conteúdo",
      defaultValue: "Título",
    },
    {
      prop: "level",
      type: "select",
      label: "Nível",
      params: {
        options: [
          { value: "1", label: "H1" },
          { value: "2", label: "H2" },
          { value: "3", label: "H3" },
          { value: "4", label: "H4" },
          { value: "5", label: "H5" },
          { value: "6", label: "H6" },
        ],
      },
      defaultValue: "2",
    },
  ],
  styles: ({ values }) => {
    const sizeMap: Record<string, string> = {
      "1": "28px", "2": "22px", "3": "16px", "4": "14px", "5": "13px", "6": "11px",
    };
    return {
      styled: {
        Root: {
          fontSize: sizeMap[values.level] || "22px",
          fontWeight: values.level <= "2" ? 700 : 600,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "inherit",
        },
      },
      props: { as: `h${values.level || 2}` },
    };
  },
};

// ============================================================================
// OrquiText
// ============================================================================

export const textDefinition: NoCodeComponentDefinition = {
  id: "OrquiText",
  label: "Texto",
  type: "item",
  schema: [
    {
      prop: "content",
      type: "orqui-template",
      label: "Conteúdo",
      defaultValue: "Texto de exemplo",
    },
  ],
  styles: () => ({
    styled: {
      Root: { fontSize: "14px", lineHeight: 1.5, color: "inherit", margin: 0 },
    },
  }),
};

// ============================================================================
// OrquiButton
// ============================================================================

export const buttonDefinition: NoCodeComponentDefinition = {
  id: "OrquiButton",
  label: "Botão",
  type: "item",
  schema: [
    {
      prop: "label",
      type: "orqui-template",
      label: "Label",
      defaultValue: "Botão",
    },
    {
      prop: "variant",
      type: "select",
      label: "Variante",
      params: {
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
          { value: "outline", label: "Outline" },
          { value: "ghost", label: "Ghost" },
          { value: "destructive", label: "Destructive" },
        ],
      },
      defaultValue: "primary",
    },
    {
      prop: "icon",
      type: "string",
      label: "Ícone",
      defaultValue: "",
    },
    {
      prop: "route",
      type: "string",
      label: "Rota",
      defaultValue: "",
    },
  ],
  styles: ({ values }) => {
    const variants: Record<string, Record<string, string>> = {
      primary: { background: "var(--orqui-accent, #6d9cff)", color: "#fff", border: "none" },
      secondary: { background: "var(--orqui-surface-2, #1c1c21)", color: "var(--orqui-text, #e4e4e7)", border: "1px solid var(--orqui-border, #2a2a33)" },
      outline: { background: "transparent", color: "var(--orqui-text, #e4e4e7)", border: "1px solid var(--orqui-border, #2a2a33)" },
      ghost: { background: "transparent", color: "var(--orqui-text-muted, #8b8b96)", border: "none" },
      destructive: { background: "var(--orqui-danger, #ff6b6b)", color: "#fff", border: "none" },
    };
    return {
      styled: {
        Root: {
          ...(variants[values.variant] || variants.primary),
          padding: "8px 16px", borderRadius: "6px", fontSize: "13px",
          fontWeight: 600, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "6px",
        },
      },
    };
  },
};

// ============================================================================
// OrquiBadge
// ============================================================================

export const badgeDefinition: NoCodeComponentDefinition = {
  id: "OrquiBadge",
  label: "Badge",
  type: "item",
  schema: [
    {
      prop: "content",
      type: "orqui-template",
      label: "Conteúdo",
      defaultValue: "Status",
    },
    {
      prop: "color",
      type: "select",
      label: "Cor",
      params: {
        options: [
          { value: "accent", label: "Accent" },
          { value: "success", label: "Success" },
          { value: "danger", label: "Danger" },
          { value: "warning", label: "Warning" },
          { value: "muted", label: "Muted" },
        ],
      },
      defaultValue: "accent",
    },
  ],
  styles: ({ values }) => {
    const colorMap: Record<string, { bg: string; fg: string }> = {
      accent: { bg: "rgba(109,156,255,0.15)", fg: "#6d9cff" },
      success: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
      danger: { bg: "rgba(255,107,107,0.15)", fg: "#ff6b6b" },
      warning: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
      muted: { bg: "rgba(139,139,150,0.15)", fg: "#8b8b96" },
    };
    const c = colorMap[values.color] || colorMap.accent;
    return {
      styled: {
        Root: {
          background: c.bg, color: c.fg,
          padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
          fontWeight: 600, display: "inline-block", lineHeight: 1.5,
        },
      },
    };
  },
};

// ============================================================================
// OrquiIcon
// ============================================================================

export const iconDefinition: NoCodeComponentDefinition = {
  id: "OrquiIcon",
  label: "Ícone",
  type: "item",
  schema: [
    {
      prop: "name",
      type: "string",
      label: "Nome (Phosphor)",
      defaultValue: "Star",
    },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      responsive: true,
      params: {
        options: [
          { value: "12", label: "12px" },
          { value: "16", label: "16px" },
          { value: "20", label: "20px" },
          { value: "24", label: "24px" },
          { value: "32", label: "32px" },
        ],
      },
      defaultValue: "20",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: `${values.size}px`, height: `${values.size}px`,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      },
    },
  }),
};

// ============================================================================
// OrquiImage
// ============================================================================

export const imageDefinition: NoCodeComponentDefinition = {
  id: "OrquiImage",
  label: "Imagem",
  type: "item",
  schema: [
    { prop: "src", type: "string", label: "URL", defaultValue: "" },
    { prop: "alt", type: "string", label: "Alt text", defaultValue: "imagem" },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      responsive: true,
      params: {
        options: [
          { value: "32", label: "32px" },
          { value: "48", label: "48px" },
          { value: "64", label: "64px" },
          { value: "96", label: "96px" },
          { value: "128", label: "128px" },
        ],
      },
      defaultValue: "48",
    },
    { prop: "rounded", type: "boolean", label: "Arredondado", defaultValue: false },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: `${values.size}px`, height: `${values.size}px`,
        borderRadius: values.rounded ? "9999px" : "4px",
        objectFit: "cover", flexShrink: 0,
      },
    },
  }),
};

// ============================================================================
// OrquiDivider
// ============================================================================

export const dividerDefinition: NoCodeComponentDefinition = {
  id: "OrquiDivider",
  label: "Divisor",
  type: "item",
  schema: [
    { prop: "color", type: "color", label: "Cor" },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        borderTop: `1px solid ${values.color || "#2a2a33"}`,
        width: "100%", height: 0, margin: 0,
      },
    },
  }),
};

// ============================================================================
// OrquiSpacer
// ============================================================================

export const spacerDefinition: NoCodeComponentDefinition = {
  id: "OrquiSpacer",
  label: "Espaço",
  type: "item",
  schema: [
    { prop: "size", type: "space", label: "Tamanho" },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: { height: values.size || "24px", width: "100%", flexShrink: 0 },
    },
  }),
};
