"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { saasBillingApi, type Plan } from "@/lib/saasBillingApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { AlertCircle, Lock, Check } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()

  const planId = searchParams.get("planId")

  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    cardName: user?.fullName || "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    billingEmail: user?.email || "",
  })

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")
  const [autoRenew, setAutoRenew] = useState(true)

  useEffect(() => {
    if (!planId) {
      router.push("/dashboard/billing/plans")
      return
    }

    const loadPlan = async () => {
      try {
        setLoading(true)
        const response = await saasBillingApi.getPlans()
        const selectedPlan = response.data.plans.find((p: { id: number }) => p.id === parseInt(planId))

        if (!selectedPlan) {
          setError("Plan not found")
          return
        }

        setPlan(selectedPlan)
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load plan")
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [planId, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === "cardNumber") {
      const sanitized = value.replace(/\s/g, "").slice(0, 16)
      const formatted = sanitized.replace(/(\d{4})/g, "$1 ").trim()
      setFormData((prev) => ({ ...prev, [name]: formatted }))
    } else if (name === "expiry") {
      const sanitized = value.replace(/\D/g, "").slice(0, 4)
      const formatted = sanitized.length > 2 ? `${sanitized.slice(0, 2)}/${sanitized.slice(2)}` : sanitized
      setFormData((prev) => ({ ...prev, [name]: formatted }))
    } else if (name === "cvc") {
      setFormData((prev) => ({ ...prev, [name]: value.slice(0, 4) }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const validateForm = (): boolean => {
    if (!formData.cardName.trim()) {
      setError("Cardholder name is required")
      return false
    }
    if (formData.cardNumber.replace(/\s/g, "").length !== 16) {
      setError("Valid card number required (16 digits)")
      return false
    }
    if (!formData.expiry || formData.expiry.length !== 5) {
      setError("Valid expiry date required (MM/YY)")
      return false
    }
    if (formData.cvc.length !== 3 && formData.cvc.length !== 4) {
      setError("Valid CVC required (3-4 digits)")
      return false
    }
    if (!formData.billingEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Valid billing email required")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!plan || !validateForm()) {
      return
    }

    setProcessing(true)

    try {
      // In production, use Stripe token instead of raw card data
      const response = await saasBillingApi.processPayment({
        planId: plan.id,
        planName: plan.name,
        amount: billingPeriod === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price,
        currency: "USD",
        billingPeriod,
        stripeTokenId: "tok_visa", // Replace with actual Stripe token
        autoRenew,
      })

      // Show success message
      router.push(
        `/dashboard/billing/success?subscriptionId=${response.data.subscriptionId}&invoiceUrl=${encodeURIComponent(response.data.invoiceUrl || "")}`
      )
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.payment?.[0] ||
          "Payment failed. Please try again."
      )
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="size-8" />
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error || "Plan not found"}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/dashboard/billing/plans")} className="self-start">
          Back to Plans
        </Button>
      </div>
    )
  }

  const totalAmount = billingPeriod === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price
  const savings = billingPeriod === "yearly" ? Math.round(plan.price * 2.4) : 0
  const taxAmount = Math.round(totalAmount * 0.1)
  const finalAmount = totalAmount + taxAmount

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <PageHeader title="Complete Your Purchase" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Payment Form */}
        <div className="lg:col-span-2">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Billing Period Selection */}
              <FormField label="Billing Period">
                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedControl
                    aria-label="Billing Period"
                    size="default"
                    value={billingPeriod}
                    onValueChange={(v) => setBillingPeriod(v as "monthly" | "yearly")}
                    options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]}
                  />
                  <Badge>Save 20%</Badge>
                </div>
              </FormField>

              <Separator />
              <div>
                <h3 className="font-semibold mb-4">Billing Information</h3>

                {/* Email */}
                <FormField label="Billing Email" htmlFor="billingEmail">
                  <Input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    value={formData.billingEmail}
                    onChange={handleInputChange}
                    disabled={processing}
                  />
                </FormField>
              </div>

              <Separator />
              <div className="flex flex-col gap-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lock className="size-5 text-muted-foreground" />
                  Payment Method
                </h3>

                {/* Cardholder Name */}
                <FormField label="Cardholder Name" htmlFor="cardName">
                  <Input
                    id="cardName"
                    name="cardName"
                    type="text"
                    placeholder="John Smith"
                    value={formData.cardName}
                    onChange={handleInputChange}
                    disabled={processing}
                  />
                </FormField>

                {/* Card Number */}
                <FormField label="Card Number" htmlFor="cardNumber" description="Test card: 4242 4242 4242 4242 | Exp: 12/25 | CVC: 123">
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    className="font-mono"
                    disabled={processing}
                  />
                </FormField>

                {/* Expiry & CVC */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Expiry (MM/YY)" htmlFor="expiry">
                    <Input
                      id="expiry"
                      name="expiry"
                      type="text"
                      placeholder="12/25"
                      value={formData.expiry}
                      onChange={handleInputChange}
                      disabled={processing}
                    />
                  </FormField>
                  <FormField label="CVC" htmlFor="cvc">
                    <Input
                      id="cvc"
                      name="cvc"
                      type="password"
                      placeholder="123"
                      value={formData.cvc}
                      onChange={handleInputChange}
                      disabled={processing}
                    />
                  </FormField>
                </div>
              </div>

              {/* Auto-renew Checkbox */}
              <Separator />
              <FormField orientation="horizontal" label="Automatically renew my subscription when it expires" htmlFor="autoRenew" className="flex-row-reverse justify-end [&>[data-slot=field-label]]:flex-none">
                <Checkbox
                  id="autoRenew"
                  checked={autoRenew}
                  onCheckedChange={(v) => setAutoRenew(v === true)}
                  disabled={processing}
                />
              </FormField>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Separator />
              <Button
                type="submit"
                size="lg"
                disabled={processing}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Spinner />
                    Processing...
                  </>
                ) : (
                  `Pay ${formatCurrency(finalAmount / 100)}`
                )}
              </Button>

              {/* Security Info */}
              <p className="text-xs text-muted-foreground text-center">
                🔒 Your payment information is encrypted and secure. We never store your full card details.
              </p>
            </form>
          </Card>
        </div>

        {/* Right: Order Summary */}
        <div>
          <SectionCard title="Order Summary" className="sticky top-20" contentClassName="flex flex-col gap-4">
            {/* Plan Details */}
            <Card className="gap-2 bg-muted/50 p-4 shadow-none">
              <p className="font-semibold">{plan.name} Plan</p>
              <p className="text-sm text-muted-foreground">{plan.description}</p>

              {/* Plan Features Checklist */}
              <div className="space-y-2 text-xs">
                {plan.features.slice(0, 3).map((feature, index) => {
                  const featureName = typeof feature === "string" ? feature : (feature.name || "");
                  return (
                    <div key={`${featureName}-${index}`} className="flex items-center gap-2">
                      <Check className="size-4 text-primary flex-shrink-0" />
                      <span>{featureName}</span>
                    </div>
                  );
                })}
                {plan.features.length > 3 && (
                  <p className="text-muted-foreground ml-6">+ {plan.features.length - 3} more features</p>
                )}
              </div>
            </Card>

            {/* Pricing Breakdown */}
            <InfoList>
              <InfoRow label={`Plan Price (${billingPeriod}):`} value={formatCurrency(totalAmount / 100)} />
              {savings > 0 && (
                <InfoRow label="Annual Savings:" value={`-${formatCurrency(savings / 100)}`} />
              )}
              <InfoRow label="Tax (10%):" value={formatCurrency(taxAmount / 100)} />
            </InfoList>
            <Separator />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="font-bold">Total:</span>
              <span className="text-2xl font-bold">
                {formatCurrency(finalAmount / 100)}
              </span>
            </div>

            {/* Guarantees */}
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span>30-day money-back guarantee</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Cancel anytime, no questions asked</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Instant access after payment</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
