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

describe("NodeRenderer registry", () => {
  it("renders a placeholder when the component is missing", () => {
    const node: NodeDef = {
      id: "comp-missing",
      type: "component",
      props: { name: "MissingComponent" },
    };

    const { container } = render(
      <ContractProvider layout={baseLayout} variables={{}} registry={{ components: {} }}>
        <NodeRenderer node={node} />
      </ContractProvider>
    );

    const placeholder = container.querySelector('[data-orqui-component-status="missing"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveTextContent('Componente "MissingComponent" não está registrado.');
  });

  it("renders the registered component with props and slots", () => {
    const Renderer = ({ title, slots }: { title: string; slots: Record<string, React.ReactNode> }) => (
      <div data-testid="registered-component">
        <span>{title}</span>
        <div data-testid="registered-slot">{slots?.default}</div>
      </div>
    );

    const node: NodeDef = {
      id: "comp-registered",
      type: "component",
      props: {
        name: "FancyComponent",
        props: { title: "Ola" },
        slots: {
          default: {
            id: "slot-text",
            type: "text",
            props: { content: "Slot renderizado" },
          },
        },
      },
    };

    render(
      <ContractProvider
        layout={baseLayout}
        variables={{}}
        registry={{ components: { FancyComponent: { renderer: Renderer } } }}
      >
        <NodeRenderer node={node} />
      </ContractProvider>
    );

    expect(screen.getByTestId("registered-component")).toBeInTheDocument();
    expect(screen.getByText("Ola")).toBeInTheDocument();
    expect(screen.getByText("Slot renderizado")).toBeInTheDocument();
  });
});
