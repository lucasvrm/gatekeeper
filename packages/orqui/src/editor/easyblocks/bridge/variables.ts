// ============================================================================
// Variable Bridge — Orqui Variable Schema → Easyblocks Custom Types
//
// Creates custom type definitions using real @easyblocks/core types:
//   InlineTypeDefinition — for "orqui-template" (inline widget)
//   ExternalTypeDefinition — for "orqui-entity-ref" (external widget)
// ============================================================================

import type { CustomTypeDefinition, InlineTypeDefinition, ExternalTypeDefinition } from "@easyblocks/core";
import type { VariablesSection, VariableInfo, VariableCategory } from "../../page-editor/variableSchema";

// ============================================================================
// Custom Type Definitions
// ============================================================================

const orquiTemplateType: InlineTypeDefinition<string> = {
  type: "inline",
  widget: { id: "orqui-template-picker", label: "Template" },
  defaultValue: "",
  validate: (value: any) => typeof value === "string",
};

const orquiEntityRefType: ExternalTypeDefinition = {
  type: "external",
  widgets: [{ id: "orqui-entity-picker", label: "Campo da entidade" }],
};

/**
 * Returns custom types for Easyblocks Config.types.
 */
export function getOrquiCustomTypes(): Record<string, CustomTypeDefinition> {
  return {
    "orqui-template": orquiTemplateType,
    "orqui-entity-ref": orquiEntityRefType,
  };
}

// ============================================================================
// Widget variable context
// ============================================================================

export interface WidgetVariableContext {
  groups: Array<{ category: VariableCategory; items: VariableInfo[] }>;
  paths: string[];
  mockData: Record<string, any>;
}

export function buildWidgetVariableContext(
  userVars?: VariablesSection,
  externalVars?: VariablesSection,
): WidgetVariableContext {
  const allItems: VariableInfo[] = [
    ...(userVars?.items || []),
    ...(externalVars?.items || []),
  ];

  const seen = new Set<string>();
  const dedupedItems: VariableInfo[] = [];
  for (const item of allItems) {
    if (!seen.has(item.path)) { seen.add(item.path); dedupedItems.push(item); }
  }

  const allCategories: VariableCategory[] = [
    ...(userVars?.categories || []),
    ...(externalVars?.categories || []),
  ];
  const categoryMap = new Map<string, VariableCategory>();
  for (const cat of allCategories) {
    if (!categoryMap.has(cat.id)) categoryMap.set(cat.id, cat);
  }

  const groupMap = new Map<string, VariableInfo[]>();
  for (const item of dedupedItems) {
    if (!groupMap.has(item.category)) groupMap.set(item.category, []);
    groupMap.get(item.category)!.push(item);
  }

  const groups = Array.from(groupMap.entries()).map(([catId, items]) => ({
    category: categoryMap.get(catId) || { id: catId, label: catId, icon: "📦" },
    items,
  }));

  const mockData: Record<string, any> = {};
  for (const item of dedupedItems) {
    setNestedValue(mockData, item.path, item.mockValue);
  }

  return { groups, paths: dedupedItems.map(v => v.path), mockData };
}

function setNestedValue(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== "object") current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}
