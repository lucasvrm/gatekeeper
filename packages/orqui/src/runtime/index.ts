// ============================================================================
// Orqui Runtime — Public API
// ============================================================================
// This barrel re-exports the same surface as the original monolithic runtime.tsx.
// Consumer imports remain unchanged:
//   import { ContractProvider, AppShell, Text, useToken, ... } from "@orqui/cli/runtime";
// ============================================================================

// Context & Provider
export { ContractProvider, useContract } from "./context.js";

// Hooks
export {
  useToken,
  useTextStyle,
  useTokens,
  useColor,
  useEmptyState,
  useSkeletonConfig,
  useToastConfig,
  useScrollbarConfig,
  useLayoutMode,
  useComponentDef,
} from "./context.js";

// Token utilities
export { resolveTokenRef, tokenToCSS, resolveTextStyleCSS, cssVar } from "./tokens.js";

// Page layout resolution
export { resolvePageLayout, deepMerge } from "./utils.js";

// Icons
export { IconValue, PhosphorIcon, PHOSPHOR_SVG_PATHS } from "./icons.js";

// Components
export { AppShell } from "./components/AppShell.js";
export { Text } from "./components/Text.js";
export { LogoRenderer } from "./components/Logo.js";
export { HeaderElementsRenderer } from "./components/HeaderElements.js";
export { PageHeaderSlot } from "./components/PageHeader.js";
export { BreadcrumbRenderer } from "./components/Breadcrumbs.js";
export { SidebarNavRenderer } from "./components/SidebarNav.js";
export { Skeleton, SkeletonText, SkeletonCard } from "./components/Skeleton.js";
export { EmptyState, EmptyTableState } from "./components/EmptyState.js";

// Types (re-export for consumers)
export type {
  Tokens,
  LayoutContract,
  UIRegistryContract,
  ContractContextValue,
  TextStyleDef,
  LogoConfig,
  PageConfig,
  RegionConfig,
  NavigationConfig,
  NavItem,
  NavGroup,
  HeaderElementsConfig,
  BreadcrumbsConfig,
  BreadcrumbItem,
  ContentLayoutConfig,
  PageHeaderConfig,
  FaviconConfig,
  SeparatorConfig,
  Container,
} from "./types.js";
