import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { DashboardPage } from "@/components/dashboard-page"
import { RunsListPage } from "@/components/runs-list-page"
import { RunDetailsPage } from "@/components/run-details-page"
import { RunDetailsPageV2 } from "@/components/run-details-page-v2"
import { NewValidationPage } from "@/components/new-validation-page"
import { GatesPage } from "@/components/gates-page"
import { ConfigPage } from "@/components/config-page"
import { WorkspacesListPage } from "@/components/workspaces-list-page"
import { WorkspaceDetailsPage } from "@/components/workspace-details-page"
import { WorkspaceFormPage } from "@/components/workspace-form-page"
import { ProjectsListPage } from "@/components/projects-list-page"
import { ProjectDetailsPage } from "@/components/project-details-page"
import { ProjectFormPage } from "@/components/project-form-page"
import { MCPSessionPage } from "@/components/mcp-session-page"
import { OrchestratorPage } from "@/components/orchestrator-page"
import { AgentRunsPage } from "@/components/agent-runs-page"
import { AgentRunDetailsPage } from "@/components/agent-run-details-page"
import { CommandPalette } from "@/components/command-palette"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { PageShellProvider, usePageShellState } from "@/hooks/use-page-shell"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { ProtectedRoute } from "@/components/protected-route"
import { LoginPage } from "@/components/login-page"
import { RegisterPage } from "@/components/register-page"

import layoutContract from "../contracts/layout-contract.json"
import registryContract from "../contracts/ui-registry-contract.json"
import { ContractProvider, AppShell, IconValue } from "../packages/orqui/src/runtime"

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/runs", label: "Runs" },
  { to: "/orchestrator", label: "Orchestrator" },
  { to: "/agent-runs", label: "Agent Runs" },
  { to: "/gates", label: "Gates" },
  { to: "/workspaces", label: "Workspaces" },
  { to: "/projects", label: "Projects" },
  { to: "/mcp", label: "MCP" },
  { to: "/config", label: "Config" },
]

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: "block",
  padding: "8px 12px",
  borderRadius: 6,
  color: isActive ? "var(--orqui-colors-text)" : "var(--orqui-colors-text-muted)",
  background: isActive ? "var(--orqui-colors-surface-3)" : "transparent",
  textDecoration: "none" as const,
  fontSize: 14,
  fontWeight: isActive ? 500 : 400,
  transition: "all 0.15s",
})

// ─── User Menu (sidebar footer) ────────────────────────────────────────────

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div style={{ position: "relative" }}>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); logout() }}
        data-testid="logout-button"
        className="orqui-nav-item"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: collapsed ? "8px 0" : "8px 6px",
          borderRadius: 6,
          textDecoration: "none",
          color: "var(--sidebar-foreground, var(--foreground))",
          fontSize: 14,
          cursor: "pointer",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        {collapsed ? (
          <IconValue icon="ph:sign-out" size={18} color="var(--destructive, #ef4444)" />
        ) : (
          <>
            <IconValue icon="ph:sign-out" size={18} color="var(--destructive, #ef4444)" />
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
              background: "var(--destructive, #ef4444)",
              color: "#fff", lineHeight: "16px",
            }}>Sair</span>
          </>
        )}
      </a>
      {collapsed && (
        <span className="orqui-nav-tooltip" style={{
          position: "absolute",
          left: "calc(100% + 12px)",
          top: "50%",
          transform: "translateY(-50%)",
          background: "var(--surface-3, #1e1e28)",
          color: "var(--destructive, #ef4444)",
          border: "1px solid var(--border, #2a2a33)",
          borderRadius: 4,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "var(--font-mono, monospace)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.15s ease",
          zIndex: 1000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>Sair</span>
      )}
    </div>
  )
}

// ─── AppShell Wrapper ──────────────────────────────────────────────────────

function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const { open, setOpen, openPalette } = useCommandPalette()
  const location = useLocation()
  const { pageKey: shellPage } = usePageShellState()

  const pageKey = shellPage || location.pathname.split("/")[1] || "dashboard"

  return (
    <>
      <AppShell
        page={pageKey}
        sidebarHeader={
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--orqui-colors-accent)" }}>
              .Gatekeeper
          </span>
        }
        sidebarNav={
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === "/"} style={navLinkStyle}>
                {label}
              </NavLink>
            ))}
          </div>
        }
        sidebarFooter={(collapsed) => <UserMenu collapsed={collapsed} />}
        onSearch={() => openPalette()}
      >
        {children}
      </AppShell>
      <CommandPalette open={open} onOpenChange={setOpen} />
      <Toaster />
    </>
  )
}

// ─── Protected App (all routes inside AppShell) ────────────────────────────

function ProtectedApp() {
  return (
    <ProtectedRoute>
      <AppShellWrapper>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsListPage />} />
          <Route path="/runs/new" element={<NewValidationPage />} />
          <Route path="/runs/:id" element={<RunDetailsPageV2 />} />
          <Route path="/runs/:id/v2" element={<RunDetailsPageV2 />} />
          <Route path="/runs/:id/legacy" element={<RunDetailsPage />} />
          <Route path="/orchestrator" element={<OrchestratorPage />} />
          <Route path="/agent-runs" element={<AgentRunsPage />} />
          <Route path="/agent-runs/:id" element={<AgentRunDetailsPage />} />
          <Route path="/gates" element={<GatesPage />} />
          <Route path="/mcp" element={<MCPSessionPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/workspaces" element={<WorkspacesListPage />} />
          <Route path="/workspaces/new" element={<WorkspaceFormPage />} />
          <Route path="/workspaces/:id/edit" element={<WorkspaceFormPage />} />
          <Route path="/workspaces/:id" element={<WorkspaceDetailsPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShellWrapper>
    </ProtectedRoute>
  )
}

// ─── App Root ──────────────────────────────────────────────────────────────

function App() {
  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      <BrowserRouter>
        <AuthProvider>
          <PageShellProvider>
            <Routes>
              {/* Public routes — no AppShell, no auth required */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              {/* All other routes — protected + AppShell */}
              <Route path="/*" element={<ProtectedApp />} />
            </Routes>
          </PageShellProvider>
        </AuthProvider>
      </BrowserRouter>
    </ContractProvider>
  )
}

export default App
