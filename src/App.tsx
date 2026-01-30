import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/app-layout"
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

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsListPage />} />
          <Route path="/runs/new" element={<NewValidationPage />} />
          <Route path="/runs/:id" element={<RunDetailsPage />} />
          <Route path="/runs/:id/v2" element={<RunDetailsPageV2 />} />
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
      </AppLayout>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
