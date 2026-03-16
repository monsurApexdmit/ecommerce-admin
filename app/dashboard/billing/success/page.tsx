"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle, Download, Home, Mail } from "lucide-react"
import Link from "next/link"

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-green-200">
        <div className="p-8 md:p-12">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Payment Successful! 🎉
            </h1>
            <p className="text-lg text-gray-600">
              Your subscription is now active. Welcome to premium access!
            </p>
          </div>

          {/* Subscription Details */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-2 gap-6 md:gap-8">
              {/* Subscription ID */}
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Subscription ID</p>
                <p className="text-xl font-bold text-gray-900 font-mono">
                  {subscriptionId || "Loading..."}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-lg font-bold text-green-600">Active</span>
                </div>
              </div>

              {/* Activation */}
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Activated</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              {/* Next Billing */}
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Next Billing</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What You Get</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Full Platform Access</p>
                  <p className="text-sm text-gray-600">All features & modules unlocked</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Priority Support</p>
                  <p className="text-sm text-gray-600">Get help when you need it</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Team Members</p>
                  <p className="text-sm text-gray-600">Invite and manage your team</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Advanced Analytics</p>
                  <p className="text-sm text-gray-600">Detailed insights & reports</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <Card className="bg-blue-50 border-blue-200 p-6 mb-8">
            <h3 className="font-bold text-gray-900 mb-3">Next Steps</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                <span>Check your email for a receipt and invoice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                <span>Review your subscription details in Billing settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                <span>Invite team members to collaborate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
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
              className="bg-blue-600 hover:bg-blue-700 text-white h-11 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Invoice
            </Button>

            {/* Go to Dashboard */}
            <Button
              onClick={() => router.push("/dashboard")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </Button>

            {/* View Subscription */}
            <Button
              onClick={() => router.push("/dashboard/billing/subscriptions")}
              variant="outline"
              className="border-gray-300 text-gray-700 h-11"
            >
              View Subscription
            </Button>
          </div>

          {/* Email Confirmation */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-gray-600" />
              <p className="font-medium text-gray-900">Confirmation Email Sent</p>
            </div>
            <p className="text-sm text-gray-600">
              Check your email for receipt, invoice, and subscription details
            </p>
          </div>

          {/* FAQ Section */}
          <div className="border-t mt-8 pt-8">
            <h3 className="font-bold text-gray-900 mb-4">Frequently Asked Questions</h3>

            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-900 mb-1">When does my subscription start?</p>
                <p className="text-sm text-gray-600">
                  Your subscription starts immediately. You have full access right now!
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Can I change my plan later?</p>
                <p className="text-sm text-gray-600">
                  Yes! You can upgrade or downgrade anytime from your billing settings. Changes take
                  effect immediately.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Is there a money-back guarantee?</p>
                <p className="text-sm text-gray-600">
                  Yes! If you're not satisfied within 30 days, we'll refund your money. No questions
                  asked.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">How do I cancel my subscription?</p>
                <p className="text-sm text-gray-600">
                  You can cancel anytime from your subscription settings. No penalties or long-term
                  contracts.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900 mb-1">Where do I get support?</p>
                <p className="text-sm text-gray-600">
                  Email us at{" "}
                  <a href="mailto:support@company.com" className="text-emerald-600 hover:underline">
                    support@company.com
                  </a>{" "}
                  or visit our{" "}
                  <a href="#" className="text-emerald-600 hover:underline">
                    help center
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-sm text-gray-500 mt-8 pt-8 border-t">
            <p>
              Thank you for upgrading! We're excited to have you on our premium plan.{" "}
              <Link href="/dashboard" className="text-emerald-600 hover:underline">
                Start exploring →
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
