"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { saasBillingApi, type Subscription, type PaymentRecord } from "@/lib/saasBillingApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Download, RefreshCw, CreditCard, Calendar } from "lucide-react"
import { formatPrice } from "@/lib/utils/subscriptionUtils"

export default function SubscriptionsPage() {
  const router = useRouter()
  const { company } = useSaasAuth()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [renewalLoading, setRenewalLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError("")

        // Load current subscription
        try {
          const subResponse = await saasBillingApi.getCurrentSubscription()
          setSubscription(subResponse.data)
        } catch (err: any) {
          if (err.response?.status !== 404) {
            throw err
          }
        }

        // Load payment history
        try {
          const paymentResponse = await saasBillingApi.getPaymentHistory()
          setPayments(paymentResponse.data.payments || [])
        } catch (err: any) {
          if (err.response?.status !== 404) {
            throw err
          }
          setPayments([])
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load subscription data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleRenew = async () => {
    if (!subscription) return

    setRenewalLoading(true)
    try {
      const response = await saasBillingApi.renewSubscription({
        subscriptionId: subscription.id,
        autoRenew: true,
      })

      setSubscription({
        ...subscription,
        currentPeriodEnd: response.data.currentPeriodEnd,
        status: "active",
      })
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to renew subscription")
    } finally {
      setRenewalLoading(false)
    }
  }

  const handleDownloadInvoice = (invoiceUrl: string | undefined) => {
    if (invoiceUrl) {
      window.open(invoiceUrl, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscriptions</h1>
        <p className="text-gray-600">Manage your subscription and billing details</p>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Current Subscription */}
      {subscription ? (
        <Card className="p-8 border-emerald-200">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{subscription.planName} Plan</h2>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-emerald-700">Active</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">
                {formatPrice(subscription.price)}
                <span className="text-base text-gray-600">/{subscription.billingPeriod === "monthly" ? "mo" : "yr"}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            {/* Current Period */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Period</p>
              <p className="font-semibold text-gray-900">
                {new Date(subscription.currentPeriodStart).toLocaleDateString()} →{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>

            {/* Next Billing */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Next Billing Date</p>
              <p className="font-semibold text-gray-900">
                {new Date(subscription.nextBillingDate).toLocaleDateString()}
              </p>
            </div>

            {/* Auto-Renewal */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Auto-Renewal</p>
              <p className="font-semibold text-gray-900">
                {subscription.autoRenew ? "✓ Enabled" : "✗ Disabled"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => router.push("/dashboard/billing/plans")} className="bg-emerald-600 hover:bg-emerald-700">
              Upgrade Plan
            </Button>
            <Button variant="outline" onClick={handleRenew} disabled={renewalLoading}>
              {renewalLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Renewing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Renew Now
                </>
              )}
            </Button>
            <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:border-red-200">
              Cancel Subscription
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="bg-blue-50 border-blue-200 p-8">
          <div className="text-center">
            <CreditCard className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 mb-2">No Active Subscription</h3>
            <p className="text-blue-700 mb-6">You're currently on a trial. Choose a plan to start your subscription.</p>
            <Button onClick={() => router.push("/dashboard/billing/plans")} className="bg-blue-600 hover:bg-blue-700">
              Browse Plans
            </Button>
          </div>
        </Card>
      )}

      {/* Payment History */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>

        {payments.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(payment.paymentDate || payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{payment.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatPrice(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            payment.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {payment.invoiceUrl ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadInvoice(payment.invoiceUrl)}
                            className="text-emerald-600 hover:bg-emerald-50"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payment history yet</p>
          </Card>
        )}
      </div>

      {/* FAQ */}
      <Card className="p-8 bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900 mb-6">FAQ</h3>
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-2">How do I change my subscription plan?</p>
            <p className="text-sm text-gray-600">
              Click "Upgrade Plan" above to change to a different plan. You'll be charged the difference immediately.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Can I cancel my subscription?</p>
            <p className="text-sm text-gray-600">
              Yes, click "Cancel Subscription" above. Your access will continue until the end of the current billing period.
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">What is auto-renewal?</p>
            <p className="text-sm text-gray-600">
              Auto-renewal automatically extends your subscription on the next billing date. You can disable it anytime.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
