"use client"

import type { ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

/** White card with the dashboard's 14px radius + 1px border, no shadow. */
export function DashCard({ className, children, ...rest }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("surface min-w-0 p-5 sm:p-[22px]", className)}
      {...rest}
    >
      {children}
    </section>
  )
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-dash-display text-lg font-bold text-dash-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-dash-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[10px] bg-dash-danger-soft p-4 text-sm text-dash-danger-fg">
      <span className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" aria-hidden /> {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-dash-danger/30 bg-dash-card px-3 text-[13px] font-semibold text-dash-ink"
      >
        <RotateCcw className="size-3.5" aria-hidden /> Retry
      </button>
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] bg-dash-neutral-soft p-3 text-[13px] text-dash-neutral-fg">{children}</p>
}

export function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-dash-neutral-soft", className)} aria-hidden />
}

/** Section-level skeleton: a few stacked bars. */
export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Bar key={i} className={i === 0 ? "h-6 w-1/3" : "h-5 w-full"} />
      ))}
    </div>
  )
}
