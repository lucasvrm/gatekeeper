import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Tokens V2: devem estar disponíveis quando o root tiver data-app-shell="v2"
import "@/ui/theme/app-shell-v2.tokens.css";

import AppLayoutV2 from "@/ui/layout/v2/AppLayoutV2";
import HeaderV2 from "@/ui/layout/v2/HeaderV2";

/**
 * Mock do hook real (repo): src/hooks/useLayoutState.ts
 * - V1 já importa desse path via alias: "@/hooks/useLayoutState"
 */
type MockLayoutState = {
  sidebar: { collapsed: boolean };
  panel: { open: boolean; activeSection: string | null };
  isLoading: boolean;
  toggleSidebar: () => void;
  togglePanel: (sectionId: string) => void;
};

let mockState: MockLayoutState;

vi.mock("@/hooks/useLayoutState", () => {
  return {
    useLayoutState: () => mockState,
  };
});

function setPanelOpen(open: boolean) {
  mockState = {
    ...mockState,
    panel: { open, activeSection: open ? "mock-section" : null },
  };
}

function setSidebarCollapsed(collapsed: boolean) {
  mockState = {
    ...mockState,
    sidebar: { collapsed },
  };
}

function childTestIds(container: HTMLElement): string[] {
  return Array.from(container.children).map((el) => el.getAttribute("data-testid") ?? "");
}

function normalizeCssVarValue(v: string): string {
  return v.trim().replace(/\s+/g, "");
}

