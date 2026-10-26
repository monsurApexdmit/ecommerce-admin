"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { StatusBadge } from "@/components/common/StatusBadge"
import { CheckCircle, Download, Home, Mail } from "lucide-react"
import Link from "next/link"

const FMT: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState(false)

  const subscriptionId = searchParams.get("subscriptionId")
  const invoiceUrl = searchParams.get("invoiceUrl")

  useEffect(() => {
    setLoaded(true)
    // Auto-redirect to dashboard after 10 seconds if no action taken
    const timer = setTimeout(() => {
      if (!loaded) {
        router.push("/dashboard")
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [router, loaded])

  const handleDownloadInvoice = () => {
    if (invoiceUrl) {
      const decodedUrl = decodeURIComponent(invoiceUrl)
      window.open(decodedUrl, "_blank")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <div className="px-8 md:px-12 py-2 md:py-6">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <CheckCircle className="mx-auto mb-6 size-16 text-primary" />

            <h1 className="text-4xl font-bold mb-2">
              Payment Successful! 🎉
            </h1>
            <p className="text-lg text-muted-foreground">
              Your subscription is now active. Welcome to premium access!
            </p>
          </div>

          {/* Subscription Details */}
          <Card className="bg-muted/50 p-6 mb-8 shadow-none">
            <InfoList className="grid-cols-2 gap-6 md:gap-8">
              {/* Subscription ID */}
              <InfoRow layout="stacked" label="Subscription ID" value={<span className="text-xl font-bold font-mono">{subscriptionId || "Loading..."}</span>} />

              {/* Status */}
              <InfoRow layout="stacked" label="Status" value={<StatusBadge status="active" label="Active" />} />

              {/* Activation */}
              <InfoRow layout="stacked" label="Activated" value={
                <span className="text-lg font-semibold">
                  {new Date().toLocaleDateString("en-US", FMT)}
                </span>
              } />

              {/* Next Billing */}
              <InfoRow layout="stacked" label="Next Billing" value={
                <span className="text-lg font-semibold">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", FMT)}
                </span>
              } />
            </InfoList>
          </Card>

          {/* What's Included */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">What You Get</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Full Platform Access</p>
                  <p className="text-sm text-muted-foreground">All features & modules unlocked</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Priority Support</p>
                  <p className="text-sm text-muted-foreground">Get help when you need it</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Team Members</p>
                  <p className="text-sm text-muted-foreground">Invite and manage your team</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="size-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold">Advanced Analytics</p>
                  <p className="text-sm text-muted-foreground">Detailed insights & reports</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <Card className="p-6 mb-8 gap-3">
            <h3 className="font-bold">Next Steps</h3>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>Check your email for a receipt and invoice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>Review your subscription details in Billing settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>Invite team members to collaborate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>Start using all premium features immediately</span>
              </li>
            </ol>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
            {/* Download Invoice */}
            <Button
              onClick={handleDownloadInvoice}
              disabled={!invoiceUrl}
            >
              <Download className="size-5" />
              Download Invoice
            </Button>

            {/* Go to Dashboard */}
            <Button
              onClick={() => router.push("/dashboard")}
            >
              <Home className="size-5" />
              Go to Dashboard
            </Button>

            {/* View Subscription */}
            <Button
              onClick={() => router.push("/dashboard/billing/subscriptions")}
              variant="outline"
            >
              View Subscription
            </Button>
          </div>

          {/* Email Confirmation */}
          <Alert>
            <Mail />
            <AlertTitle>Confirmation Email Sent</AlertTitle>
            <AlertDescription>
              Check your email for receipt, invoice, and subscription details
            </AlertDescription>
          </Alert>

          {/* FAQ Section */}
          <Separator className="mt-8" />
          <div className="pt-8">
            <h3 className="font-bold mb-4">Frequently Asked Questions</h3>

            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-1">When does my subscription start?</p>
                <p className="text-sm text-muted-foreground">
                  Your subscription starts immediately. You have full access right now!
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Can I change my plan later?</p>
                <p className="text-sm text-muted-foreground">
                  Yes! You can upgrade or downgrade anytime from your billing settings. Changes take
                  effect immediately.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Is there a money-back guarantee?</p>
                <p className="text-sm text-muted-foreground">
                  Yes! If you're not satisfied within 30 days, we'll refund your money. No questions
                  asked.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">How do I cancel my subscription?</p>
                <p className="text-sm text-muted-foreground">
                  You can cancel anytime from your subscription settings. No penalties or long-term
                  contracts.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Where do I get support?</p>
                <p className="text-sm text-muted-foreground">
                  Email us at{" "}
                  <a href="mailto:support@company.com" className="text-primary hover:underline">
                    support@company.com
                  </a>{" "}
                  or visit our{" "}
                  <a href="#" className="text-primary hover:underline">
                    help center
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <Separator className="mt-8" />
          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>
              Thank you for upgrading! We're excited to have you on our premium plan.{" "}
              <Link href="/dashboard" className="text-primary hover:underline">
                Start exploring →
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
