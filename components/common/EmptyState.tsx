import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Button(s) shown under the text. */
  action?: React.ReactNode
  /** Adds a dashed border (for empty panels/drop areas). */
  bordered?: boolean
  className?: string
}

/** Icon + title + description + action, built on shadcn Empty. Replaces ad-hoc "No items yet" blocks. */
export function EmptyState({ icon: Icon, title, description, action, bordered, className }: EmptyStateProps) {
  return (
    <Empty className={cn(bordered && "border", className)}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        )}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
