"use client"

import { DuesView } from "@/components/dues/dues-view"
import { useModuleGuard } from "@/hooks/use-module-guard"

export default function VendorDuesPage() {
  const blocked = useModuleGuard("Dues")
  if (blocked) return blocked
  return <DuesView party="vendors" />
}
