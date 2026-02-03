// ============================================================================
// PagePresets — pre-built page templates
// ============================================================================

import React, { type CSSProperties } from "react";
import { usePageEditor } from "./PageEditorProvider";
import type { NodeDef, PageDef } from "./nodeDefaults";
import { generateId, createDefaultPage } from "./nodeDefaults";
import { C, MONO } from "./styles";

// ============================================================================
// Preset definitions
// ============================================================================

interface Preset {
  id: string;
  label: string;
  description: string;
  icon: string;
  tags: string[];
  build: () => NodeDef;
}

function node(type: string, props?: Record<string, any>, children?: NodeDef[], style?: Record<string, string>): NodeDef {
  return {
    id: generateId(type),
    type,
    ...(props ? { props } : {}),
    ...(children ? { children } : {}),
    ...(style ? { style } : {}),
  };
}

const PRESETS: Preset[] = [
  {
    id: "empty",
    label: "Vazia",
    description: "Página em branco com um stack",
    icon: "📄",
    tags: ["básico"],
    build: () => node("stack", { gap: "24px" }, []),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Título, stat cards em grid, tabela principal",
    icon: "📊",
    tags: ["dados", "overview"],
    build: () => node("stack", { gap: "24px" }, [
      // Header row
      node("row", { gap: "12px", align: "center", justify: "space-between" }, [
        node("heading", { content: "Dashboard", level: 1 }),
        node("row", { gap: "8px", align: "center" }, [
          node("search", { placeholder: "Buscar..." }),
          node("button", { label: "Nova ação", variant: "primary", icon: "Plus" }),
        ]),
      ]),
      // Stat cards
      node("grid", { columns: 4, gap: "16px" }, [
        node("stat-card", { label: "Total", value: "1,234", icon: "TrendUp" }),
        node("stat-card", { label: "Ativos", value: "567", icon: "CheckCircle" }),
        node("stat-card", { label: "Pendentes", value: "89", icon: "Clock" }),
        node("stat-card", { label: "Taxa", value: "94.2%", icon: "Percent" }),
      ]),
      // Filters row
      node("row", { gap: "8px", align: "center" }, [
        node("select", { placeholder: "Status", options: [
          { value: "all", label: "Todos" },
          { value: "active", label: "Ativos" },
          { value: "inactive", label: "Inativos" },
        ] }),
        node("select", { placeholder: "Período", options: [
          { value: "7d", label: "Últimos 7 dias" },
          { value: "30d", label: "Últimos 30 dias" },
          { value: "90d", label: "Últimos 90 dias" },
        ] }),
        node("spacer", { size: "1px" }),
      ]),
      // Main table
      node("table", {
        dataSource: "items",
        columns: [
          { key: "name", label: "Nome", width: "30%" },
          { key: "status", label: "Status", width: "15%" },
          { key: "date", label: "Data", width: "20%" },
          { key: "value", label: "Valor", width: "15%", align: "right" },
          { key: "actions", label: "", width: "20%", align: "right" },
        ],
      }),
    ]),
  },
  {
    id: "list",
    label: "Lista",
    description: "Título, barra de filtros, tabela com paginação",
    icon: "📋",
    tags: ["dados", "CRUD"],
    build: () => node("stack", { gap: "20px" }, [
      // Header
      node("row", { gap: "12px", align: "center", justify: "space-between" }, [
        node("stack", { gap: "4px" }, [
          node("heading", { content: "Itens", level: 1 }),
          node("text", { content: "Gerencie todos os registros" }),
        ]),
        node("button", { label: "Criar novo", variant: "primary", icon: "Plus" }),
      ]),
      // Filters
      node("row", { gap: "8px", align: "center" }, [
        node("search", { placeholder: "Buscar por nome..." }),
        node("select", { placeholder: "Status", options: [
          { value: "all", label: "Todos" },
          { value: "active", label: "Ativos" },
          { value: "archived", label: "Arquivados" },
        ] }),
        node("select", { placeholder: "Ordenar", options: [
          { value: "recent", label: "Mais recentes" },
          { value: "name", label: "Nome A-Z" },
          { value: "oldest", label: "Mais antigos" },
        ] }),
      ]),
      // Table
      node("table", {
        dataSource: "items",
        columns: [
          { key: "name", label: "Nome", width: "35%" },
          { key: "type", label: "Tipo", width: "15%" },
          { key: "status", label: "Status", width: "15%" },
          { key: "updated", label: "Atualizado", width: "20%" },
          { key: "actions", label: "", width: "15%", align: "right" },
        ],
      }),
    ]),
  },
  {
    id: "detail",
    label: "Detalhe",
    description: "Header com ações, info cards, key-value, tabs de conteúdo",
    icon: "🔍",
    tags: ["detalhe", "entidade"],
    build: () => node("stack", { gap: "24px" }, [
      // Header
      node("row", { gap: "12px", align: "center", justify: "space-between" }, [
        node("row", { gap: "12px", align: "center" }, [
          node("heading", { content: "Nome do item", level: 1 }),
          node("badge", { content: "Ativo", color: "success" }),
        ]),
        node("row", { gap: "8px", align: "center" }, [
          node("button", { label: "Editar", variant: "outline", icon: "PencilSimple" }),
          node("button", { label: "Excluir", variant: "destructive", icon: "Trash" }),
        ]),
      ]),
      // Info grid
      node("grid", { columns: 2, gap: "16px" }, [
        node("card", { title: "Informações", padding: "16px" }, [
          node("key-value", {
            layout: "horizontal",
            items: [
              { label: "ID", value: "#12345" },
              { label: "Criado em", value: "01/01/2025" },
              { label: "Atualizado", value: "15/01/2025" },
              { label: "Responsável", value: "João Silva" },
            ],
          }),
        ]),
        node("card", { title: "Métricas", padding: "16px" }, [
          node("grid", { columns: 2, gap: "12px" }, [
            node("stat-card", { label: "Execuções", value: "42", icon: "Play" }),
            node("stat-card", { label: "Taxa sucesso", value: "95%", icon: "CheckCircle" }),
          ]),
        ]),
      ]),
      // Tabs
      node("tabs", { items: [
        { id: "history", label: "Histórico" },
        { id: "config", label: "Configuração" },
        { id: "logs", label: "Logs" },
      ], defaultTab: "history" }),
      // Content area (placeholder)
      node("container", { padding: "16px" }, [
        node("table", {
          dataSource: "history",
          columns: [
            { key: "date", label: "Data", width: "25%" },
            { key: "event", label: "Evento", width: "35%" },
            { key: "user", label: "Usuário", width: "20%" },
            { key: "status", label: "Status", width: "20%" },
          ],
        }),
      ]),
    ]),
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Formulário com seções, campos agrupados",
    icon: "⚙",
    tags: ["config", "formulário"],
    build: () => node("stack", { gap: "24px" }, [
      node("heading", { content: "Configurações", level: 1 }),
      // Section 1
      node("card", { title: "Geral", padding: "20px" }, [
        node("stack", { gap: "16px" }, [
          node("key-value", {
            layout: "vertical",
            items: [
              { label: "Nome do projeto", value: "Meu Projeto" },
              { label: "Descrição", value: "Descrição do projeto" },
              { label: "Ambiente", value: "Produção" },
            ],
          }),
        ]),
      ]),
      // Section 2
      node("card", { title: "Notificações", padding: "20px" }, [
        node("stack", { gap: "12px" }, [
          node("key-value", {
            layout: "horizontal",
            items: [
              { label: "Email", value: "Ativado" },
              { label: "Slack", value: "Desativado" },
              { label: "Webhook", value: "Ativado" },
            ],
          }),
        ]),
      ]),
      // Actions
      node("row", { gap: "8px", align: "center", justify: "flex-end" }, [
        node("button", { label: "Cancelar", variant: "outline" }),
        node("button", { label: "Salvar", variant: "primary" }),
      ]),
    ]),
  },
  {
    id: "cards-grid",
    label: "Grade de Cards",
    description: "Header, busca, grid de cards",
    icon: "🃏",
    tags: ["visual", "galeria"],
    build: () => node("stack", { gap: "20px" }, [
      node("row", { gap: "12px", align: "center", justify: "space-between" }, [
        node("heading", { content: "Itens", level: 1 }),
        node("search", { placeholder: "Buscar..." }),
      ]),
      node("grid", { columns: 3, gap: "16px" }, [
        node("card", { title: "Card 1", padding: "16px" }, [
          node("text", { content: "Descrição do card" }),
          node("row", { gap: "4px", align: "center" }, [
            node("badge", { content: "Tag 1", color: "accent" }),
            node("badge", { content: "Tag 2", color: "muted" }),
          ]),
        ]),
        node("card", { title: "Card 2", padding: "16px" }, [
          node("text", { content: "Descrição do card" }),
          node("row", { gap: "4px", align: "center" }, [
            node("badge", { content: "Tag 1", color: "success" }),
          ]),
        ]),
        node("card", { title: "Card 3", padding: "16px" }, [
          node("text", { content: "Descrição do card" }),
          node("row", { gap: "4px", align: "center" }, [
            node("badge", { content: "Tag 1", color: "warning" }),
            node("badge", { content: "Tag 2", color: "danger" }),
          ]),
        ]),
      ]),
    ]),
  },
];

