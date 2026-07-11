"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { saasCompanyApi } from "@/lib/saasCompanyApi"
import { useEffect, useState } from "react"

export interface TeamStatusResult {
  userCount: number
  maxUsers: number | null
  canAddMore: boolean
  remainingSlots: number | null
  utilizationPercentage: number
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to get team and user status
 * Checks user count and plan limits
 *
 * @returns TeamStatusResult with team info
 *
 * @example
 * const { userCount, maxUsers, canAddMore } = useTeamStatus()
 * if (canAddMore) {
 *   console.log(`You can add ${remainingSlots} more users`)
 * }
 */
export function useTeamStatus(): TeamStatusResult {
  const { company } = useSaasAuth()

  const [userCount, setUserCount] = useState(0)
  const [maxUsers, setMaxUsers] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeamStatus = async () => {
    if (!company) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get company status to get user limit
      const statusResponse = await saasCompanyApi.getStatus()
      setUserCount(statusResponse.data.userCount)
      setMaxUsers(statusResponse.data.maxUsers)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load team status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeamStatus()
  }, [company?.id])

  // Use company.maxUsers if available (from plan), otherwise use fetched maxUsers
  const effectiveMaxUsers = company?.maxUsers ?? maxUsers

  // canAddMore should only be false if maxUsers is a real number and limit is reached
  // If maxUsers is null/undefined, unlimited users are allowed (canAddMore = true)
  const canAddMore = effectiveMaxUsers ? userCount < effectiveMaxUsers : true
  const remainingSlots = effectiveMaxUsers ? Math.max(0, effectiveMaxUsers - userCount) : null
  const utilizationPercentage = effectiveMaxUsers ? Math.round((userCount / effectiveMaxUsers) * 100) : 0

  return {
    userCount,
    maxUsers,
    canAddMore,
    remainingSlots,
    utilizationPercentage,
    loading,
    error,
    refetch: fetchTeamStatus,
  }
}
