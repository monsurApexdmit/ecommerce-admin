import { cn } from "@/lib/utils"
import { TAILOR_STAGES, TAILOR_STAGE_LABEL, type TailorPaymentStatus, type TailorStage } from "@/lib/tailorApi"

export const tInput = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
export const tOutlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-40"
export const tPrimaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
export const tIconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

export const STAGE_CLS: Record<TailorStage, string> = {
  new: "bg-dash-neutral-soft text-dash-neutral-fg",
  cutting: "bg-dash-warn-soft text-dash-warn-fg",
  stitching: "bg-dash-accent-soft text-dash-accent-fg",
  trial: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  ready: "bg-dash-success-soft text-dash-success-fg",
  delivered: "bg-dash-neutral-soft text-dash-muted",
  cancelled: "bg-dash-danger-soft text-dash-danger-fg",
}

export const PAY_CLS: Record<TailorPaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "bg-dash-danger-soft text-dash-danger-fg" },
  partial: { label: "Partial", cls: "bg-dash-warn-soft text-dash-warn-fg" },
  paid: { label: "Paid", cls: "bg-dash-success-soft text-dash-success-fg" },
}

export function StageBadge({ stage, className }: { stage: TailorStage; className?: string }) {
  return <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STAGE_CLS[stage], className)}>{TAILOR_STAGE_LABEL[stage]}</span>
}

export function PayBadge({ status, className }: { status: TailorPaymentStatus; className?: string }) {
  const p = PAY_CLS[status] ?? PAY_CLS.unpaid
  return <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", p.cls, className)}>{p.label}</span>
}

export function UrgentBadge() {
  return <span className="rounded-full bg-dash-danger-soft px-2 py-[2px] text-[10px] font-bold tracking-wide text-dash-danger-fg">URGENT</span>
}

/** Six-segment pipeline bar: Received → Delivered. */
export function StageBar({ stageIndex, stage }: { stageIndex: number; stage: TailorStage }) {
  return (
    <div className="mt-1 flex gap-[3px]" aria-hidden>
      {TAILOR_STAGES.map((s, j) => (
        <span key={s.id} title={s.label}
          className={cn("h-1.5 w-[18px] rounded-full",
            stage === "cancelled" ? "bg-dash-danger/30" : j <= stageIndex ? (stage === "delivered" ? "bg-dash-neutral" : "bg-dash-accent") : "bg-dash-border")} />
      ))}
    </div>
  )
}

/** "Overdue 2d" / "Due today" / "In 3 days" with a tone class. */
export function whenText(daysLeft: number | null, stage: TailorStage): { text: string; cls: string } {
  if (stage === "delivered") return { text: "Delivered", cls: "text-dash-muted" }
  if (stage === "cancelled") return { text: "Cancelled", cls: "text-dash-muted" }
  if (daysLeft == null) return { text: "No delivery date", cls: "text-dash-muted" }
  if (daysLeft < 0) return { text: `Overdue ${-daysLeft}d`, cls: "text-dash-danger" }
  if (daysLeft === 0) return { text: "Due today", cls: "text-dash-warn-fg" }
  return { text: `In ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, cls: daysLeft <= 1 ? "text-dash-warn-fg" : "text-dash-muted" }
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
