"use client"

import { useEffect, useState } from "react"
import { fetchSection } from "@/lib/dashboard/api"
import { supportApi } from "@/lib/supportApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"

export interface NavBadges {
  /** Orders waiting to be confirmed */
  orders: number
  /** Products out of stock */
  stock: number
  /** Open support tickets */
  support: number
  /** Active staff whose payslip for this month is not fully paid */
  salaryDue: number
}

/** Sidebar badge counts. Each source is best-effort and only requested when the user may read it. */
export function useNavBadges(): NavBadges {
  const { canRead } = useSaasAuth()
  const canDashboard = canRead("Dashboard")
  const canSupport = canRead("Support")
  const [badges, setBadges] = useState<NavBadges>({ orders: 0, stock: 0, support: 0, salaryDue: 0 })

  useEffect(() => {
    if (!canDashboard) return
    const controller = new AbortController()
    const today = new Date().toISOString().slice(0, 10)
    fetchSection("alerts", { from: today, to: today }, undefined, controller.signal)
      .then((a) =>
        setBadges((b) => ({ ...b, orders: a.pendingOrders.count, stock: a.stock.outOfStock, salaryDue: Number((a.salaries as { unpaidCount?: number } | undefined)?.unpaidCount ?? 0) })),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [canDashboard])

  useEffect(() => {
    if (!canSupport) return
    let cancelled = false
    supportApi
      .getStats()
      .then((s) => { if (!cancelled) setBadges((b) => ({ ...b, support: Number(s?.open ?? 0) })) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [canSupport])

  return badges
}
