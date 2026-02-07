import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Minus,
  RotateCw,
} from "lucide-react"
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
      className: "bg-status-passed/20 text-status-passed border-status-passed",
    },
    FAILED: {
      icon: XCircle,
      label: "Failed",
      className: "bg-status-failed/20 text-status-failed border-status-failed",
    },
    WARNING: {
      icon: AlertTriangle,
      label: "AlertTriangle",
      className: "bg-status-warning/20 text-status-warning border-status-warning/30",
    },
    RUNNING: {
      icon: RotateCw,
      label: "Running",
      className: "bg-status-running/20 text-status-passed border-status-running/30",
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
      <Icon className="w-3.5 h-3.5" fill="currentColor" strokeWidth={2} />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  )
}
