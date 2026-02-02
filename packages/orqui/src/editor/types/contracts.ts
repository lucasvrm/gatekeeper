export type TokenValue = { value: number; unit: string };
export type FontFamilyToken = { family: string; fallbacks: string[] };
export type FontWeightToken = { value: number };
export type UnitlessToken = { value: number };
export type Container = { name: string; description: string; order: number };
export type RegionBehavior = { fixed: boolean; collapsible: boolean; scrollable: boolean };
export type Region = {
  enabled: boolean;
  position?: string;
  dimensions?: Record<string, string>;
  padding?: Record<string, string>;
  containers?: Container[];
  behavior?: RegionBehavior;
};
export type Tokens = {
  spacing: Record<string, TokenValue>;
  sizing: Record<string, TokenValue>;
  fontFamilies: Record<string, FontFamilyToken>;
  fontSizes: Record<string, TokenValue>;
  fontWeights: Record<string, FontWeightToken>;
  lineHeights: Record<string, UnitlessToken>;
  letterSpacings: Record<string, TokenValue>;
  [key: string]: any;
};
export type TextStyle = {
  description?: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
};
export type LayoutContract = {
  structure: { regions: Record<string, Region> };
  tokens: Tokens;
  textStyles: Record<string, TextStyle>;
};
export type ComponentProp = {
  type: string;
  required: boolean;
  description: string;
  default?: any;
  enumValues?: string[];
  items?: any;
  shape?: any;
};
export type ComponentSlot = { description: string; required: boolean; acceptedComponents: string[] };
export type ComponentDef = {
  name: string;
  category: string;
  description: string;
  source: string;
  props: Record<string, ComponentProp>;
  slots: Record<string, ComponentSlot>;
  variants: Array<{ name: string; props: Record<string, any> }>;
  examples: Array<{ name: string; props: Record<string, any>; slots?: Record<string, any> }>;
  tags: string[];
};
export type UIRegistry = { components: Record<string, ComponentDef> };

export interface CmdItem {
  id: string;
  label: string;
  category: string;
  hint?: string;
  icon?: string;
  action: () => void;
  keywords?: string[];
}
