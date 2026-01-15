import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AppLayout } from "@/components/app-layout"
import { DashboardPage } from "@/components/dashboard-page"
import { RunsListPage } from "@/components/runs-list-page"
import { RunDetailsPage } from "@/components/run-details-page"
import { NewValidationPage } from "@/components/new-validation-page"
import { GatesPage } from "@/components/gates-page"
import { ConfigPage } from "@/components/config-page"

function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsListPage />} />
          <Route path="/runs/new" element={<NewValidationPage />} />
          <Route path="/runs/:id" element={<RunDetailsPage />} />
          <Route path="/gates" element={<GatesPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <Toaster />
    </BrowserRouter>
  )
}

export default App