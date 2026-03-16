"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { saasBillingApi } from "@/lib/saasBillingApi"
import { useEffect, useState } from "react"

export interface BillingStatusResult {
  currentPlanId: number | null
  currentPlanName: string | null
  subscriptionStatus: "active" | "expired" | "cancelled" | "pending" | null
  subscriptionEndDate: string | null
  daysUntilRenewal: number | null
  isRenewingSoon: boolean
  isSubscriptionExpired: boolean
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to get subscription and billing status
 * Fetches current subscription details from API
 *
 * @returns BillingStatusResult with subscription info
 *
 * @example
 * const { currentPlanName, daysUntilRenewal } = useBillingStatus()
 * console.log(`Your ${currentPlanName} plan renews in ${daysUntilRenewal} days`)
 */
export function useBillingStatus(): BillingStatusResult {
  const { company } = useSaasAuth()

  const [planId, setPlanId] = useState<number | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    "active" | "expired" | "cancelled" | "pending" | null
  >(null)
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubscriptionStatus = async () => {
    if (!company || company.status === "trial") {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await saasBillingApi.getCurrentSubscription()
      setPlanId(response.data.planId)
      setPlanName(response.data.planName)
      setSubscriptionStatus(response.data.status)
      setSubscriptionEndDate(response.data.currentPeriodEnd)
    } catch (err: any) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || "Failed to load billing status")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [company?.id])

  // Calculate days until renewal
  const daysUntilRenewal =
    subscriptionEndDate &&
    Math.ceil(
      (new Date(subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

  const isRenewingSoon = daysUntilRenewal ? daysUntilRenewal <= 7 && daysUntilRenewal > 0 : false
  const isSubscriptionExpired = daysUntilRenewal ? daysUntilRenewal <= 0 : false

  return {
    currentPlanId: planId,
    currentPlanName: planName,
    subscriptionStatus,
    subscriptionEndDate,
    daysUntilRenewal,
    isRenewingSoon,
    isSubscriptionExpired,
    loading,
    error,
    refetch: fetchSubscriptionStatus,
  }
}
