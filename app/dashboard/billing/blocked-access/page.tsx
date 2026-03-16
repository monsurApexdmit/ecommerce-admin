"use client"

import { BlockedAccessScreen } from "@/components/BlockedAccessScreen"
import { useSearchParams } from "next/navigation"

export default function BlockedAccessPage() {
  const searchParams = useSearchParams()
  const reason = searchParams.get("reason") as any || "trial_expired"

  return <BlockedAccessScreen reason={reason} />
}
