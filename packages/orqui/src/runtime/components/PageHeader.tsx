// ============================================================================
// Orqui Runtime — Page Header Slot
// ============================================================================
import React from "react";
import type { PageHeaderConfig, PageConfig, Tokens } from "../types.js";
import { resolveTokenRef } from "../tokens.js";

export function PageHeaderSlot({ config, page, pages, resolve }: {
  config: PageHeaderConfig;
  page?: string;
  pages?: Record<string, PageConfig>;
  resolve: (ref?: string) => string | number | null;
}) {
  const pageConfig = page ? pages?.[page] : undefined;
  const title = pageConfig?.label || (page ? page.charAt(0).toUpperCase() + page.slice(1) : "");
  const subtitle = pageConfig?.description || "";

  const titleTypo = config.typography?.title;
  const subtitleTypo = config.typography?.subtitle;

  return (
    <>
      {config.showTitle !== false && title && (
        <h1 data-orqui-page-title="" style={{
          margin: 0,
          fontSize: resolve(titleTypo?.fontSize) as string ?? "28px",
          fontWeight: (resolve(titleTypo?.fontWeight) as number) ?? 700,
          fontFamily: resolve(titleTypo?.fontFamily) as string ?? undefined,
          color: resolve(titleTypo?.color) as string ?? "var(--foreground)",
          letterSpacing: resolve(titleTypo?.letterSpacing) as string ?? "-0.02em",
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
      )}
      {config.showSubtitle !== false && subtitle && (
        <p data-orqui-page-subtitle="" style={{
          margin: "4px 0 0",
          fontSize: resolve(subtitleTypo?.fontSize) as string ?? "14px",
          fontWeight: (resolve(subtitleTypo?.fontWeight) as number) ?? 400,
          fontFamily: resolve(subtitleTypo?.fontFamily) as string ?? undefined,
          color: resolve(subtitleTypo?.color) as string ?? "var(--muted-foreground)",
        }}>
          {subtitle}
        </p>
      )}
    </>
  );
}
