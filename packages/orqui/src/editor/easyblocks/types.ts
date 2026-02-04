// ============================================================================
// Orqui × Easyblocks — Shared Types
// ============================================================================

// Re-export Orqui types that the bridge needs
export type { NodeDef, PageDef } from "../page-editor/nodeDefaults";
export type { VariablesSection, VariableInfo, VariableCategory } from "../page-editor/variableSchema";

// ============================================================================
// Easyblocks type stubs
// Until @easyblocks/core is installed, these mirror the shapes we need.
// Replace with `import type { ... } from "@easyblocks/core"` after install.
// ============================================================================

/** Schema property definition for a No-Code Component */
export interface SchemaProp {
  prop: string;
  type: string;
  label?: string;
  responsive?: boolean;
  required?: boolean;
  defaultValue?: unknown;
  /** For `select` type — Easyblocks requires options inside params */
  params?: { options: Array<{ value: string; label: string }> | string[] };
  /** @deprecated use params.options */
  options?: Array<{ value: string; label: string }> | string[];
  /** For `component` / `component-collection` */
  accepts?: string[];
  /** For `component-collection` */
  placeholderAppearance?: {
    height?: number;
    width?: number;
    label?: string;
  };
  /** Easyblocks: when true, passed to styles/editing but NOT to React component */
  buildOnly?: boolean;
  /** Group in the sidebar */
  group?: string;
}

/** The styles function receives resolved prop values and returns CSS for styled slots */
export interface StylesFunctionArgs {
  values: Record<string, any>;
  params: Record<string, any>;
  isEditing: boolean;
  device: { id: string; w: number; h?: number };
}

export type StylesFunctionResult = {
  styled: Record<string, React.CSSProperties>;
  props?: Record<string, any>;
  components?: Record<string, Record<string, any>>;
};

/** The editing function controls sidebar/canvas behavior */
export interface EditingFunctionArgs {
  values: Record<string, any>;
  editingInfo: Record<string, any>;
}

export type EditingFunctionResult = {
  components?: Record<string, { visible?: boolean; label?: string }>;
  fields?: Record<string, { visible?: boolean; label?: string }>;
};

/** A full No-Code Component Definition */
export interface NoCodeComponentDefinition {
  id: string;
  label: string;
  type?: string;
  schema: SchemaProp[];
  styles?: (args: StylesFunctionArgs) => StylesFunctionResult;
  editing?: (args: EditingFunctionArgs) => EditingFunctionResult;
  /** Group in the component palette */
  paletteLabel?: string;
}

/** Easyblocks token entry */
export interface EasyblocksToken {
  id: string;
  label: string;
  value: string | Record<string, any>;
  isDefault?: boolean;
}

/** Easyblocks Config.tokens shape */
export interface EasyblocksTokens {
  colors: EasyblocksToken[];
  space: EasyblocksToken[];
  fonts: EasyblocksToken[];
  /** Orqui extends with custom token types */
  borderRadius?: EasyblocksToken[];
}

/** Easyblocks custom type definition */
export interface EasyblocksCustomType {
  type: "inline" | "external" | "token";
  /** For inline types — single widget */
  widget?: { id: string; label: string };
  /** For external types — multiple widgets */
  widgets?: Array<{ id: string; label: string }>;
  /** For token types — which Config.tokens key to use */
  token?: string;
  /** Allow freeform custom values beyond the token list */
  allowCustom?: boolean;
  defaultValue?: unknown;
  validate?: (value: unknown) => boolean;
}

/** Easyblocks Config shape (subset we use) */
export interface EasyblocksConfig {
  backend: EasyblocksBackend;
  components: NoCodeComponentDefinition[];
  tokens: EasyblocksTokens;
  types?: Record<string, EasyblocksCustomType>;
  locales: Array<{ code: string; isDefault?: boolean; fallback?: string }>;
  templates?: Array<{ id: string; label?: string; thumbnail?: string; entry: unknown }>;
  devices?: Record<string, { hidden?: boolean }>;
}

