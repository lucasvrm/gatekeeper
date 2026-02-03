// ============================================================================
// Data Component Definitions — StatCard, Card, Table, List, KeyValue
//
// FIX: select → params: { options: [...] }
// FIX: orqui-template → string (fallback until Phase 5)
// FIX: space doesn't need responsive: true
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

export const statCardDefinition: NoCodeComponentDefinition = {
  id: "OrquiStatCard",
  label: "Stat Card",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    { prop: "label", type: "string", label: "Label", defaultValue: "Métrica" },
    { prop: "value", type: "string", label: "Valor", defaultValue: "0" },
    { prop: "icon", type: "string", label: "Ícone (Phosphor)", defaultValue: "TrendUp" },
    { prop: "trend", type: "string", label: "Trend", group: "Avançado" },
    {
      prop: "trendDirection",
      type: "select",
      label: "Direção do trend",
      params: {
        options: [
          { value: "up", label: "↑ Subindo" },
          { value: "down", label: "↓ Descendo" },
          { value: "neutral", label: "→ Neutro" },
        ],
      },
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
      },
    },
  }),
};

export const cardDefinition: NoCodeComponentDefinition = {
  id: "OrquiCard",
  label: "Card",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    { prop: "title", type: "string", label: "Título", defaultValue: "Card" },
    { prop: "padding", type: "space", label: "Padding" },
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
        padding: values.padding,
      },
    },
  }),
};

export const tableDefinition: NoCodeComponentDefinition = {
  id: "OrquiTable",
  label: "Tabela",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    { prop: "dataSource", type: "string", label: "Data source", defaultValue: "items" },
    {
      prop: "columnsJson",
      type: "string",
      label: "Colunas (JSON)",
      defaultValue: JSON.stringify([
        { key: "col1", label: "Coluna 1", width: "50%" },
        { key: "col2", label: "Coluna 2", width: "50%" },
      ]),
    },
    { prop: "striped", type: "boolean", label: "Linhas alternadas", defaultValue: false, group: "Estilo" },
    { prop: "compact", type: "boolean", label: "Compacto", defaultValue: false, group: "Estilo" },
  ],
  styles: () => ({
    styled: {
      Root: {
        width: "100%",
        border: "1px solid var(--orqui-border, #2a2a33)",
        borderRadius: "8px",
        overflow: "hidden",
      },
    },
  }),
};

export const listDefinition: NoCodeComponentDefinition = {
  id: "OrquiList",
  label: "Lista",
  type: "item",
  paletteLabel: "Dados",
  schema: [
    { prop: "dataSource", type: "string", label: "Data source", defaultValue: "items" },
    {
      prop: "maxItems",
      type: "select",
      label: "Máximo de itens",
      params: {
        options: [
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "20", label: "20" },
          { value: "50", label: "50" },
        ],
      },
      defaultValue: "10",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "1px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--orqui-border, #2a2a33)",
      },
    },
  }),
};

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
      params: {
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      defaultValue: "horizontal",
    },
    {
      prop: "itemsJson",
      type: "string",
      label: "Items (JSON)",
      defaultValue: JSON.stringify([{ label: "Chave", value: "Valor" }]),
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "4px",
      },
    },
  }),
};
