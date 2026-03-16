"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { Button } from "@/components/ui/button"
import { AlertCircle, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"

export function TrialBanner() {
  const { company, companyStatus, trialDaysRemaining } = useSaasAuth()

  if (!company) return null

  // Trial active - normal
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining > 3) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-900">
                🎉 Free Trial Active
              </p>
              <p className="text-xs text-emerald-700">
                {trialDaysRemaining} days remaining • Trial ends {company.trialEndDate}
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/plans">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              Upgrade Now →
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Trial expiring soon - warning
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining <= 3) {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                ⚠️ Trial Expires Soon
              </p>
              <p className="text-xs text-yellow-700">
                Only {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} left • Choose a plan to continue
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/plans">
            <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
              Choose Plan →
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Trial expired - error
  if (companyStatus === "trial" && trialDaysRemaining && trialDaysRemaining <= 0) {
    return (
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-900">
                🚫 Trial Expired
              </p>
              <p className="text-xs text-red-700">
                Your trial has ended • Subscribe to continue using the platform
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/plans">
            <Button size="sm" className="bg-red-600 hover:bg-red-700">
              View Plans →
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Active subscription
  if (companyStatus === "active") {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                ✓ Active Subscription
              </p>
              <p className="text-xs text-green-700">
                Your subscription is active and running smoothly
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/subscriptions">
            <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
              Manage →
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Subscription expired
  if (companyStatus === "expired") {
    return (
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-900">
                ⚠️ Subscription Expired
              </p>
              <p className="text-xs text-red-700">
                Your subscription has expired • Renew to regain access
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/subscriptions">
            <Button size="sm" className="bg-red-600 hover:bg-red-700">
              Renew Now →
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Suspended
  if (companyStatus === "suspended") {
    return (
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-medium text-white">
                🚫 Account Suspended
              </p>
              <p className="text-xs text-gray-400">
                Your account has been suspended • Contact support for assistance
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" asChild>
            <a href="mailto:support@company.com">Contact Support</a>
          </Button>
        </div>
      </div>
    )
  }

  return null
}
