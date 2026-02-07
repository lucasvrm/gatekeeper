import { useAuth } from "@/components/auth-provider"
import { UserAvatar } from "@/components/user-avatar"
import { Card } from "@/components/ui/card"

export function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="page-gap">
      <header>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </header>

      <Card className="p-6">
        <div className="flex items-start gap-6">
          <UserAvatar firstName={user.firstName} size={80} />
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Account Information</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              User ID
            </label>
            <p className="font-mono text-sm">{user.id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p>{user.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p>{user.firstName} {user.lastName}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
