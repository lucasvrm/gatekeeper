import { useAuth } from "@/components/auth-provider"
import { useNavigate } from "react-router-dom"
import { UserAvatar } from "@/components/user-avatar"
import { IconValue } from "../../packages/orqui/src/runtime"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface UserMenuProps {
  collapsed: boolean
}

export function UserMenu({ collapsed }: UserMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  // Collapsed: apenas avatar
  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 4px",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              width: "100%",
            }}
            className="hover:bg-[var(--surface-2)]"
            aria-label="Menu do usuário"
          >
            <UserAvatar firstName={user.firstName} size={32} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuLabel className="text-muted-foreground">
            {user.email}
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => navigate('/profile')}>
            <IconValue icon="lucide:user" size={16} />
            <span style={{ marginLeft: 8 }}>Profile</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.preventDefault()
              logout()
            }}
          >
            <IconValue icon="lucide:log-out" size={16} />
            <span style={{ marginLeft: 8 }}>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Expanded: avatar + nome
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 6px",
            borderRadius: 6,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            width: "100%",
            color: "var(--sidebar-foreground)",
            fontSize: 14,
          }}
          className="hover:bg-[var(--surface-2)]"
          aria-label="Menu do usuário"
        >
          <UserAvatar firstName={user.firstName} size={32} />
          <span style={{ fontWeight: 500 }}>
            {user.firstName} {user.lastName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel className="text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <IconValue icon="lucide:user" size={16} />
          <span style={{ marginLeft: 8 }}>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive"
          onClick={(e) => {
            e.preventDefault()
            logout()
          }}
        >
          <IconValue icon="lucide:log-out" size={16} />
          <span style={{ marginLeft: 8 }}>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
