"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"

export function TrialBanner() {
  const { company, companyStatus, trialDaysRemaining } = useSaasAuth()

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
                🎉 Free Trial Active
              </p>
              <p className="text-xs text-muted-foreground">
                {trialDaysRemaining} days remaining • Trial ends {company.trialEndDate}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">Upgrade Now →</Link>
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
                ⚠️ Trial Expires Soon
              </p>
              <p className="text-xs text-muted-foreground">
                Only {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left • Choose a plan to continue
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">Choose Plan →</Link>
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
                🚫 Trial Expired
              </p>
              <p className="text-xs text-muted-foreground">
                Your trial has ended • Subscribe to continue using the platform
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/plans">View Plans →</Link>
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
                ✓ Active Subscription
              </p>
              <p className="text-xs text-muted-foreground">
                Your subscription is active and running smoothly
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/billing/subscriptions">Manage →</Link>
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
                ⚠️ Subscription Expired
              </p>
              <p className="text-xs text-muted-foreground">
                Your subscription has expired • Renew to regain access
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/billing/subscriptions">Renew Now →</Link>
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
                🚫 Account Suspended
              </p>
              <p className="text-xs text-muted-foreground">
                Your account has been suspended • Contact support for assistance
              </p>
            </div>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <a href="mailto:support@company.com">Contact Support</a>
          </Button>
        </div>
      </Alert>
    )
  }

  return null
}
