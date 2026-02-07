import { useLocation, useNavigate, Link } from "react-router-dom"
import { List, ShieldCheck, Settings, Grid, FolderOpen, Folder, Bot } from "lucide-react"
import { AppShell } from "@orqui/runtime"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", path: "/", icon: Grid },
  { name: "Runs", path: "/runs", icon: List },
  { name: "Gates", path: "/gates", icon: ShieldCheck },
  { name: "Workspaces", path: "/workspaces", icon: Folder },
  { name: "Projects", path: "/projects", icon: FolderOpen },
  { name: "MCP", path: "/mcp", icon: Bot },
  { name: "Config", path: "/config", icon: Settings },
]

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // Derive current page key from path for contract page overrides
  const pageKey = location.pathname.split("/")[1] || "dashboard"

  const sidebarNav = (
    <ul className="space-y-1">
      {navigation.map((item) => {
        const isActive =
          item.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.path)
        const Icon = item.icon

        return (
          <li key={item.path}>
            <Link
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" fill={isActive ? "currentColor" : "none"} strokeWidth={2} />
              <span>{item.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )

  const sidebarFooter = (
    <div className="px-4 py-2 text-xs text-muted-foreground">
      <div className="font-mono">v1.0.0</div>
    </div>
  )

  return (
    <AppShell
      sidebarNav={sidebarNav}
      sidebarFooter={sidebarFooter}
      page={pageKey}
      navigate={navigate}
    >
      {children}
    </AppShell>
  )
}
