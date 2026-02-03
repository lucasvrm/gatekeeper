// ============================================================================
// Page Editor — Public API
// ============================================================================

// Components
export { PageEditor } from "./PageEditor";
export { PageEditorProvider, usePageEditor } from "./PageEditorProvider";
export { VariablesProvider, useVariables } from "./VariablesContext";
export { LeftPanel } from "./LeftPanel";
export { StructureTree } from "./StructureTree";
export { PagePresets } from "./PagePresets";
export { VariableEditor } from "./VariableEditor";
export { TemplateField } from "./TemplateField";

// Template engine
export { parseTemplate, hasTemplateExpr, resolveTemplate, getDisplayHint, FORMATTERS, FORMATTER_CATEGORIES } from "./templateEngine";
export type { TemplateToken, FormatterInfo } from "./templateEngine";

// Variable schema
export {
  mergeVariables, buildMockData, searchVariables, getVariableInfo,
  groupByCategory, typeIcon, formatMock, defaultMockValue, EMPTY_VARIABLES,
} from "./variableSchema";
export type { VariableInfo, VariableCategory, VariablesSection, MergedVariables } from "./variableSchema";

// Types
export type { DragSource, DropTarget } from "./PageEditorProvider";
export type { NodeDef, PageDef, NodeTypeMeta } from "./nodeDefaults";

// Node catalog
export { NODE_CATALOG, CATEGORIES, createDefaultNode, createDefaultPage, isContainerType, getNodeMeta } from "./nodeDefaults";

// Tree utilities
export { findNode, findParent, flattenTree } from "./treeUtils";
