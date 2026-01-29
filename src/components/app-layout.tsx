import { Link, useLocation } from "react-router-dom"
import { List, ShieldCheck, Gear, SquaresFour, FolderOpen, Folders } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", path: "/", icon: SquaresFour },
  { name: "Workspaces", path: "/workspaces", icon: Folders },
  { name: "Projetos", path: "/projects", icon: FolderOpen },
  { name: "Runs", path: "/runs", icon: List },
  { name: "Gates", path: "/gates", icon: ShieldCheck },
  { name: "Config", path: "/config", icon: Gear },
]

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="border-r border-border bg-card flex flex-col w-64">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary-foreground" weight="fill" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Gatekeeper</h1>
              <p className="text-xs text-muted-foreground">Dashboard de Validações</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.path
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
                    <Icon className="w-5 h-5" weight={isActive ? "fill" : "regular"} />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="px-4 py-2 text-xs text-muted-foreground">
            <div className="font-mono">v1.0.0</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  )
}
