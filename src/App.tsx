import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { DashboardPage } from "@/components/dashboard-page"
import { RunsListPage } from "@/components/runs-list-page"
import { RunDetailsPage } from "@/components/run-details-page"
import { RunDetailsPageV2 } from "@/components/run-details-page-v2"
import { NewValidationPage } from "@/components/new-validation-page"
import { GatesPage } from "@/components/gates-page"
import { ConfigPage } from "@/components/config-page"
import { PageEditorPage } from "@/components/page-editor-page"
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
import { LogsMetricsPage } from "@/components/logs-metrics-page"
import { AnalyticsPage } from "@/components/analytics-page"
import { CommandPalette } from "@/components/command-palette"
import { useCommandPalette } from "@/hooks/use-command-palette"
import { PageShellProvider, usePageShellState } from "@/hooks/use-page-shell"
import { AuthProvider } from "@/components/auth-provider"
import { ProtectedRoute } from "@/components/protected-route"
import { LoginPage } from "@/components/login-page"
import { RegisterPage } from "@/components/register-page"
import { UserMenu } from "@/components/user-menu"
import { ProfilePage } from "@/components/profile-page"

import layoutContractStatic from "../contracts/layout-contract.json"
import registryContract from "../contracts/ui-registry-contract.json"
import { ContractProvider, AppShell, IconValue } from "../packages/orqui/src/runtime"
import { useState, useEffect } from "react"

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
          <Route path="/logs" element={<LogsMetricsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
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
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShellWrapper>
    </ProtectedRoute>
  )
}

// ─── App Root ──────────────────────────────────────────────────────────────

function App() {
  const [layoutContract, setLayoutContract] = useState(layoutContractStatic)

  // Enable HMR for layout contract in development
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept('../contracts/layout-contract.json', (newModule) => {
        if (newModule) {
          console.log('[App] Layout contract reloaded via HMR')
          setLayoutContract(newModule.default)
        }
      })
    }
  }, [])

  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      <BrowserRouter>
        <AuthProvider>
          <PageShellProvider>
            <Routes>
              {/* Public routes — no AppShell, no auth required */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              {/* Protected fullscreen routes — auth required, no AppShell */}
              <Route
                path="/page-editor"
                element={
                  <ProtectedRoute>
                    <PageEditorPage />
                  </ProtectedRoute>
                }
              />
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
