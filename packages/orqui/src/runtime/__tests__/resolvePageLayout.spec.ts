import { describe, it, expect } from "vitest";
import { resolvePageLayout } from "../utils";
import type { LayoutContract } from "../types";

describe("resolvePageLayout", () => {
  const baseLayout: LayoutContract = {
    tokens: {},
    structure: {
      regions: {
        sidebar: { enabled: true },
        header: { enabled: true },
        main: { enabled: true },
      },
      pages: {
        dashboard: {
          label: "Dashboard",
          route: "/dashboard",
          overrides: {
            sidebar: { enabled: false },
            headerElements: { search: { enabled: true } },
          },
        },
      },
    },
  };

  it("applies overrides when page key matches", () => {
    const layout = resolvePageLayout(baseLayout, "dashboard");
    expect(layout.structure.regions.sidebar?.enabled).toBe(false);
    expect(layout.structure.headerElements?.search?.enabled).toBe(true);
  });

  it("applies overrides when page route matches", () => {
    const layout = resolvePageLayout(baseLayout, "/dashboard");
    expect(layout.structure.regions.sidebar?.enabled).toBe(false);
  });

  it("applies overrides when page route is nested", () => {
    const layout = resolvePageLayout(baseLayout, "/dashboard/stats");
    expect(layout.structure.regions.sidebar?.enabled).toBe(false);
  });
});
