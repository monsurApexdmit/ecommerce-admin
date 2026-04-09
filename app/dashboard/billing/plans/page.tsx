"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saasBillingApi, type Plan, type UpdatePlanPayload } from "@/lib/saasBillingApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Check, Zap, ChevronDown, ChevronUp, Edit, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

export default function PlansPage() {
  const router = useRouter()
  const { company } = useSaasAuth()
  const { toast } = useToast()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null)
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set())

  // Edit dialog state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editFormData, setEditFormData] = useState<UpdatePlanPayload>({})
  const [newFeature, setNewFeature] = useState("")
  const [editLoading, setEditLoading] = useState(false)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setLoading(true)
        const response = await saasBillingApi.getPlans()
        setPlans(response.data?.plans || [])

        try {
          const subResponse = await saasBillingApi.getCurrentSubscription()
          setCurrentPlanId(subResponse.data?.planId || null)
        } catch (err) {
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

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan)
    setEditFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price / 100, // convert cents to dollars
      maxUsers: plan.maxUsers || undefined,
      maxProducts: plan.maxProducts || undefined,
      maxBranches: plan.maxBranches || undefined,
      features: plan.features.map(f => typeof f === "string" ? f : f.name || "") as string[],
      isFeatured: plan.isFeatured || false,
    })
    setNewFeature("")
  }

  const closeEditDialog = () => {
    setEditingPlan(null)
    setEditFormData({})
    setNewFeature("")
  }

  const handleAddFeature = () => {
    if (!newFeature.trim()) return
    const features = editFormData.features || []
    setEditFormData({
      ...editFormData,
      features: [...features, newFeature.trim()],
    })
    setNewFeature("")
  }

  const handleRemoveFeature = (index: number) => {
    const features = editFormData.features || []
    setEditFormData({
      ...editFormData,
      features: features.filter((_, i) => i !== index),
    })
  }

  const handleSavePlan = async () => {
    if (!editingPlan) return

    setEditLoading(true)
    try {
      const response = await saasBillingApi.updatePlan(editingPlan.id, editFormData)

      // Update plans list
      setPlans(plans.map(p => p.id === editingPlan.id ? response.data : p))
      toast({
        title: "Success",
        description: "Plan updated successfully",
      })
      closeEditDialog()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to update plan",
        variant: "destructive",
      })
    } finally {
      setEditLoading(false)
    }
  }

  const toggleExpand = (planId: number) => {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      if (next.has(planId)) {
        next.delete(planId)
      } else {
        next.add(planId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 -z-10"></div>

        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="inline-block px-4 py-2 bg-emerald-100 rounded-full mb-3 sm:mb-4">
            <p className="text-emerald-700 text-xs sm:text-sm font-semibold">💎 Simple, Transparent Pricing</p>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-3 sm:mb-4">
            Choose Your Perfect Plan
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto">
            Start with a free trial or select a plan that scales with your business. All plans include a 30-day money-back guarantee.
          </p>

          {/* Current Status Banner */}
          {company && (
            <div className="inline-block mb-8">
              {company.status === "trial" ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-6 py-4">
                  <p className="text-emerald-900 font-semibold mb-1">🎉 Free Trial Active</p>
                  <p className="text-emerald-700 text-sm">{company.trialDaysRemaining} days remaining • Select a plan below to upgrade</p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-6 py-4">
                  <p className="text-emerald-900 font-semibold mb-1">✓ Active Subscription</p>
                  <p className="text-emerald-700 text-sm">
                    Current Plan: <span className="font-semibold">{company.planName || plans.find(p => p.id === currentPlanId)?.name || "Professional"}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-4xl mx-auto mb-8 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {plans.length > 0 ? (
        <div className="w-full px-4 py-0">
          <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-16">
            {plans.map((plan) => {
              const isPopular = plan.isFeatured || false
              const planNameMatch = company?.planName?.toLowerCase().trim() === plan.name?.toLowerCase().trim()
              const isCurrent = currentPlanId === plan.id || planNameMatch
              const formattedPrice = (plan.price / 100).toFixed(2)
              const isExpanded = expandedPlans.has(plan.id)
              const visibleFeatures = isExpanded ? plan.features : plan.features.slice(0, 5)

              return (
                <div
                  key={plan.id}
                  className={`relative group transition-all duration-300 ${
                    isPopular ? "md:scale-105" : ""
                  }`}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                        <Zap className="w-4 h-4" />
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  {/* Card */}
                  <Card
                    className={`h-full p-6 sm:p-8 flex flex-col relative overflow-hidden transition-all duration-300 ${
                      isPopular
                        ? "border-2 border-emerald-500 shadow-2xl bg-white"
                        : "border border-gray-200 hover:border-emerald-300 hover:shadow-lg bg-white"
                    } ${isCurrent ? "ring-2 ring-emerald-400" : ""}`}
                  >
                    {/* Background Accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300"></div>

                    <div className="relative z-10">
                      {/* Header with Name and Edit Button */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1">
                          {/* Current Plan Badge */}
                          {isCurrent && (
                            <div className="mb-3">
                              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                                ✓ Current Plan
                              </span>
                            </div>
                          )}
                          {/* Plan Name */}
                          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{plan.name}</h3>
                        </div>
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditDialog(plan)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0"
                          title="Edit plan"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-gray-600 text-sm mb-6 h-10">{plan.description}</p>

                      {/* Pricing */}
                      <div className="mb-8">
                        {plan.price > 0 ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl sm:text-5xl font-bold text-gray-900">${formattedPrice}</span>
                            <span className="text-gray-600 text-base sm:text-lg">/month</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-3xl sm:text-4xl font-bold text-gray-900">Free</span>
                            <p className="text-gray-600 text-xs sm:text-sm mt-2">10-day trial</p>
                          </div>
                        )}
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isCurrent}
                        className={`w-full h-12 font-semibold text-base mb-8 transition-all duration-300 ${
                          isPopular
                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl"
                            : "bg-gray-900 hover:bg-gray-800 text-white"
                        } ${isCurrent ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isCurrent ? "Current Plan" : "Get Started"}
                      </Button>

                      {/* Limits Section */}
                      <div className="mb-8 pb-8 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Limits</p>
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">👥</div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {plan.maxUsers === 999999 || !plan.maxUsers ? "Unlimited" : `Up to ${plan.maxUsers}`} Team Members
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">📦</div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {plan.maxProducts === 999999 || !plan.maxProducts ? "Unlimited" : `Up to ${plan.maxProducts?.toLocaleString()}`} Products
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg">🏪</div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {plan.maxBranches === 999999 || !plan.maxBranches ? "Unlimited" : `Up to ${plan.maxBranches}`} Branches
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Features List */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Features</p>
                        <ul className="space-y-3">
                          {visibleFeatures.map((feature, index) => {
                            const featureName = typeof feature === "string" ? feature : (feature.name || "");
                            return (
                              <li key={`${featureName}-${index}`} className="flex items-start gap-3">
                                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700">{featureName}</span>
                              </li>
                            );
                          })}
                        </ul>

                        {/* Expand/Collapse Button */}
                        {plan.features.length > 5 && (
                          <button
                            onClick={() => toggleExpand(plan.id)}
                            className="mt-4 text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline"
                          >
                            {isExpanded
                              ? <><ChevronUp size={14}/> Show less</>
                              : <><ChevronDown size={14}/> + {plan.features.length - 5} more features</>
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto mb-8 px-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 text-lg font-semibold">No plans available</p>
            <p className="text-yellow-700 mt-2">Please contact support for assistance.</p>
          </div>
        </div>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan: {editingPlan?.name}</DialogTitle>
            <DialogDescription>Update plan details, pricing, limits, and features</DialogDescription>
          </DialogHeader>

          {editingPlan && (
            <div className="space-y-6 py-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                <Input
                  value={editFormData.name || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g., Professional"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editFormData.description || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Short description of the plan"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  rows={2}
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price ($/month)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editFormData.price || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 149.00"
                />
              </div>

              {/* Max Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Team Members (999999 = Unlimited)</label>
                <Input
                  type="number"
                  value={editFormData.maxUsers || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, maxUsers: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 5"
                />
              </div>

              {/* Max Products */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Products (999999 = Unlimited)</label>
                <Input
                  type="number"
                  value={editFormData.maxProducts || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, maxProducts: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 10000"
                />
              </div>

              {/* Max Branches */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Branches (999999 = Unlimited)</label>
                <Input
                  type="number"
                  value={editFormData.maxBranches || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, maxBranches: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 5"
                />
              </div>

              {/* Is Featured */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={editFormData.isFeatured || false}
                  onChange={(e) => setEditFormData({ ...editFormData, isFeatured: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="isFeatured" className="text-sm font-medium text-gray-700">
                  Mark as "Most Popular"
                </label>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Features</label>
                <div className="space-y-2 mb-3">
                  {(editFormData.features || []).map((feature, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                      <span className="text-sm text-gray-700">{feature}</span>
                      <button
                        onClick={() => handleRemoveFeature(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFeature()}
                    placeholder="Add new feature..."
                  />
                  <Button
                    onClick={handleAddFeature}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" onClick={closeEditDialog} disabled={editLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePlan}
                  disabled={editLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {editLoading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
