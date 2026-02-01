import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom"
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

import layoutContract from "../contracts/layout-contract.json"
import registryContract from "../contracts/ui-registry-contract.json"
import { ContractProvider, AppShell } from "../packages/orqui/src/runtime"

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/runs", label: "Runs" },
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
  color: isActive ? "var(--uild-colors-text)" : "var(--uild-colors-text-muted)",
  background: isActive ? "var(--uild-colors-surface-3)" : "transparent",
  textDecoration: "none" as const,
  fontSize: 14,
  fontWeight: isActive ? 500 : 400,
  transition: "all 0.15s",
})

function App() {
  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      <BrowserRouter>
        <AppShell
          sidebarHeader={
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--uild-colors-accent)" }}>
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
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/runs" element={<RunsListPage />} />
            <Route path="/runs/new" element={<NewValidationPage />} />
            <Route path="/runs/:id" element={<RunDetailsPageV2 />} />
            <Route path="/runs/:id/v2" element={<RunDetailsPageV2 />} />
            <Route path="/runs/:id/legacy" element={<RunDetailsPage />} />
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
        </AppShell>
        <Toaster />
      </BrowserRouter>
    </ContractProvider>
  )
}

export default App