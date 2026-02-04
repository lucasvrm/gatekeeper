// ============================================================================
// Content Component Definitions
// Heading, Text, Button, Badge, Icon, Image, Divider, Spacer
//
// Phase 3: color tokens on Heading/Text, font tokens on Heading,
// borderRadius tokens on Button/Image, space tokens on Spacer.
// orqui-template still falls back to string until Phase 5 widget.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";

export const headingDefinition: NoCodeComponentDefinition = {
  id: "OrquiHeading",
  label: "Título",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    {
      prop: "content",
      type: "string",  // was orqui-template — fallback until Phase 5
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
    {
      prop: "color",
      type: "color",
      label: "Cor do texto",
    },
    {
      prop: "font",
      type: "font",
      label: "Fonte",
      group: "Tipografia",
    },
  ],
  styles: ({ values }) => {
    const sizeMap: Record<string, string> = {
      "1": "28px", "2": "22px", "3": "16px",
      "4": "14px", "5": "13px", "6": "11px",
    };
    const weightMap: Record<string, number> = {
      "1": 700, "2": 600, "3": 600,
      "4": 600, "5": 500, "6": 500,
    };

    // Font token overrides individual properties when set
    const fontValue = values.font && typeof values.font === "object" ? values.font : null;

    return {
      styled: {
        Root: {
          fontFamily: fontValue?.fontFamily || "inherit",
          fontSize: fontValue?.fontSize ? `${fontValue.fontSize}px` : (sizeMap[values.level] || "22px"),
          fontWeight: fontValue?.fontWeight || (weightMap[values.level] || 600),
          lineHeight: fontValue?.lineHeight || 1.2,
          letterSpacing: "-0.02em",
          margin: 0,
          color: values.color || "inherit",
        },
      },
      props: {
        as: `h${values.level || 2}`,
      },
    };
  },
};

export const textDefinition: NoCodeComponentDefinition = {
  id: "OrquiText",
  label: "Texto",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    {
      prop: "content",
      type: "string",  // was orqui-template
      label: "Conteúdo",
      defaultValue: "Texto de exemplo",
    },
    {
      prop: "color",
      type: "color",
      label: "Cor do texto",
    },
    {
      prop: "font",
      type: "font",
      label: "Fonte",
      group: "Tipografia",
    },
  ],
  styles: ({ values }) => {
    const fontValue = values.font && typeof values.font === "object" ? values.font : null;
    return {
      styled: {
        Root: {
          fontFamily: fontValue?.fontFamily || "inherit",
          fontSize: fontValue?.fontSize ? `${fontValue.fontSize}px` : "14px",
          fontWeight: fontValue?.fontWeight || 400,
          lineHeight: fontValue?.lineHeight || 1.5,
          color: values.color || "inherit",
          margin: 0,
        },
      },
    };
  },
};

export const buttonDefinition: NoCodeComponentDefinition = {
  id: "OrquiButton",
  label: "Botão",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    {
      prop: "label",
      type: "string",  // was orqui-template
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
          { value: "custom", label: "Customizado" },
        ],
      },
      defaultValue: "primary",
    },
    {
      prop: "customBg",
      type: "color",
      label: "Cor de fundo",
      group: "Customização",
    },
    {
      prop: "customColor",
      type: "color",
      label: "Cor do texto",
      group: "Customização",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
    {
      prop: "icon",
      type: "string",
      label: "Ícone",
      defaultValue: "",
      group: "Avançado",
    },
    {
      prop: "route",
      type: "string",
      label: "Rota",
      defaultValue: "",
      group: "Avançado",
    },
  ],
  editing: ({ values }) => ({
    fields: {
      customBg: { visible: values.variant === "custom" },
      customColor: { visible: values.variant === "custom" },
    },
  }),
  styles: ({ values }: any) => {
    const variants: Record<string, any> = {
      primary: { background: "var(--orqui-accent, #6d9cff)", color: "#fff", border: "none" },
      secondary: { background: "var(--orqui-surface-2, #1c1c21)", color: "var(--orqui-text, #e4e4e7)", border: "1px solid var(--orqui-border, #2a2a33)" },
      outline: { background: "transparent", color: "var(--orqui-text, #e4e4e7)", border: "1px solid var(--orqui-border, #2a2a33)" },
      ghost: { background: "transparent", color: "var(--orqui-text-muted, #8b8b96)", border: "none" },
      destructive: { background: "var(--orqui-danger, #ff6b6b)", color: "#fff", border: "none" },
      custom: {
        background: values.customBg || "var(--orqui-accent, #6d9cff)",
        color: values.customColor || "#fff",
        border: "none",
      },
    };
    const variantStyle = variants[values.variant] || variants.primary;
    return {
      styled: {
        Root: {
          ...variantStyle,
          padding: "8px 16px",
          borderRadius: values.borderRadius || "6px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        },
      },
    };
  },
};

export const badgeDefinition: NoCodeComponentDefinition = {
  id: "OrquiBadge",
  label: "Badge",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    {
      prop: "content",
      type: "string",  // was orqui-template
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
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
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
          padding: "2px 8px",
          borderRadius: values.borderRadius || "4px",
          fontSize: "11px", fontWeight: 600,
          display: "inline-block", lineHeight: 1.5,
        },
      },
    };
  },
};

export const iconDefinition: NoCodeComponentDefinition = {
  id: "OrquiIcon",
  label: "Ícone",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    { prop: "name", type: "string", label: "Nome (Phosphor)", defaultValue: "Star" },
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
          { value: "48", label: "48px" },
        ],
      },
      defaultValue: "20",
    },
    {
      prop: "color",
      type: "color",
      label: "Cor",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: `${values.size}px`, height: `${values.size}px`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: values.color || "inherit",
        flexShrink: 0,
      },
    },
  }),
};

export const imageDefinition: NoCodeComponentDefinition = {
  id: "OrquiImage",
  label: "Imagem",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    { prop: "src", type: "string", label: "URL da imagem", defaultValue: "" },
    { prop: "alt", type: "string", label: "Alt text", defaultValue: "imagem" },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      responsive: true,
      params: {
        options: [
          { value: "24", label: "24px" },
          { value: "32", label: "32px" },
          { value: "48", label: "48px" },
          { value: "64", label: "64px" },
          { value: "96", label: "96px" },
          { value: "128", label: "128px" },
        ],
      },
      defaultValue: "48",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: `${values.size}px`, height: `${values.size}px`,
        borderRadius: values.borderRadius || "4px",
        flexShrink: 0,
      },
    },
  }),
};

export const dividerDefinition: NoCodeComponentDefinition = {
  id: "OrquiDivider",
  label: "Divisor",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    { prop: "color", type: "color", label: "Cor" },
    {
      prop: "lineStyle",
      type: "select",
      label: "Estilo",
      params: {
        options: [
          { value: "solid", label: "Sólido" },
          { value: "dashed", label: "Tracejado" },
          { value: "dotted", label: "Pontilhado" },
        ],
      },
      defaultValue: "solid",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        borderTop: `1px ${values.lineStyle || "solid"} ${values.color || "#2a2a33"}`,
        width: "100%", height: 0, margin: 0,
      },
    },
  }),
};

export const spacerDefinition: NoCodeComponentDefinition = {
  id: "OrquiSpacer",
  label: "Espaço",
  type: "item",
  paletteLabel: "Conteúdo",
  schema: [
    { prop: "size", type: "space", label: "Tamanho" },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: { height: values.size || "24px", width: "100%", flexShrink: 0 },
    },
  }),
};
