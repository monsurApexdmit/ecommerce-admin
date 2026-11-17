"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
import { TAILOR_STAGES, type TailorPaymentStatus, type TailorStage } from "@/lib/tailorApi"
import { TAILOR_NS, payStatusLabel, stageLabel, type TailorT } from "./i18n"

export function StageBadge({ stage, className }: { stage: TailorStage; className?: string }) {
  const { t } = useTranslation(TAILOR_NS)
  return <StatusBadge status={stage} label={stageLabel(t, stage)} className={className} />
}

export function PayBadge({ status, className }: { status: TailorPaymentStatus; className?: string }) {
  const { t } = useTranslation(TAILOR_NS)
  const s: TailorPaymentStatus = status === "partial" || status === "paid" ? status : "unpaid"
  return <StatusBadge status={s} label={payStatusLabel(t, s)} className={className} />
}

export function UrgentBadge() {
  const { t } = useTranslation(TAILOR_NS)
  return <Badge variant="destructive">{t("tailor:shared.urgent")}</Badge>
}

/** Six-segment pipeline bar: Received → Delivered. */
export function StageBar({ stageIndex, stage }: { stageIndex: number; stage: TailorStage }) {
  const { t } = useTranslation(TAILOR_NS)
  return (
    <div className="mt-1 flex gap-[3px]" aria-hidden>
      {TAILOR_STAGES.map((s, j) => (
        <span key={s.id} title={stageLabel(t, s.id)}
          className={cn("h-1.5 w-[18px] rounded-full",
            stage === "cancelled" ? "bg-destructive/30" : j <= stageIndex ? (stage === "delivered" ? "bg-muted-foreground" : "bg-primary") : "bg-border")} />
      ))}
    </div>
  )
}

/** "Overdue 2d" / "Due today" / "In 3 days" with a tone class. */
export function whenText(t: TailorT, daysLeft: number | null, stage: TailorStage): { text: string; cls: string } {
  if (stage === "delivered") return { text: t("tailor:when.delivered"), cls: "text-muted-foreground" }
  if (stage === "cancelled") return { text: t("tailor:when.cancelled"), cls: "text-muted-foreground" }
  if (daysLeft == null) return { text: t("tailor:when.noDeliveryDate"), cls: "text-muted-foreground" }
  if (daysLeft < 0) return { text: t("tailor:when.overdue", { days: -daysLeft }), cls: "text-destructive" }
  if (daysLeft === 0) return { text: t("tailor:when.dueToday"), cls: "text-dash-warn-fg" }
  return { text: t("tailor:when.inDays", { count: daysLeft }), cls: daysLeft <= 1 ? "text-dash-warn-fg" : "text-muted-foreground" }
}

/** "25 Oct 2026" in the staff member's language; "—" when empty. */
export const fmtDate = (d: string | null | undefined, lng: string) =>
  d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString(localeTag(lng), { month: "short", day: "numeric", year: "numeric" }) : "—"

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function apiError(e: any, fallback: string): string {
  const errs = e?.response?.data?.errors
  if (errs && typeof errs === "object") {
    const first = Object.values(errs)[0] as any
    if (Array.isArray(first) && first[0]) return String(first[0])
  }
  return e?.response?.data?.message ?? fallback
}
