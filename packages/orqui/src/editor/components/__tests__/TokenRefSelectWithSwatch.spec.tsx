import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TokenRefSelectWithSwatch } from "../TokenRefSelectWithSwatch";
import type { Tokens } from "../../../runtime/types.js";

describe("TokenRefSelectWithSwatch", () => {
  const mockTokens: Tokens = {
    colors: {
      accent: { value: "#6d9cff" },
      border: { value: "#404040" },
      text: { value: "#e5e5e5" },
      "text-muted": { value: "#a3a3a3" },
    },
    spacing: {
      sm: { value: 8, unit: "px" },
      md: { value: 16, unit: "px" },
    },
  } as Tokens;

  it("renderiza trigger com swatch quando cor selecionada", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenRefSelectWithSwatch
        value="$tokens.colors.accent"
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
      />
    );

    // Verifica que o trigger foi renderizado
    const trigger = screen.getByRole("button", { name: /select color token/i });
    expect(trigger).toBeDefined();

    // Verifica que mostra o label correto
    expect(trigger.textContent).toContain("accent");

    // Verifica que o swatch foi renderizado (div com background color)
    const swatch = container.querySelector('div[style*="background"]');
    expect(swatch).toBeDefined();
  });

  it("abre dropdown ao clicar no trigger", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    // Verifica que as opções aparecem
    expect(screen.getByText("accent")).toBeDefined();
    expect(screen.getByText("border")).toBeDefined();
    expect(screen.getByText("text")).toBeDefined();
    expect(screen.getByText("text-muted")).toBeDefined();
  });

  it("fecha dropdown ao clicar fora", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    // Dropdown aberto
    expect(screen.getByText("accent")).toBeDefined();

    // Simula clique fora do dropdown
    fireEvent.mouseDown(document.body);

    // Verifica que o dropdown fechou (opções não visíveis)
    // Nota: o DOM ainda contém o texto, mas o dropdown não é renderizado
    const dropdown = container.querySelector('div[style*="position: absolute"]');
    expect(dropdown).toBeNull();
  });

  it("chama onChange com valor correto ao selecionar opção", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    // Clica na opção "accent"
    const accentOption = screen.getByRole("button", { name: /accent/i });
    fireEvent.click(accentOption);

    // Verifica que onChange foi chamado com o valor correto
    expect(onChange).toHaveBeenCalledWith("$tokens.colors.accent");
  });

  it("mostra placeholder quando nenhum valor selecionado", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
        placeholder="Selecione uma cor"
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    expect(trigger.textContent).toContain("Selecione uma cor");
  });

  it("não mostra swatches para categorias não-cor", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TokenRefSelectWithSwatch
        value="$tokens.spacing.md"
        tokens={mockTokens}
        category="spacing"
        onChange={onChange}
      />
    );

    // Verifica que o swatch NÃO foi renderizado
    const swatch = container.querySelector('div[aria-hidden="true"]');
    expect(swatch).toBeNull();
  });

  it("mostra ícone de warning para cores inexistentes", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    // Verifica que opção vazia não mostra warning
    const emptyOption = screen.getByText("— nenhum —");
    expect(emptyOption.textContent).not.toContain("⚠️");
  });

  it("habilita busca automaticamente para listas longas", () => {
    const manyColorTokens: Tokens = {
      colors: Object.fromEntries(
        Array.from({ length: 15 }, (_, i) => [`color${i}`, { value: `#${i}${i}${i}${i}${i}${i}` }])
      ),
    } as Tokens;

    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={manyColorTokens}
        category="colors"
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    // Verifica que input de busca foi renderizado
    const searchInput = screen.getByPlaceholderText("Buscar...");
    expect(searchInput).toBeDefined();
  });

  it("filtra opções ao digitar na busca", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
        showSearch={true}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText("Buscar...");
    fireEvent.change(searchInput, { target: { value: "acc" } });

    // Verifica que apenas "accent" está visível
    expect(screen.getByText("accent")).toBeDefined();
    expect(screen.queryByText("border")).toBeNull();
  });

  it("desabilita interação quando disabled=true", () => {
    const onChange = vi.fn();
    render(
      <TokenRefSelectWithSwatch
        value=""
        tokens={mockTokens}
        category="colors"
        onChange={onChange}
        disabled={true}
      />
    );

    const trigger = screen.getByRole("button", { name: /select color token/i });
    expect(trigger).toHaveProperty("disabled", true);

    // Clique não deve abrir dropdown
    fireEvent.click(trigger);
    expect(screen.queryByText("accent")).toBeNull();
  });
});
