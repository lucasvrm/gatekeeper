// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ContractProvider } from "../../context";
import { AppShell } from "../AppShell";
import type { LayoutContract, UIRegistryContract } from "../../types";

describe("AppShell page overrides", () => {
  it("applies overrides when page is a route", () => {
    const layout: LayoutContract = {
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
            },
          },
        },
      },
    };
    const registry: UIRegistryContract = { components: {} };

    const { container } = render(
      <ContractProvider layout={layout} registry={registry}>
        <AppShell page="/dashboard">
          <div>content</div>
        </AppShell>
      </ContractProvider>
    );

    expect(container.querySelector("[data-orqui-sidebar]"))
      .toBeNull();
  });
});
