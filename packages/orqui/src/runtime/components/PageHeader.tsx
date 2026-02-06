// ============================================================================
// Orqui Runtime — Page Header Slot
// Renders page title and subtitle with optional text style support
// ============================================================================
import React from "react";
import type { CSSProperties } from "react";
import type { PageHeaderConfig, PageConfig, Tokens } from "../types.js";
import { resolveTokenRef } from "../tokens.js";
import { useContract } from "../context.js";

export interface PageHeaderSlotProps {
  config: PageHeaderConfig;
  page?: string;
  pages?: Record<string, PageConfig>;
  resolve: (ref?: string) => string | number | null;
  /** Override title text style name (from textStyles) */
  titleTextStyle?: string;
  /** Override subtitle text style name (from textStyles) */
  subtitleTextStyle?: string;
}

export function PageHeaderSlot({
  config,
  page,
  pages,
  resolve,
  titleTextStyle,
  subtitleTextStyle,
}: PageHeaderSlotProps) {
  const { getTextStyle } = useContract();

  const pageConfig = page ? pages?.[page] : undefined;
  const title = config.typography?.title?.text ?? pageConfig?.label ?? (page ? page.charAt(0).toUpperCase() + page.slice(1) : "");
  const subtitle = config.typography?.subtitle?.text ?? pageConfig?.description ?? "";

  // Get text styles from contract (if defined)
  const titleStyleName = titleTextStyle || config.typography?.titleTextStyle || "heading-1";
  const subtitleStyleName = subtitleTextStyle || config.typography?.subtitleTextStyle || "body-sm";
  
  const titleTextStyleCSS = getTextStyle(titleStyleName) || {};
  const subtitleTextStyleCSS = getTextStyle(subtitleStyleName) || {};

  // Inline typography overrides (backward compat)
  const titleTypo = config.typography?.title;
  const subtitleTypo = config.typography?.subtitle;

  // Build title style: textStyle base + inline overrides
  const titleStyle: CSSProperties = {
    margin: 0,
    lineHeight: 1.2,
    color: "var(--foreground)",
    // Apply text style first
    ...titleTextStyleCSS,
    // Then apply inline overrides (backward compat)
    ...(titleTypo?.fontSize && { fontSize: resolve(titleTypo.fontSize) as string }),
    ...(titleTypo?.fontWeight && { fontWeight: resolve(titleTypo.fontWeight) as number }),
    ...(titleTypo?.fontFamily && { fontFamily: resolve(titleTypo.fontFamily) as string }),
    ...(titleTypo?.color && { color: resolve(titleTypo.color) as string }),
    ...(titleTypo?.letterSpacing && { letterSpacing: resolve(titleTypo.letterSpacing) as string }),
  };

  // Build subtitle style: textStyle base + inline overrides
  const subtitleStyle: CSSProperties = {
    margin: "4px 0 0",
    color: "var(--muted-foreground)",
    // Apply text style first
    ...subtitleTextStyleCSS,
    // Then apply inline overrides (backward compat)
    ...(subtitleTypo?.fontSize && { fontSize: resolve(subtitleTypo.fontSize) as string }),
    ...(subtitleTypo?.fontWeight && { fontWeight: resolve(subtitleTypo.fontWeight) as number }),
    ...(subtitleTypo?.fontFamily && { fontFamily: resolve(subtitleTypo.fontFamily) as string }),
    ...(subtitleTypo?.color && { color: resolve(subtitleTypo.color) as string }),
    ...(subtitleTypo?.letterSpacing && { letterSpacing: resolve(subtitleTypo.letterSpacing) as string }),
  };

  // Padding from config
  const padding = config.padding;
  const containerStyle: CSSProperties = padding ? {
    paddingTop: resolve(padding.top) as string,
    paddingRight: resolve(padding.right) as string,
    paddingBottom: resolve(padding.bottom) as string,
    paddingLeft: resolve(padding.left) as string,
  } : {};

  return (
    <div data-orqui-page-header="" style={containerStyle}>
      {config.showTitle !== false && title && (
        <h1 data-orqui-page-title="" style={titleStyle}>
          {title}
        </h1>
      )}
      {config.showSubtitle !== false && subtitle && (
        <p data-orqui-page-subtitle="" style={subtitleStyle}>
          {subtitle}
        </p>
      )}
      {config.showDivider && (
        <div
          data-orqui-page-divider=""
          style={{
            marginTop: "16px",
            height: "1px",
            background: "var(--border)",
          }}
        />
      )}
    </div>
  );
}
