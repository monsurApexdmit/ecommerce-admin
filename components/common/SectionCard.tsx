import * as React from "react"

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SectionCardProps extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Header-right slot (buttons, badges). */
  actions?: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
}

/** Card with optional title/description/actions header and footer. Replaces `rounded-xl border bg-white p-5` panels. */
export function SectionCard({ title, description, actions, footer, className, contentClassName, children, ...props }: SectionCardProps) {
  const hasHeader = title || description || actions
  return (
    <Card className={className} {...props}>
      {hasHeader && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
      {footer && <CardFooter className="gap-2">{footer}</CardFooter>}
    </Card>
  )
}
