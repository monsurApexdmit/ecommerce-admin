"use client"

import { cn } from "@/lib/utils"

export interface StatusTab {
  value: string
  label: string
  count?: number
}

interface StatusTabsProps {
  tabs: StatusTab[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/** Pill tabs with counts, e.g. All 11 | Pending 11 | Delivered 0 */
export function StatusTabs({ tabs, value, onChange, className }: StatusTabsProps) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1 border-b border-border", className)}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                active ? "bg-brand-soft text-brand-fg" : "bg-muted text-muted-foreground",
              )}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
