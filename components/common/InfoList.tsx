import * as React from "react"

import { cn } from "@/lib/utils"

/** `<dl>` wrapper for key/value rows in detail views/dialogs. */
export function InfoList({ className, ...props }: React.ComponentProps<"dl">) {
  return <dl className={cn("grid gap-2 text-sm", className)} {...props} />
}

interface InfoRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode
  /** Value; falls back to `children`. */
  value?: React.ReactNode
  children?: React.ReactNode
  /** `stacked` puts the value under the label instead of right-aligned. */
  layout?: "inline" | "stacked"
}

/** One label/value row (muted label, medium value). Use inside `InfoList`. */
export function InfoRow({ label, value, children, layout = "inline", className, ...props }: InfoRowProps) {
  return (
    <div
      className={cn(layout === "inline" ? "flex items-start justify-between gap-4" : "flex flex-col gap-1", className)}
      {...props}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", layout === "inline" && "text-right")}>{value ?? children}</dd>
    </div>
  )
}
