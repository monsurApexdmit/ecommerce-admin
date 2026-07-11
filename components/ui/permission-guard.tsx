"use client"

import { useSaasAuth } from "@/contexts/saas-auth-context"

interface PermissionGuardProps {
  module: string
  action?: "read" | "write" | "delete"
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGuard({
  module,
  action = "read",
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission } = useSaasAuth()
  if (!hasPermission(module, action)) return <>{fallback}</>
  return <>{children}</>
}
