// ============================================================================
// Orqui Template Engine — Public API
// ============================================================================

// Parser
export {
  parseTemplate,
  hasTemplateExpressions,
  extractVariablePaths,
} from "./parser.js";
export type {
  ParsedTemplate,
  TemplatePart,
  TemplateLiteral,
  TemplateExpression,
  FormatterCall,
  SpecialPrefix,
} from "./parser.js";

// Formatters
export {
  registerFormatter,
  getFormatter,
  getFormatterNames,
  isRichValue,
  builtinFormatters,
} from "./formatters.js";
export type {
  FormatterFn,
  FormatterContext,
  FormattedValue,
  RichFormattedValue,
} from "./formatters.js";

// Resolver
export {
  resolveTemplate,
  resolveTemplateParsed,
  resolveTemplateText,
  resolveTemplateRecord,
  resolveTemplateForList,
  getNestedValue,
} from "./resolver.js";
export type {
  DataContext,
  AppContext,
  ResolvedTemplate,
  ResolvedPart,
  ResolvedLiteral,
  ResolvedValue,
} from "./resolver.js";

// Visibility
export {
  evaluateVisibility,
  evaluateCondition,
  filterByVisibility,
} from "./visibility.js";
export type {
  VisibilityRule,
  ViewportContext,
} from "./visibility.js";
