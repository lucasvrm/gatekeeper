// ============================================================================
// Orqui Template Engine — Tests
// ============================================================================
import { describe, it, expect } from "vitest";

import {
  parseTemplate,
  hasTemplateExpressions,
  extractVariablePaths,
} from "../engine/parser";

import {
  resolveTemplate,
  resolveTemplateText,
  resolveTemplateForList,
  getNestedValue,
} from "../engine/resolver";
import type { DataContext, AppContext } from "../engine/resolver";

import { isRichValue, getFormatterNames } from "../engine/formatters";

import {
  evaluateVisibility,
  evaluateCondition,
  filterByVisibility,
} from "../engine/visibility";
import type { VisibilityRule } from "../engine/visibility";


// ============================================================================
// Parser Tests
// ============================================================================
describe("parseTemplate", () => {
  it("parses static strings (no expressions)", () => {
    const result = parseTemplate("Hello World");
    expect(result.isStatic).toBe(true);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0]).toEqual({ type: "literal", value: "Hello World" });
    expect(result.expressions).toHaveLength(0);
  });

  it("parses a single expression", () => {
    const result = parseTemplate("{{run.status}}");
    expect(result.isStatic).toBe(false);
    expect(result.expressions).toHaveLength(1);
    expect(result.expressions[0].path).toEqual(["run", "status"]);
    expect(result.expressions[0].formatters).toHaveLength(0);
  });

  it("parses mixed text and expressions", () => {
    const result = parseTemplate("Total: {{stats.count}} items");
    expect(result.parts).toHaveLength(3);
    expect(result.parts[0]).toEqual({ type: "literal", value: "Total: " });
    expect(result.parts[1].type).toBe("expression");
    expect(result.parts[2]).toEqual({ type: "literal", value: " items" });
  });

  it("parses multiple expressions", () => {
    const result = parseTemplate("{{run.id}} — {{run.status}}");
    expect(result.expressions).toHaveLength(2);
    expect(result.expressions[0].path).toEqual(["run", "id"]);
    expect(result.expressions[1].path).toEqual(["run", "status"]);
  });

  it("parses expression with single formatter", () => {
    const result = parseTemplate("{{run.status | badge}}");
    expect(result.expressions[0].formatters).toHaveLength(1);
    expect(result.expressions[0].formatters[0]).toEqual({ name: "badge", args: [] });
  });

  it("parses expression with formatter and argument", () => {
    const result = parseTemplate("{{run.id | truncate:8}}");
    expect(result.expressions[0].formatters[0]).toEqual({ name: "truncate", args: ["8"] });
  });

  it("parses chained formatters", () => {
    const result = parseTemplate("{{run.id | truncate:8 | uppercase}}");
    const fmts = result.expressions[0].formatters;
    expect(fmts).toHaveLength(2);
    expect(fmts[0]).toEqual({ name: "truncate", args: ["8"] });
    expect(fmts[1]).toEqual({ name: "uppercase", args: [] });
  });

  it("parses formatter with slash-separated args (boolean)", () => {
    const result = parseTemplate("{{active | boolean:Sim/Não}}");
    expect(result.expressions[0].formatters[0]).toEqual({ name: "boolean", args: ["Sim/Não"] });
  });

  it("parses $app prefix", () => {
    const result = parseTemplate("{{$app.name}}");
    expect(result.expressions[0].prefix).toBe("$app");
    expect(result.expressions[0].path).toEqual(["name"]);
  });

  it("parses $page prefix", () => {
    const result = parseTemplate("{{$page.label}}");
    expect(result.expressions[0].prefix).toBe("$page");
    expect(result.expressions[0].path).toEqual(["label"]);
  });

  it("parses $enum prefix", () => {
    const result = parseTemplate("{{$enum.run.status}}");
    expect(result.expressions[0].prefix).toBe("$enum");
    expect(result.expressions[0].path).toEqual(["run", "status"]);
  });

  it("parses $actions with list", () => {
    const result = parseTemplate("{{$actions: view, edit, delete}}");
    expect(result.expressions[0].prefix).toBe("$actions");
    expect(result.expressions[0].args).toEqual(["view", "edit", "delete"]);
  });

  it("handles empty string", () => {
    const result = parseTemplate("");
    expect(result.isStatic).toBe(true);
    expect(result.parts).toHaveLength(0);
  });

  it("handles null/undefined", () => {
    expect(parseTemplate(null as any).isStatic).toBe(true);
    expect(parseTemplate(undefined as any).isStatic).toBe(true);
  });

  it("handles unclosed braces as literal", () => {
    const result = parseTemplate("Hello {{ world");
    expect(result.isStatic).toBe(true);
    expect(result.parts[1]).toEqual({ type: "literal", value: "{{ world" });
  });

  it("handles deeply nested paths", () => {
    const result = parseTemplate("{{run.project.workspace.name}}");
    expect(result.expressions[0].path).toEqual(["run", "project", "workspace", "name"]);
  });

  it("trims whitespace inside expressions", () => {
    const result = parseTemplate("{{  run.status  |  badge  }}");
    expect(result.expressions[0].path).toEqual(["run", "status"]);
    expect(result.expressions[0].formatters[0].name).toBe("badge");
  });
});

