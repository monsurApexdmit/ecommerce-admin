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
import { useTranslation } from "react-i18next"

export default function PlatformOverview() {
  const { t } = useTranslation(["auth", "common"])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    platformApi.getStats()
      .then(setStats)
      .catch(() => setError(t("auth:platform.overview.loadFailed")))
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
      <PageHeader title={t("auth:platform.overview.title")} description={t("auth:platform.overview.description")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatTile label={t("auth:platform.overview.totalCompanies")} value={stats!.totalCompanies} icon={<Building2 />} />
        <StatTile label={t("auth:platform.overview.activeCompanies")} value={stats!.activeCompanies} hint={t("auth:platform.overview.onTrial", { count: stats!.trialCompanies })} icon={<TrendingUp />} />
        <StatTile label={t("auth:platform.overview.totalUsers")} value={stats!.totalUsers} icon={<Users />} />
        <StatTile label={t("auth:platform.overview.mrr")} value={`$${stats!.mrr.toFixed(2)}`} hint={t("auth:platform.overview.activeSubs", { count: stats!.activeSubscriptions })} icon={<CreditCard />} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Link href="/platform/companies" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full gap-0 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">{t("auth:platform.overview.manageCompanies")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("auth:platform.overview.manageCompaniesDesc")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{t("auth:platform.overview.activeCount", { count: stats!.activeCompanies })}</Badge>
            <Badge variant="secondary">{t("auth:platform.overview.trialCount", { count: stats!.trialCompanies })}</Badge>
            <Badge variant="outline">{t("auth:platform.overview.inactiveCount", { count: stats!.inactiveCompanies })}</Badge>
          </div>
          </Card>
        </Link>

        <Link href="/platform/plans" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full gap-0 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">{t("auth:platform.overview.managePlans")}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{t("auth:platform.overview.managePlansDesc")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{t("auth:platform.overview.activePlans", { count: stats!.activePlans })}</Badge>
            <Badge variant="outline">{t("auth:platform.overview.totalCount", { count: stats!.totalPlans })}</Badge>
            <Badge variant="secondary">{t("auth:platform.overview.paidSubs", { count: stats!.activeSubscriptions })}</Badge>
          </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}
