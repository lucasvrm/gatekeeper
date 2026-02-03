// ============================================================================
// Node Catalog — types, defaults, categories
// ============================================================================

export interface NodeDef {
  id: string;
  type: string;
  props?: Record<string, any>;
  children?: NodeDef[];
  style?: Record<string, string>;
}

export interface PageDef {
  id: string;
  label: string;
  route: string;
  browserTitle?: string;
  content: NodeDef;
}

export interface NodeTypeMeta {
  type: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  isContainer: boolean;
}

// ---- ID generation ----

let _counter = Date.now() % 100000;
export function generateId(type: string): string {
  return `${type}-${++_counter}`;
}

// ---- Node type catalog ----

export const NODE_CATALOG: NodeTypeMeta[] = [
  // Layout
  { type: "stack", label: "Stack", icon: "☰", description: "Empilhamento vertical", category: "layout", isContainer: true },
  { type: "row", label: "Row", icon: "≡", description: "Linha horizontal", category: "layout", isContainer: true },
  { type: "grid", label: "Grid", icon: "⊞", description: "Grid com colunas", category: "layout", isContainer: true },
  { type: "container", label: "Container", icon: "☐", description: "Wrapper com padding/bg", category: "layout", isContainer: true },

  // Content
  { type: "heading", label: "Título", icon: "H", description: "H1–H6", category: "content", isContainer: false },
  { type: "text", label: "Texto", icon: "T", description: "Parágrafo de texto", category: "content", isContainer: false },
  { type: "button", label: "Botão", icon: "▣", description: "Botão clicável", category: "content", isContainer: false },
  { type: "badge", label: "Badge", icon: "●", description: "Tag/status", category: "content", isContainer: false },
  { type: "icon", label: "Ícone", icon: "★", description: "Ícone Phosphor", category: "content", isContainer: false },
  { type: "image", label: "Imagem", icon: "◻", description: "Imagem/avatar", category: "content", isContainer: false },
  { type: "divider", label: "Divisor", icon: "—", description: "Linha separadora", category: "content", isContainer: false },
  { type: "spacer", label: "Espaço", icon: "↕", description: "Espaçamento vazio", category: "content", isContainer: false },

  // Data
  { type: "stat-card", label: "Stat Card", icon: "📊", description: "Card de métrica", category: "data", isContainer: false },
  { type: "card", label: "Card", icon: "🃏", description: "Card genérico", category: "data", isContainer: true },
  { type: "table", label: "Tabela", icon: "📋", description: "Tabela de dados", category: "data", isContainer: false },
  { type: "list", label: "Lista", icon: "📃", description: "Lista/feed", category: "data", isContainer: false },
  { type: "key-value", label: "Key-Value", icon: "🔑", description: "Pares chave-valor", category: "data", isContainer: false },

  // Navigation
  { type: "tabs", label: "Tabs", icon: "⊟", description: "Abas de conteúdo", category: "navigation", isContainer: false },

  // Inputs
  { type: "search", label: "Busca", icon: "🔍", description: "Campo de busca", category: "input", isContainer: false },
  { type: "select", label: "Select", icon: "▾", description: "Dropdown", category: "input", isContainer: false },

  // Special
  { type: "slot", label: "Slot", icon: "⧉", description: "Injeção de componente custom", category: "special", isContainer: false },
];

export const CATEGORIES = [
  { id: "layout", label: "Layout" },
  { id: "content", label: "Conteúdo" },
  { id: "data", label: "Dados" },
  { id: "navigation", label: "Navegação" },
  { id: "input", label: "Inputs" },
  { id: "special", label: "Especial" },
];

export function getNodeMeta(type: string): NodeTypeMeta | undefined {
  return NODE_CATALOG.find(n => n.type === type);
}

export function isContainerType(type: string): boolean {
  return NODE_CATALOG.find(n => n.type === type)?.isContainer ?? false;
}

// ---- Default node factory ----

export function createDefaultNode(type: string): NodeDef {
  const id = generateId(type);
  const meta = getNodeMeta(type);
  const base: NodeDef = { id, type };

  if (meta?.isContainer) {
    base.children = [];
  }

  switch (type) {
    case "stack":
      base.props = { gap: "16px" };
      break;
    case "row":
      base.props = { gap: "8px", align: "center" };
      break;
    case "grid":
      base.props = { columns: 2, gap: "16px" };
      break;
    case "container":
      base.props = { padding: "16px" };
      break;
    case "heading":
      base.props = { content: "Título", level: 2 };
      break;
    case "text":
      base.props = { content: "Texto de exemplo" };
      break;
    case "button":
      base.props = { label: "Botão", variant: "primary" };
      break;
    case "badge":
      base.props = { content: "Status", color: "accent" };
      break;
    case "icon":
      base.props = { name: "Star", size: 20 };
      break;
    case "image":
      base.props = { src: "", size: 48, rounded: false, alt: "imagem" };
      break;
    case "divider":
      base.props = { color: "#2a2a33" };
      break;
    case "spacer":
      base.props = { size: "24px" };
      break;
    case "stat-card":
      base.props = { label: "Métrica", value: "0", icon: "TrendUp" };
      break;
    case "card":
      base.props = { title: "Card", padding: "16px" };
      break;
    case "table":
      base.props = {
        dataSource: "items",
        columns: [
          { key: "col1", label: "Coluna 1", width: "50%" },
          { key: "col2", label: "Coluna 2", width: "50%" },
        ],
      };
      break;
    case "list":
      base.props = { dataSource: "items", maxItems: 10 };
      break;
    case "key-value":
      base.props = {
        layout: "horizontal",
        items: [
          { label: "Chave", value: "Valor" },
        ],
      };
      break;
    case "tabs":
      base.props = {
        items: [
          { id: "tab1", label: "Tab 1" },
          { id: "tab2", label: "Tab 2" },
        ],
        defaultTab: "tab1",
      };
      break;
    case "search":
      base.props = { placeholder: "Buscar..." };
      break;
    case "select":
      base.props = {
        placeholder: "Selecionar...",
        options: [
          { value: "opt1", label: "Opção 1" },
          { value: "opt2", label: "Opção 2" },
        ],
      };
      break;
    case "slot":
      base.props = { name: "custom-slot" };
      break;
  }

  return base;
}

// ---- Empty page factory ----

export function createDefaultPage(id: string, label: string, route: string): PageDef {
  return {
    id,
    label,
    route,
    content: {
      id: generateId("stack"),
      type: "stack",
      props: { gap: "24px" },
      children: [],
    },
  };
}
