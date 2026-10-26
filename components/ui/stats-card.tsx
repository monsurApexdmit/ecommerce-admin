"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface StatItem {
  label: string
  value: number | string
  icon?: ReactNode
  color?: "blue" | "green" | "yellow" | "red" | "purple"
  /** Small secondary line under the value, e.g. "12% vs last month" */
  hint?: ReactNode
  /** Makes the card clickable (e.g. to apply a filter) */
  onClick?: () => void
  active?: boolean
}

interface StatsCardsProps {
  stats: StatItem[]
}

const colorClasses = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, idx) => {
        const clickable = !!stat.onClick
        return (
          <Card
            key={idx}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={stat.onClick}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stat.onClick?.() } } : undefined}
            className={cn(
              "p-5 transition-colors",
              clickable && "cursor-pointer hover:border-ring/60",
              stat.active && "border-ring ring-1 ring-ring/40",
            )}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                {stat.icon && (
                  <div className={`p-2 rounded-lg ${colorClasses[stat.color || "blue"]}`}>
                    {stat.icon}
                  </div>
                )}
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</p>
              {stat.hint && <p className="text-xs text-muted-foreground">{stat.hint}</p>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
