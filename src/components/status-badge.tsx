import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  Minus,
  ArrowsClockwise,
} from "@phosphor-icons/react"
import type { RunStatus, ValidatorStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: RunStatus | ValidatorStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    PASSED: {
      icon: CheckCircle,
      label: "Passed",
      className: "bg-status-passed/20 text-status-passed border-status-passed/30",
    },
    FAILED: {
      icon: XCircle,
      label: "Failed",
      className: "bg-status-failed/20 text-status-failed border-status-failed/30",
    },
    WARNING: {
      icon: Warning,
      label: "Warning",
      className: "bg-status-warning/20 text-status-warning border-status-warning/30",
    },
    RUNNING: {
      icon: ArrowsClockwise,
      label: "Running",
      className: "bg-status-running/20 text-status-running border-status-running/30",
    },
    PENDING: {
      icon: Clock,
      label: "Pending",
      className: "bg-status-pending/20 text-status-pending border-status-pending/30",
    },
    ABORTED: {
      icon: XCircle,
      label: "Aborted",
      className: "bg-status-aborted/20 text-status-aborted border-status-aborted/30",
    },
    SKIPPED: {
      icon: Minus,
      label: "Skipped",
      className: "bg-status-skipped/20 text-status-skipped border-status-skipped/30",
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} ${className} flex items-center gap-1.5 px-2 py-0.5`}>
      <Icon className="w-3.5 h-3.5" weight="fill" />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  )
}
