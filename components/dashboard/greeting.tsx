"use client"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useDashboardSection } from "./use-dashboard-section"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useDashboardFilters } from "./dashboard-context"

export function Greeting() {
  const { t, i18n } = useTranslation(["dashboard", "common"])
  const { user } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const { filters } = useDashboardFilters()
  const kpis = useDashboardSection("kpis")

  const hour = new Date().getHours()
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
  const first = user?.fullName?.split(" ")[0]
  const hello = first ? t(`dashboard:greeting.${part}Name`, { name: first }) : t(`dashboard:greeting.${part}`)
  const today = new Date().toLocaleDateString(localeTag(i18n.language), { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const exportReport = () => {
    const d = kpis.data
    if (!d) return
    exportToCSV(
      [
        [t("dashboard:csv.netRevenue"), formatCurrency(d.revenue.value)],
        [t("dashboard:csv.grossProfit"), formatCurrency(d.grossProfit.value)],
        [t("dashboard:csv.orders"), String(d.orders.value)],
        [t("dashboard:csv.aov"), formatCurrency(d.orders.aov)],
        [t("dashboard:csv.inventoryValue"), formatCurrency(d.inventory.valueAtCost)],
        [t("dashboard:csv.receivable"), formatCurrency(d.receivable.value)],
        [t("dashboard:csv.payable"), formatCurrency(d.payable.value)],
      ],
      `dashboard-${filters.from}_${filters.to}`,
      [t("dashboard:csv.metric"), t("dashboard:csv.value")],
    )
  }

  return (
    <PageHeader
      title={hello}
      description={today}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/vendors/purchase-orders">{t("dashboard:greeting.receiveStock")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/vendors/purchase-orders?new=1">{t("dashboard:greeting.createPo")}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={exportReport} disabled={!kpis.data}>
            {t("dashboard:greeting.exportReport")}
          </Button>
        </>
      }
    />
  )
}
