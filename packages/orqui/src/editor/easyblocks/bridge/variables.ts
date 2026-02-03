// ============================================================================
// Variable Bridge — Orqui Variable Schema → Easyblocks Custom Types
//
// The Orqui template engine ({{entity.field | pipe:arg}}) is a CORE
// differentiator. It must be fully preserved in the Easyblocks integration.
//
// Strategy:
// 1. Define a custom Easyblocks type "orqui-template" (inline, with widget)
// 2. The widget wraps the existing TemplateField component
// 3. Variables from orqui.variables.json are exposed as autocomplete data
// 4. The resolved template values are passed to React components as strings
//
// This bridge does NOT attempt to convert to Easyblocks' external data model.
// Templates remain Orqui strings ("{{run.status | badge}}") stored directly
// in the NoCode Entry props.
// ============================================================================

import type { EasyblocksCustomType } from "../types";
import type { VariablesSection, VariableInfo, VariableCategory } from "../../page-editor/variableSchema";

// ============================================================================
// Custom Type Definitions for Easyblocks Config.types
// ============================================================================

/**
 * Custom type for Orqui template expressions.
 * String fields that support {{entity.field | pipe}} syntax.
 *
 * The widget ID "orqui-template-picker" maps to the TemplatePickerWidget
 * component that wraps the existing TemplateField.
 */
export const orquiTemplateType: EasyblocksCustomType = {
  type: "inline",
  widget: {
    id: "orqui-template-picker",
    label: "Template",
  },
  defaultValue: "",
  validate(value: unknown) {
    return typeof value === "string";
  },
};

/**
 * Custom type for entity field references.
 * Used when a prop should be bound to a specific entity field path.
 *
 * The widget ID "orqui-entity-picker" maps to the EntityPickerWidget
 * that provides a hierarchical variable browser.
 */
export const orquiEntityRefType: EasyblocksCustomType = {
  type: "external",
  widgets: [{
    id: "orqui-entity-picker",
    label: "Campo da entidade",
  }],
};

/**
 * Returns all custom types to register in Easyblocks Config.types.
 */
export function getOrquiCustomTypes(): Record<string, EasyblocksCustomType> {
  return {
    "orqui-template": orquiTemplateType,
    "orqui-entity-ref": orquiEntityRefType,
  };
}

// ============================================================================
// Variable Context — prepare variable data for the editor widgets
// ============================================================================

/** Flattened variable info for widget autocomplete */
export interface WidgetVariableContext {
  /** All available variables, grouped by category */
  groups: Array<{
    category: VariableCategory;
    items: VariableInfo[];
  }>;
  /** Flat list of all variable paths (for quick search) */
  paths: string[];
  /** Mock data object for template preview */
  mockData: Record<string, any>;
}

/**
 * Build the variable context that widgets need for autocomplete and preview.
 *
 * @param userVars - User-defined variables from the contract
 * @param externalVars - External variables provided by consumer
 * @returns Context object for the TemplatePickerWidget
 */
export function buildWidgetVariableContext(
  userVars?: VariablesSection,
  externalVars?: VariablesSection,
): WidgetVariableContext {
  // Import from variableSchema to merge
  const allItems: VariableInfo[] = [
    ...(userVars?.items || []).map(v => ({ ...v, source: "user" as const })),
    ...(externalVars?.items || []).map(v => ({ ...v, source: "external" as const })),
  ];

  // Dedupe by path (user wins)
  const seen = new Set<string>();
  const dedupedItems: VariableInfo[] = [];
  for (const item of allItems) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      dedupedItems.push(item);
    }
  }

  // Build category groups
  const allCategories: VariableCategory[] = [
    ...(userVars?.categories || []),
    ...(externalVars?.categories || []),
  ];
  const categoryMap = new Map<string, VariableCategory>();
  for (const cat of allCategories) {
    if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, cat);
  }

  // Group items by category
  const groupMap = new Map<string, VariableInfo[]>();
  for (const item of dedupedItems) {
    if (!groupMap.has(item.category)) groupMap.set(item.category, []);
    groupMap.get(item.category)!.push(item);
  }

  const groups = Array.from(groupMap.entries()).map(([catId, items]) => ({
    category: categoryMap.get(catId) || { id: catId, label: catId, icon: "📦" },
    items,
  }));

  // Build mock data
  const mockData: Record<string, any> = {};
  for (const item of dedupedItems) {
    setNestedValue(mockData, item.path, item.mockValue);
  }

  return {
    groups,
    paths: dedupedItems.map(v => v.path),
    mockData,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function setNestedValue(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}
