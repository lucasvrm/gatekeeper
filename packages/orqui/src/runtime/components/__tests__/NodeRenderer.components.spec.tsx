// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractProvider } from "../../context/ContractProvider";
import { NodeRenderer } from "../NodeRenderer";
import type { NodeDef } from "../../context/ContractProvider";

const baseLayout = {
  app: { name: "Test" },
  tokens: {},
  textStyles: {},
  shell: { layout: "minimal" },
  navigation: [],
  pages: {},
} as any;

describe("NodeRenderer components", () => {
  it("normalizes Skeleton to skeleton node", () => {
    const node: NodeDef = {
      id: "skeleton-1",
      type: "Skeleton",
      props: { width: 120, height: 16 },
    };

    const { container } = render(
      <ContractProvider layout={baseLayout} variables={{}} registry={{ components: {} }}>
        <NodeRenderer node={node} />
      </ContractProvider>
    );

    expect(container.querySelector('[data-orqui-type="skeleton"]')).not.toBeNull();
    expect(container.querySelector("[data-orqui-skeleton]")).not.toBeNull();
  });

  it("normalizes Sonner to toast node", () => {
    const node: NodeDef = {
      id: "toast-1",
      type: "Sonner",
      props: { message: "Toast message" },
    };

    render(
      <ContractProvider layout={baseLayout} variables={{}} registry={{ components: {} }}>
        <NodeRenderer node={node} />
      </ContractProvider>
    );

    expect(screen.getByText("Toast message")).toBeInTheDocument();
    expect(document.querySelector('[data-orqui-type="toast"]')).not.toBeNull();
  });

  it("falls back to unknown when registry component is missing", () => {
    const node: NodeDef = {
      id: "missing-1",
      type: "FancyWidget",
      props: {},
    };

    const { container } = render(
      <ContractProvider layout={baseLayout} variables={{}} registry={{ components: {} }}>
        <NodeRenderer node={node} />
      </ContractProvider>
    );

    expect(container.querySelector('[data-orqui-unknown="FancyWidget"]')).not.toBeNull();
  });
});
