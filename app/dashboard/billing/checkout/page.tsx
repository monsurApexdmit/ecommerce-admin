"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { saasBillingApi, type Plan } from "@/lib/saasBillingApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Lock, Check } from "lucide-react"

export default function CheckoutPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSaasAuth()

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
        const selectedPlan = response.data.plans.find((p) => p.id === parseInt(planId))

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
        <div className="text-center">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <Card className="bg-red-50 border-red-200 p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error || "Plan not found"}</p>
        </div>
        <Button onClick={() => router.push("/dashboard/billing/plans")} className="mt-4">
          Back to Plans
        </Button>
      </Card>
    )
  }

  const totalAmount = billingPeriod === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price
  const savings = billingPeriod === "yearly" ? Math.round(plan.price * 2.4) : 0
  const taxAmount = Math.round(totalAmount * 0.1)
  const finalAmount = totalAmount + taxAmount

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Complete Your Purchase</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Payment Form */}
        <div className="lg:col-span-2">
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Billing Period Selection */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <label className="text-sm font-semibold text-gray-900 block mb-3">
                  Billing Period
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("monthly")}
                    className={`p-3 rounded-lg border-2 font-medium transition-all ${
                      billingPeriod === "monthly"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("yearly")}
                    className={`p-3 rounded-lg border-2 font-medium transition-all relative ${
                      billingPeriod === "yearly"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    Yearly
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Billing Information</h3>

                {/* Email */}
                <div className="mb-4">
                  <Label htmlFor="billingEmail" className="text-sm font-medium">
                    Billing Email
                  </Label>
                  <Input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    value={formData.billingEmail}
                    onChange={handleInputChange}
                    className="h-10 mt-2"
                    disabled={processing}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600" />
                  Payment Method
                </h3>

                {/* Cardholder Name */}
                <div className="mb-4">
                  <Label htmlFor="cardName" className="text-sm font-medium">
                    Cardholder Name
                  </Label>
                  <Input
                    id="cardName"
                    name="cardName"
                    type="text"
                    placeholder="John Smith"
                    value={formData.cardName}
                    onChange={handleInputChange}
                    className="h-10 mt-2"
                    disabled={processing}
                  />
                </div>

                {/* Card Number */}
                <div className="mb-4">
                  <Label htmlFor="cardNumber" className="text-sm font-medium">
                    Card Number
                  </Label>
                  <Input
                    id="cardNumber"
                    name="cardNumber"
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    className="h-10 mt-2 font-mono"
                    disabled={processing}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Test card: 4242 4242 4242 4242 | Exp: 12/25 | CVC: 123
                  </p>
                </div>

                {/* Expiry & CVC */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="expiry" className="text-sm font-medium">
                      Expiry (MM/YY)
                    </Label>
                    <Input
                      id="expiry"
                      name="expiry"
                      type="text"
                      placeholder="12/25"
                      value={formData.expiry}
                      onChange={handleInputChange}
                      className="h-10 mt-2"
                      disabled={processing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvc" className="text-sm font-medium">
                      CVC
                    </Label>
                    <Input
                      id="cvc"
                      name="cvc"
                      type="password"
                      placeholder="123"
                      value={formData.cvc}
                      onChange={handleInputChange}
                      className="h-10 mt-2"
                      disabled={processing}
                    />
                  </div>
                </div>
              </div>

              {/* Auto-renew Checkbox */}
              <div className="border-t pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                    disabled={processing}
                  />
                  <span className="text-sm text-gray-700">
                    Automatically renew my subscription when it expires
                  </span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="border-t pt-6">
                <Button
                  type="submit"
                  disabled={processing}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-lg"
                >
                  {processing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    `Pay $${(finalAmount / 100).toFixed(2)}`
                  )}
                </Button>
              </div>

              {/* Security Info */}
              <p className="text-xs text-gray-500 text-center">
                🔒 Your payment information is encrypted and secure. We never store your full card details.
              </p>
            </form>
          </Card>
        </div>

        {/* Right: Order Summary */}
        <div>
          <Card className="p-6 sticky top-20 bg-gradient-to-br from-gray-50 to-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>

            {/* Plan Details */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="font-semibold text-gray-900">{plan.name} Plan</p>
              <p className="text-sm text-gray-600 mb-2">{plan.description}</p>

              {/* Plan Features Checklist */}
              <div className="space-y-2 text-xs text-gray-700">
                {plan.features.slice(0, 3).map((feature, index) => {
                  const featureName = typeof feature === "string" ? feature : (feature.name || "");
                  return (
                    <div key={`${featureName}-${index}`} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{featureName}</span>
                    </div>
                  );
                })}
                {plan.features.length > 3 && (
                  <p className="text-gray-500 ml-6">+ {plan.features.length - 3} more features</p>
                )}
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-3 border-b pb-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Plan Price ({billingPeriod}):</span>
                <span className="font-medium text-gray-900">
                  ${(totalAmount / 100).toFixed(2)}
                </span>
              </div>

              {savings > 0 && (
                <div className="flex items-center justify-between text-sm bg-emerald-50 p-2 rounded -mx-2 px-2">
                  <span className="text-emerald-700 font-medium">Annual Savings:</span>
                  <span className="text-emerald-700 font-bold">
                    -${(savings / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Tax (10%):</span>
                <span className="font-medium text-gray-900">
                  ${(taxAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-emerald-600">
                ${(finalAmount / 100).toFixed(2)}
              </span>
            </div>

            {/* Guarantees */}
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>30-day money-back guarantee</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Cancel anytime, no questions asked</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>Instant access after payment</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
