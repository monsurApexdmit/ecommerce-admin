"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useProduct } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"

export interface PlanLimitsResult {
  // User limits
  maxUsers: number | null
  canAddMoreUsers: boolean

  // Product limits
  maxProducts: number | null
  currentProductCount: number
  canAddMoreProducts: boolean
  remainingProductSlots: number | null

  // Warehouse/Branch limits
  maxBranches: number | null
  currentBranchCount: number
  canAddMoreBranches: boolean
  remainingBranchSlots: number | null

  // Plan info
  planName: string | null
  planFeatures: string[]
}

/**
 * Hook to check plan limits and remaining capacity
 * Returns all limit information for the current subscription plan
 */
export function usePlanLimits(): PlanLimitsResult {
  const { company } = useSaasAuth()
  const { products } = useProduct()
  const { warehouses } = useWarehouse()

  // Get plan limits from company (now includes maxUsers, maxProducts, maxBranches from subscription plan)
  const maxUsers = company?.maxUsers ?? null
  const maxProducts = company?.maxProducts ?? null
  const maxBranches = company?.maxBranches ?? null
  const planFeatures = company?.planFeatures ?? []
  const planName = company?.planName ?? null

  // Count current usage
  const currentProductCount = products?.length ?? 0
  const currentBranchCount = warehouses?.length ?? 0

  // Calculate if user can add more
  const canAddMoreUsers = maxUsers ? maxUsers > (company?.maxUsers ?? 0) : true // Will be calculated by API
  const canAddMoreProducts = maxProducts ? currentProductCount < maxProducts : true
  const canAddMoreBranches = maxBranches ? currentBranchCount < maxBranches : true

  // Calculate remaining slots
  const remainingProductSlots = maxProducts ? Math.max(0, maxProducts - currentProductCount) : null
  const remainingBranchSlots = maxBranches ? Math.max(0, maxBranches - currentBranchCount) : null

  return {
    // Users
    maxUsers,
    canAddMoreUsers,

    // Products
    maxProducts,
    currentProductCount,
    canAddMoreProducts,
    remainingProductSlots,

    // Branches/Warehouses
    maxBranches,
    currentBranchCount,
    canAddMoreBranches,
    remainingBranchSlots,

    // Plan info
    planName,
    planFeatures,
  }
}
