// ============================================================================
// EXEMPLO: Como consumir contratos Orqui na sua aplicação
// ============================================================================

import layoutContract from "../contracts/layout-contract.json";
import registryContract from "../contracts/ui-registry-contract.json";
import {
  ContractProvider,
  AppShell,
  Text,
  useToken,
  useTextStyle,
  useComponentDef,
  cssVar,
} from "@orqui/cli/runtime";

// ============================================================================
// 1. Setup com react-router
// ============================================================================
// import { BrowserRouter, Routes, Route } from "react-router-dom";

export function App() {
  return (
    <ContractProvider layout={layoutContract} registry={registryContract}>
      {/* <BrowserRouter>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter> */}
      <DashboardPage />
    </ContractProvider>
  );
}

// ============================================================================
// 2. MULTI-PAGE: cada página usa AppShell com prop `page`
//
// No contrato layout-contract.json:
//   "pages": {
//     "dashboard": { "label": "Dashboard", "route": "/dashboard", "overrides": {} },
//     "leads":     { "label": "Leads",     "route": "/leads",
//       "overrides": { "headerElements": { "cta": { "enabled": true, "label": "Novo Lead" } } }
//     },
//     "settings":  { "label": "Settings",  "route": "/settings",
//       "overrides": { "sidebar": { "enabled": false } }
//     }
//   }
//
// AppShell faz deep-merge do layout base com os overrides da page.
// ============================================================================

function DashboardPage() {
  return (
    <AppShell
      page="dashboard"
      sidebarNav={<NavLinks />}
      sidebarFooter={<UserMenu />}
      headerLeft={<Breadcrumb />}
      headerCenter={<PageTitle title="Dashboard" />}
      headerRight={<UserAvatar />}
      onSearch={(q) => console.log("search:", q)}
      onCTA={() => console.log("CTA clicked")}
    >
      <Text style_name="heading-1" as="h1">Dashboard</Text>
      <Text style_name="body" as="p">Layout governado pelo contrato Orqui.</Text>
    </AppShell>
  );
}

function LeadsPage() {
  return (
    <AppShell
      page="leads"
      sidebarNav={<NavLinks />}
      headerLeft={<Breadcrumb />}
      headerCenter={<PageTitle title="Leads" />}
      onCTA={() => console.log("Novo Lead")}
    >
      <Text style_name="heading-1" as="h1">Leads</Text>
    </AppShell>
  );
}

function SettingsPage() {
  return (
    <AppShell page="settings" headerCenter={<PageTitle title="Settings" />}>
      <Text style_name="heading-1" as="h1">Settings</Text>
    </AppShell>
  );
}

// ============================================================================
// 3. Logo — renderizado automaticamente pelo AppShell via contrato
// 4. Header Elements — renderizados automaticamente, callbacks via props
// ============================================================================

// Placeholder components
function NavLinks() { return <nav>nav links</nav>; }
function UserMenu() { return <div>user menu</div>; }
function Breadcrumb() { return <div>home / page</div>; }
function PageTitle({ title = "Page" }) { return <h1>{title}</h1>; }
function UserAvatar() { return <div>👤</div>; }
