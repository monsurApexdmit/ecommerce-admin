"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Clock, AlertTriangle } from "lucide-react"
import { saasBillingApi } from "@/lib/saasBillingApi"

/**
 * Always-visible bar shown across the dashboard while the company is on a free
 * trial. Displays how many days remain before the trial expires. Fetches the
 * current subscription directly so it doesn't depend on possibly-missing
 * fields in the auth context.
 */
export function TrialBanner() {
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

        // Only show for trial subscriptions.
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

  const urgent = expired || (daysLeft !== null && daysLeft <= 3)

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium ${
        urgent ? "bg-red-600 text-white" : "bg-amber-500 text-white"
      }`}
    >
      {urgent ? (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      ) : (
        <Clock className="w-4 h-4 shrink-0" />
      )}
      <span>
        {expired
          ? "Your free trial has expired."
          : `You're on a free trial — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining.`}
      </span>
      <Link
        href="/dashboard/billing/subscriptions"
        className="underline underline-offset-2 hover:no-underline font-semibold"
      >
        Upgrade now
      </Link>
    </div>
  )
}
