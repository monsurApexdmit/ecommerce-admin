"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"

export type StatusVariant = "default" | "secondary" | "destructive" | "outline"

const POSITIVE = ["active", "selling", "delivered", "published", "completed", "complete", "paid", "approved", "success", "succeeded", "in stock", "received", "shipped", "enabled", "verified", "fulfilled", "resolved", "ready", "open", "live"]
const PROGRESS = ["pending", "processing", "draft", "partial", "partially paid", "partially received", "in transit", "in progress", "scheduled", "trial", "trialing", "low stock", "on hold", "awaiting", "review", "in review", "ordered", "sent", "new", "packed"]
const NEGATIVE = ["out of stock", "expired", "cancelled", "canceled", "failed", "rejected", "overdue", "unpaid", "discontinued", "blocked", "suspended", "returned", "refunded", "void", "error", "declined", "lost", "damaged"]

const normalize = (status: string) => status.toLowerCase().replace(/[_-]+/g, " ").trim()

/** Maps a status string to a Badge variant: positive=default, in-progress=secondary, negative=destructive, else outline. */
export function statusVariant(status: string): StatusVariant {
  const s = normalize(status)
  if (POSITIVE.includes(s)) return "default"
  if (PROGRESS.includes(s)) return "secondary"
  if (NEGATIVE.includes(s)) return "destructive"
  return "outline"
}

// Known status codes (normalised: lowercase, "_"/"-" -> space) -> translation key. Unknown codes show as-is.
const STATUS_KEYS = {
  active: "common:status.active",
  inactive: "common:status.inactive",
  draft: "common:status.draft",
  published: "common:status.published",
  enabled: "common:status.enabled",
  disabled: "common:status.disabled",
  pending: "common:orderStatus.pending",
  processing: "common:orderStatus.processing",
  confirmed: "common:orderStatus.confirmed",
  shipped: "common:orderStatus.shipped",
  delivered: "common:orderStatus.delivered",
  completed: "common:orderStatus.completed",
  cancelled: "common:orderStatus.cancelled",
  canceled: "common:orderStatus.cancelled",
  returned: "common:orderStatus.returned",
  refunded: "common:orderStatus.refunded",
  "on hold": "common:orderStatus.onHold",
  paid: "common:payment.paid",
  unpaid: "common:payment.unpaid",
  partial: "common:extra.partialShort",
  "partially paid": "common:payment.partial",
  "in stock": "common:extra.inStock",
  "low stock": "common:extra.lowStock",
  "out of stock": "common:extra.outOfStock",
  packed: "common:extra.packed",
  error: "common:extra.error",
  success: "common:extra.success",
  selling: "ui:statusLabels.selling",
  complete: "ui:statusLabels.complete",
  approved: "ui:statusLabels.approved",
  succeeded: "ui:statusLabels.succeeded",
  received: "ui:statusLabels.received",
  verified: "ui:statusLabels.verified",
  fulfilled: "ui:statusLabels.fulfilled",
  resolved: "ui:statusLabels.resolved",
  ready: "ui:statusLabels.ready",
  open: "ui:statusLabels.open",
  closed: "ui:statusLabels.closed",
  live: "ui:statusLabels.live",
  "partially received": "ui:statusLabels.partiallyReceived",
  "in transit": "ui:statusLabels.inTransit",
  "in progress": "ui:statusLabels.inProgress",
  scheduled: "ui:statusLabels.scheduled",
  trial: "ui:statusLabels.trial",
  trialing: "ui:statusLabels.trial",
  awaiting: "ui:statusLabels.awaiting",
  review: "ui:statusLabels.review",
  "in review": "ui:statusLabels.inReview",
  ordered: "ui:statusLabels.ordered",
  sent: "ui:statusLabels.sent",
  new: "ui:statusLabels.new",
  expired: "ui:statusLabels.expired",
  failed: "ui:statusLabels.failed",
  rejected: "ui:statusLabels.rejected",
  overdue: "ui:statusLabels.overdue",
  discontinued: "ui:statusLabels.discontinued",
  blocked: "ui:statusLabels.blocked",
  suspended: "ui:statusLabels.suspended",
  void: "ui:statusLabels.void",
  declined: "ui:statusLabels.declined",
  lost: "ui:statusLabels.lost",
  damaged: "ui:statusLabels.damaged",
  unpublished: "ui:statusLabels.unpublished",
  archived: "ui:statusLabels.archived",
} as const

/** Translated label for a known status code (e.g. "in_stock" -> "In stock"); unknown codes come back unchanged. */
export function useStatusLabel(): (status: string) => string {
  const { t } = useTranslation(["ui", "common"])
  return React.useCallback((status: string) => {
    const s = normalize(status)
    const key = Object.prototype.hasOwnProperty.call(STATUS_KEYS, s) ? STATUS_KEYS[s as keyof typeof STATUS_KEYS] : undefined
    return key ? t(key) : status
  }, [t])
}

interface StatusBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant"> {
  status: string
  /** Override the automatic mapping. */
  variant?: StatusVariant
  /** Display text (defaults to the translated `status`, or `status` itself when it isn't a known code). */
  label?: React.ReactNode
}

/** Badge for a record status with automatic variant mapping (see `statusVariant`). */
export function StatusBadge({ status, variant, label, ...props }: StatusBadgeProps) {
  const statusLabel = useStatusLabel()
  return (
    <Badge variant={variant ?? statusVariant(status)} {...props}>
      {label ?? statusLabel(status)}
    </Badge>
  )
}