describe("AppShellV2 / AppLayoutV2 (contract: app_shell_v2)", () => {
  beforeEach(() => {
    mockState = {
      sidebar: { collapsed: false },
      panel: { open: false, activeSection: null },
      isLoading: false,
      toggleSidebar: vi.fn(),
      togglePanel: vi.fn(),
    };

    document.documentElement.removeAttribute("data-app-shell");
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-app-shell");
  });

  // @clause CLAUSE_001
  it("CLAUSE_001: com panel fechado, app-layout contém sidebar e main-wrapper nessa ordem; contextual-panel ausente", () => {
    setPanelOpen(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayoutV2>
          <div>Child</div>
        </AppLayoutV2>
      </MemoryRouter>
    );

    const appLayout = screen.getByTestId("app-layout");

    expect(within(appLayout).getByTestId("sidebar")).toBeInTheDocument();
    expect(within(appLayout).queryByTestId("contextual-panel")).not.toBeInTheDocument();
    expect(within(appLayout).getByTestId("main-wrapper")).toBeInTheDocument();

    expect(childTestIds(appLayout)).toEqual(["sidebar", "main-wrapper"]);
  });

  // @clause CLAUSE_002
  it("CLAUSE_002: main-wrapper contém header e main-content; header fica dentro do main-wrapper", () => {
    setPanelOpen(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayoutV2>
          <div>Child</div>
        </AppLayoutV2>
      </MemoryRouter>
    );

    const mainWrapper = screen.getByTestId("main-wrapper");
    const header = within(mainWrapper).getByTestId("header");
    const mainContent = within(mainWrapper).getByTestId("main-content");

    expect(header).toBeInTheDocument();
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toHaveAttribute("role", "main");
  });

  // @clause CLAUSE_003
  it("CLAUSE_003: HeaderV2 não renderiza menu topo; apenas breadcrumb (esq) e ações (dir)", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <HeaderV2 />
      </MemoryRouter>
    );

    // breadcrumb único e acessível
    const breadcrumbNav = screen.getByTestId("breadcrumb-nav");
    expect(breadcrumbNav.tagName.toLowerCase()).toBe("nav");
    expect(breadcrumbNav).toHaveAttribute("aria-label", "Breadcrumb");

    // não existe outro <nav> (evita menu topo)
    const allNavs = screen.getAllByRole("navigation");
    expect(allNavs).toHaveLength(1);

    // ações (mínimo verificável): botões com type="button"
    const searchBtn = screen.getByTestId("header-search");
    const notifBtn = screen.getByTestId("header-notifications");

    expect(searchBtn.tagName.toLowerCase()).toBe("button");
    expect(notifBtn.tagName.toLowerCase()).toBe("button");
    expect(searchBtn).toHaveAttribute("type", "button");
    expect(notifBtn).toHaveAttribute("type", "button");

    // theme-toggle é opcional pelo contrato ("se existir")
    const themeToggle = screen.queryByTestId("theme-toggle");
    if (themeToggle) {
      expect(themeToggle.tagName.toLowerCase()).toBe("button");
      expect(themeToggle).toHaveAttribute("type", "button");
    }
  });

  // @clause CLAUSE_004
  it("CLAUSE_004: modo V2 ativa :root[data-app-shell=v2] e expõe variáveis 241–252 com valores exatos", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayoutV2>
          <div>Child</div>
        </AppLayoutV2>
      </MemoryRouter>
    );

    expect(document.documentElement.getAttribute("data-app-shell")).toBe("v2");

    const cs = getComputedStyle(document.documentElement);

    // Interpretação do artefato: 241–252 = 12 tokens core (nomes semânticos)
    const expected: Record<string, string> = {
      "--primary": "#E53935",
      "--primary-hover": "#C62828",
      "--primary-light": "rgba(229,57,53,0.15)",
      "--sidebar-bg": "#111318",
      "--panel-bg": "#1a1d24",
      "--border-light": "rgba(255,255,255,0.08)",
      "--text-primary": "#111827",
      "--text-secondary": "#6B7280",
      "--text-muted": "#9CA3AF",
      "--bg-page": "#F9FAFB",
      "--bg-card": "#FFFFFF",
      "--border-default": "#E5E7EB",
    };

    for (const [varName, value] of Object.entries(expected)) {
      const got = cs.getPropertyValue(varName);
      expect(normalizeCssVarValue(got)).toBe(normalizeCssVarValue(value));
    }
  });

  // @clause CLAUSE_005
  it("CLAUSE_005: rollout por rota — /dashboard usa AppLayoutV2 e rota não-dashboard usa AppLayout (V1)", async () => {
    /**
     * App.tsx cria BrowserRouter internamente (não dá para envolver com MemoryRouter).
     * Além disso, AuthProvider (supabase) não pode rodar em teste unitário: mock obrigatório.
     */
    vi.resetModules();

    // Providers/auth: pass-through (evita supabase e redirects)
    vi.doMock("@/auth/AuthProvider", () => ({
      AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/auth/RequireAuth", () => ({
      RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/auth/PublicOnly", () => ({
      PublicOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/ui/UIConfigProvider", () => ({
      UIConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/ui/RequirePermission", () => ({
      RequirePermission: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/components/ThemeProvider", () => ({
      ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/contexts/UIPreviewContext", () => ({
      UIPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));
    vi.doMock("@/components/PageLoader", () => ({
      PageLoader: () => <div data-testid="page-loader" />,
    }));

    // Mock dos layouts para observar qual foi escolhido pelo roteamento
    vi.doMock("@/ui/layout/AppLayout", () => ({
      AppLayout: () => <div data-testid="layout-v1" />,
    }));
    vi.doMock("@/ui/layout/v2/AppLayoutV2", () => ({
      __esModule: true,
      default: () => <div data-testid="layout-v2" />,
      AppLayoutV2: () => <div data-testid="layout-v2" />,
    }));

    const { default: App } = await import("@/App");

    // 1) /dashboard => V2
    window.history.pushState({}, "", "/dashboard");
    const r1 = render(<App />);
    expect(await screen.findByTestId("layout-v2")).toBeInTheDocument();
    r1.unmount();

    // 2) /leads (não-dashboard) => V1
    window.history.pushState({}, "", "/leads");
    render(<App />);
    expect(await screen.findByTestId("layout-v1")).toBeInTheDocument();
  });
});
