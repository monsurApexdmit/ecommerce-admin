"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { localeTag } from "@/lib/i18n"
import { FINAL_COURIER_STATUSES, type CourierAccount, type CourierBooking, type CourierStatus } from "@/lib/courierApi"
import { cn } from "@/lib/utils"
import { COURIER_NS, type CourierKey } from "./i18n"

/** Provider code → brand name + avatar initials (brand names are not translated). */
export const PROVIDER_META: Record<string, { name: string; ini: string }> = {
  pathao: { name: "Pathao", ini: "PT" },
  steadfast: { name: "Steadfast", ini: "SF" },
  redx: { name: "RedX", ini: "RX" },
  paperfly: { name: "Paperfly", ini: "PF" },
}

export const providerName = (provider?: string | null) => {
  const p = String(provider ?? "")
  return PROVIDER_META[p.toLowerCase()]?.name ?? p
}

export const accountName = (a: Pick<CourierAccount, "provider" | "label">) => a.label || providerName(a.provider)

/** Normalized courier status → label key */
export const COURIER_STATUS_KEY: Record<CourierStatus, CourierKey> = {
  booked: "courier:status.booked",
  pickup_pending: "courier:status.pickup_pending",
  picked: "courier:status.picked",
  in_transit: "courier:status.in_transit",
  out_for_delivery: "courier:status.out_for_delivery",
  delivered: "courier:status.delivered",
  partial_delivered: "courier:status.partial_delivered",
  returned: "courier:status.returned",
  cancelled: "courier:status.cancelled",
  on_hold: "courier:status.on_hold",
  failed: "courier:status.failed",
}

const STATUS_VARIANT: Record<CourierStatus, StatusVariant> = {
  booked: "outline",
  pickup_pending: "secondary",
  picked: "secondary",
  in_transit: "secondary",
  out_for_delivery: "secondary",
  delivered: "default",
  partial_delivered: "default",
  returned: "destructive",
  cancelled: "destructive",
  on_hold: "secondary",
  failed: "destructive",
}

const asStatus = (s?: string | null): CourierStatus | null =>
  s && Object.prototype.hasOwnProperty.call(COURIER_STATUS_KEY, s) ? (s as CourierStatus) : null

export const isFinalCourierStatus = (s?: string | null) => FINAL_COURIER_STATUSES.includes(s as CourierStatus)

/** Translated label for a normalized courier status; unknown codes come back humanized. */
export function useCourierStatusLabel() {
  const { t } = useTranslation(COURIER_NS)
  return React.useCallback((s?: string | null) => {
    const st = asStatus(s)
    if (st) return t(COURIER_STATUS_KEY[st])
    const h = String(s ?? "").replace(/[_-]+/g, " ").trim()
    return h ? h.charAt(0).toUpperCase() + h.slice(1) : "—"
  }, [t])
}

/** Normalized courier status badge; the tooltip shows the courier's own status text and when it changed. */
export function CourierStatusBadge({ courier, className }: { courier: Pick<CourierBooking, "status" | "rawStatus" | "statusAt">; className?: string }) {
  const { t, i18n } = useTranslation(COURIER_NS)
  const label = useCourierStatusLabel()
  const st = asStatus(courier.status)
  const tip = [
    courier.rawStatus ? t("courier:panel.rawStatus", { status: courier.rawStatus }) : null,
    courier.statusAt ? new Date(courier.statusAt).toLocaleString(localeTag(i18n.language)) : null,
  ].filter(Boolean).join(" · ")
  const badge = (
    <StatusBadge
      status={courier.status ?? "booked"}
      variant={st ? STATUS_VARIANT[st] : "outline"}
      label={label(courier.status)}
      tabIndex={tip ? 0 : undefined}
      className={cn("w-fit", className)}
    />
  )
  return <WithTooltip content={tip || undefined}>{badge}</WithTooltip>
}

/** Small icon button that copies `value` (consignment id / tracking code). */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const { t } = useTranslation(COURIER_NS)
  const [done, setDone] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <WithTooltip content={done ? t("common:actions.copied") : label}>
      <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={copy} className={cn("size-7", className)}>
        {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </Button>
    </WithTooltip>
  )
}

/** Monospace code with a copy button. */
export function CodeWithCopy({ value, copyLabel }: { value?: string | null; copyLabel: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="break-all font-mono text-[13px]">{value}</span>
      <CopyButton value={value} label={copyLabel} />
    </span>
  )
}
