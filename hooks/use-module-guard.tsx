"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { PlanGate } from "@/components/ui/plan-gate"

/**
 * Returns a JSX element to render when access is blocked, or null when allowed.
 *
 * Priority:
 *   1. Module not in plan  → <PlanGate />   (upgrade CTA)
 *   2. RBAC canRead false  → <AccessDenied /> (permission error)
 *   3. null               → access granted, render page normally
 *
 * Usage:
 *   const blocked = useModuleGuard('Orders')
 *   if (blocked) return blocked
 */
export function useModuleGuard(module: string): JSX.Element | null {
  const { isPlanModule, canRead } = useSaasAuth()

  if (!isPlanModule(module)) return <PlanGate moduleName={module} />
  if (!canRead(module)) return <AccessDenied />
  return null
}