/** Easyblocks Backend interface (custom implementation) */
export interface EasyblocksBackend {
  documents: {
    get: (params: { id: string }) => Promise<{ document: unknown } | null>;
    create: (params: { entry: unknown; id?: string }) => Promise<{ id: string }>;
    update: (params: { id: string; entry: unknown }) => Promise<void>;
  };
  templates?: {
    get: () => Promise<Array<{ id: string; entry: unknown }>>;
  };
}

// ============================================================================
// Orqui-specific component type groupings (used in `accepts`)
// ============================================================================

/** Type groups — Easyblocks uses these for slot constraints */
export const ORQUI_TYPE_GROUPS = {
  // Original (21)
  layout: ["OrquiStack", "OrquiRow", "OrquiGrid", "OrquiContainer", "OrquiAccordion", "OrquiSidebar"],
  content: ["OrquiHeading", "OrquiText", "OrquiButton", "OrquiBadge", "OrquiIcon", "OrquiImage", "OrquiDivider", "OrquiSpacer"],
  data: ["OrquiStatCard", "OrquiCard", "OrquiTable", "OrquiList", "OrquiKeyValue"],
  navigation: ["OrquiTabs", "OrquiBreadcrumb", "OrquiPagination", "OrquiMenu", "OrquiLink"],
  input: ["OrquiSearch", "OrquiSelect", "OrquiInput", "OrquiTextarea", "OrquiCheckbox", "OrquiSwitch", "OrquiRadio"],
  special: ["OrquiSlot"],
  // New groups
  feedback: ["OrquiAlert", "OrquiProgress", "OrquiSpinner", "OrquiSkeleton"],
  overlay: ["OrquiModal", "OrquiDrawer", "OrquiTooltip"],
  media: ["OrquiAvatar", "OrquiVideo", "OrquiCarousel"],
} as const;

/** All component IDs — used as a flat accepts list for unconstrained containers */
export const ALL_COMPONENT_IDS = [
  ...ORQUI_TYPE_GROUPS.layout,
  ...ORQUI_TYPE_GROUPS.content,
  ...ORQUI_TYPE_GROUPS.data,
  ...ORQUI_TYPE_GROUPS.navigation,
  ...ORQUI_TYPE_GROUPS.input,
  ...ORQUI_TYPE_GROUPS.special,
  ...ORQUI_TYPE_GROUPS.feedback,
  ...ORQUI_TYPE_GROUPS.overlay,
  ...ORQUI_TYPE_GROUPS.media,
];

// ============================================================================
// Mapping tables
// ============================================================================

/** Orqui node type string → Easyblocks component ID */
export const NODE_TYPE_TO_EB_ID: Record<string, string> = {
  // Original
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
  // New — forms
  input: "OrquiInput",
  textarea: "OrquiTextarea",
  checkbox: "OrquiCheckbox",
  switch: "OrquiSwitch",
  radio: "OrquiRadio",
  // New — feedback
  alert: "OrquiAlert",
  progress: "OrquiProgress",
  spinner: "OrquiSpinner",
  skeleton: "OrquiSkeleton",
  // New — navigation
  breadcrumb: "OrquiBreadcrumb",
  pagination: "OrquiPagination",
  menu: "OrquiMenu",
  link: "OrquiLink",
  // New — overlay
  modal: "OrquiModal",
  drawer: "OrquiDrawer",
  tooltip: "OrquiTooltip",
  // New — media
  avatar: "OrquiAvatar",
  video: "OrquiVideo",
  carousel: "OrquiCarousel",
  // New — layout extras
  accordion: "OrquiAccordion",
  sidebar: "OrquiSidebar",
};

/** Reverse mapping: Easyblocks component ID → Orqui node type string */
export const EB_ID_TO_NODE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPE_TO_EB_ID).map(([k, v]) => [v, k])
);
