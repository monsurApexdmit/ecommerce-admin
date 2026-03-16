"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Mail } from "lucide-react"
import Link from "next/link"
import { useSaasAuth } from "@/contexts/saas-auth-context"

interface BlockedAccessScreenProps {
  reason?: "trial_expired" | "subscription_expired" | "account_suspended"
}

export function BlockedAccessScreen({ reason = "trial_expired" }: BlockedAccessScreenProps) {
  const { logout } = useSaasAuth()

  const getContent = () => {
    switch (reason) {
      case "trial_expired":
        return {
          icon: "🎯",
          title: "Trial Period Ended",
          message:
            "Your 10-day free trial has expired. To continue using the platform, please select a subscription plan.",
          primaryButton: { label: "View Plans", href: "/dashboard/billing/plans" },
          secondaryButton: { label: "Contact Support", href: "mailto:support@company.com" },
        }
      case "subscription_expired":
        return {
          icon: "📅",
          title: "Subscription Expired",
          message:
            "Your subscription has expired. Renew your subscription to regain access to all features.",
          primaryButton: { label: "Renew Subscription", href: "/dashboard/billing/subscriptions" },
          secondaryButton: { label: "View Plans", href: "/dashboard/billing/plans" },
        }
      case "account_suspended":
        return {
          icon: "🚫",
          title: "Account Suspended",
          message:
            "Your account has been suspended. Please contact our support team for assistance.",
          primaryButton: { label: "Contact Support", href: "mailto:support@company.com" },
          secondaryButton: { label: "View Help Center", href: "https://help.company.com" },
        }
      default:
        return {
          icon: "⚠️",
          title: "Access Denied",
          message: "You don't have access to the dashboard at the moment.",
          primaryButton: { label: "Go Back", href: "/" },
          secondaryButton: { label: "Contact Support", href: "mailto:support@company.com" },
        }
    }
  }

  const content = getContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-red-200">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-6">{content.icon}</div>

          {/* Alert Icon */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{content.title}</h1>

          {/* Message */}
          <p className="text-gray-600 text-sm mb-6">{content.message}</p>

          {/* Features List */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">What you need to do:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {reason === "trial_expired" && (
                <>
                  <li>• Select a subscription plan that fits your needs</li>
                  <li>• Add a payment method</li>
                  <li>• Enjoy immediate access to all features</li>
                </>
              )}
              {reason === "subscription_expired" && (
                <>
                  <li>• Visit your subscription page</li>
                  <li>• Click "Renew Subscription"</li>
                  <li>• Complete the payment process</li>
                </>
              )}
              {reason === "account_suspended" && (
                <>
                  <li>• Review your account status</li>
                  <li>• Check your email for details</li>
                  <li>• Contact support to resolve the issue</li>
                </>
              )}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link href={content.primaryButton.href} className="block">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-11">
                {content.primaryButton.label}
              </Button>
            </Link>

            <Link href={content.secondaryButton.href} className="block">
              <Button
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 h-11"
              >
                {content.secondaryButton.label}
              </Button>
            </Link>

            <Button
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800 h-11"
              onClick={logout}
            >
              Sign Out
            </Button>
          </div>

          {/* Support Info */}
          <div className="border-t mt-6 pt-6">
            <div className="flex items-center gap-2 text-xs text-gray-600 justify-center mb-2">
              <Mail className="w-4 h-4" />
              <span>Need help?</span>
            </div>
            <p className="text-xs text-gray-500">
              Email us at{" "}
              <a href="mailto:support@company.com" className="text-red-600 hover:underline font-medium">
                support@company.com
              </a>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Or visit our{" "}
              <a href="https://help.company.com" className="text-red-600 hover:underline font-medium">
                help center
              </a>
            </p>
          </div>

          {/* Additional Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-6 text-left">
            <p className="text-xs text-blue-800">
              <strong>Did you know?</strong> Most plans offer a 30-day money-back guarantee. No questions asked.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
