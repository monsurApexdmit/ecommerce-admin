"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useMemo } from "react"

export interface TrialStatusResult {
  isTrialActive: boolean
  isTrialExpired: boolean
  isTrialExpiringSoon: boolean
  daysRemaining: number | null
  percentageRemaining: number
  trialStartDate: string | null
  trialEndDate: string | null
  message: string
}

/**
 * Hook to get trial status information
 * Provides details about the company's trial period
 *
 * @returns TrialStatusResult with trial status info
 *
 * @example
 * const { daysRemaining, isTrialExpiring Soon } = useTrialStatus()
 * if (isTrialExpiringSoon) {
 *   console.log(`Trial expires in ${daysRemaining} days`)
 * }
 */
export function useTrialStatus(): TrialStatusResult {
  const { company, companyStatus, trialDaysRemaining } = useSaasAuth()

  return useMemo(() => {
    // If company is not on trial, return empty state
    if (!company || companyStatus !== "trial") {
      return {
        isTrialActive: false,
        isTrialExpired: false,
        isTrialExpiringSoon: false,
        daysRemaining: null,
        percentageRemaining: 0,
        trialStartDate: null,
        trialEndDate: null,
        message: "No active trial",
      }
    }

    const daysRemaining = trialDaysRemaining || 0
    const isTrialActive = daysRemaining > 0
    const isTrialExpired = daysRemaining <= 0
    const isTrialExpiringSoon = daysRemaining <= 3 && daysRemaining > 0
    const percentageRemaining = Math.max(0, Math.min(100, (daysRemaining / 10) * 100))

    let message = ""
    if (isTrialExpired) {
      message = "Trial has expired"
    } else if (isTrialExpiringSoon) {
      message = `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`
    } else if (isTrialActive) {
      message = `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} of free trial remaining`
    }

    return {
      isTrialActive,
      isTrialExpired,
      isTrialExpiringSoon,
      daysRemaining,
      percentageRemaining,
      trialStartDate: company.trialStartDate,
      trialEndDate: company.trialEndDate,
      message,
    }
  }, [company, companyStatus, trialDaysRemaining])
}
