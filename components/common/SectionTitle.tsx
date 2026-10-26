import * as React from "react"

import { cn } from "@/lib/utils"

interface SectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading element to render (default `h3`). Use `legend` inside a `<fieldset>`. */
  as?: "h2" | "h3" | "h4" | "p" | "legend"
  /** Optional element shown on the right (e.g. an "Add" button). */
  action?: React.ReactNode
}

/** Small uppercase muted section heading. Replaces `sectionTitle` class-string constants. */
export function SectionTitle({ as: Comp = "h3", action, className, children, ...props }: SectionTitleProps) {
  const heading = (
    <Comp className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", !action && className)} {...props}>
      {children}
    </Comp>
  )
  if (!action) return heading
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {heading}
      {action}
    </div>
  )
}
