// ============================================================================
// Orqui Runtime — Shared Types
// ============================================================================
import type { CSSProperties } from "react";

// ============================================================================
// Grid Engine Types
// ============================================================================
export interface GridItem {
  component: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
  props?: Record<string, any>;
}

export interface GridLayoutConfig {
  columns: number;
  rowHeight: string;
  gap: string;
  items: GridItem[];
}

export interface TokenValue { value: number; unit: string }
export interface FontFamilyToken { family: string; fallbacks: string[] }
export interface FontWeightToken { value: number }
export interface UnitlessToken { value: number }
export interface ColorToken { value: string }
export interface Container { name: string; description: string; order: number }
export interface SeparatorConfig {
  enabled: boolean;
  color?: string;
  width?: string;
  style?: string;
  extend?: "full" | "inset" | "none";
}
export interface NavTypography {
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  activeFontWeight?: string;
  activeColor?: string;
  hoverColor?: string;
  hoverBackground?: string;
  hoverFontWeight?: string;
  activeBackground?: string;
  cardEnabled?: boolean;
  cardBackground?: string;
  cardBorderColor?: string;
  cardBorderWidth?: string;
  cardBorderRadius?: string;
  cardPadding?: string;
  activeCardBorder?: string;
  hoverCardBorder?: string;
}
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  badge?: string | number;
  disabled?: boolean;
  children?: NavItem[];
  description?: string;
}
export interface NavGroup {
  label?: string;
  collapsed?: boolean;
  items: NavItem[];
}
export interface NavigationConfig {
  items?: NavItem[];
  groups?: NavGroup[];
  icons?: { enabled?: boolean; size?: string; gap?: string };
  typography?: NavTypography;
}
export interface CollapseButtonConfig {
  icon?: string;
  position?: string;
  size?: string;
}
export interface RegionConfig {
  enabled?: boolean;
  position?: string;
  dimensions?: {
    width?: string;
    height?: string;
    minWidth?: string;
    maxWidth?: string;
  };
  padding?: { top?: string; right?: string; bottom?: string; left?: string };
  containers?: Container[];
  behavior?: {
    fixed?: boolean;
    collapsible?: boolean;
    scrollable?: boolean;
    collapsedDisplay?: "icon-only" | "letter-only";
  };
  navigation?: NavigationConfig;
  collapseButton?: CollapseButtonConfig;
  background?: string;
  separators?: Record<string, SeparatorConfig>;
  alignmentPad?: string;
  collapsedTooltip?: Record<string, any>;
  zones?: Record<string, any>;
}
export interface ContentLayoutConfig {
  centering?: boolean;
  maxWidth?: string;
  contentGap?: string;
  contentPadding?: string;
  grid?: {
    enabled?: boolean;
    columns?: number | "auto-fit" | "auto-fill";
    minColumnWidth?: string;
    gap?: string;
    rowGap?: string;
    columnGap?: string;
  };
}
export interface PageHeaderConfig {
  enabled?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showDivider?: boolean;
  padding?: { top?: string; right?: string; bottom?: string; left?: string };
  typography?: {
    title?: { fontSize?: string; fontWeight?: string; letterSpacing?: string };
    subtitle?: { fontSize?: string; color?: string };
  };
}
export interface TextStyleDef {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  description?: string;
}
export interface LogoConfig {
  type?: "icon-text" | "icon" | "text" | "image";
  text?: string;
  icon?: string;
  iconUrl?: string;
  imageUrl?: string;
  position?: "sidebar" | "header";
  headerSlot?: "left" | "center" | "right";
  sidebarAlign?: "left" | "center";
  alignWithHeader?: boolean;
  iconGap?: number;
  iconSize?: number;
  typography?: Record<string, any>;
  padding?: Record<string, any>;
}
export interface FaviconConfig {
  type?: "url" | "emoji";
  url?: string;
  emoji?: string;
  color?: string;
}
export interface HeaderElementsConfig {
  search?: { enabled?: boolean; placeholder?: string; icon?: string };
  cta?: { enabled?: boolean; label?: string; variant?: string; route?: string };
  ctas?: Array<{ id: string; label: string; variant?: string; route?: string; icon?: string }>;
  icons?: { enabled?: boolean; items?: Array<{ id: string; icon: string; route?: string; badge?: any }> };
  order?: string[];
}
export interface PageConfig {
  label?: string;
  route?: string;
  description?: string;
  browserTitle?: string;
  icon?: string;
  parentPage?: string;
  overrides?: {
    sidebar?: Partial<RegionConfig>;
    header?: Partial<RegionConfig>;
    main?: Partial<RegionConfig>;
    headerElements?: Partial<HeaderElementsConfig>;
    contentLayout?: Partial<ContentLayoutConfig>;
    pageHeader?: Partial<PageHeaderConfig>;
    gridLayout?: GridLayoutConfig;
  };
}
export interface Tokens {
  spacing?: Record<string, TokenValue>;
  sizing?: Record<string, TokenValue | string>;
  fontFamilies?: Record<string, FontFamilyToken>;
  fontSizes?: Record<string, TokenValue>;
  fontWeights?: Record<string, FontWeightToken>;
  lineHeights?: Record<string, UnitlessToken>;
  letterSpacings?: Record<string, TokenValue>;
  colors?: Record<string, ColorToken | string>;
  borderRadius?: Record<string, TokenValue>;
  borderWidth?: Record<string, TokenValue>;
}
/** A single breadcrumb segment — used when the consumer provides explicit crumbs */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Route to navigate to (omit for the last/current segment) */
  route?: string;
  /** Optional icon (Phosphor key, e.g. "ph:folder") */
  icon?: string;
}
export interface BreadcrumbsConfig {
  enabled?: boolean;
  position?: "sidebar" | "header" | "main";
  alignment?: "left" | "center" | "right";
  separator?: string;
  clickable?: boolean;
  arrows?: boolean;
  autoHide?: boolean;
  showHome?: boolean;
  homeLabel?: string;
  homeRoute?: string;
  padding?: Record<string, string>;
  typography?: {
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    activeColor?: string;
    activeFontWeight?: string;
    color?: string;
    linkColor?: string;
    separatorColor?: string;
    hoverColor?: string;
  };
  _alignNote?: string;
}
export interface LoginPageConfig {
  logo?: {
    enabled?: boolean;
    placement?: "above-card" | "inside-card";
    align?: "left" | "center" | "right";
    scale?: number;
    marginBottom?: string;
  };
  background?: {
    type?: "solid" | "gradient" | "image";
    color?: string;
    gradient?: string;
    imageUrl?: string;
    overlay?: string;
  };
  card?: {
    position?: "left" | "center" | "right";
    verticalAlign?: "top" | "center" | "bottom";
    maxWidth?: string;
    background?: string;
    borderColor?: string;
    borderRadius?: string;
    shadow?: string;
    padding?: string;
  };
  title?: {
    text?: string;
    align?: "left" | "center" | "right";
  };
  inputs?: {
    background?: string;
    borderColor?: string;
    focusBorderColor?: string;
  };
  button?: {
    background?: string;
    color?: string;
    hoverBackground?: string;
  };
  links?: {
    color?: string;
    hoverColor?: string;
  };
  footer?: {
    text?: string;
  };
}
export interface LayoutContract {
  $orqui?: Record<string, any>;
  tokens: Tokens;
  textStyles?: Record<string, TextStyleDef>;
  structure: {
    regions: {
      sidebar?: RegionConfig;
      header?: RegionConfig;
      main?: RegionConfig;
      footer?: RegionConfig;
    };
    logo?: LogoConfig;
    favicon?: FaviconConfig;
    headerElements?: HeaderElementsConfig;
    breadcrumbs?: BreadcrumbsConfig;
    contentLayout?: ContentLayoutConfig;
    pageHeader?: PageHeaderConfig;
    pages?: Record<string, PageConfig>;
    layoutMode?: "sidebar-first" | "header-first";
    scrollbar?: Record<string, any>;
    toast?: Record<string, any>;
    emptyState?: Record<string, any>;
    skeleton?: Record<string, any>;
    tableSeparator?: Record<string, any>;
    appTitle?: string;
    alignmentGrid?: Record<string, any>;
    loginPage?: LoginPageConfig;
  };
}
export interface UIRegistryContract {
  $orqui?: Record<string, any>;
  components: Record<string, any>;
}
export interface ContractContextValue {
  layout: LayoutContract;
  registry: UIRegistryContract;
  tokens: Tokens;
  resolveToken: (ref: string) => string | number | null;
  getTextStyle: (name: string) => CSSProperties;
  getTokenValue: (category: string, key: string) => string;
  color: (name: string) => string;
}
