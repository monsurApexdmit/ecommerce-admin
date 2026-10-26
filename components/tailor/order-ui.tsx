import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { cn } from "@/lib/utils"
import { TAILOR_STAGES, TAILOR_STAGE_LABEL, type TailorPaymentStatus, type TailorStage } from "@/lib/tailorApi"

export const PAY_LABEL: Record<TailorPaymentStatus, string> = { unpaid: "Unpaid", partial: "Partial", paid: "Paid" }

export function StageBadge({ stage, className }: { stage: TailorStage; className?: string }) {
  return <StatusBadge status={stage} label={TAILOR_STAGE_LABEL[stage]} className={className} />
}

export function PayBadge({ status, className }: { status: TailorPaymentStatus; className?: string }) {
  const s = PAY_LABEL[status] ? status : "unpaid"
  return <StatusBadge status={s} label={PAY_LABEL[s]} className={className} />
}

export function UrgentBadge() {
  return <Badge variant="destructive">URGENT</Badge>
}

/** Six-segment pipeline bar: Received → Delivered. */
export function StageBar({ stageIndex, stage }: { stageIndex: number; stage: TailorStage }) {
  return (
    <div className="mt-1 flex gap-[3px]" aria-hidden>
      {TAILOR_STAGES.map((s, j) => (
        <span key={s.id} title={s.label}
          className={cn("h-1.5 w-[18px] rounded-full",
            stage === "cancelled" ? "bg-destructive/30" : j <= stageIndex ? (stage === "delivered" ? "bg-muted-foreground" : "bg-primary") : "bg-border")} />
      ))}
    </div>
  )
}

/** "Overdue 2d" / "Due today" / "In 3 days" with a tone class. */
export function whenText(daysLeft: number | null, stage: TailorStage): { text: string; cls: string } {
  if (stage === "delivered") return { text: "Delivered", cls: "text-muted-foreground" }
  if (stage === "cancelled") return { text: "Cancelled", cls: "text-muted-foreground" }
  if (daysLeft == null) return { text: "No delivery date", cls: "text-muted-foreground" }
  if (daysLeft < 0) return { text: `Overdue ${-daysLeft}d`, cls: "text-destructive" }
  if (daysLeft === 0) return { text: "Due today", cls: "text-dash-warn-fg" }
  return { text: `In ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, cls: daysLeft <= 1 ? "text-dash-warn-fg" : "text-muted-foreground" }
}

export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const WORK_LABEL: Record<string, string> = { assigned: "Assigned", in_progress: "In progress", completed: "Done", returned: "Returned for fixing", paid: "Paid" }

export function apiError(e: any, fallback: string): string {
  const errs = e?.response?.data?.errors
  if (errs && typeof errs === "object") {
    const first = Object.values(errs)[0] as any
    if (Array.isArray(first) && first[0]) return String(first[0])
  }
  return e?.response?.data?.message ?? fallback
}
