"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Order details live in a dialog on the orders list (see OrderDetailDialog).
 * This route is kept so existing links (dashboard, assignments, payments, notifications)
 * keep working: it forwards to the list with the dialog opened for this order.
 */
export default function TailorOrderRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  useEffect(() => { router.replace(`/dashboard/tailor/orders?view=${encodeURIComponent(id)}`) }, [id, router])
  return <Skeleton className="h-40 rounded-[14px]" />
}
