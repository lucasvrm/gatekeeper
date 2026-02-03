// ============================================================================
// Layout Component Definitions — Stack, Row, Grid, Container
// These are the 4 container types that accept children via component-collection
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

// ============================================================================
// OrquiStack — vertical flex container
// Orqui equivalent: { type: "stack", props: { gap } }
// ============================================================================

export const stackDefinition: NoCodeComponentDefinition = {
  id: "OrquiStack",
  label: "Stack",
  type: "section",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      responsive: true,
      defaultValue: { tokenId: "md" },
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 48, label: "Adicionar elemento" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        gap: values.gap,
        width: "100%",
      },
    },
  }),
};

// ============================================================================
// OrquiRow — horizontal flex container
// Orqui equivalent: { type: "row", props: { gap, align, justify, wrap } }
// ============================================================================

export const rowDefinition: NoCodeComponentDefinition = {
  id: "OrquiRow",
  label: "Row",
  type: "section",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      responsive: true,
      defaultValue: { tokenId: "sm" },
    },
    {
      prop: "align",
      type: "select",
      label: "Alinhamento vertical",
      responsive: true,
      options: [
        { value: "stretch", label: "Stretch" },
        { value: "flex-start", label: "Topo" },
        { value: "center", label: "Centro" },
        { value: "flex-end", label: "Base" },
        { value: "baseline", label: "Baseline" },
      ],
      defaultValue: "center",
    },
    {
      prop: "justify",
      type: "select",
      label: "Justificação",
      responsive: true,
      options: [
        { value: "flex-start", label: "Início" },
        { value: "center", label: "Centro" },
        { value: "flex-end", label: "Fim" },
        { value: "space-between", label: "Space Between" },
        { value: "space-around", label: "Space Around" },
        { value: "space-evenly", label: "Space Evenly" },
      ],
      defaultValue: "flex-start",
    },
    {
      prop: "wrap",
      type: "boolean",
      label: "Wrap",
      responsive: true,
      defaultValue: false,
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 48, width: 120, label: "Adicionar" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "row",
        gap: values.gap,
        alignItems: values.align,
        justifyContent: values.justify,
        flexWrap: values.wrap ? "wrap" : "nowrap",
        width: "100%",
      },
    },
  }),
};

// ============================================================================
// OrquiGrid — CSS grid container
// Orqui equivalent: { type: "grid", props: { columns, gap, columnGap, rowGap } }
// ============================================================================

export const gridDefinition: NoCodeComponentDefinition = {
  id: "OrquiGrid",
  label: "Grid",
  type: "section",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "columns",
      type: "select",
      label: "Colunas",
      responsive: true,
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
        { value: "4", label: "4" },
        { value: "5", label: "5" },
        { value: "6", label: "6" },
        { value: "8", label: "8" },
        { value: "12", label: "12" },
      ],
      defaultValue: "2",
    },
    {
      prop: "gap",
      type: "space",
      label: "Gap",
      responsive: true,
      defaultValue: { tokenId: "md" },
    },
    {
      prop: "columnGap",
      type: "space",
      label: "Column gap",
      responsive: true,
      group: "Avançado",
    },
    {
      prop: "rowGap",
      type: "space",
      label: "Row gap",
      responsive: true,
      group: "Avançado",
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 64, label: "Célula" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "grid",
        gridTemplateColumns: `repeat(${values.columns || 2}, 1fr)`,
        gap: values.gap,
        ...(values.columnGap ? { columnGap: values.columnGap } : {}),
        ...(values.rowGap ? { rowGap: values.rowGap } : {}),
        width: "100%",
      },
    },
  }),
};

// ============================================================================
// OrquiContainer — generic wrapper with padding, bg, border-radius
// Orqui equivalent: { type: "container", props: { padding } }
// ============================================================================

export const containerDefinition: NoCodeComponentDefinition = {
  id: "OrquiContainer",
  label: "Container",
  type: "section",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "padding",
      type: "space",
      label: "Padding",
      responsive: true,
      defaultValue: { tokenId: "md" },
    },
    {
      prop: "background",
      type: "color",
      label: "Background",
      responsive: true,
    },
    {
      prop: "borderRadius",
      type: "select",
      label: "Border radius",
      options: [
        { value: "0", label: "Nenhum" },
        { value: "4px", label: "sm (4px)" },
        { value: "6px", label: "md (6px)" },
        { value: "8px", label: "lg (8px)" },
        { value: "12px", label: "xl (12px)" },
      ],
      defaultValue: "0",
    },
    {
      prop: "maxWidth",
      type: "string",
      label: "Max width",
      group: "Avançado",
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 48, label: "Conteúdo" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        padding: values.padding,
        background: values.background,
        borderRadius: values.borderRadius || undefined,
        maxWidth: values.maxWidth || undefined,
        width: "100%",
      },
    },
  }),
};
