import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons/links rendered on the right (wraps under the title on small screens). */
  actions?: React.ReactNode
}

/** Page title + optional subtitle + right-aligned actions. Replaces the hand-rolled `<h1>` + `<p>` header block. */
export function PageHeader({ title, description, actions, className, children, ...props }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)} {...props}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
