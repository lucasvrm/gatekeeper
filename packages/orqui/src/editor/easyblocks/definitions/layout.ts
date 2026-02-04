// ============================================================================
// Layout Component Definitions — Stack, Row, Grid, Container
//
// FIX: select type uses params: { options: [...] } (not top-level options)
// FIX: space and color are inherently responsive, removed redundant flag
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { ALL_COMPONENT_IDS } from "../types";

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
        flexDirection: "column" as const,
        gap: values.gap,
        width: "100%",
      },
    },
  }),
};

export const rowDefinition: NoCodeComponentDefinition = {
  id: "OrquiRow",
  label: "Row",
  type: "item",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "gap",
      type: "space",
      label: "Gap",
    },
    {
      prop: "align",
      type: "select",
      label: "Alinhamento vertical",
      responsive: true,
      params: {
        options: [
          { value: "stretch", label: "Stretch" },
          { value: "flex-start", label: "Topo" },
          { value: "center", label: "Centro" },
          { value: "flex-end", label: "Base" },
          { value: "baseline", label: "Baseline" },
        ],
      },
      defaultValue: "center",
    },
    {
      prop: "justify",
      type: "select",
      label: "Justificação",
      responsive: true,
      params: {
        options: [
          { value: "flex-start", label: "Início" },
          { value: "center", label: "Centro" },
          { value: "flex-end", label: "Fim" },
          { value: "space-between", label: "Space Between" },
          { value: "space-around", label: "Space Around" },
          { value: "space-evenly", label: "Space Evenly" },
        ],
      },
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
        flexDirection: "row" as const,
        gap: values.gap,
        alignItems: values.align,
        justifyContent: values.justify,
        flexWrap: values.wrap ? ("wrap" as const) : ("nowrap" as const),
        width: "100%",
      },
    },
  }),
};

export const gridDefinition: NoCodeComponentDefinition = {
  id: "OrquiGrid",
  label: "Grid",
  type: "item",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "columns",
      type: "select",
      label: "Colunas",
      responsive: true,
      params: {
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6" },
        ],
      },
      defaultValue: "2",
    },
    {
      prop: "gap",
      type: "space",
      label: "Gap",
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
        width: "100%",
      },
    },
  }),
};

export const containerDefinition: NoCodeComponentDefinition = {
  id: "OrquiContainer",
  label: "Container",
  type: "item",
  paletteLabel: "Layout",
  schema: [
    {
      prop: "padding",
      type: "space",
      label: "Padding",
    },
    {
      prop: "background",
      type: "color",
      label: "Background",
    },
    {
      prop: "borderRadius",
      type: "select",
      label: "Border radius",
      params: {
        options: [
          { value: "0", label: "Nenhum" },
          { value: "4px", label: "sm (4px)" },
          { value: "6px", label: "md (6px)" },
          { value: "8px", label: "lg (8px)" },
          { value: "12px", label: "xl (12px)" },
        ],
      },
      defaultValue: "0",
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
        width: "100%",
      },
    },
  }),
};
