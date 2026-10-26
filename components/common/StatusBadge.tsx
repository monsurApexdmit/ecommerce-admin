import * as React from "react"

import { Badge } from "@/components/ui/badge"

export type StatusVariant = "default" | "secondary" | "destructive" | "outline"

const POSITIVE = ["active", "selling", "delivered", "published", "completed", "complete", "paid", "approved", "success", "succeeded", "in stock", "received", "shipped", "enabled", "verified", "fulfilled", "resolved", "ready", "open", "live"]
const PROGRESS = ["pending", "processing", "draft", "partial", "partially paid", "partially received", "in transit", "in progress", "scheduled", "trial", "trialing", "low stock", "on hold", "awaiting", "review", "in review", "ordered", "sent", "new", "packed"]
const NEGATIVE = ["out of stock", "expired", "cancelled", "canceled", "failed", "rejected", "overdue", "unpaid", "discontinued", "blocked", "suspended", "returned", "refunded", "void", "error", "declined", "lost", "damaged"]

/** Maps a status string to a Badge variant: positive=default, in-progress=secondary, negative=destructive, else outline. */
export function statusVariant(status: string): StatusVariant {
  const s = status.toLowerCase().replace(/[_-]+/g, " ").trim()
  if (POSITIVE.includes(s)) return "default"
  if (PROGRESS.includes(s)) return "secondary"
  if (NEGATIVE.includes(s)) return "destructive"
  return "outline"
}

interface StatusBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant"> {
  status: string
  /** Override the automatic mapping. */
  variant?: StatusVariant
  /** Display text (defaults to `status`). */
  label?: React.ReactNode
}

/** Badge for a record status with automatic variant mapping (see `statusVariant`). */
export function StatusBadge({ status, variant, label, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={variant ?? statusVariant(status)} {...props}>
      {label ?? status}
    </Badge>
  )
}