// ============================================================================
// Component
// ============================================================================

export function PagePresets() {
  const { state, dispatch, currentPage, currentContent } = usePageEditor();

  const applyToCurrentPage = (preset: Preset) => {
    if (!currentPage) return;
    const hasContent = currentContent?.children && currentContent.children.length > 0;
    if (hasContent && !confirm(`Substituir o conteúdo de "${currentPage.label}" pelo preset "${preset.label}"?`)) {
      return;
    }
    const content = preset.build();
    dispatch({
      type: "SET_PAGES",
      pages: {
        ...state.pages,
        [currentPage.id]: { ...currentPage, content },
      },
    });
  };

  const createNewPage = (preset: Preset) => {
    const id = `${preset.id}-${Date.now() % 10000}`;
    const page: PageDef = {
      id,
      label: preset.label,
      route: `/${id}`,
      content: preset.build(),
    };
    dispatch({ type: "ADD_PAGE", page });
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Presets</span>
        <span style={{ fontSize: 11, color: C.textDim }}>{PRESETS.length}</span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 12px" }}>
        {PRESETS.map(preset => (
          <div key={preset.id} style={presetCardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{preset.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{preset.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4, marginTop: 2 }}>{preset.description}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
                  {preset.tags.map(tag => (
                    <span key={tag} style={tagStyle}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {currentPage && (
                <button
                  onClick={() => applyToCurrentPage(preset)}
                  style={applyBtnStyle}
                  title={`Aplicar à página "${currentPage.label}"`}
                >
                  Aplicar aqui
                </button>
              )}
              <button
                onClick={() => createNewPage(preset)}
                style={newPageBtnStyle}
                title="Criar nova página com este preset"
              >
                + Nova página
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: CSSProperties = {
  width: "100%", height: "100%",
  display: "flex", flexDirection: "column",
  background: C.surface,
  fontFamily: "'Inter', -apple-system, sans-serif",
};

const headerStyle: CSSProperties = {
  padding: "12px 12px 8px",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};

const presetCardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.surface2,
  marginBottom: 6,
};

const tagStyle: CSSProperties = {
  fontSize: 9,
  padding: "1px 6px",
  borderRadius: 3,
  background: C.surface3,
  color: C.textDim,
  fontWeight: 500,
};

const applyBtnStyle: CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  border: `1px solid ${C.accent}30`,
  background: C.accent + "10",
  color: C.accent,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};

const newPageBtnStyle: CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.textMuted,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};
