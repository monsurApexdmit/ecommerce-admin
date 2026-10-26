"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface WithTooltipProps {
  /** Tooltip text; when empty the child renders without a tooltip. */
  content?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  /** A single focusable element (Button, Link, Badge…). Wrap disabled buttons in a `<span tabIndex={0}>`. */
  children: React.ReactElement
}

/** Wraps one element with a shadcn Tooltip. Replaces native `title="…"` hover hints. */
export function WithTooltip({ content, side, children }: WithTooltipProps) {
  if (content == null || content === "") return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  )
}

interface TooltipIconProps {
  content: React.ReactNode
  /** Accessible name for the icon button (default "More info"). */
  label?: string
  icon?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
}

/** Small ghost icon button (Info icon by default) that shows a tooltip — for inline help next to labels. */
export function TooltipIcon({ content, label = "More info", icon, side, className }: TooltipIconProps) {
  return (
    <WithTooltip content={content} side={side}>
      <Button type="button" variant="ghost" size="icon" aria-label={label} className={className ?? "size-6"}>
        {icon ?? <Info />}
      </Button>
    </WithTooltip>
  )
}
