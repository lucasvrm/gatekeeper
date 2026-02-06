import { describe, it, expect } from "vitest";
import { textStyleToCSS } from "../useTokens";

describe("textStyleToCSS", () => {
  it("resolves token references for typography fields", () => {
    const style = textStyleToCSS({
      fontFamily: "$tokens.fontFamilies.primary",
      fontSize: "$tokens.fontSizes.md",
      fontWeight: "$tokens.fontWeights.semibold",
      lineHeight: "$tokens.lineHeights.tight",
      letterSpacing: "$tokens.letterSpacings.wide",
    });

    expect(style).toMatchObject({
      fontFamily: "var(--orqui-fontFamilies-primary)",
      fontSize: "var(--orqui-fontSizes-md)",
      fontWeight: "var(--orqui-fontWeights-semibold)",
      lineHeight: "var(--orqui-lineHeights-tight)",
      letterSpacing: "var(--orqui-letterSpacings-wide)",
    });
  });

  it("keeps numeric values for lineHeight and letterSpacing", () => {
    const style = textStyleToCSS({
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 0.25,
    });

    expect(style.fontWeight).toBe(600);
    expect(style.lineHeight).toBe(1.4);
    expect(style.letterSpacing).toBe(0.25);
  });

  it("passes through literal string values", () => {
    const style = textStyleToCSS({
      lineHeight: "1.6",
      letterSpacing: "0.02em",
    });

    expect(style.lineHeight).toBe("1.6");
    expect(style.letterSpacing).toBe("0.02em");
  });
});
