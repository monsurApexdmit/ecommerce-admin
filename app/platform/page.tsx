"use client"

import { useEffect, useState } from "react"
import { Building2, Users, CreditCard, TrendingUp, AlertCircle } from "lucide-react"
import { platformApi, PlatformStats } from "@/lib/platformApi"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/common/PageHeader"
import { StatTile } from "@/components/common/StatTile"

export default function PlatformOverview() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    platformApi.getStats()
      .then(setStats)
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="size-6" />
    </div>
  )

  if (error) return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader title="Platform Overview" description="All companies and subscriptions across StockFlow." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label="Total Companies" value={stats!.totalCompanies} icon={<Building2 />} />
        <StatTile label="Active Companies" value={stats!.activeCompanies} hint={`${stats!.trialCompanies} on trial`} icon={<TrendingUp />} />
        <StatTile label="Total Users" value={stats!.totalUsers} icon={<Users />} />
        <StatTile label="Monthly Revenue" value={`$${stats!.mrr.toFixed(2)}`} hint={`${stats!.activeSubscriptions} active subs`} icon={<CreditCard />} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Link href="/platform/companies" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full gap-0 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">Manage Companies</h3>
          </div>
          <p className="text-sm text-muted-foreground">View all companies, assign plans, activate or deactivate accounts.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{stats!.activeCompanies} active</Badge>
            <Badge variant="secondary">{stats!.trialCompanies} trial</Badge>
            <Badge variant="outline">{stats!.inactiveCompanies} inactive</Badge>
          </div>
          </Card>
        </Link>

        <Link href="/platform/plans" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full gap-0 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">Manage Plans</h3>
          </div>
          <p className="text-sm text-muted-foreground">Create, edit and toggle subscription plans. Changes reflect immediately on the signup page.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{stats!.activePlans} active plans</Badge>
            <Badge variant="outline">{stats!.totalPlans} total</Badge>
            <Badge variant="secondary">{stats!.activeSubscriptions} paid subscriptions</Badge>
          </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
