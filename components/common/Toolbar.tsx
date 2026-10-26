import * as React from "react"

import { cn } from "@/lib/utils"

interface ToolbarProps extends React.ComponentProps<"div"> {
  /** Right-aligned slot (export/add buttons, view toggles). */
  actions?: React.ReactNode
}

/** Wrapping row for search/filters on the left and actions on the right. Layout only; put shadcn controls inside. */
export function Toolbar({ actions, className, children, ...props }: ToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Alias of `Toolbar` for filter rows. */
export const FilterBar = Toolbar
