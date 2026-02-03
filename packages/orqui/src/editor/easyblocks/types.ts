// ============================================================================
// Orqui × Easyblocks — Shared Types
//
// Imports real types from @easyblocks/core and adds Orqui-specific extensions.
// ============================================================================

// Re-export Orqui types that the bridge needs
export type { NodeDef, PageDef } from "../page-editor/nodeDefaults";
export type { VariablesSection, VariableInfo, VariableCategory } from "../page-editor/variableSchema";

// Re-export Easyblocks types we use throughout the integration
export type {
  Config,
  Backend,
  Document,
  NoCodeComponentEntry,
  NoCodeComponentDefinition,
  SchemaProp,
  ConfigTokenValue,
  ConfigDevices,
  CustomTypeDefinition,
  InlineTypeDefinition,
  ExternalTypeDefinition,
  Template,
  UserDefinedTemplate,
  NoCodeComponentStylesFunctionInput,
  NoCodeComponentStylesFunctionResult,
  NoCodeComponentEditingFunctionInput,
  NoCodeComponentEditingFunctionResult,
  ExternalData,
  RequestedExternalData,
  WidgetComponentProps,
  InlineTypeWidgetComponentProps,
} from "@easyblocks/core";

// ============================================================================
// Orqui-specific component type groupings (used in `accepts`)
// ============================================================================

/** Type groups — Easyblocks uses these for slot constraints */
export const ORQUI_TYPE_GROUPS = {
  layout: ["OrquiStack", "OrquiRow", "OrquiGrid", "OrquiContainer"],
  content: ["OrquiHeading", "OrquiText", "OrquiButton", "OrquiBadge", "OrquiIcon", "OrquiImage", "OrquiDivider", "OrquiSpacer"],
  data: ["OrquiStatCard", "OrquiCard", "OrquiTable", "OrquiList", "OrquiKeyValue"],
  navigation: ["OrquiTabs"],
  input: ["OrquiSearch", "OrquiSelect"],
  special: ["OrquiSlot"],
} as const;

/** All component IDs — used as a flat accepts list for unconstrained containers */
export const ALL_COMPONENT_IDS = [
  ...ORQUI_TYPE_GROUPS.layout,
  ...ORQUI_TYPE_GROUPS.content,
  ...ORQUI_TYPE_GROUPS.data,
  ...ORQUI_TYPE_GROUPS.navigation,
  ...ORQUI_TYPE_GROUPS.input,
  ...ORQUI_TYPE_GROUPS.special,
];

// ============================================================================
// Mapping tables
// ============================================================================

/** Orqui node type string → Easyblocks component ID */
export const NODE_TYPE_TO_EB_ID: Record<string, string> = {
  stack: "OrquiStack",
  row: "OrquiRow",
  grid: "OrquiGrid",
  container: "OrquiContainer",
  heading: "OrquiHeading",
  text: "OrquiText",
  button: "OrquiButton",
  badge: "OrquiBadge",
  icon: "OrquiIcon",
  image: "OrquiImage",
  divider: "OrquiDivider",
  spacer: "OrquiSpacer",
  "stat-card": "OrquiStatCard",
  card: "OrquiCard",
  table: "OrquiTable",
  list: "OrquiList",
  "key-value": "OrquiKeyValue",
  tabs: "OrquiTabs",
  search: "OrquiSearch",
  select: "OrquiSelect",
  slot: "OrquiSlot",
};

/** Reverse mapping: Easyblocks component ID → Orqui node type string */
export const EB_ID_TO_NODE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPE_TO_EB_ID).map(([k, v]) => [v, k])
);
