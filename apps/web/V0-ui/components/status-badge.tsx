import type { OfferStatus } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  OfferStatus,
  { label: string; className: string }
> = {
  running: {
    label: "Running",
    className: "bg-success/20 text-success",
  },
  paused: {
    label: "Paused",
    className: "bg-muted text-muted-foreground",
  },
  cap_hit: {
    label: "Cap Hit",
    className: "bg-warning/20 text-warning",
  },
  expired: {
    label: "Expired",
    className: "bg-destructive/20 text-destructive",
  },
}

export function StatusBadge({ status }: { status: OfferStatus }) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
