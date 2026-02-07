import { describe, it, expect } from "vitest";
import { LUCIDE_TOP_300, LUCIDE_ICON_REGISTRY, LUCIDE_CATEGORIES, getLucideIcon } from "../LucideIcons";

describe("LucideIcons", () => {
  it("should have 278 icons in TOP_300", () => {
    expect(LUCIDE_TOP_300).toHaveLength(278);
  });

  it("should have all TOP_300 icons in registry", () => {
    LUCIDE_TOP_300.forEach(iconName => {
      expect(LUCIDE_ICON_REGISTRY[iconName]).toBeDefined();
      expect(typeof LUCIDE_ICON_REGISTRY[iconName]).toBe("function");
    });
  });

  it("should resolve PascalCase icon names", () => {
    expect(getLucideIcon("Home")).toBeTruthy();
    expect(getLucideIcon("Settings")).toBeTruthy();
    expect(getLucideIcon("Search")).toBeTruthy();
    expect(getLucideIcon("Menu")).toBeTruthy();
  });

  it("should resolve kebab-case icon names", () => {
    expect(getLucideIcon("chevron-right")).toBeTruthy();
    expect(getLucideIcon("arrow-up-right")).toBeTruthy();
    expect(getLucideIcon("folder-open")).toBeTruthy();
    expect(getLucideIcon("lock-keyhole")).toBeTruthy();
  });

  it("should return null for non-existent icons", () => {
    expect(getLucideIcon("NonExistentIcon")).toBeNull();
    expect(getLucideIcon("InvalidName123")).toBeNull();
    expect(getLucideIcon("")).toBeNull();
  });

  it("should handle lucide: prefix", () => {
    expect(getLucideIcon("lucide:Home")).toBeTruthy();
    expect(getLucideIcon("lucide:Settings")).toBeTruthy();
    expect(getLucideIcon("lucide:chevron-right")).toBeTruthy();
  });

  it("should have all categories covered", () => {
    const categorized = new Set(Object.values(LUCIDE_CATEGORIES).flat());
    // All icons should be in at least one category
    expect(categorized.size).toBeGreaterThanOrEqual(LUCIDE_TOP_300.length);
  });

  it("should have valid category names", () => {
    const categoryNames = Object.keys(LUCIDE_CATEGORIES);
    expect(categoryNames.length).toBeGreaterThan(0);
    expect(categoryNames).toContain("Interface");
    expect(categoryNames).toContain("Files & Folders");
    expect(categoryNames).toContain("System & Settings");
  });

  it("should have no duplicate icons in registry", () => {
    const iconNames = Object.keys(LUCIDE_ICON_REGISTRY);
    const uniqueNames = new Set(iconNames);
    expect(iconNames.length).toBe(uniqueNames.size);
  });

  it("should match TOP_300 with registry keys", () => {
    const registryKeys = new Set(Object.keys(LUCIDE_ICON_REGISTRY));
    LUCIDE_TOP_300.forEach(icon => {
      expect(registryKeys.has(icon)).toBe(true);
    });
  });
});
