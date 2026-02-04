// ============================================================================
// Navigation Component Definitions — Breadcrumb, Pagination, NavMenu, Link
//
// Phase 3: color tokens on Link/Breadcrumb, space tokens for gaps.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";

export const breadcrumbDefinition: NoCodeComponentDefinition = {
  id: "OrquiBreadcrumb",
  label: "Breadcrumb",
  type: "item",
  paletteLabel: "Navegação",
  schema: [
    {
      prop: "itemsJson",
      type: "string",
      label: "Itens (JSON)",
      defaultValue: JSON.stringify([
        { label: "Início", href: "/" },
        { label: "Seção", href: "/secao" },
        { label: "Página atual" },
      ]),
    },
    {
      prop: "separator",
      type: "select",
      label: "Separador",
      params: {
        options: [
          { value: "/", label: "/" },
          { value: ">", label: ">" },
          { value: "→", label: "→" },
          { value: "·", label: "·" },
        ],
      },
      defaultValue: "/",
    },
    {
      prop: "color",
      type: "color",
      label: "Cor do texto",
      group: "Estilo",
    },
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        alignItems: "center",
        gap: values.gap || "6px",
        fontSize: "13px",
        color: values.color || "var(--orqui-text-muted, #8b8b96)",
      },
    },
  }),
};

export const paginationDefinition: NoCodeComponentDefinition = {
  id: "OrquiPagination",
  label: "Paginação",
  type: "item",
  paletteLabel: "Navegação",
  schema: [
    {
      prop: "totalPages",
      type: "select",
      label: "Total de páginas",
      params: {
        options: [
          { value: "3", label: "3" },
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "20", label: "20" },
          { value: "50", label: "50" },
        ],
      },
      defaultValue: "5",
    },
    {
      prop: "currentPage",
      type: "select",
      label: "Página atual",
      params: {
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
        ],
      },
      defaultValue: "1",
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
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      group: "Estilo",
    },
    {
      prop: "accentColor",
      type: "color",
      label: "Cor ativa",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        alignItems: "center",
        gap: values.gap || "4px",
      },
    },
  }),
};

export const navMenuDefinition: NoCodeComponentDefinition = {
  id: "OrquiMenu",
  label: "Menu",
  type: "item",
  paletteLabel: "Navegação",
  schema: [
    {
      prop: "itemsJson",
      type: "string",
      label: "Itens (JSON)",
      defaultValue: JSON.stringify([
        { label: "Dashboard", href: "/", icon: "House" },
        { label: "Configurações", href: "/config", icon: "Gear" },
        { label: "Perfil", href: "/profile", icon: "User" },
      ]),
    },
    {
      prop: "direction",
      type: "select",
      label: "Direção",
      params: {
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
      defaultValue: "vertical",
    },
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      group: "Estilo",
    },
    {
      prop: "activeColor",
      type: "color",
      label: "Cor do item ativo",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: values.direction === "horizontal" ? "row" as const : "column" as const,
        gap: values.gap || "2px",
        width: values.direction === "vertical" ? "100%" : "auto",
      },
    },
  }),
};

export const linkDefinition: NoCodeComponentDefinition = {
  id: "OrquiLink",
  label: "Link",
  type: "item",
  paletteLabel: "Navegação",
  schema: [
    { prop: "label", type: "string", label: "Texto", defaultValue: "Clique aqui" },
    { prop: "href", type: "string", label: "URL", defaultValue: "#" },
    {
      prop: "target",
      type: "select",
      label: "Abrir em",
      params: {
        options: [
          { value: "_self", label: "Mesma aba" },
          { value: "_blank", label: "Nova aba" },
        ],
      },
      defaultValue: "_self",
    },
    {
      prop: "variant",
      type: "select",
      label: "Estilo",
      params: {
        options: [
          { value: "default", label: "Padrão" },
          { value: "muted", label: "Discreto" },
          { value: "accent", label: "Destaque" },
          { value: "custom", label: "Customizado" },
        ],
      },
      defaultValue: "default",
    },
    {
      prop: "customColor",
      type: "color",
      label: "Cor customizada",
      group: "Customização",
    },
  ],
  editing: ({ values }) => ({
    fields: {
      customColor: { visible: values.variant === "custom" },
    },
  }),
  styles: ({ values }) => {
    const colorMap: Record<string, string> = {
      default: "var(--orqui-accent, #6d9cff)",
      muted: "var(--orqui-text-muted, #8b8b96)",
      accent: "var(--orqui-accent, #6d9cff)",
      custom: values.customColor || "var(--orqui-accent, #6d9cff)",
    };
    return {
      styled: {
        Root: {
          color: colorMap[values.variant] || colorMap.default,
          textDecoration: values.variant === "accent" ? "none" : "underline",
          fontSize: "inherit",
          cursor: "pointer",
          fontWeight: values.variant === "accent" ? 600 : 400,
        },
      },
    };
  },
};
