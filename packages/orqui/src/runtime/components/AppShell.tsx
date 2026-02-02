// ============================================================================
// Orqui Runtime — AppShell (Layout Orchestrator)
// ============================================================================
import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Tokens, RegionConfig, SeparatorConfig } from "../types.js";
import { resolveTokenRef } from "../tokens.js";
import { PHOSPHOR_SVG_PATHS } from "../icons.js";
import { resolvePageLayout } from "../utils.js";
import { useContract } from "../context.js";
import { LogoRenderer } from "./Logo.js";
import { HeaderElementsRenderer } from "./HeaderElements.js";
import { PageHeaderSlot } from "./PageHeader.js";
import { BreadcrumbRenderer } from "./Breadcrumbs.js";
import { SidebarNavRenderer } from "./SidebarNav.js";

// ============================================================================
// AppShell — renders layout from contract, uses same CSS vars as components
// ============================================================================
interface AppShellProps {
  sidebarHeader?: ReactNode;
  sidebarNav?: ReactNode;
  sidebarFooter?: ReactNode;
  headerLeft?: ReactNode;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  /** Page key — merges page overrides from layout contract */
  page?: string;
  /** Explicit breadcrumb trail — overrides auto-generated crumbs.
   *  Home is auto-prepended. Only provide the meaningful segments.
   *  Example: [{ label: "Runs", route: "/runs" }, { label: "Type", route: "/workspaces/type" }, { label: "Frontend", route: "/projects/frontend" }, { label: "abc123" }] */
  breadcrumbs?: import("../types.js").BreadcrumbItem[];
  /** Called when header search input changes */
  onSearch?: (query: string) => void;
  /** Called when header CTA is clicked */
  onCTA?: () => void;
  /** Called when a header icon is clicked */
  onIconClick?: (iconId: string, route?: string) => void;
  /** Navigation function (e.g. react-router's navigate) for icon/CTA routes */
  navigate?: (route: string) => void;
}

const COLLAPSE_ICONS: Record<string, [string, string]> = {
  chevron: ["◂", "▸"],
  arrow:   ["←", "→"],
  hamburger: ["✕", "☰"],
  dots:    ["⋮", "⋯"],
};

