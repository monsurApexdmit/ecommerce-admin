"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { saasBillingApi } from "@/lib/saasBillingApi"

const TRIAL_LENGTH_DAYS = 10

/**
 * Compact upgrade card pinned to the sidebar footer while the company is on a
 * free trial. Replaces the old full-width top banner. Shows a countdown line, a
 * thin progress bar (days elapsed of the trial), and a single brand "Upgrade
 * plan" button. Hidden entirely once the company is on a paid plan.
 *
 * Reuses the same subscription source as the former TrialBanner so the state
 * stays in sync.
 */
export function TrialCard() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [show, setShow] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    let active = true

    saasBillingApi
      .getCurrentSubscription()
      .then((res) => {
        if (!active) return
        const sub = (res as any)?.data ?? res
        const status = sub?.status
        const periodEnd = sub?.currentPeriodEnd

        const isTrial = status === "trialing" || status === "trial"
        if (!isTrial || !periodEnd) return

        const end = new Date(periodEnd).getTime()
        if (Number.isNaN(end)) return

        const diffMs = end - Date.now()
        const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

        setDaysLeft(days)
        setExpired(diffMs <= 0)
        setShow(true)
      })
      .catch(() => {
        /* silently hide on error */
      })

    return () => {
      active = false
    }
  }, [])

  if (!show) return null

  // Progress = portion of the trial already consumed.
  const remaining = daysLeft ?? 0
  const elapsed = Math.min(TRIAL_LENGTH_DAYS, Math.max(0, TRIAL_LENGTH_DAYS - remaining))
  const pct = Math.round((elapsed / TRIAL_LENGTH_DAYS) * 100)

  return (
    <div
      className="rounded-xl border border-border bg-card p-3 group-data-[collapsible=icon]:hidden"
      role="region"
      aria-label="Trial status"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand-fg shrink-0" />
        <p className="text-[13px] font-medium text-foreground">
          {expired ? "Trial expired" : "Free trial"}
        </p>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {expired
          ? "Upgrade to keep your data."
          : `${remaining} ${remaining === 1 ? "day" : "days"} remaining`}
      </p>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        href="/dashboard/billing/subscriptions"
        className="mt-3 flex w-full items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Upgrade plan
      </Link>
    </div>
  )
}
