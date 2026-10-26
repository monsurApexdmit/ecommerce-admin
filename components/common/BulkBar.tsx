"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BulkBarProps {
  /** Number of selected rows; the bar renders nothing when 0. */
  count: number
  onClear?: () => void
  /** Bulk action buttons. */
  children?: React.ReactNode
  /** Override "N selected". */
  label?: React.ReactNode
  className?: string
}

/** Selection bar for tables: "N selected" badge + actions + clear. Replaces hand-styled bulk-action strips. */
export function BulkBar({ count, onClear, children, label, className }: BulkBarProps) {
  if (count <= 0) return null
  return (
    <Card role="region" aria-label="Bulk actions" className={cn("flex flex-row flex-wrap items-center gap-2 px-3 py-2", className)}>
      <Badge variant="secondary">{label ?? `${count} selected`}</Badge>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {onClear && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X />
          Clear
        </Button>
      )}
    </Card>
  )
}