export function AppShell({
  sidebarHeader,
  sidebarNav,
  sidebarFooter,
  headerLeft,
  headerCenter,
  headerRight,
  children,
  page,
  breadcrumbs: breadcrumbItems,
  onSearch,
  onCTA,
  onIconClick,
  navigate,
}: AppShellProps) {
  const { layout: baseLayout, tokens } = useContract();
  const layout = resolvePageLayout(baseLayout, page);
  const { regions } = layout.structure;
  const logoConfig = layout.structure.logo;
  const headerElements = layout.structure.headerElements;
  const faviconConfig = layout.structure.favicon;
  const breadcrumbsConfig = layout.structure.breadcrumbs;
  const contentLayoutConfig = layout.structure.contentLayout;
  const pageHeaderConfig = layout.structure.pageHeader;
  const pages = layout.structure.pages;
  const layoutMode = layout.structure.layoutMode || "sidebar-first";
  const scrollbarConfig = layout.structure.scrollbar;
  const toastConfig = layout.structure.toast;
  const emptyStateConfig = layout.structure.emptyState;
  const skeletonConfig = layout.structure.skeleton;
  const appTitle = layout.structure.appTitle || "";

  // --- Update document.title based on current page ---
  useEffect(() => {
    if (typeof document === "undefined") return;
    const currentPage = page && pages ? pages[page] : null;
    if (currentPage?.browserTitle) {
      document.title = currentPage.browserTitle;
    } else if (currentPage?.label && appTitle) {
      document.title = `${currentPage.label} — ${appTitle}`;
    } else if (currentPage?.label) {
      document.title = currentPage.label;
    } else if (appTitle) {
      document.title = appTitle;
    }
  }, [page, pages, appTitle]);

  // Debug breadcrumbs — remove after confirming it works
  if (typeof window !== "undefined" && (window as any).__ORQUI_DEBUG !== false) {
    console.info("[Orqui] breadcrumbs config:", breadcrumbsConfig, "| page prop:", page);
  }

  const sidebar = regions.sidebar;
  const header = regions.header;
  const isCollapsible = sidebar?.behavior?.collapsible ?? false;
  const [collapsed, setCollapsed] = useState(false);

  const resolve = (ref?: string) => ref ? resolveTokenRef(ref, tokens) : null;

  const sidebarWidth = collapsed
    ? (resolve(sidebar?.dimensions?.minWidth) ?? "64px")
    : (resolve(sidebar?.dimensions?.width) ?? "260px");
  const headerHeightRaw = resolve(header?.dimensions?.height) ?? "56px";
  const headerHeightNum = parseInt(String(headerHeightRaw), 10) || 56;

  const sidebarPadTop = sidebar?.padding?.top ? parseInt(String(resolve(sidebar.padding.top) ?? "0"), 10) || 0 : 0;
  const sidebarPadL = sidebar?.padding?.left ? parseInt(String(resolve(sidebar.padding.left) ?? "0"), 10) || 0 : 0;
  const sidebarPadR = sidebar?.padding?.right ? parseInt(String(resolve(sidebar.padding.right) ?? "0"), 10) || 0 : 0;
  const sidebarPadBot = sidebar?.padding?.bottom ? parseInt(String(resolve(sidebar.padding.bottom) ?? "0"), 10) || 0 : 0;

  // --- Container-specific padding: sidebar.containers[].padding overrides sidebar.padding ---
  const sidebarContainers = sidebar?.containers || [];
  const getContainerPad = (name: string): { top: number; right: number; bottom: number; left: number } => {
    const container = sidebarContainers.find((c: any) => c.name === name);
    if (!container?.padding) return { top: sidebarPadTop, right: sidebarPadR, bottom: sidebarPadBot, left: sidebarPadL };
    return {
      top:    container.padding.top    ? parseInt(String(resolve(container.padding.top)    ?? "0"), 10) || 0 : sidebarPadTop,
      right:  container.padding.right  ? parseInt(String(resolve(container.padding.right)  ?? "0"), 10) || 0 : sidebarPadR,
      bottom: container.padding.bottom ? parseInt(String(resolve(container.padding.bottom) ?? "0"), 10) || 0 : sidebarPadBot,
      left:   container.padding.left   ? parseInt(String(resolve(container.padding.left)   ?? "0"), 10) || 0 : sidebarPadL,
    };
  };
  const brandPad = getContainerPad("brand");
  const navPad = getContainerPad("navigation");
  const footerPad = getContainerPad("sidebarFooter");
  const shouldAlignLogo = logoConfig?.position === "sidebar" && logoConfig?.alignWithHeader && header?.enabled;

  // When aligned, the sidebar header container height = headerHeight - sidebar's own top padding
  // This makes the bottom border line up exactly with the main header's bottom border
  const alignedSidebarHeaderH = Math.max(headerHeightNum - brandPad.top, 32);

  const resolvePadding = (p?: Record<string, string>) => {
    if (!p) return "0";
    return [p.top, p.right, p.bottom, p.left].map(v => String(resolve(v) ?? "0")).join(" ");
  };

  // Separator helper
  const resolveSeparator = (sep?: any): string | undefined => {
    if (!sep) return undefined; // no config → use fallback
    if (!sep.enabled) return "none"; // explicitly disabled → no border
    const width = resolve(sep.width) ?? "1px";
    const style = sep.style ?? "solid";
    const color = resolve(sep.color) ?? "var(--sidebar-border)";
    return `${width} ${style} ${color}`;
  };

  // Separator extend helper — computes negative margins to cancel parent padding
  const separatorExtendStyle = (sep?: any, parentPadding?: Record<string, string>): React.CSSProperties => {
    if (!sep?.enabled || !parentPadding) return {};
    const ext = sep.extend || "full";
    if (ext === "full") {
      const pl = parseInt(String(resolve(parentPadding.left) ?? "0"), 10) || 0;
      const pr = parseInt(String(resolve(parentPadding.right) ?? "0"), 10) || 0;
      return { marginLeft: -pl, marginRight: -pr, paddingLeft: pl, paddingRight: pr };
    }
    if (ext === "none") return { marginLeft: 8, marginRight: 8 };
    return {}; // "inset" — respect parent padding
  };

  // Collapse button config
  const cbConfig = sidebar?.collapseButton ?? {};
  const cbIcons = COLLAPSE_ICONS[cbConfig.icon ?? "chevron"] ?? COLLAPSE_ICONS.chevron;
  const cbPosition = cbConfig.position ?? "header-end";

  // Collapsed display mode
  const collapsedDisplay = sidebar?.behavior?.collapsedDisplay ?? "icon-only";

  const collapseButtonEl = isCollapsible ? (
    <button
      data-orqui-cb=""
      onClick={() => setCollapsed(!collapsed)}
      style={{
        background: "var(--sidebar, #111114)",
        border: "1px solid var(--sidebar-border, #2a2a33)",
        color: "var(--muted-foreground)",
        cursor: "pointer",
        padding: "4px 6px",
        borderRadius: 4,
        fontSize: 16,
        lineHeight: 1,
        flexShrink: 0,
        zIndex: 50,
      }}
      title={collapsed ? "Expand" : "Collapse"}
    >
      {collapsed ? cbIcons[1] : cbIcons[0]}
    </button>
  ) : null;

  // Inject favicon
  useEffect(() => {
    if (!faviconConfig || faviconConfig.type === "none") return;
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (faviconConfig.type === "image" && faviconConfig.url) {
      link.href = faviconConfig.url;
      link.type = faviconConfig.url.startsWith("data:image/svg") ? "image/svg+xml" : "image/x-icon";
    } else if (faviconConfig.type === "emoji" && faviconConfig.emoji) {
      let svg: string;
      const fillColor = faviconConfig.color || "white";
      if (faviconConfig.emoji.startsWith("ph:")) {
        const phPath = PHOSPHOR_SVG_PATHS[faviconConfig.emoji.slice(3)];
        if (phPath) {
          svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${fillColor}"><path d="${phPath}"/></svg>`;
        } else {
          svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">?</text></svg>`;
        }
      } else {
        svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${faviconConfig.emoji}</text></svg>`;
      }
      link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      link.type = "image/svg+xml";
    }
  }, [faviconConfig]);

  // Navigation: contract is source of truth, sidebarNav prop is fallback only
  const contractNavItems = sidebar?.navigation?.items;
  const hasContractNav = contractNavItems && contractNavItems.length > 0;
  const effectiveNav = hasContractNav ? (
    <SidebarNavRenderer
      navConfig={sidebar!.navigation!}
      page={page}
      navigate={navigate}
      collapsed={collapsed}
      collapsedDisplay={collapsedDisplay}
    />
  ) : sidebarNav || null;

  // ── Extracted JSX blocks for layoutMode switching ────────────────────────

  const sidebarEl = sidebar?.enabled ? (
    <aside data-orqui-sidebar="" style={{
      width: String(sidebarWidth),
      minWidth: String(sidebarWidth),
      height: layoutMode === "header-first" ? undefined : "100vh",
      flex: layoutMode === "header-first" ? "0 0 auto" : undefined,
      position: layoutMode === "header-first" ? undefined : "sticky",
      top: layoutMode === "header-first" ? undefined : 0,
      display: "flex",
      flexDirection: "column",
      background: sidebar?.background ? String(resolve(sidebar.background) ?? "var(--sidebar)") : "var(--sidebar)",
      borderRight: "1px solid var(--sidebar-border)",
      transition: "width 0.2s ease, min-width 0.2s ease",
      overflow: "hidden",
      boxSizing: "border-box",
    }}>
      {/* Sidebar header — full-width, own padding */}
      {layoutMode !== "header-first" && (
        <div data-orqui-sidebar-header="" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : (logoConfig?.sidebarAlign === "center" ? "center" : logoConfig?.sidebarAlign === "right" ? "flex-end" : "space-between"),
          borderBottom: resolveSeparator(sidebar.separators?.header) ?? "1px solid var(--sidebar-border)",
          paddingLeft: collapsed ? 0 : brandPad.left,
          paddingRight: collapsed ? 0 : brandPad.right,
          paddingTop: collapsed ? 0 : brandPad.top,
          position: "relative",
          ...(shouldAlignLogo ? {
            height: `${headerHeightNum}px`,
            minHeight: `${headerHeightNum}px`,
            maxHeight: `${headerHeightNum}px`,
            boxSizing: "border-box" as const,
          } : {
            paddingBottom: collapsed ? 0 : brandPad.bottom,
          }),
          flexShrink: 0,
        }}>
          {/* Logo in sidebar */}
          {logoConfig?.position === "sidebar" ? (
            <LogoRenderer config={logoConfig} collapsed={collapsed} />
          ) : (
            !collapsed && sidebarHeader
          )}
          {cbPosition === "header-end" && collapseButtonEl && (
            collapsed ? (
              <div style={{ position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)" }}>
                {collapseButtonEl}
              </div>
            ) : collapseButtonEl
          )}
        </div>
      )}

      {/* Nav area — own padding from sidebar config */}
      <nav data-orqui-sidebar-nav="" style={{
        flex: 1,
        overflow: sidebar.behavior?.scrollable ? "auto" : "hidden",
        display: "flex",
        flexDirection: "column",
        gap: String(resolve("$tokens.spacing.2xs") ?? "2px"),
        padding: collapsed
          ? `${String(resolve("$tokens.spacing.sm") ?? "8px")} 4px`
          : `${navPad.top}px ${navPad.right}px ${navPad.bottom}px ${navPad.left}px`,
        ...(collapsed ? { alignItems: "center" } : {}),
      }}>
        {collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", width: "100%" }}
            data-orqui-collapsed="true"
            data-orqui-collapsed-display={collapsedDisplay}
          >
            {effectiveNav}
          </div>
        ) : effectiveNav}
      </nav>

      {/* Collapse button at center position (inside sidebar) */}
      {cbPosition === "center" && collapseButtonEl && (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
          {collapseButtonEl}
        </div>
      )}

      {/* Sidebar footer */}
      {(sidebarFooter || cbPosition === "bottom") && (
        <div style={{
          paddingTop: footerPad.top,
          borderTop: resolveSeparator(sidebar.separators?.footer) ?? "1px solid var(--sidebar-border)",
          paddingLeft: collapsed ? 4 : footerPad.left,
          paddingRight: collapsed ? 4 : footerPad.right,
          paddingBottom: footerPad.bottom,
          display: "flex",
          alignItems: collapsed ? "center" : "stretch",
          flexDirection: "column",
          gap: 4,
        }}>
          {!collapsed && sidebarFooter}
          {cbPosition === "bottom" && collapseButtonEl}
        </div>
      )}
    </aside>
  ) : null;

  const edgeCenterCollapseEl = sidebar?.enabled && cbPosition === "edge-center" && collapseButtonEl ? (
    <div style={{
      position: "fixed",
      left: `calc(${sidebarWidth} - 12px)`,
      top: layoutMode === "header-first"
        ? `calc(${headerHeightNum}px + (100vh - ${headerHeightNum}px) / 2)`
        : `calc(${headerHeightNum}px + (100vh - ${headerHeightNum}px) / 2)`,
      transform: "translateY(-50%)",
      zIndex: 100,
      transition: "left 0.2s ease",
    }}>
      {collapseButtonEl}
    </div>
  ) : null;

  // Zone-based header support
  const headerZones = (header as any)?.zones;
  const sidebarPadToken = resolve("$tokens.sizing.sidebar-pad");
  const mainPadToken = resolve("$tokens.sizing.main-pad");
  const sidebarPadPx = sidebarPadToken ? String(sidebarPadToken) : "16px";
  const mainPadPx = mainPadToken ? String(mainPadToken) : "28px";

  const headerEl = header?.enabled ? (
    <header data-orqui-header="" style={{
      height: `${headerHeightNum}px`,
      minHeight: `${headerHeightNum}px`,
      display: "flex",
      alignItems: "stretch",
      padding: headerZones ? "0" : resolvePadding(header.padding),
      background: header?.background ? String(resolve(header.background) ?? "var(--background)") : "var(--background)",
      borderBottom: resolveSeparator(header?.separators?.bottom) ?? "1px solid var(--border)",
      position: header.behavior?.fixed ? "sticky" : undefined,
      top: header.behavior?.fixed ? 0 : undefined,
      zIndex: header.behavior?.fixed ? 10 : undefined,
      boxSizing: "border-box",
    }}>
      {headerZones ? (
        <>
          {/* ── Sidebar Zone ── matches sidebar width */}
          <div data-orqui-header-zone="sidebar" style={{
            width: String(sidebarWidth),
            minWidth: String(sidebarWidth),
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: collapsed ? "0" : sidebarPadPx,
            paddingRight: collapsed ? "0" : undefined,
            justifyContent: collapsed ? "center" : "flex-start",
            borderRight: headerZones.sidebar?.borderRight?.enabled !== false
              ? `${resolve(headerZones.sidebar?.borderRight?.width) ?? "1px"} solid ${resolve(headerZones.sidebar?.borderRight?.color) ?? "var(--border)"}`
              : "none",
            transition: "width 0.2s ease, min-width 0.2s ease",
            boxSizing: "border-box",
            gap: "12px",
          }}>
            {/* Logo in header sidebar-zone */}
            {logoConfig?.position === "header" && (
              <LogoRenderer config={logoConfig} collapsed={collapsed} />
            )}
            {layoutMode === "header-first" && logoConfig?.position === "sidebar" && (
              <LogoRenderer config={logoConfig} collapsed={collapsed} />
            )}
            {headerLeft}
            <div id="orqui-header-left" style={{ display: "contents" }} />
          </div>

          {/* ── Content Zone ── flex:1, aligned with main content */}
          <div data-orqui-header-zone="content" style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: mainPadPx,
            paddingRight: mainPadPx,
            gap: "12px",
            boxSizing: "border-box",
          }}>
            {/* Breadcrumbs */}
            {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && (
              <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} resolveToken={(ref) => resolveTokenRef(ref, tokens)} items={breadcrumbItems} />
            )}
            {headerCenter}
            {/* Spacer */}
            <div style={{ flex: 1 }} />
            {/* Header elements (search, icons, CTAs) */}
            <HeaderElementsRenderer config={headerElements} onSearch={onSearch} onCTA={onCTA} onIconClick={onIconClick} navigate={navigate} />
            {headerRight}
            <div id="orqui-header-right" style={{ display: "contents" }} />
          </div>
        </>
      ) : (
        <>
          {/* ── Legacy flat header ── left / center / right */}
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
            {logoConfig?.position === "header" && logoConfig?.headerSlot === "left" && (
              <LogoRenderer config={logoConfig} />
            )}
            {layoutMode === "header-first" && logoConfig?.position === "sidebar" && (
              <LogoRenderer config={logoConfig} />
            )}
            {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && breadcrumbsConfig?.alignment !== "center" && breadcrumbsConfig?.alignment !== "right" && (
              <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} resolveToken={(ref) => resolveTokenRef(ref, tokens)} items={breadcrumbItems} />
            )}
            {headerLeft}
            <div id="orqui-header-left" style={{ display: "contents" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", justifyContent: (logoConfig?.position === "header" && logoConfig?.headerSlot === "center") || breadcrumbsConfig?.alignment === "center" ? "center" : undefined }}>
            {logoConfig?.position === "header" && logoConfig?.headerSlot === "center" && (
              <LogoRenderer config={logoConfig} />
            )}
            {breadcrumbsConfig?.enabled && breadcrumbsConfig?.position === "header" && breadcrumbsConfig?.alignment === "center" && (
              <BreadcrumbRenderer config={breadcrumbsConfig} pages={pages} currentPage={page} navigate={navigate} resolveToken={(ref) => resolveTokenRef(ref, tokens)} items={breadcrumbItems} />
            )}
            {headerCenter}
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <HeaderElementsRenderer config={headerElements} onSearch={onSearch} onCTA={onCTA} onIconClick={onIconClick} navigate={navigate} />
            {logoConfig?.position === "header" && logoConfig?.headerSlot === "right" && (
              <LogoRenderer config={logoConfig} />
            )}
            {headerRight}
            <div id="orqui-header-right" style={{ display: "contents" }} />
          </div>
        </>
      )}
    </header>
  ) : null;

  const mainEl = (
    <main style={{
      flex: 1,
      padding: resolvePadding(regions.main?.padding),
      overflow: "auto",
      background: regions.main?.background ? String(resolve(regions.main.background) ?? undefined) : undefined,
    }}>
      {/* Page Header */}
      {pageHeaderConfig?.enabled && (
        <div data-orqui-page-header="" style={{
          padding: resolvePadding(pageHeaderConfig.padding),
          background: pageHeaderConfig.background ? (resolve(pageHeaderConfig.background) as string ?? pageHeaderConfig.background) : undefined,
          borderBottom: pageHeaderConfig.showDivider ? "1px solid var(--border)" : undefined,
          marginBottom: pageHeaderConfig.showDivider ? 0 : undefined,
        }}>
          {pageHeaderConfig.showTitle !== false && (
            <PageHeaderSlot config={pageHeaderConfig} page={page} pages={pages} resolve={resolve} />
          )}
        </div>
      )}
      {/* Content wrapper */}
      {contentLayoutConfig ? (
        <div data-orqui-content="" style={{
          maxWidth: contentLayoutConfig.maxWidth ? (resolve(contentLayoutConfig.maxWidth) as string ?? contentLayoutConfig.maxWidth) : undefined,
          margin: contentLayoutConfig.centering !== false && contentLayoutConfig.maxWidth ? "0 auto" : undefined,
          ...(contentLayoutConfig.grid?.enabled ? {
            display: "grid",
            gridTemplateColumns: (() => {
              const g = contentLayoutConfig.grid!;
              if (typeof g.columns === "number") return `repeat(${g.columns}, 1fr)`;
              if (g.columns === "auto-fit" || g.columns === "auto-fill") {
                const minW = resolve(g.minColumnWidth) ?? g.minColumnWidth ?? "280px";
                return `repeat(${g.columns}, minmax(${minW}, 1fr))`;
              }
              return g.columns as string ?? undefined;
            })(),
            gap: resolve(contentLayoutConfig.grid.gap ?? contentLayoutConfig.grid.rowGap) as string ?? undefined,
            columnGap: contentLayoutConfig.grid.columnGap ? (resolve(contentLayoutConfig.grid.columnGap) as string ?? contentLayoutConfig.grid.columnGap) : undefined,
            rowGap: contentLayoutConfig.grid.rowGap ? (resolve(contentLayoutConfig.grid.rowGap) as string ?? contentLayoutConfig.grid.rowGap) : undefined,
          } : {}),
        }}>
          {children}
        </div>
      ) : children}
    </main>
  );

  // ── Compose layout based on layoutMode ─────────────────────────────────

  if (layoutMode === "header-first") {
    // header-first: full-width header on top, sidebar + main below
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background)",
        color: "var(--foreground)",
        fontFamily: "var(--font-sans, Inter, sans-serif)",
        position: "relative",
      }}>
        {headerEl}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {sidebarEl}
          {edgeCenterCollapseEl}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "clip" }}>
            {mainEl}
          </div>
        </div>
      </div>
    );
  }

  // sidebar-first (default): sidebar full-height, header in main column
  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "var(--background)",
      color: "var(--foreground)",
      fontFamily: "var(--font-sans, Inter, sans-serif)",
      position: "relative",
    }}>
      {sidebarEl}
      {edgeCenterCollapseEl}
      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "clip" }}>
        {headerEl}
        {mainEl}
      </div>
    </div>
  );
}