describe("hasTemplateExpressions", () => {
  it("returns true for templates", () => {
    expect(hasTemplateExpressions("{{run.id}}")).toBe(true);
    expect(hasTemplateExpressions("Hello {{name}}")).toBe(true);
  });

  it("returns false for non-templates", () => {
    expect(hasTemplateExpressions("Hello World")).toBe(false);
    expect(hasTemplateExpressions("")).toBe(false);
    expect(hasTemplateExpressions(null as any)).toBe(false);
  });
});

describe("extractVariablePaths", () => {
  it("extracts paths from template", () => {
    const paths = extractVariablePaths("{{run.status}} — {{run.project.name}}");
    expect(paths).toEqual(["run.status", "run.project.name"]);
  });

  it("excludes $actions from paths", () => {
    const paths = extractVariablePaths("{{$actions: view, delete}}");
    expect(paths).toHaveLength(0);
  });

  it("includes $app paths", () => {
    const paths = extractVariablePaths("{{$app.name}}");
    expect(paths).toEqual(["$app.name"]);
  });
});


// ============================================================================
// Resolver Tests
// ============================================================================
describe("resolveTemplate", () => {
  const data: DataContext = {
    run: {
      id: "run_abc123",
      status: "passed",
      duration: 154000,
      project: { name: "Frontend App" },
      created_at: "2026-02-01T10:30:00Z",
    },
    stats: {
      total_runs: 142,
      pass_rate: 83.1,
      pending_runs: 3,
    },
    user: {
      name: "Lucas",
      role: "admin",
    },
  };

  const appCtx: AppContext = {
    app: { name: "Gatekeeper" },
    page: { id: "runs-list", label: "Runs", route: "/runs" },
    variables: {
      entities: {
        run: {
          fields: {
            status: {
              type: "enum",
              values: ["pending", "running", "passed", "failed"],
              colorMap: { pending: "warning", running: "accent", passed: "success", failed: "danger" },
            },
          },
        },
      },
    },
  };

  it("resolves static text unchanged", () => {
    const result = resolveTemplate("Hello World", data);
    expect(result.text).toBe("Hello World");
    expect(result.hasRichValues).toBe(false);
  });

  it("resolves simple variable", () => {
    expect(resolveTemplateText("{{run.id}}", data)).toBe("run_abc123");
  });

  it("resolves nested variable", () => {
    expect(resolveTemplateText("{{run.project.name}}", data)).toBe("Frontend App");
  });

  it("resolves mixed template", () => {
    expect(resolveTemplateText("Run: {{run.id}} ({{run.status}})", data)).toBe("Run: run_abc123 (passed)");
  });

  it("resolves $app variables", () => {
    expect(resolveTemplateText("{{$app.name}}", data, appCtx)).toBe("Gatekeeper");
  });

  it("resolves $page variables", () => {
    expect(resolveTemplateText("{{$page.label}}", data, appCtx)).toBe("Runs");
  });

  it("resolves undefined variable to empty string", () => {
    expect(resolveTemplateText("{{run.nonexistent}}", data)).toBe("");
  });

  it("resolves globals directly", () => {
    expect(resolveTemplateText("{{stats.total_runs}}", data)).toBe("142");
  });

  it("resolves user info", () => {
    expect(resolveTemplateText("{{user.name}}", data)).toBe("Lucas");
  });

  // Formatter tests
  it("applies truncate formatter", () => {
    expect(resolveTemplateText("{{run.id | truncate:8}}", data)).toBe("run_abc1…");
  });

  it("applies uppercase formatter", () => {
    expect(resolveTemplateText("{{run.status | uppercase}}", data)).toBe("PASSED");
  });

  it("applies capitalize formatter", () => {
    expect(resolveTemplateText("{{run.status | capitalize}}", data)).toBe("Passed");
  });

  it("applies chained formatters", () => {
    expect(resolveTemplateText("{{run.id | truncate:6 | uppercase}}", data)).toBe("RUN_AB…");
  });

  it("applies duration formatter", () => {
    expect(resolveTemplateText("{{run.duration | duration}}", data)).toBe("2m 34s");
  });

  it("applies percent formatter", () => {
    expect(resolveTemplateText("{{stats.pass_rate | percent}}", data)).toBe("83.1%");
  });

  it("applies number formatter", () => {
    expect(resolveTemplateText("{{stats.total_runs | number}}", data, appCtx)).toMatch(/142/);
  });

  it("applies default formatter on missing value", () => {
    expect(resolveTemplateText("{{run.nonexistent | default:N/A}}", data)).toBe("N/A");
  });

  it("applies default formatter — does not override existing value", () => {
    expect(resolveTemplateText("{{run.status | default:N/A}}", data)).toBe("passed");
  });

  it("applies badge formatter — returns rich value", () => {
    const result = resolveTemplate("{{run.status | badge}}", data, appCtx);
    expect(result.hasRichValues).toBe(true);
    const resolved = result.parts[0];
    expect(resolved.type).toBe("resolved");
    if (resolved.type === "resolved" && isRichValue(resolved.value)) {
      expect(resolved.value.type).toBe("badge");
      expect(resolved.value.text).toBe("passed");
      expect(resolved.value.color).toBe("success");
    }
  });

  it("applies boolean formatter", () => {
    const d = { active: true };
    expect(resolveTemplateText("{{active | boolean:Sim/Não}}", d)).toBe("Sim");

    const d2 = { active: false };
    expect(resolveTemplateText("{{active | boolean:Sim/Não}}", d2)).toBe("Não");
  });

  it("applies boolean:icon formatter — returns rich value", () => {
    const result = resolveTemplate("{{active | boolean:icon}}", { active: true });
    expect(result.hasRichValues).toBe(true);
  });

  it("applies date:relative formatter", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const result = resolveTemplateText("{{ts | date:relative}}", { ts: fiveMinAgo });
    expect(result).toBe("5m atrás");
  });

  it("applies date:iso formatter", () => {
    const result = resolveTemplateText("{{run.created_at | date:iso}}", data);
    expect(result).toBe("2026-02-01");
  });

  it("resolves $enum from variable schema", () => {
    const result = resolveTemplateText("{{$enum.run.status}}", data, appCtx);
    expect(result).toBe('["pending","running","passed","failed"]');
  });

  it("resolves $actions as placeholder", () => {
    const result = resolveTemplate("{{$actions: view, edit, delete}}", data, appCtx);
    expect(result.text).toContain("view");
  });
});

