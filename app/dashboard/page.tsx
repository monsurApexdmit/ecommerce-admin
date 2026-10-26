"use client"

import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { Greeting } from "@/components/dashboard/greeting"
import { Alerts } from "@/components/dashboard/alerts"
import { Kpis } from "@/components/dashboard/kpis"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { Pipeline } from "@/components/dashboard/pipeline"
import { StockHealth } from "@/components/dashboard/stock-health"
import { ReorderSuggestions } from "@/components/dashboard/reorder"
import { TopSellers } from "@/components/dashboard/top-sellers"
import { Channels } from "@/components/dashboard/channels"
import { Obligations } from "@/components/dashboard/obligations"
import { RecentOrders } from "@/components/dashboard/recent-orders"
import { Activity } from "@/components/dashboard/activity"

export default function DashboardPage() {
  const blocked = useModuleGuard("Dashboard")
  if (blocked) return blocked

  return (
    <>
      <div className={`${bricolage.variable} ${instrument.variable} font-dash-body text-dash-ink`}>
        <div className="flex w-full flex-col gap-6">
          <Greeting />
          <Alerts />
          <Kpis />

          <div className="flex flex-wrap gap-4">
            <RevenueChart />
            <Pipeline />
          </div>

          <div className="flex flex-wrap gap-4">
            <StockHealth />
            <ReorderSuggestions />
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
            <TopSellers />
            <Channels />
            <Obligations />
          </div>

          <div className="flex flex-wrap gap-4">
            <RecentOrders />
            <Activity />
          </div>
        </div>
      </div>
    </>
  )
}
