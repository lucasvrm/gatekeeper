// ============================================================================
// Example: Gatekeeper integration with Orqui v2 Runtime
// This file shows how a consuming app wires everything together
// ============================================================================

import React from "react";
import {
  ContractProvider,
  AppShell,
  PageRenderer,
  generateBaseCSS,
} from "@orqui/core";

// These are loaded from the project's contracts/ directory
import layoutContract from "../contracts/layout-contract.json";
import variablesSchema from "../orqui.variables.json";

// ============================================================================
// 1. App Root — inject the contract
// ============================================================================

export function App() {
  // Global data that's available on every page
  const [globalData, setGlobalData] = React.useState({
    stats: { total_runs: 142, passed_runs: 118, failed_runs: 24, pending_runs: 3, pass_rate: 83.1, avg_duration: 45000, total_projects: 5, total_workspaces: 2 },
    user: { name: "Lucas", role: "admin" },
    feature: { mcp_enabled: true, v2_details: true },
  });

  // Inject base CSS (tokens → CSS variables)
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = generateBaseCSS(layoutContract.tokens);
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Simple router state
  const [currentRoute, setRoute] = React.useState("/");

  // Map routes to page IDs
  const routeToPage: Record<string, string> = {
    "/": "dashboard",
    "/runs": "runs-list",
    "/gates": "gates",
    "/projects": "projects-list",
    "/workspaces": "workspaces-list",
    "/config": "config",
    "/mcp": "mcp",
  };

  const currentPage = routeToPage[currentRoute] || "dashboard";

  return (
    <ContractProvider
      layout={layoutContract as any}
      variables={variablesSchema}
      initialPage={currentPage}
      initialData={globalData}
      locale="pt-BR"
    >
      <AppShell
        data={globalData}
        onNavigate={setRoute}
        sidebarFooter={<SidebarFooter />}
        renderIcon={renderPhosphorIcon}
      >
        <CurrentPage page={currentPage} onNavigate={setRoute} />
      </AppShell>
    </ContractProvider>
  );
}

// ============================================================================
// 2. Page components — each page provides its own data
// ============================================================================

function CurrentPage({ page, onNavigate }: { page: string; onNavigate: (r: string) => void }) {
  switch (page) {
    case "dashboard":
      return <DashboardPage onNavigate={onNavigate} />;
    case "runs-list":
      return <RunsListPage onNavigate={onNavigate} />;
    case "gates":
      return <GatesPage onNavigate={onNavigate} />;
    default:
      return <PageRenderer page={page} onNavigate={onNavigate} />;
  }
}

function DashboardPage({ onNavigate }: { onNavigate: (r: string) => void }) {
  // Fetch recent runs (normally from API)
  const recentRuns = [
    { id: "run_7f3a2b1c", status: "passed", project: { name: "Frontend" }, current_gate: "Gate 3: QUALITY", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "run_4e2d1a0b", status: "failed", project: { name: "API" }, current_gate: "Gate 1: SANITIZATION", created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: "run_9c8b7d6e", status: "running", project: { name: "Mobile" }, current_gate: "Gate 2: EXECUTION", created_at: new Date(Date.now() - 1800000).toISOString() },
  ];

  return (
    <PageRenderer
      page="dashboard"
      data={{ recent_runs: recentRuns }}
      onNavigate={onNavigate}
    />
  );
}

function RunsListPage({ onNavigate }: { onNavigate: (r: string) => void }) {
  const runs = [
    { id: "run_7f3a2b1c", status: "passed", project: { name: "Frontend" }, current_gate: "COMPLETE", passed_validators: 24, total_validators: 24, duration: 154000, target_ref: "feat/new-button", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "run_4e2d1a0b", status: "failed", project: { name: "API" }, current_gate: "Gate 1: SANITIZATION", passed_validators: 3, total_validators: 24, duration: 12000, target_ref: "fix/auth-bug", created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: "run_9c8b7d6e", status: "running", project: { name: "Mobile" }, current_gate: "Gate 2: EXECUTION", passed_validators: 12, total_validators: 24, duration: 67000, target_ref: "feat/notifications", created_at: new Date(Date.now() - 1800000).toISOString() },
  ];

  return (
    <PageRenderer
      page="runs-list"
      data={{ runs }}
      onNavigate={onNavigate}
      onAction={(action, item) => {
        const run = item as any;
        if (action === "view") onNavigate(`/runs/${run.id}`);
        if (action === "rerun") console.log("Rerun:", run.id);
        if (action === "delete") console.log("Delete:", run.id);
      }}
    />
  );
}

function GatesPage({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <PageRenderer
      page="gates"
      onNavigate={onNavigate}
      slots={{
        "gates-overview": <GatesOverviewCustomComponent />,
      }}
    />
  );
}

// ============================================================================
// 3. Custom components injected via slots
// ============================================================================

function GatesOverviewCustomComponent() {
  // This is a fully custom React component that gets injected into the
  // contract-defined layout via the "slots" mechanism
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
      {[
        { name: "SANITIZATION", emoji: "🧹", validators: 6 },
        { name: "EXECUTION", emoji: "▶️", validators: 8 },
        { name: "QUALITY", emoji: "✨", validators: 6 },
        { name: "COMPLIANCE", emoji: "📋", validators: 4 },
      ].map((gate) => (
        <div
          key={gate.name}
          style={{
            background: "var(--orqui-colors-surface)",
            border: "1px solid var(--orqui-colors-border)",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>{gate.emoji}</div>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>{gate.name}</div>
          <div style={{ fontSize: "13px", color: "var(--orqui-colors-text-muted)" }}>
            {gate.validators} validadores
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div style={{ fontSize: "11px", color: "var(--orqui-colors-text-dim)", padding: "8px" }}>
      Gatekeeper v2.0.0
    </div>
  );
}

// ============================================================================
// 4. Icon resolver — maps contract icon names to actual React components
// ============================================================================

function renderPhosphorIcon(name: string, size: number = 18) {
  // In a real app, this would import from @phosphor-icons/react:
  //   import { House, Play, Gear, ... } from "@phosphor-icons/react";
  //   const icons = { House, Play, Gear, ... };
  //   return icons[name] ? React.createElement(icons[name], { size, weight: "regular" }) : null;

  // Placeholder: render icon name as text
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.6,
        opacity: 0.7,
      }}
      title={name}
    >
      ●
    </span>
  );
}
