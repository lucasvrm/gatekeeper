import { cn } from "@/lib/utils"

interface UserAvatarProps {
  firstName: string
  size?: number
  className?: string
  isActive?: boolean
  status?: 'online' | 'offline' | 'away'
}

export function UserAvatar({
  firstName,
  size = 32,
  className,
  isActive = false,
  status
}: UserAvatarProps) {
  const initial = firstName.charAt(0).toUpperCase()

  return (
    <div
      role="img"
      aria-label={`${firstName}'s avatar`}
      className={cn(
        "flex items-center justify-center rounded-full font-semibold select-none relative",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: isActive
          ? "var(--sidebar-foreground)"
          : "var(--accent)",
        color: isActive
          ? "var(--background)"
          : "var(--accent-foreground)",
      }}
    >
      {initial}

      {/* Status indicator (opcional para futuro) */}
      {status && (
        <div
          className="absolute rounded-full border-2"
          style={{
            width: size * 0.25,
            height: size * 0.25,
            bottom: 0,
            right: 0,
            borderColor: "var(--background)",
            backgroundColor:
              status === 'online' ? '#30a46c' :
              status === 'away' ? '#f5a524' :
              '#6e6e80'
          }}
        />
      )}
    </div>
  )
}
