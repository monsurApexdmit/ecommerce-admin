"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { SectionTitle } from "@/components/common/SectionTitle"
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
      <Card className="w-full max-w-md py-0">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="text-6xl mb-6">{content.icon}</div>

          {/* Alert Icon */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-2">{content.title}</h1>

          {/* Message */}
          <p className="text-muted-foreground text-sm mb-6">{content.message}</p>

          {/* Features List */}
          <Card className="gap-0 p-4 mb-6 text-left shadow-none bg-muted/50">
            <SectionTitle as="p" className="mb-2">What you need to do:</SectionTitle>
            <ul className="text-xs text-muted-foreground space-y-1">
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
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href={content.primaryButton.href}>
                {content.primaryButton.label}
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href={content.secondaryButton.href}>
                {content.secondaryButton.label}
              </Link>
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={logout}
            >
              Sign Out
            </Button>
          </div>

          {/* Support Info */}
          <Separator className="mt-6" />
          <div className="pt-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mb-2">
              <Mail className="w-4 h-4" />
              <span>Need help?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Email us at{" "}
              <a href="mailto:support@company.com" className="text-primary hover:underline font-medium">
                support@company.com
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Or visit our{" "}
              <a href="https://help.company.com" className="text-primary hover:underline font-medium">
                help center
              </a>
            </p>
          </div>

          {/* Additional Info */}
          <Alert className="mt-6 text-left">
            <AlertDescription className="text-xs">
              <p>
                <strong className="text-foreground">Did you know?</strong> Most plans offer a 30-day money-back guarantee. No questions asked.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </Card>
    </div>
  )
}
