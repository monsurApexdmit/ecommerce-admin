"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PricingCard } from "@/components/PricingCard"
import { saasBillingApi, type Plan } from "@/lib/saasBillingApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader } from "lucide-react"

export default function PlansPage() {
  const router = useRouter()
  const { company } = useSaasAuth()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoading(true)
        const response = await saasBillingApi.getPlans()
        setPlans(response.data?.plans || [])

        // Get current subscription to highlight current plan
        try {
          const subResponse = await saasBillingApi.getCurrentSubscription()
          setCurrentPlanId(subResponse.data.planId)
        } catch (err) {
          // No active subscription (still on trial)
          setCurrentPlanId(null)
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load plans")
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [])

  const handleSelectPlan = (plan: Plan) => {
    router.push(`/dashboard/billing/checkout?planId=${plan.id}`)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Choose Your Plan</h1>
        <p className="text-lg text-gray-600">
          Select the perfect plan for your business. All plans include a 30-day money-back guarantee.
        </p>
      </div>

      {/* Current Status */}
      {company && (
        <Card className="bg-emerald-50 border-emerald-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-900 mb-1">
                {company.status === "trial"
                  ? "🎉 Free Trial Active"
                  : "✓ Active Subscription"}
              </p>
              <p className="text-sm text-emerald-700">
                {company.status === "trial"
                  ? `${company.trialDaysRemaining} days remaining • Trial ends ${company.trialEndDate}`
                  : "Your subscription is active and running smoothly"}
              </p>
            </div>
            {company.status === "trial" && (
              <Button variant="outline" size="sm" disabled>
                Choose a plan below to upgrade
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading plans...</p>
          </div>
        </div>
      ) : (
        <>
          {/* No Plans Error */}
          {!plans || plans.length === 0 ? (
            <Card className="bg-yellow-50 border-yellow-200 p-6">
              <div className="flex items-center gap-3 text-yellow-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>No plans available at the moment. Please contact support.</p>
              </div>
            </Card>
          ) : (
            <>
          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans?.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={currentPlanId === plan.id}
                onSelectPlan={handleSelectPlan}
              />
            ))}
          </div>

            {/* FAQ Section */}
            <Card className="p-8 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Q1 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Can I change my plan anytime?</h3>
                <p className="text-sm text-gray-600">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>

              {/* Q2 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
                <p className="text-sm text-gray-600">
                  We accept all major credit cards (Visa, Mastercard, American Express) via Stripe.
                </p>
              </div>

              {/* Q3 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Is there a setup fee?</h3>
                <p className="text-sm text-gray-600">
                  No, there are no hidden fees. You only pay the monthly or annual subscription price.
                </p>
              </div>

              {/* Q4 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What about the money-back guarantee?</h3>
                <p className="text-sm text-gray-600">
                  If you're not satisfied within 30 days, we'll refund your money. No questions asked.
                </p>
              </div>

              {/* Q5 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Can I add more users?</h3>
                <p className="text-sm text-gray-600">
                  Each plan comes with a user limit. Upgrade to add more team members.
                </p>
              </div>

              {/* Q6 */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Do you offer annual discounts?</h3>
                <p className="text-sm text-gray-600">
                  Yes! Save 20% when you switch to annual billing. The discount applies automatically.
                </p>
              </div>
            </div>
          </Card>

          {/* Contact Support */}
          <Card className="p-8 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-emerald-900 mb-3">Need a Custom Plan?</h2>
              <p className="text-emerald-700 mb-6">
                For large organizations, we offer custom plans tailored to your needs.
              </p>
              <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
                <a href="mailto:sales@company.com">Contact Sales Team</a>
              </Button>
            </div>
          </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
