"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export function TrialBanner() {
  const { company, companyStatus, trialDaysRemaining } = useSaasAuth()
  const { t } = useTranslation(["ui", "common"])

  if (!company) return null

  // Trial active - normal
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining > 3) {
    return (
      <Alert className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.activeTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.activeBody", { count: trialDaysRemaining, date: company.trialEndDate })}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">{t("ui:trialBanner.upgradeNow")}</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  // Trial expiring soon - warning
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining <= 3) {
    return (
      <Alert className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.soonTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.soonBody", { count: trialDaysRemaining })}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">{t("ui:trialBanner.choosePlan")}</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  // Trial expired - error
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining <= 0) {
    return (
      <Alert variant="destructive" className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.expiredTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.expiredBody")}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">{t("ui:trialBanner.viewPlans")}</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  // Active subscription
  if (companyStatus === "active") {
    return (
      <Alert className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.activeSubTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.activeSubBody")}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/billing/subscriptions">{t("ui:trialBanner.manage")}</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  // Subscription expired
  if (companyStatus === "expired") {
    return (
      <Alert variant="destructive" className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.subExpiredTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.subExpiredBody")}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/subscriptions">{t("ui:trialBanner.renewNow")}</Link>
          </Button>
        </div>
      </Alert>
    )
  }

  // Suspended
  if (companyStatus === "suspended") {
    return (
      <Alert className="block rounded-none border-x-0 border-t-0 px-0 py-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="text-sm font-medium">
                {t("ui:trialBanner.suspendedTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("ui:trialBanner.suspendedBody")}
              </p>
            </div>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <a href="mailto:support@company.com">{t("ui:trialBanner.contactSupport")}</a>
          </Button>
        </div>
      </Alert>
    )
  }

  return null
}
