"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Check } from "lucide-react"
import { saasBillingApi, type Plan } from "@/lib/saasBillingApi"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface PricingCardProps {
  plan: Plan
  isCurrentPlan?: boolean
  onSelectPlan?: (plan: Plan) => void
}

export function PricingCard({ plan, isCurrentPlan = false, onSelectPlan }: PricingCardProps) {
  const router = useRouter()
  const { formatCurrency } = useCompanySettings()
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

  const formattedPrice = formatCurrency(plan.price / 100)

  return (
    <Card
      className={cn("relative h-full gap-0 p-6", plan.isPopular && "border-primary ring-1 ring-primary", isCurrentPlan && "bg-muted/50")}
    >
      {/* Popular Badge */}
      {plan.isPopular && (
        <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">POPULAR</Badge>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <Badge variant="secondary" className="mb-3">Current Plan</Badge>
      )}

      {/* Plan Name */}
      <h3 className="text-xl font-bold mb-2">{plan.name}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

      {/* Pricing */}
      <div className="mb-6">
        {plan.price > 0 ? (
          <div>
            <span className="text-4xl font-bold">
              {formattedPrice}
            </span>
            <span className="text-muted-foreground text-sm">
              {plan.billingPeriod === "monthly" && " / month"}
              {plan.billingPeriod === "yearly" && " / year"}
              {plan.billingPeriod === "custom" && " / custom"}
            </span>
          </div>
        ) : (
          <div>
            <span className="text-3xl font-bold">Custom</span>
            <p className="text-sm text-muted-foreground">Contact us for pricing</p>
          </div>
        )}
      </div>

      {/* Limits */}
      <Card className="mb-6 gap-0 bg-muted/50 p-4 shadow-none">
        <SectionTitle as="p" className="mb-3">Limits</SectionTitle>
        <div className="space-y-2 text-sm">
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
      </Card>

      {/* Features List */}
      <div className="mb-6 flex-grow">
        <SectionTitle as="p" className="mb-3">Features</SectionTitle>
        <ul className="space-y-3">
          {plan.features.map((feature, index) => {
            const featureName = typeof feature === "string" ? feature : (feature.name || "");
            const featureDesc = typeof feature === "object" ? (feature.description || "") : "";
            return (
              <li key={`${featureName}-${index}`} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{featureName}</p>
                  {featureDesc && <p className="text-xs text-muted-foreground">{featureDesc}</p>}
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
        variant={plan.isPopular ? "default" : "outline"}
        className="w-full"
      >
        {loading ? "Loading..." : isCurrentPlan ? "Current Plan" : "Select Plan"}
      </Button>

      {/* Money Back Guarantee */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        ✓ 30-day money-back guarantee
      </p>
    </Card>
  )
}
