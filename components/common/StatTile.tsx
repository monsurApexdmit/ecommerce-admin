"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatTileProps extends Omit<React.ComponentProps<"div">, "onClick"> {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
  /** Secondary line under the value (trend, comparison). */
  hint?: React.ReactNode
  /** Makes the tile a keyboard-accessible button (e.g. to apply a filter). */
  onClick?: () => void
  active?: boolean
}

/** Single KPI tile (label, big value, optional icon + hint) built on Card. */
export function StatTile({ label, value, icon, hint, onClick, active, className, ...props }: StatTileProps) {
  const clickable = !!onClick
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? !!active : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.() } } : undefined}
      className={cn(
        "flex flex-col gap-2 p-5",
        clickable && "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary ring-1 ring-primary",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}
