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

  const canAddMore = maxUsers ? userCount < maxUsers : false
  const remainingSlots = maxUsers ? Math.max(0, maxUsers - userCount) : null
  const utilizationPercentage = maxUsers ? Math.round((userCount / maxUsers) * 100) : 0

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
