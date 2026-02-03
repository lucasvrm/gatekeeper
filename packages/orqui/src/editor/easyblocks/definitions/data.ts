// ============================================================================
// Data Component Definitions
// StatCard, Card, Table, List, KeyValue
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

// ============================================================================
// OrquiStatCard — metric card with label, value, icon, trend
// Orqui: { type: "stat-card", props: { label, value, icon } }
// ============================================================================

export const statCardDefinition: NoCodeComponentDefinition = {
  id: "OrquiStatCard",
  label: "Stat Card",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    {
      prop: "label",
      type: "orqui-template",
      label: "Label",
      defaultValue: "Métrica",
    },
    {
      prop: "value",
      type: "orqui-template",
      label: "Valor",
      defaultValue: "0",
    },
    {
      prop: "icon",
      type: "string",
      label: "Ícone (Phosphor)",
      defaultValue: "TrendUp",
    },
    {
      prop: "trend",
      type: "orqui-template",
      label: "Trend",
      group: "Avançado",
    },
    {
      prop: "trendDirection",
      type: "select",
      label: "Direção do trend",
      options: [
        { value: "up", label: "↑ Subindo" },
        { value: "down", label: "↓ Descendo" },
        { value: "neutral", label: "→ Neutro" },
      ],
      defaultValue: "up",
      group: "Avançado",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        background: "var(--orqui-card-bg, #141417)",
        border: "1px solid var(--orqui-card-border, #2a2a33)",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      },
      Label: {
        fontSize: "11px",
        color: "var(--orqui-text-muted, #8b8b96)",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      },
      Value: {
        fontSize: "24px",
        fontWeight: 700,
        color: "var(--orqui-text, #e4e4e7)",
        lineHeight: 1.2,
      },
      IconWrapper: {
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "6px",
        background: "var(--orqui-accent, #6d9cff)15",
      },
    },
  }),
};

// ============================================================================
// OrquiCard — generic card container with title
// Orqui: { type: "card", props: { title, padding }, children: [...] }
// ============================================================================

export const cardDefinition: NoCodeComponentDefinition = {
  id: "OrquiCard",
  label: "Card",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    {
      prop: "title",
      type: "orqui-template",
      label: "Título",
      defaultValue: "Card",
    },
    {
      prop: "padding",
      type: "space",
      label: "Padding",
      responsive: true,
      defaultValue: { tokenId: "md" },
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 48, label: "Conteúdo do card" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        background: "var(--orqui-card-bg, #141417)",
        border: "1px solid var(--orqui-card-border, #2a2a33)",
        borderRadius: "8px",
        overflow: "hidden",
      },
      Header: {
        padding: "12px 16px",
        borderBottom: "1px solid var(--orqui-border, #2a2a33)",
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--orqui-text, #e4e4e7)",
      },
      Body: {
        padding: values.padding,
      },
    },
  }),
};

// ============================================================================
// OrquiTable — data table
// Orqui: { type: "table", props: { dataSource, columns: [{ key, label, width }] } }
//
// Tables are complex — columns are stored as a JSON string in Easyblocks
// and parsed by the React component. The editing function provides a
// custom experience for managing columns.
// ============================================================================

export const tableDefinition: NoCodeComponentDefinition = {
  id: "OrquiTable",
  label: "Tabela",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    {
      prop: "dataSource",
      type: "string",
      label: "Data source",
      defaultValue: "items",
    },
    {
      prop: "columnsJson",
      type: "string",
      label: "Colunas (JSON)",
      defaultValue: JSON.stringify([
        { key: "col1", label: "Coluna 1", width: "50%" },
        { key: "col2", label: "Coluna 2", width: "50%" },
      ]),
      // In Phase 2, this becomes a custom widget with visual column editor
    },
    {
      prop: "striped",
      type: "boolean",
      label: "Linhas alternadas",
      defaultValue: false,
      group: "Estilo",
    },
    {
      prop: "compact",
      type: "boolean",
      label: "Compacto",
      defaultValue: false,
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "13px",
        border: "1px solid var(--orqui-border, #2a2a33)",
        borderRadius: "8px",
        overflow: "hidden",
      },
      HeaderCell: {
        padding: values.compact ? "6px 10px" : "10px 14px",
        textAlign: "left" as const,
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        color: "var(--orqui-text-muted, #8b8b96)",
        borderBottom: "2px solid var(--orqui-border, #2a2a33)",
        background: "var(--orqui-surface-2, #1c1c21)",
      },
      Cell: {
        padding: values.compact ? "6px 10px" : "10px 14px",
        borderBottom: "1px solid var(--orqui-border, #2a2a33)",
        color: "var(--orqui-text, #e4e4e7)",
      },
    },
  }),
};

// ============================================================================
// OrquiList — data list/feed
// Orqui: { type: "list", props: { dataSource, maxItems } }
// ============================================================================

export const listDefinition: NoCodeComponentDefinition = {
  id: "OrquiList",
  label: "Lista",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    {
      prop: "dataSource",
      type: "string",
      label: "Data source",
      defaultValue: "items",
    },
    {
      prop: "maxItems",
      type: "select",
      label: "Máximo de itens",
      options: [
        { value: "5", label: "5" },
        { value: "10", label: "10" },
        { value: "20", label: "20" },
        { value: "50", label: "50" },
        { value: "100", label: "100" },
      ],
      defaultValue: "10",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        gap: "1px",
        background: "var(--orqui-border, #2a2a33)",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--orqui-border, #2a2a33)",
      },
      Item: {
        padding: "10px 14px",
        background: "var(--orqui-surface, #141417)",
        fontSize: "13px",
        color: "var(--orqui-text, #e4e4e7)",
      },
    },
  }),
};

// ============================================================================
// OrquiKeyValue — key-value pair display
// Orqui: { type: "key-value", props: { layout, items: [{ label, value }] } }
//
// Like table columns, items are stored as JSON string.
// Phase 2 provides a custom widget.
// ============================================================================

export const keyValueDefinition: NoCodeComponentDefinition = {
  id: "OrquiKeyValue",
  label: "Key-Value",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    {
      prop: "layout",
      type: "select",
      label: "Layout",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
      defaultValue: "horizontal",
    },
    {
      prop: "itemsJson",
      type: "string",
      label: "Items (JSON)",
      defaultValue: JSON.stringify([
        { label: "Chave", value: "Valor" },
      ]),
    },
  ],
  styles: ({ values }) => {
    const isHorizontal = values.layout === "horizontal";
    return {
      styled: {
        Root: {
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        },
        Pair: {
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          gap: isHorizontal ? "12px" : "2px",
          padding: "6px 0",
          borderBottom: "1px solid var(--orqui-border, #2a2a33)",
          alignItems: isHorizontal ? "center" : "flex-start",
        },
        Label: {
          fontSize: "12px",
          color: "var(--orqui-text-muted, #8b8b96)",
          fontWeight: 500,
          minWidth: isHorizontal ? "120px" : undefined,
          flexShrink: 0,
        },
        Value: {
          fontSize: "13px",
          color: "var(--orqui-text, #e4e4e7)",
        },
      },
    };
  },
};