describe("getNestedValue", () => {
  it("gets top-level value", () => {
    expect(getNestedValue({ a: 1 }, ["a"])).toBe(1);
  });

  it("gets nested value", () => {
    expect(getNestedValue({ a: { b: { c: 42 } } }, ["a", "b", "c"])).toBe(42);
  });

  it("returns undefined for missing path", () => {
    expect(getNestedValue({ a: 1 }, ["b"])).toBeUndefined();
  });

  it("returns undefined for null intermediary", () => {
    expect(getNestedValue({ a: null }, ["a", "b"])).toBeUndefined();
  });

  it("handles empty path", () => {
    const obj = { x: 1 };
    expect(getNestedValue(obj, [])).toEqual(obj);
  });
});

describe("resolveTemplateForList", () => {
  it("resolves template for each item", () => {
    const items = [
      { id: "a", status: "passed" },
      { id: "b", status: "failed" },
    ];
    const results = resolveTemplateForList("{{run.id}}: {{run.status}}", "run", items);
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe("a: passed");
    expect(results[1].text).toBe("b: failed");
  });
});


// ============================================================================
// Formatters — Additional coverage
// ============================================================================
describe("formatters registry", () => {
  it("has all built-in formatters registered", () => {
    const names = getFormatterNames();
    const expected = [
      "badge", "date", "currency", "number", "percent",
      "truncate", "uppercase", "lowercase", "capitalize",
      "duration", "boolean", "icon", "link", "color",
      "default", "json", "count", "join", "first", "last",
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});

describe("currency formatter", () => {
  it("formats BRL", () => {
    const result = resolveTemplateText("{{val | currency:BRL}}", { val: 1234.56 }, { locale: "pt-BR" });
    expect(result).toMatch(/1\.234,56/);
  });

  it("formats USD", () => {
    const result = resolveTemplateText("{{val | currency:USD}}", { val: 1234.56 }, { locale: "en-US" });
    expect(result).toMatch(/1,234\.56/);
  });
});

describe("duration formatter", () => {
  it("formats milliseconds", () => {
    expect(resolveTemplateText("{{d | duration}}", { d: 500 })).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(resolveTemplateText("{{d | duration}}", { d: 45000 })).toBe("45s");
  });

  it("formats minutes", () => {
    expect(resolveTemplateText("{{d | duration}}", { d: 90000 })).toBe("1m 30s");
  });

  it("formats hours", () => {
    expect(resolveTemplateText("{{d | duration}}", { d: 7200000 })).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(resolveTemplateText("{{d | duration}}", { d: 5400000 })).toBe("1h 30m");
  });
});

describe("number:compact formatter", () => {
  it("formats compact thousands", () => {
    const result = resolveTemplateText("{{n | number:compact}}", { n: 1234 }, { locale: "en-US" });
    expect(result).toMatch(/1\.?2K/i);
  });
});

describe("array formatters", () => {
  it("count returns array length", () => {
    expect(resolveTemplateText("{{items | count}}", { items: [1, 2, 3] })).toBe("3");
  });

  it("join joins array", () => {
    expect(resolveTemplateText("{{items | join}}", { items: ["a", "b", "c"] })).toBe("a, b, c");
  });

  it("join with custom separator", () => {
    expect(resolveTemplateText("{{items | join:-}}", { items: ["a", "b"] })).toBe("a-b");
  });

  it("first returns first element", () => {
    expect(resolveTemplateText("{{items | first}}", { items: ["a", "b", "c"] })).toBe("a");
  });

  it("last returns last element", () => {
    expect(resolveTemplateText("{{items | last}}", { items: ["a", "b", "c"] })).toBe("c");
  });
});

describe("json formatter", () => {
  it("stringifies objects", () => {
    const result = resolveTemplateText("{{obj | json}}", { obj: { a: 1 } });
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });
});

describe("link formatter", () => {
  it("returns rich link value", () => {
    const result = resolveTemplate("{{name | link:/users/123}}", { name: "Lucas" });
    expect(result.hasRichValues).toBe(true);
    const part = result.parts[0];
    if (part.type === "resolved" && isRichValue(part.value)) {
      expect(part.value.type).toBe("link");
      expect(part.value.text).toBe("Lucas");
      expect(part.value.href).toBe("/users/123");
    }
  });
});


// ============================================================================
// Visibility Tests
// ============================================================================
describe("evaluateVisibility", () => {
  const data: DataContext = {
    user: { role: "admin", name: "Lucas" },
    stats: { pending_runs: 3, total: 100 },
    feature: { mcp_enabled: true, beta: false },
  };

  it("returns true when no rule", () => {
    expect(evaluateVisibility(undefined, "dashboard")).toBe(true);
  });

  it("filters by pages — visible", () => {
    const rule: VisibilityRule = { pages: ["dashboard", "runs"] };
    expect(evaluateVisibility(rule, "dashboard", data)).toBe(true);
  });

  it("filters by pages — hidden", () => {
    const rule: VisibilityRule = { pages: ["runs", "gates"] };
    expect(evaluateVisibility(rule, "dashboard", data)).toBe(false);
  });

  it("wildcard pages shows everywhere", () => {
    const rule: VisibilityRule = { pages: ["*"] };
    expect(evaluateVisibility(rule, "anypage", data)).toBe(true);
  });

  it("filters by breakpoint", () => {
    const rule: VisibilityRule = { breakpoints: { hidden: ["mobile"] } };
    expect(evaluateVisibility(rule, "dashboard", data, {}, { breakpoint: "mobile" })).toBe(false);
    expect(evaluateVisibility(rule, "dashboard", data, {}, { breakpoint: "desktop" })).toBe(true);
  });
});

describe("evaluateCondition", () => {
  const data: DataContext = {
    user: { role: "admin" },
    stats: { pending_runs: 3, count: 0 },
    feature: { mcp_enabled: true, beta: false },
    run: { status: "passed" },
  };

  it("evaluates string equality", () => {
    expect(evaluateCondition("{{user.role}} === 'admin'", data)).toBe(true);
    expect(evaluateCondition("{{user.role}} === 'viewer'", data)).toBe(false);
  });

  it("evaluates string inequality", () => {
    expect(evaluateCondition("{{run.status}} !== 'pending'", data)).toBe(true);
    expect(evaluateCondition("{{run.status}} !== 'passed'", data)).toBe(false);
  });

  it("evaluates numeric greater than", () => {
    expect(evaluateCondition("{{stats.pending_runs}} > 0", data)).toBe(true);
    expect(evaluateCondition("{{stats.count}} > 0", data)).toBe(false);
  });

  it("evaluates numeric greater than or equal", () => {
    expect(evaluateCondition("{{stats.pending_runs}} >= 3", data)).toBe(true);
    expect(evaluateCondition("{{stats.pending_runs}} >= 4", data)).toBe(false);
  });

  it("evaluates numeric less than", () => {
    expect(evaluateCondition("{{stats.pending_runs}} < 10", data)).toBe(true);
    expect(evaluateCondition("{{stats.pending_runs}} < 2", data)).toBe(false);
  });

  it("evaluates boolean true", () => {
    expect(evaluateCondition("{{feature.mcp_enabled}} === true", data)).toBe(true);
    expect(evaluateCondition("{{feature.beta}} === true", data)).toBe(false);
  });

  it("evaluates boolean false", () => {
    expect(evaluateCondition("{{feature.beta}} === false", data)).toBe(true);
    expect(evaluateCondition("{{feature.mcp_enabled}} === false", data)).toBe(false);
  });

  it("evaluates truthy check (no operator)", () => {
    expect(evaluateCondition("{{feature.mcp_enabled}}", data)).toBe(true);
    expect(evaluateCondition("{{feature.beta}}", data)).toBe(false);
  });

  it("evaluates empty condition as true", () => {
    expect(evaluateCondition("", data)).toBe(true);
  });

  it("evaluates missing variable as falsy", () => {
    expect(evaluateCondition("{{feature.nonexistent}}", data)).toBe(false);
  });

  it("evaluates == (loose equality) same as ===", () => {
    expect(evaluateCondition("{{user.role}} == 'admin'", data)).toBe(true);
  });

  it("evaluates != same as !==", () => {
    expect(evaluateCondition("{{run.status}} != 'failed'", data)).toBe(true);
  });
});

describe("filterByVisibility", () => {
  it("filters items based on visibility rules", () => {
    const items = [
      { id: "a", visibility: { pages: ["dashboard"] } },
      { id: "b", visibility: { pages: ["runs"] } },
      { id: "c" },  // no visibility = always visible
      { id: "d", visibility: { condition: "{{feature.mcp_enabled}}" } },
    ];

    const data: DataContext = { feature: { mcp_enabled: true } };
    const filtered = filterByVisibility(items, "dashboard", data);
    expect(filtered.map((i) => i.id)).toEqual(["a", "c", "d"]);
  });

  it("filters with combined page + condition", () => {
    const items = [
      { id: "a", visibility: { pages: ["dashboard"], condition: "{{user.role}} === 'admin'" } },
    ];

    // Wrong page
    expect(filterByVisibility(items, "runs", { user: { role: "admin" } })).toHaveLength(0);
    // Right page, wrong role
    expect(filterByVisibility(items, "dashboard", { user: { role: "viewer" } })).toHaveLength(0);
    // Right page, right role
    expect(filterByVisibility(items, "dashboard", { user: { role: "admin" } })).toHaveLength(1);
  });
});
