"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check } from "lucide-react"
import { saasBillingApi, type Plan } from "@/lib/saasBillingApi"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface PricingCardProps {
  plan: Plan
  isCurrentPlan?: boolean
  onSelectPlan?: (plan: Plan) => void
}

export function PricingCard({ plan, isCurrentPlan = false, onSelectPlan }: PricingCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSelectPlan = async () => {
    if (onSelectPlan) {
      onSelectPlan(plan)
      return
    }

    // Default behavior: redirect to checkout
    setLoading(true)
    try {
      router.push(`/dashboard/billing/checkout?planId=${plan.id}`)
    } finally {
      setLoading(false)
    }
  }

  const formattedPrice = (plan.price / 100).toFixed(2)

  return (
    <Card
      className={`relative flex flex-col h-full p-6 transition-all duration-300 ${
        plan.isPopular
          ? "ring-2 ring-emerald-500 shadow-xl md:scale-105"
          : "hover:shadow-lg"
      } ${isCurrentPlan ? "bg-emerald-50" : ""}`}
    >
      {/* Popular Badge */}
      {plan.isPopular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            POPULAR
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="mb-3 inline-block">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded">
            Current Plan
          </span>
        </div>
      )}

      {/* Plan Name */}
      <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-6">{plan.description}</p>

      {/* Pricing */}
      <div className="mb-6">
        {plan.price > 0 ? (
          <div>
            <span className="text-4xl font-bold text-gray-900">
              ${formattedPrice}
            </span>
            <span className="text-gray-600 text-sm">
              {plan.billingPeriod === "monthly" && " / month"}
              {plan.billingPeriod === "yearly" && " / year"}
              {plan.billingPeriod === "custom" && " / custom"}
            </span>
          </div>
        ) : (
          <div>
            <span className="text-3xl font-bold text-gray-900">Custom</span>
            <p className="text-sm text-gray-600">Contact us for pricing</p>
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-xs font-semibold text-gray-700 uppercase mb-3">Limits</p>
        <div className="space-y-2 text-sm text-gray-700">
          {plan.maxUsers !== null && (
            <p>👥 Up to {plan.maxUsers} users</p>
          )}
          {plan.maxUsers === null && (
            <p>👥 Unlimited users</p>
          )}

          {plan.maxBranches !== null && (
            <p>🏪 Up to {plan.maxBranches} branch{plan.maxBranches !== 1 ? "es" : ""}</p>
          )}
          {plan.maxBranches === null && (
            <p>🏪 Unlimited branches</p>
          )}

          {plan.maxProducts !== null && (
            <p>📦 Up to {plan.maxProducts} products</p>
          )}
          {plan.maxProducts === null && (
            <p>📦 Unlimited products</p>
          )}
        </div>
      </div>

      {/* Features List */}
      <div className="mb-6 flex-grow">
        <p className="text-xs font-semibold text-gray-700 uppercase mb-3">Features</p>
        <ul className="space-y-3">
          {plan.features.map((feature, index) => {
            const featureName = typeof feature === "string" ? feature : (feature.name || "");
            const featureDesc = typeof feature === "object" ? (feature.description || "") : "";
            return (
              <li key={`${featureName}-${index}`} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{featureName}</p>
                  {featureDesc && <p className="text-xs text-gray-600">{featureDesc}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* CTA Button */}
      <Button
        onClick={handleSelectPlan}
        disabled={loading || isCurrentPlan}
        className={`w-full h-11 font-medium transition-all ${
          plan.isPopular
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-gray-900 hover:bg-gray-800 text-white"
        } ${isCurrentPlan ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {loading ? "Loading..." : isCurrentPlan ? "Current Plan" : "Select Plan"}
      </Button>

      {/* Money Back Guarantee */}
      <p className="text-xs text-gray-500 text-center mt-4">
        ✓ 30-day money-back guarantee
      </p>
    </Card>
  )
}
