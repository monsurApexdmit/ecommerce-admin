"use client"

import type { ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/EmptyState"

/** Dashboard panel: shadcn Card with the dashboard's padding (callers add flex/gap as needed). */
export function DashCard({ className, children, ...rest }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("min-w-0 gap-0 p-5 sm:p-[22px]", className)}
      {...rest}
    >
      {children}
    </Card>
  )
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-none">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden />
      <AlertTitle>{message}</AlertTitle>
      <AlertDescription>
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={onRetry}
        >
          <RotateCcw className="size-3.5" aria-hidden /> Retry
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <EmptyState title={children} bordered className="p-4 md:p-6" />
}

export function Bar({ className }: { className?: string }) {
  return <Skeleton className={className} aria-hidden />
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
